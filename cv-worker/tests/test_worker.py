import argparse
import json
import os
import time
from pathlib import Path

from PIL import Image

import worker
from worker import (
    Job,
    ProcessResult,
    discover_jobs,
    job_options_key,
    outputs_exist,
    process_once,
    run_job,
    watch_loop,
    worker_lock,
)


def make_image(path: Path, size: tuple[int, int] = (800, 400)) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", size, (30, 60, 90)).save(path)
    return path


def make_args(**overrides) -> argparse.Namespace:
    values = {
        "preview_width": 1024,
        "max_width": 4096,
        "quality_full": 85,
        "quality_preview": 75,
        "no_crop": True,
        "public_prefix": "/uploads/panoramas",
        "settle_seconds": 0.0,
        "floor_id": "",
        "x": 0.0,
        "y": 0.0,
        "yaw_offset": 0.0,
        "hotspots_file": None,
        "confidence_thresh": 1.0,
        "no_wave_correction": False,
        "registration_resol": 0.6,
        "seam_resol": 0.1,
        "compositing_resol": 1.0,
        "prune": False,
        "once": False,
        "interval": 0.0,
    }
    values.update(overrides)
    return argparse.Namespace(**values)


def test_discover_jobs_skips_output_and_single_frame_dirs(tmp_path):
    input_dir = tmp_path / "uploads"
    output_dir = input_dir / "panoramas"
    output_dir.mkdir(parents=True)

    make_image(input_dir / "ready.png")
    make_image(input_dir / "panoramas" / "old.png")
    make_image(input_dir / "stitch_me" / "f1.jpg")
    make_image(input_dir / "stitch_me" / "f2.jpg")
    make_image(input_dir / "single" / "f1.jpg")

    jobs = discover_jobs(input_dir, output_dir)
    names = {(job.kind, job.name) for job in jobs}

    assert names == {("compress", "ready"), ("stitch", "stitch_me")}


def test_discover_jobs_disambiguates_collisions(tmp_path):
    input_dir = tmp_path / "uploads"
    output_dir = tmp_path / "panoramas"
    input_dir.mkdir()

    make_image(input_dir / "a.png")
    make_image(input_dir / "a.jpg")
    make_image(input_dir / "lobby.jpg")
    make_image(input_dir / "lobby" / "f1.jpg")
    make_image(input_dir / "lobby" / "f2.jpg")

    jobs = discover_jobs(input_dir, output_dir)
    names = [job.name for job in jobs]

    assert len(names) == len(set(names)) == 4
    assert "a__png" in names
    assert "a__jpg" in names
    assert "lobby__jpg" in names
    assert "lobby__stitch" in names


def test_process_once_writes_distinct_outputs_for_collisions(tmp_path):
    input_dir = tmp_path / "uploads"
    output_dir = tmp_path / "panoramas"
    make_image(input_dir / "a.png")
    make_image(input_dir / "a.jpg")

    assert process_once(input_dir, output_dir, make_args()).processed == 2

    assert outputs_exist(output_dir, "a__png")
    assert outputs_exist(output_dir, "a__jpg")
    index = json.loads((output_dir / "index.json").read_text(encoding="utf-8"))
    assert {item["id"] for item in index["panoramas"]} == {"a__png", "a__jpg"}


def test_outputs_exist_requires_valid_full_preview_and_manifest(tmp_path):
    assert not outputs_exist(tmp_path, "lobby")

    (tmp_path / "lobby.webp").write_bytes(b"x")
    (tmp_path / "lobby_preview.webp").write_bytes(b"x")
    (tmp_path / "lobby.json").write_text(json.dumps({"id": "lobby"}), encoding="utf-8")
    assert outputs_exist(tmp_path, "lobby")

    (tmp_path / "lobby.json").write_text("not json", encoding="utf-8")
    assert not outputs_exist(tmp_path, "lobby")


def test_fingerprint_changes_with_compression_options(tmp_path):
    frame = make_image(tmp_path / "lobby.png")
    job = Job("compress", "lobby", [frame])

    assert job.fingerprint("a") != job.fingerprint("b")


def test_fingerprint_changes_with_metadata_and_hotspots(tmp_path):
    frame = make_image(tmp_path / "lobby.png")
    job = Job("compress", "lobby", [frame], source="lobby.png")
    base = make_args(floor_id="floor-1", x=100, y=200)

    assert job_options_key(base, job) != job_options_key(
        make_args(floor_id="floor-2", x=100, y=200), job
    )
    assert job_options_key(base, job) != job_options_key(
        make_args(floor_id="floor-1", x=100, y=200, public_prefix="/other"), job
    )

    without_hotspot = job_options_key(base, job)
    (tmp_path / "lobby.hotspots.json").write_text(
        json.dumps([{"id": "h1", "yaw": 0, "pitch": 0, "type": "info", "text": "A"}]),
        encoding="utf-8",
    )
    with_hotspot = job_options_key(base, job)
    assert with_hotspot != without_hotspot

    (tmp_path / "lobby.hotspots.json").write_text(
        json.dumps([{"id": "h2", "yaw": 10, "pitch": 0, "type": "info", "text": "B"}]),
        encoding="utf-8",
    )
    assert job_options_key(base, job) != with_hotspot


def test_fingerprint_includes_stitching_options(tmp_path):
    frames = [make_image(tmp_path / "f1.jpg"), make_image(tmp_path / "f2.jpg")]
    job = Job("stitch", "lobby", frames, source="lobby")

    assert job_options_key(make_args(confidence_thresh=1.0), job) != job_options_key(
        make_args(confidence_thresh=2.0), job
    )
    assert job_options_key(make_args(seam_resol=0.1), job) != job_options_key(
        make_args(seam_resol=0.2), job
    )


def test_job_is_settled_only_after_quiet_period(tmp_path):
    frame = make_image(tmp_path / "lobby.png")
    job = Job("compress", "lobby", [frame])

    os.utime(frame, (time.time() - 10, time.time() - 10))
    assert job.is_settled(2.0)

    os.utime(frame, None)
    assert not job.is_settled(60.0)


def test_process_once_rebuilds_missing_outputs(tmp_path):
    input_dir = tmp_path / "uploads"
    output_dir = tmp_path / "panoramas"
    make_image(input_dir / "lobby.png")
    args = make_args()

    first = process_once(input_dir, output_dir, args)
    assert first == ProcessResult(processed=1)
    assert outputs_exist(output_dir, "lobby")
    assert process_once(input_dir, output_dir, args).processed == 0

    (output_dir / "lobby_preview.webp").unlink()
    assert process_once(input_dir, output_dir, args).processed == 1


def test_process_once_rebuilds_when_options_change(tmp_path):
    input_dir = tmp_path / "uploads"
    output_dir = tmp_path / "panoramas"
    make_image(input_dir / "lobby.png", (2000, 1000))

    assert process_once(input_dir, output_dir, make_args(max_width=4096)).processed == 1
    assert process_once(input_dir, output_dir, make_args(max_width=1024)).processed == 1


def test_process_once_rebuilds_when_metadata_changes(tmp_path):
    input_dir = tmp_path / "uploads"
    output_dir = tmp_path / "panoramas"
    make_image(input_dir / "lobby.png")

    process_once(input_dir, output_dir, make_args(floor_id="floor-1", x=600, y=400))
    manifest = json.loads((output_dir / "lobby.json").read_text(encoding="utf-8"))
    assert manifest["floorId"] == "floor-1"
    assert manifest["x"] == 600
    assert manifest["y"] == 400

    process_once(input_dir, output_dir, make_args(floor_id="floor-2", x=10, y=20))
    manifest = json.loads((output_dir / "lobby.json").read_text(encoding="utf-8"))
    assert manifest["floorId"] == "floor-2"
    assert manifest["x"] == 10
    assert manifest["y"] == 20


def test_process_once_rebuilds_when_hotspots_change(tmp_path):
    input_dir = tmp_path / "uploads"
    output_dir = tmp_path / "panoramas"
    make_image(input_dir / "lobby.png")
    args = make_args()

    process_once(input_dir, output_dir, args)
    manifest = json.loads((output_dir / "lobby.json").read_text(encoding="utf-8"))
    assert manifest["hotspots"] == []

    hotspots = [{"id": "h1", "yaw": 10, "pitch": 0, "type": "info", "text": "Вход"}]
    (input_dir / "lobby.hotspots.json").write_text(
        json.dumps(hotspots, ensure_ascii=False),
        encoding="utf-8",
    )

    assert process_once(input_dir, output_dir, args).processed == 1
    manifest = json.loads((output_dir / "lobby.json").read_text(encoding="utf-8"))
    assert manifest["hotspots"] == hotspots


def test_process_once_writes_index(tmp_path):
    input_dir = tmp_path / "uploads"
    output_dir = tmp_path / "panoramas"
    make_image(input_dir / "lobby.png")

    process_once(input_dir, output_dir, make_args())

    index = json.loads((output_dir / "index.json").read_text(encoding="utf-8"))
    assert index["count"] == 1
    assert index["panoramas"][0]["id"] == "lobby"


def test_manifest_has_no_internal_paths(tmp_path):
    input_dir = tmp_path / "uploads"
    output_dir = tmp_path / "panoramas"
    make_image(input_dir / "lobby.png")

    process_once(input_dir, output_dir, make_args())

    manifest = json.loads((output_dir / "lobby.json").read_text(encoding="utf-8"))
    for field in ("full", "preview", "source", "sourceFrames"):
        assert field not in manifest
    assert manifest["url"] == "/uploads/panoramas/lobby.webp"
    assert manifest["previewUrl"] == "/uploads/panoramas/lobby_preview.webp"
    assert "createdAt" in manifest


def test_process_once_continues_after_job_failure(tmp_path, monkeypatch):
    input_dir = tmp_path / "uploads"
    output_dir = tmp_path / "panoramas"
    make_image(input_dir / "aaa" / "f1.jpg")
    make_image(input_dir / "aaa" / "f2.jpg")
    make_image(input_dir / "zzz.png")

    def boom(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(worker, "stitch_and_compress", boom)

    result = process_once(input_dir, output_dir, make_args())

    assert result.failed == 1
    assert result.processed == 1
    assert (output_dir / "zzz.webp").exists()


def test_watch_once_returns_nonzero_on_failure(tmp_path):
    input_dir = tmp_path / "uploads"
    output_dir = tmp_path / "panoramas"
    make_image(input_dir / "bad" / "f1.jpg")
    (input_dir / "bad" / "f2.jpg").write_bytes(b"not an image")

    args = make_args(once=True)
    assert watch_loop(input_dir, output_dir, args) == 1
    assert (output_dir / worker.HEARTBEAT_FILE).exists()


def test_watch_once_returns_zero_on_success(tmp_path):
    input_dir = tmp_path / "uploads"
    output_dir = tmp_path / "panoramas"
    make_image(input_dir / "lobby.png")

    assert watch_loop(input_dir, output_dir, make_args(once=True)) == 0


def test_prune_removes_outputs_after_source_disappears(tmp_path):
    input_dir = tmp_path / "uploads"
    output_dir = tmp_path / "panoramas"
    source = make_image(input_dir / "lobby.png")

    process_once(input_dir, output_dir, make_args())
    assert outputs_exist(output_dir, "lobby")

    source.unlink()
    result = process_once(input_dir, output_dir, make_args(prune=True))

    assert result.pruned == 3
    assert not outputs_exist(output_dir, "lobby")
    index = json.loads((output_dir / "index.json").read_text(encoding="utf-8"))
    assert index["count"] == 0


def test_worker_lock_is_exclusive(tmp_path):
    with worker_lock(tmp_path) as first:
        assert first
        with worker_lock(tmp_path) as second:
            assert not second
    with worker_lock(tmp_path) as again:
        assert again


def test_load_state_ignores_non_object(tmp_path):
    (tmp_path / worker.STATE_FILE).write_text("[]", encoding="utf-8")

    assert worker.load_state(tmp_path) == {}


def test_run_job_passes_stitch_options_and_hotspots(tmp_path, monkeypatch):
    frames_dir = tmp_path / "lobby"
    frames = [
        make_image(frames_dir / "f1.jpg"),
        make_image(frames_dir / "f2.jpg"),
    ]
    hotspots = [{"id": "h1", "yaw": 10, "pitch": 0, "type": "info", "text": "Вход"}]
    (frames_dir / "hotspots.json").write_text(
        json.dumps(hotspots, ensure_ascii=False),
        encoding="utf-8",
    )

    captured = {}

    def fake_stitch(frames, output_dir, name, *, stitch_options=None, **kwargs):
        captured["stitch_options"] = stitch_options
        return {
            "width": 2000,
            "height": 1000,
            "previewWidth": 1024,
            "previewHeight": 512,
            "full": str(Path(output_dir) / f"{name}.webp"),
            "preview": str(Path(output_dir) / f"{name}_preview.webp"),
            "bytes": {"full": 0, "preview": 0},
            "type": "panorama",
            "sourceFrames": [str(path) for path in frames],
        }

    monkeypatch.setattr(worker, "stitch_and_compress", fake_stitch)
    args = make_args(
        confidence_thresh=1.5,
        seam_resol=0.2,
        floor_id="floor-1",
        x=600,
        y=400,
    )

    manifest = run_job(Job("stitch", "lobby", frames), tmp_path / "out", args)

    assert captured["stitch_options"]["confidence_thresh"] == 1.5
    assert captured["stitch_options"]["seam_resol"] == 0.2
    assert captured["stitch_options"]["wave_correction"] is True
    assert manifest["hotspots"] == hotspots
    assert manifest["floorId"] == "floor-1"
    assert manifest["url"] == "/uploads/panoramas/lobby.webp"
    assert manifest["sourceFramesCount"] == 2
    assert "sourceFrames" not in manifest

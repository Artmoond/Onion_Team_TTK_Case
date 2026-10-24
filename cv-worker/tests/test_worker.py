import argparse
import os
import time
from pathlib import Path

from PIL import Image

from worker import (
    Job,
    discover_jobs,
    outputs_exist,
    process_once,
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


def test_outputs_exist_requires_full_preview_and_manifest(tmp_path):
    assert not outputs_exist(tmp_path, "lobby")

    for filename in ("lobby.webp", "lobby_preview.webp", "lobby.json"):
        (tmp_path / filename).write_text("x")

    assert outputs_exist(tmp_path, "lobby")


def test_fingerprint_changes_with_compression_options(tmp_path):
    frame = make_image(tmp_path / "lobby.png")
    job = Job("compress", "lobby", [frame])

    assert job.fingerprint("a") != job.fingerprint("b")


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

    assert process_once(input_dir, output_dir, args) == 1
    assert outputs_exist(output_dir, "lobby")
    assert process_once(input_dir, output_dir, args) == 0

    (output_dir / "lobby_preview.webp").unlink()
    assert process_once(input_dir, output_dir, args) == 1


def test_process_once_rebuilds_when_options_change(tmp_path):
    input_dir = tmp_path / "uploads"
    output_dir = tmp_path / "panoramas"
    make_image(input_dir / "lobby.png", (2000, 1000))

    assert process_once(input_dir, output_dir, make_args(max_width=4096)) == 1
    assert process_once(input_dir, output_dir, make_args(max_width=1024)) == 1

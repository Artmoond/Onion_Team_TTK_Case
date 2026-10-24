"""CLI и фоновый воркер обработки панорам.

Примеры:
    python worker.py compress pano.jpg -o /app/uploads/panoramas
    python worker.py stitch frame1.jpg frame2.jpg -n lobby -o /app/uploads/panoramas
    python worker.py watch -i /app/uploads -o /app/uploads/panoramas
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import signal
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

from stitcher import (
    DEFAULT_MAX_WIDTH,
    DEFAULT_PREVIEW_WIDTH,
    DEFAULT_QUALITY_FULL,
    DEFAULT_QUALITY_PREVIEW,
    PANORAMA_ASPECT,
    StitchingError,
    build_manifest,
    compress_panorama,
    is_supported_image,
    iter_images,
    stitch_and_compress,
    write_manifest,
)

LOG = logging.getLogger("cv-worker")

STATE_FILE = ".cv-worker-state.json"
DEFAULT_SETTLE_SECONDS = 2.0


@dataclass
class Job:
    kind: str
    name: str
    frames: list[Path]

    def fingerprint(self, options_key: str = "") -> str:
        parts = []
        for path in self.frames:
            stat = path.stat()
            parts.append(f"{path.name}:{stat.st_size}:{int(stat.st_mtime)}")
        parts.append(f"options:{options_key}")
        return "|".join(parts)

    def is_settled(self, settle_seconds: float) -> bool:
        if settle_seconds <= 0:
            return True
        now = time.time()
        try:
            return all(now - path.stat().st_mtime >= settle_seconds for path in self.frames)
        except OSError:
            return False


def outputs_exist(output_dir: Path, name: str) -> bool:
    return all(
        (output_dir / filename).exists()
        for filename in (f"{name}.webp", f"{name}_preview.webp", f"{name}.json")
    )


def load_state(output_dir: Path) -> dict:
    path = output_dir / STATE_FILE
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        LOG.warning("не удалось прочитать %s, состояние сброшено", path)
        return {}


def save_state(output_dir: Path, state: dict) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / STATE_FILE
    path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def discover_jobs(input_dir: Path, output_dir: Path) -> list[Job]:
    if not input_dir.exists():
        return []

    output_resolved = output_dir.resolve()
    jobs: list[Job] = []

    for entry in sorted(input_dir.iterdir()):
        if entry.name.startswith("."):
            continue
        try:
            if entry.resolve() == output_resolved:
                continue
        except OSError:
            continue

        if entry.is_dir():
            frames = list(iter_images(entry))
            if len(frames) >= 2:
                jobs.append(Job("stitch", entry.name, frames))
            continue

        if entry.is_file() and is_supported_image(entry) and not entry.stem.endswith("_preview"):
            jobs.append(Job("compress", entry.stem, [entry]))

    return jobs


def compression_options(args: argparse.Namespace) -> dict:
    return {
        "preview_width": args.preview_width,
        "max_width": args.max_width,
        "quality_full": args.quality_full,
        "quality_preview": args.quality_preview,
        "force_aspect": None if args.no_crop else PANORAMA_ASPECT,
    }


def run_job(job: Job, output_dir: Path, args: argparse.Namespace) -> dict:
    options = compression_options(args)
    if job.kind == "stitch":
        result = stitch_and_compress(job.frames, output_dir, job.name, **options)
    else:
        result = compress_panorama(job.frames[0], output_dir, **options)

    manifest = build_manifest(result, args.public_prefix)
    write_manifest(output_dir, job.name, manifest)
    return manifest


def process_once(input_dir: Path, output_dir: Path, args: argparse.Namespace) -> int:
    output_dir.mkdir(parents=True, exist_ok=True)
    state = load_state(output_dir)
    processed = 0

    options_key = json.dumps(compression_options(args), sort_keys=True, default=str)
    settle_seconds = getattr(args, "settle_seconds", 0.0)

    for job in discover_jobs(input_dir, output_dir):
        fingerprint = job.fingerprint(options_key)
        key = f"{job.kind}:{job.name}"
        if state.get(key) == fingerprint and outputs_exist(output_dir, job.name):
            continue

        if not job.is_settled(settle_seconds):
            LOG.debug("откладываю %s: файлы ещё обновляются", job.name)
            continue

        LOG.info("задача %s: %s (%d кадр.)", job.kind, job.name, len(job.frames))
        try:
            manifest = run_job(job, output_dir, args)
        except (StitchingError, OSError, ValueError) as exc:
            LOG.error("ошибка %s: %s", job.name, exc)
            continue

        state[key] = fingerprint
        save_state(output_dir, state)
        processed += 1
        LOG.info(
            "готово %s: %sx%s, preview=%s",
            manifest["id"],
            manifest["width"],
            manifest["height"],
            manifest["preview"],
        )

    return processed


def watch_loop(input_dir: Path, output_dir: Path, args: argparse.Namespace) -> int:
    running = True

    def stop(signum, frame):
        nonlocal running
        LOG.info("получен сигнал %s, останавливаюсь", signum)
        running = False

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)

    LOG.info("наблюдаю %s -> %s (интервал %s c)", input_dir, output_dir, args.interval)
    while running:
        try:
            process_once(input_dir, output_dir, args)
        except Exception:
            LOG.exception("непредвиденная ошибка цикла")
        if args.once:
            break
        deadline = time.monotonic() + args.interval
        while running and time.monotonic() < deadline:
            time.sleep(min(0.5, max(0.0, deadline - time.monotonic())))
    return 0


def add_compression_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--preview-width", type=int, default=DEFAULT_PREVIEW_WIDTH)
    parser.add_argument("--max-width", type=int, default=DEFAULT_MAX_WIDTH)
    parser.add_argument("--quality-full", type=int, default=DEFAULT_QUALITY_FULL)
    parser.add_argument("--quality-preview", type=int, default=DEFAULT_QUALITY_PREVIEW)
    parser.add_argument("--no-crop", action="store_true", help="не обрезать под 2:1")
    parser.add_argument(
        "--public-prefix",
        default=os.getenv("CV_PUBLIC_PREFIX", ""),
        help="префикс URL для манифеста, например /uploads/panoramas",
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="worker.py",
        description="Сшивка панорам и подготовка WebP (full + preview)",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    compress = subparsers.add_parser("compress", help="сжать готовые панорамы в WebP")
    compress.add_argument("images", nargs="+", type=Path)
    compress.add_argument("-o", "--output-dir", type=Path, default=Path("panoramas"))
    add_compression_args(compress)

    stitch = subparsers.add_parser("stitch", help="сшить кадры и сжать результат")
    stitch.add_argument("frames", nargs="+", type=Path)
    stitch.add_argument("-n", "--name", required=True)
    stitch.add_argument("-o", "--output-dir", type=Path, default=Path("panoramas"))
    add_compression_args(stitch)

    watch = subparsers.add_parser("watch", help="следить за папкой загрузок")
    watch.add_argument(
        "-i",
        "--input-dir",
        type=Path,
        default=Path(os.getenv("CV_INPUT_DIR", "/app/uploads")),
    )
    watch.add_argument(
        "-o",
        "--output-dir",
        type=Path,
        default=Path(os.getenv("CV_OUTPUT_DIR", "/app/uploads/panoramas")),
    )
    watch.add_argument(
        "--interval",
        type=float,
        default=float(os.getenv("CV_WATCH_INTERVAL", "5")),
    )
    watch.add_argument(
        "--settle-seconds",
        type=float,
        default=float(os.getenv("CV_SETTLE_SECONDS", str(DEFAULT_SETTLE_SECONDS))),
        help="не брать файлы, изменённые менее N секунд назад (0 — отключить)",
    )
    watch.add_argument("--once", action="store_true", help="один проход и выход")
    add_compression_args(watch)

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    logging.basicConfig(
        level=os.getenv("CV_LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(message)s",
    )
    args = build_parser().parse_args(argv)

    if args.command == "compress":
        args.output_dir.mkdir(parents=True, exist_ok=True)
        failures = 0
        for image in args.images:
            try:
                result = compress_panorama(image, args.output_dir, **compression_options(args))
                manifest = build_manifest(result, args.public_prefix)
                write_manifest(args.output_dir, image.stem, manifest)
                LOG.info("готово %s -> %s", image, manifest["full"])
            except (OSError, ValueError) as exc:
                failures += 1
                LOG.error("ошибка %s: %s", image, exc)
        return 1 if failures else 0

    if args.command == "stitch":
        try:
            result = stitch_and_compress(
                args.frames, args.output_dir, args.name, **compression_options(args)
            )
            manifest = build_manifest(result, args.public_prefix)
            write_manifest(args.output_dir, args.name, manifest)
            LOG.info("готово %s -> %s", args.name, manifest["full"])
            return 0
        except (StitchingError, OSError, ValueError) as exc:
            LOG.error("ошибка сшивки %s: %s", args.name, exc)
            return 1

    if args.command == "watch":
        return watch_loop(args.input_dir, args.output_dir, args)

    return 2


if __name__ == "__main__":
    sys.exit(main())

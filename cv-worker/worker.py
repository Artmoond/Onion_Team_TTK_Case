"""CLI и фоновый воркер обработки панорам.

Примеры:
    python worker.py compress pano.jpg -o /app/uploads/panoramas
    python worker.py stitch frame1.jpg frame2.jpg -n lobby -o /app/uploads/panoramas
    python worker.py watch -i /app/uploads -o /app/uploads/panoramas

В режиме ``watch --once`` воркер возвращает ненулевой код, если хотя бы одна
задача завершилась ошибкой. Постоянный ``watch`` продолжает работу после
ошибок, чтобы один битый файл не останавливал обработку всей папки.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import signal
import sys
import time
from collections import Counter
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, Sequence

try:  # pragma: no cover - fcntl есть на Linux/macOS, которых достаточно для Docker
    import fcntl
except ImportError:  # pragma: no cover
    fcntl = None

from stitcher import (
    DEFAULT_COMPOSITING_RESOL,
    DEFAULT_CONFIDENCE_THRESH,
    DEFAULT_MAX_WIDTH,
    DEFAULT_PREVIEW_WIDTH,
    DEFAULT_QUALITY_FULL,
    DEFAULT_QUALITY_PREVIEW,
    DEFAULT_REGISTRATION_RESOL,
    DEFAULT_SEAM_RESOL,
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
INDEX_FILE = "index.json"
LOCK_FILE = ".cv-worker.lock"
HEARTBEAT_FILE = ".cv-worker-heartbeat"
DEFAULT_SETTLE_SECONDS = 2.0

# Меняется при несовместимом изменении формата манифеста/состояния.
MANIFEST_SCHEMA = 2


@dataclass
class Job:
    kind: str
    name: str
    frames: list[Path]
    source: str = ""

    def fingerprint(self, options_key: str = "") -> str:
        parts = [f"source:{self.source or self.name}"]
        for path in self.frames:
            stat = path.stat()
            parts.append(f"{path.name}:{stat.st_size}:{stat.st_mtime_ns}")
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


@dataclass
class ProcessResult:
    processed: int = 0
    failed: int = 0
    pruned: int = 0

    @property
    def ok(self) -> bool:
        return self.failed == 0


def _safe_component(name: str) -> str:
    """Не даёт имени задачи выйти за пределы output_dir."""
    value = str(name)
    if (
        not value
        or value in {".", ".."}
        or "/" in value
        or "\\" in value
        or Path(value).name != value
    ):
        raise ValueError(f"недопустимое имя результата: {name!r}")
    return value


def outputs_exist(output_dir: Path, name: str) -> bool:
    paths = [
        output_dir / f"{name}.webp",
        output_dir / f"{name}_preview.webp",
        output_dir / f"{name}.json",
    ]
    if not all(path.exists() and path.stat().st_size > 0 for path in paths):
        return False
    try:
        manifest = json.loads(paths[2].read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False
    return isinstance(manifest, dict) and manifest.get("id") == name


def load_state(output_dir: Path) -> dict:
    path = output_dir / STATE_FILE
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        LOG.warning("не удалось прочитать %s, состояние сброшено", path)
        return {}
    if not isinstance(data, dict):
        LOG.warning("%s: ожидается JSON-объект, состояние сброшено", path)
        return {}
    return data


def save_state(output_dir: Path, state: dict) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / STATE_FILE
    tmp_path = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    try:
        tmp_path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp_path, path)
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except OSError:
            pass


def _candidate_name(kind: str, base: str, source: str) -> str:
    if kind == "stitch":
        return f"{base}__stitch"
    extension = Path(source).suffix.lower().lstrip(".")
    return f"{base}__{extension or 'img'}"


def _assign_unique_names(candidates: list[tuple[str, str, str, list[Path]]]) -> list[Job]:
    """Строит задачи, разводя одинаковые имена источников.

    ``a.jpg`` и ``a.png`` не должны перезаписывать друг друга, а папка
    ``lobby`` не должна конфликтовать с файлом ``lobby.jpg``.
    """
    counts = Counter(base for _, base, _, _ in candidates)
    used: set[str] = set()
    jobs: list[Job] = []

    for kind, base, source, frames in candidates:
        name = base if counts[base] == 1 else _candidate_name(kind, base, source)
        if name in used:
            index = 2
            while f"{name}_{index}" in used:
                index += 1
            name = f"{name}_{index}"
        if name != base:
            LOG.warning("коллизия имён: %s -> %s", base, name)
        name = _safe_component(name)
        used.add(name)
        jobs.append(Job(kind, name, frames, source=source))

    return jobs


def discover_jobs(input_dir: Path, output_dir: Path) -> list[Job]:
    if not input_dir.exists():
        return []

    output_resolved = output_dir.resolve()
    candidates: list[tuple[str, str, str, list[Path]]] = []

    for entry in sorted(input_dir.iterdir()):
        if entry.name.startswith("."):
            continue
        try:
            if entry.resolve() == output_resolved:
                continue
        except OSError:
            continue

        try:
            _safe_component(entry.name)
        except ValueError:
            LOG.warning("пропуск небезопасного имени: %s", entry.name)
            continue

        if entry.is_dir():
            frames = list(iter_images(entry))
            if len(frames) >= 2:
                candidates.append(("stitch", entry.name, entry.name, frames))
            continue

        if entry.is_file() and is_supported_image(entry) and not entry.stem.endswith("_preview"):
            candidates.append(("compress", entry.stem, entry.name, [entry]))

    return _assign_unique_names(candidates)


def make_compress_jobs(images: Sequence[Path]) -> list[Job]:
    candidates = [
        ("compress", image.stem, image.name, [image])
        for image in images
    ]
    return _assign_unique_names(candidates)


def compression_options(args: argparse.Namespace) -> dict:
    return {
        "preview_width": args.preview_width,
        "max_width": args.max_width,
        "quality_full": args.quality_full,
        "quality_preview": args.quality_preview,
        "force_aspect": None if args.no_crop else PANORAMA_ASPECT,
    }


def stitching_options(args: argparse.Namespace) -> dict:
    return {
        "confidence_thresh": getattr(args, "confidence_thresh", DEFAULT_CONFIDENCE_THRESH),
        "wave_correction": not getattr(args, "no_wave_correction", False),
        "registration_resol": getattr(args, "registration_resol", DEFAULT_REGISTRATION_RESOL),
        "seam_resol": getattr(args, "seam_resol", DEFAULT_SEAM_RESOL),
        "compositing_resol": getattr(args, "compositing_resol", DEFAULT_COMPOSITING_RESOL),
    }


def hotspots_path(args: argparse.Namespace, job: Job) -> Path:
    explicit = getattr(args, "hotspots_file", None)
    if explicit is not None:
        return Path(explicit)

    frame_dir = job.frames[0].parent
    if job.kind == "stitch":
        return frame_dir / "hotspots.json"
    # Для сжатия имя хотспотов привязано к исходному файлу, а не к результату:
    # при коллизии имён результат может называться a__png, а файл — a.hotspots.json.
    return frame_dir / f"{job.frames[0].stem}.hotspots.json"


def hotspots_reference(args: argparse.Namespace, job: Job) -> dict | None:
    """Описывает хотспоты для fingerprint без их полного содержимого."""
    path = hotspots_path(args, job)
    explicit = getattr(args, "hotspots_file", None)
    if not path.exists():
        if explicit is not None:
            return {"missing": True, "name": path.name}
        return None

    try:
        stat = path.stat()
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
    except OSError as exc:
        return {"error": str(exc), "name": path.name}
    return {
        "name": path.name,
        "size": stat.st_size,
        "sha256": digest,
    }


def load_hotspots(args: argparse.Namespace, job: Job) -> list:
    path = hotspots_path(args, job)
    explicit = getattr(args, "hotspots_file", None)
    if not path.exists():
        if explicit is not None:
            raise ValueError(f"файл хотспотов не найден: {path}")
        return []

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"не удалось прочитать хотспоты {path}: {exc}") from exc
    if not isinstance(data, list) or not all(isinstance(item, dict) for item in data):
        raise ValueError(f"{path}: ожидается JSON-массив объектов")
    return data


def manifest_options(args: argparse.Namespace, job: Job) -> dict:
    return {
        "public_prefix": getattr(args, "public_prefix", ""),
        "floorId": str(getattr(args, "floor_id", "") or ""),
        "x": float(getattr(args, "x", 0) or 0),
        "y": float(getattr(args, "y", 0) or 0),
        "yawOffset": float(getattr(args, "yaw_offset", 0) or 0),
        "hotspots": hotspots_reference(args, job),
    }


def job_options_key(args: argparse.Namespace, job: Job) -> str:
    data = {
        "schema": MANIFEST_SCHEMA,
        "compression": compression_options(args),
        "manifest": manifest_options(args, job),
    }
    if job.kind == "stitch":
        data["stitching"] = stitching_options(args)
    return json.dumps(data, sort_keys=True, ensure_ascii=False, default=str)


def manifest_metadata(args: argparse.Namespace, job: Job) -> dict:
    return {
        "floorId": str(getattr(args, "floor_id", "") or ""),
        "x": float(getattr(args, "x", 0) or 0),
        "y": float(getattr(args, "y", 0) or 0),
        "yawOffset": float(getattr(args, "yaw_offset", 0) or 0),
        "hotspots": load_hotspots(args, job),
    }


def run_job(job: Job, output_dir: Path, args: argparse.Namespace) -> dict:
    options = compression_options(args)
    if job.kind == "stitch":
        result = stitch_and_compress(
            job.frames,
            output_dir,
            job.name,
            stitch_options=stitching_options(args),
            **options,
        )
    else:
        result = compress_panorama(job.frames[0], output_dir, name=job.name, **options)

    manifest = build_manifest(
        result,
        args.public_prefix,
        metadata=manifest_metadata(args, job),
    )
    write_manifest(output_dir, job.name, manifest)
    return manifest


def build_index(output_dir: Path) -> dict:
    panoramas = []
    for path in sorted(output_dir.glob("*.json")):
        if path.name in (INDEX_FILE, STATE_FILE):
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            LOG.warning("пропуск битого манифеста %s", path)
            continue
        if isinstance(data, dict) and data.get("id") and data.get("url"):
            panoramas.append(data)

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "count": len(panoramas),
        "panoramas": panoramas,
    }


def write_index(output_dir: Path) -> Path:
    path = output_dir / INDEX_FILE
    tmp_path = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    try:
        tmp_path.write_text(
            json.dumps(build_index(output_dir), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        os.replace(tmp_path, path)
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except OSError:
            pass
    return path


def prune_stale(output_dir: Path, state: dict, jobs: list[Job]) -> int:
    """Удаляет результаты задач, исходники которых больше не найдены.

    Работает только по записям в state-файле, то есть не трогает файлы,
    положенные в output_dir вручную. Включается флагом ``--prune``.
    """
    active = {f"{job.kind}:{job.name}" for job in jobs}
    removed = 0

    for key in list(state):
        if key in active:
            continue
        if ":" not in key:
            del state[key]
            continue
        _, name = key.split(":", 1)
        try:
            name = _safe_component(name)
        except ValueError:
            LOG.warning("пропускаю небезопасный ключ состояния %s", key)
            continue

        failed = False
        for path in (
            output_dir / f"{name}.json",
            output_dir / f"{name}.webp",
            output_dir / f"{name}_preview.webp",
        ):
            try:
                path.unlink()
                removed += 1
            except FileNotFoundError:
                pass
            except OSError as exc:
                failed = True
                LOG.warning("не удалось удалить %s: %s", path, exc)
        if not failed:
            del state[key]

    return removed


def process_once(input_dir: Path, output_dir: Path, args: argparse.Namespace) -> ProcessResult:
    output_dir.mkdir(parents=True, exist_ok=True)
    state = load_state(output_dir)
    result = ProcessResult()
    jobs = discover_jobs(input_dir, output_dir)

    if getattr(args, "prune", False) and input_dir.exists():
        removed = prune_stale(output_dir, state, jobs)
        if removed:
            result.pruned = removed
            save_state(output_dir, state)
            LOG.info("удалено устаревших файлов: %d", removed)

    settle_seconds = getattr(args, "settle_seconds", 0.0)

    for job in jobs:
        key = f"{job.kind}:{job.name}"
        try:
            fingerprint = job.fingerprint(job_options_key(args, job))
            if state.get(key) == fingerprint and outputs_exist(output_dir, job.name):
                continue

            if not job.is_settled(settle_seconds):
                LOG.debug("откладываю %s: файлы ещё обновляются", job.name)
                continue

            LOG.info("задача %s: %s (%d кадр.)", job.kind, job.name, len(job.frames))
            manifest = run_job(job, output_dir, args)
            state[key] = fingerprint
            save_state(output_dir, state)
        except Exception as exc:  # noqa: BLE001 - одна задача не должна ронять весь проход
            result.failed += 1
            LOG.error("ошибка %s (%s): %s", job.name, job.kind, exc)
            LOG.debug("подробности ошибки %s", job.name, exc_info=True)
            continue

        result.processed += 1
        LOG.info(
            "готово %s: %sx%s, preview=%s",
            manifest["id"],
            manifest["width"],
            manifest["height"],
            manifest["previewUrl"],
        )

    write_index(output_dir)
    return result


def write_heartbeat(output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / HEARTBEAT_FILE
    try:
        path.write_text(datetime.now(timezone.utc).isoformat(), encoding="utf-8")
    except OSError as exc:
        LOG.debug("не удалось записать heartbeat: %s", exc)


@contextmanager
def worker_lock(output_dir: Path) -> Iterator[bool]:
    """Неблокирующая блокировка на время прохода.

    Файл блокируется через ``flock``. На платформах без fcntl блокировка
    отключается, чтобы не ломать локальный запуск.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / LOCK_FILE
    try:
        handle = open(path, "a+", encoding="utf-8")
    except OSError as exc:
        LOG.error("не удалось открыть %s: %s", path, exc)
        yield False
        return

    acquired = True
    if fcntl is not None:
        try:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            acquired = False

    if acquired:
        handle.seek(0)
        handle.truncate()
        handle.write(f"{os.getpid()} {datetime.now(timezone.utc).isoformat()}\n")
        handle.flush()

    try:
        yield acquired
    finally:
        if acquired and fcntl is not None:
            try:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
            except OSError:
                pass
        handle.close()


def watch_loop(input_dir: Path, output_dir: Path, args: argparse.Namespace) -> int:
    running = True

    def stop(signum, frame):
        nonlocal running
        LOG.info("получен сигнал %s, останавливаюсь", signum)
        running = False

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)

    LOG.info("наблюдаю %s -> %s (интервал %s c)", input_dir, output_dir, args.interval)
    exit_code = 0

    while running:
        write_heartbeat(output_dir)
        try:
            with worker_lock(output_dir) as acquired:
                if not acquired:
                    LOG.warning(
                        "другой воркер уже обрабатывает %s — пропускаю проход",
                        output_dir,
                    )
                    result = None
                else:
                    result = process_once(input_dir, output_dir, args)

            if result is not None:
                if result.failed:
                    LOG.warning(
                        "проход завершён с ошибками: обработано %d, ошибок %d",
                        result.processed,
                        result.failed,
                    )
                    if args.once:
                        exit_code = 1
                if result.pruned:
                    LOG.info("удалено устаревших результатов: %d", result.pruned)
        except Exception:  # noqa: BLE001 - цикл не должен умирать из-за одного сбоя
            LOG.exception("непредвиденная ошибка цикла")
            if args.once:
                exit_code = 1
        write_heartbeat(output_dir)

        if args.once:
            break
        deadline = time.monotonic() + args.interval
        while running and time.monotonic() < deadline:
            time.sleep(min(0.5, max(0.0, deadline - time.monotonic())))

    return exit_code


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


def add_manifest_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--floor-id", default=os.getenv("CV_FLOOR_ID", ""))
    parser.add_argument("--x", type=float, default=float(os.getenv("CV_X", "0")))
    parser.add_argument("--y", type=float, default=float(os.getenv("CV_Y", "0")))
    parser.add_argument(
        "--yaw-offset",
        type=float,
        default=float(os.getenv("CV_YAW_OFFSET", "0")),
    )
    parser.add_argument(
        "--hotspots-file",
        type=Path,
        default=None,
        help="JSON-массив хотспотов для манифеста (по умолчанию hotspots.json рядом с кадрами)",
    )


def add_stitching_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--confidence-thresh",
        type=float,
        default=float(os.getenv("CV_CONFIDENCE_THRESH", str(DEFAULT_CONFIDENCE_THRESH))),
    )
    parser.add_argument("--no-wave-correction", action="store_true")
    parser.add_argument(
        "--registration-resol",
        type=float,
        default=float(os.getenv("CV_REGISTRATION_RESOL", str(DEFAULT_REGISTRATION_RESOL))),
    )
    parser.add_argument(
        "--seam-resol",
        type=float,
        default=float(os.getenv("CV_SEAM_RESOL", str(DEFAULT_SEAM_RESOL))),
    )
    parser.add_argument(
        "--compositing-resol",
        type=float,
        default=float(os.getenv("CV_COMPOSITING_RESOL", str(DEFAULT_COMPOSITING_RESOL))),
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
    add_manifest_args(compress)

    stitch = subparsers.add_parser("stitch", help="сшить кадры и сжать результат")
    stitch.add_argument("frames", nargs="+", type=Path)
    stitch.add_argument("-n", "--name", required=True)
    stitch.add_argument("-o", "--output-dir", type=Path, default=Path("panoramas"))
    add_compression_args(stitch)
    add_manifest_args(stitch)
    add_stitching_args(stitch)

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
    watch.add_argument(
        "--prune",
        action="store_true",
        help="удалять результаты, исходники которых исчезли",
    )
    add_compression_args(watch)
    add_manifest_args(watch)
    add_stitching_args(watch)

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    logging.basicConfig(
        level=os.getenv("CV_LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(message)s",
    )
    # В контейнере воркер может запускаться без аргументов (старый CMD образа).
    # По умолчанию включаем режим наблюдения, чтобы не падать с кодом 2.
    effective_argv = list(sys.argv[1:] if argv is None else argv)
    if not effective_argv:
        effective_argv = ["watch"]
    args = build_parser().parse_args(effective_argv)

    if args.command == "compress":
        args.output_dir.mkdir(parents=True, exist_ok=True)
        with worker_lock(args.output_dir) as acquired:
            if not acquired:
                LOG.error("не удалось получить блокировку %s", args.output_dir / LOCK_FILE)
                return 1

            try:
                jobs = make_compress_jobs(list(args.images))
            except ValueError as exc:
                LOG.error("некорректное имя файла: %s", exc)
                return 1

            failures = 0
            for job in jobs:
                try:
                    manifest = run_job(job, args.output_dir, args)
                    LOG.info("готово %s -> %s", job.frames[0], manifest["url"])
                except Exception as exc:  # noqa: BLE001
                    failures += 1
                    LOG.error("ошибка %s: %s", job.frames[0], exc)
            try:
                write_index(args.output_dir)
            except OSError as exc:
                LOG.error("не удалось записать %s: %s", INDEX_FILE, exc)
                return 1
        return 1 if failures else 0

    if args.command == "stitch":
        args.output_dir.mkdir(parents=True, exist_ok=True)
        with worker_lock(args.output_dir) as acquired:
            if not acquired:
                LOG.error("не удалось получить блокировку %s", args.output_dir / LOCK_FILE)
                return 1
            try:
                manifest = run_job(
                    Job("stitch", args.name, list(args.frames), source=args.name),
                    args.output_dir,
                    args,
                )
                write_index(args.output_dir)
            except (StitchingError, OSError, ValueError) as exc:
                LOG.error("ошибка сшивки %s: %s", args.name, exc)
                return 1
            except Exception as exc:  # noqa: BLE001 - OpenCV может бросить cv2.error
                LOG.error("непредвиденная ошибка сшивки %s: %s", args.name, exc)
                LOG.debug("подробности", exc_info=True)
                return 1
        LOG.info("готово %s -> %s", args.name, manifest["url"])
        return 0

    if args.command == "watch":
        return watch_loop(args.input_dir, args.output_dir, args)

    return 2


if __name__ == "__main__":
    sys.exit(main())

"""Ядро CV-обработки панорам: сшивка кадров и подготовка WebP.

Модуль не содержит побочных эффектов при импорте: его можно использовать
и как библиотеку, и через CLI в worker.py.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Sequence

import cv2
from PIL import Image, ImageOps

SUPPORTED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff",
}

PANORAMA_ASPECT = 2.0
DEFAULT_PREVIEW_WIDTH = 1024
DEFAULT_MAX_WIDTH = 4096
DEFAULT_QUALITY_FULL = 85
DEFAULT_QUALITY_PREVIEW = 75
DEFAULT_CONFIDENCE_THRESH = 1.0
DEFAULT_REGISTRATION_RESOL = 0.6
DEFAULT_SEAM_RESOL = 0.1
DEFAULT_COMPOSITING_RESOL = 1.0

_STITCH_ERRORS = {
    getattr(cv2, "Stitcher_ERR_NEED_MORE_IMGS", 1): "нужно больше перекрывающихся кадров",
    getattr(cv2, "Stitcher_ERR_HOMOGRAPHY_EST_FAIL", 2): "не удалось оценить гомографию (мало общего между кадрами)",
    getattr(cv2, "Stitcher_ERR_CAMERA_PARAMS_ADJUST_FAIL", 3): "не удалось подобрать параметры камеры",
}


class StitchingError(RuntimeError):
    """Ошибка сшивки кадров в панораму."""


def is_supported_image(path: Path) -> bool:
    return path.suffix.lower() in SUPPORTED_EXTENSIONS


def _open_rgb(image_path: Path) -> Image.Image:
    with Image.open(image_path) as source:
        oriented = ImageOps.exif_transpose(source)
        return oriented.convert("RGB")


def crop_to_aspect(image: Image.Image, aspect: float = PANORAMA_ASPECT) -> Image.Image:
    """Центрированный кроп под соотношение сторон (по умолчанию 2:1)."""
    width, height = image.size
    current = width / height
    if abs(current - aspect) < 1e-3:
        return image

    if current > aspect:
        new_width = max(1, round(height * aspect))
        left = (width - new_width) // 2
        return image.crop((left, 0, left + new_width, height))

    new_height = max(1, round(width / aspect))
    top = (height - new_height) // 2
    return image.crop((0, top, width, top + new_height))


def _save_webp(image: Image.Image, path: Path, quality: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    try:
        image.save(tmp_path, "WEBP", quality=quality, method=6)
        os.replace(tmp_path, path)
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except OSError:
            pass


def _compress_image(
    image: Image.Image,
    stem: str,
    output_dir: Path,
    *,
    preview_width: int,
    max_width: int,
    quality_full: int,
    quality_preview: int,
    force_aspect: float | None,
) -> dict:
    if force_aspect:
        image = crop_to_aspect(image, force_aspect)

    full = image
    if full.width > max_width:
        new_height = max(1, round(full.height * (max_width / full.width)))
        full = full.resize((max_width, new_height), Image.Resampling.LANCZOS)

    target_preview_width = min(preview_width, full.width)
    if target_preview_width == full.width:
        preview = full
    else:
        preview = full.resize(
            (target_preview_width, max(1, round(target_preview_width / (full.width / full.height)))),
            Image.Resampling.LANCZOS,
        )

    full_path = output_dir / f"{stem}.webp"
    preview_path = output_dir / f"{stem}_preview.webp"

    _save_webp(full, full_path, quality_full)
    _save_webp(preview, preview_path, quality_preview)

    return {
        "width": full.width,
        "height": full.height,
        "aspectRatio": round(full.width / full.height, 3),
        "previewWidth": preview.width,
        "previewHeight": preview.height,
        "full": str(full_path),
        "preview": str(preview_path),
        "bytes": {
            "full": full_path.stat().st_size,
            "preview": preview_path.stat().st_size,
        },
    }


def compress_panorama(
    image_path: Path | str,
    output_dir: Path | str,
    *,
    preview_width: int = DEFAULT_PREVIEW_WIDTH,
    max_width: int = DEFAULT_MAX_WIDTH,
    quality_full: int = DEFAULT_QUALITY_FULL,
    quality_preview: int = DEFAULT_QUALITY_PREVIEW,
    force_aspect: float | None = PANORAMA_ASPECT,
) -> dict:
    """Готовит из исходного изображения full (до 4096px) и preview (1024px) WebP."""
    image_path = Path(image_path)
    output_dir = Path(output_dir)
    image = _open_rgb(image_path)
    result = _compress_image(
        image,
        image_path.stem,
        output_dir,
        preview_width=preview_width,
        max_width=max_width,
        quality_full=quality_full,
        quality_preview=quality_preview,
        force_aspect=force_aspect,
    )
    result["source"] = str(image_path)
    return result


def _read_frames(image_paths: Sequence[Path]) -> list:
    frames = []
    for path in image_paths:
        frame = cv2.imread(str(path), cv2.IMREAD_COLOR)
        if frame is None:
            print(f"[stitcher] пропуск нечитаемого файла: {path}")
            continue
        frames.append(frame)
    return frames


def _configure_stitcher(
    stitcher,
    *,
    confidence_thresh: float,
    wave_correction: bool,
    registration_resol: float,
    seam_resol: float,
    compositing_resol: float,
) -> None:
    options = (
        ("setPanoConfidenceThresh", confidence_thresh),
        ("setWaveCorrection", wave_correction),
        ("setRegistrationResol", registration_resol),
        ("setSeamEstimationResol", seam_resol),
        ("setCompositingResol", compositing_resol),
    )
    for method_name, value in options:
        setter = getattr(stitcher, method_name, None)
        if setter is not None:
            setter(value)


def stitch_to_image(
    image_paths: Sequence[Path | str],
    *,
    crop: bool = True,
    confidence_thresh: float = DEFAULT_CONFIDENCE_THRESH,
    wave_correction: bool = True,
    registration_resol: float = DEFAULT_REGISTRATION_RESOL,
    seam_resol: float = DEFAULT_SEAM_RESOL,
    compositing_resol: float = DEFAULT_COMPOSITING_RESOL,
) -> Image.Image:
    """Сшивает кадры OpenCV Stitcher'ом и возвращает RGB-панораму."""
    paths = [Path(p) for p in image_paths]
    frames = _read_frames(paths)
    if len(frames) < 2:
        raise StitchingError("для сшивки нужно минимум 2 читаемых кадра")

    stitcher = cv2.Stitcher_create(cv2.Stitcher_PANORAMA)
    _configure_stitcher(
        stitcher,
        confidence_thresh=confidence_thresh,
        wave_correction=wave_correction,
        registration_resol=registration_resol,
        seam_resol=seam_resol,
        compositing_resol=compositing_resol,
    )
    status, panorama = stitcher.stitch(frames)
    if status != cv2.Stitcher_OK or panorama is None:
        reason = _STITCH_ERRORS.get(status, f"неизвестный код {status}")
        raise StitchingError(f"OpenCV Stitcher: {reason}")

    rgb = cv2.cvtColor(panorama, cv2.COLOR_BGR2RGB)
    image = Image.fromarray(rgb)
    return crop_to_aspect(image, PANORAMA_ASPECT) if crop else image


def stitch_images(
    image_paths: Sequence[Path | str],
    output_path: Path | str,
    *,
    crop: bool = True,
    **stitch_kwargs,
) -> dict:
    """Сшивает кадры и сохраняет результат в output_path (jpg/png/webp)."""
    output_path = Path(output_path)
    image = stitch_to_image(image_paths, crop=crop, **stitch_kwargs)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path)
    return {
        "output": str(output_path),
        "width": image.width,
        "height": image.height,
        "sourceFrames": [str(p) for p in image_paths],
    }


def stitch_and_compress(
    image_paths: Sequence[Path | str],
    output_dir: Path | str,
    name: str,
    *,
    stitch_options: dict | None = None,
    **compress_kwargs,
) -> dict:
    """Сшивает кадры и сразу сохраняет full/preview WebP с манифестом."""
    output_dir = Path(output_dir)
    image = stitch_to_image(image_paths, **(stitch_options or {}))
    result = _compress_image(image, name, output_dir, **compress_kwargs)
    result["type"] = "panorama"
    result["sourceFrames"] = [str(p) for p in image_paths]
    result["createdAt"] = datetime.now(timezone.utc).isoformat()
    return result


def public_url(prefix: str, path: Path | str) -> str:
    name = Path(path).name
    if not prefix:
        return name
    return f"{prefix.rstrip('/')}/{name}"


def build_manifest(
    result: dict,
    public_prefix: str = "",
    metadata: dict | None = None,
) -> dict:
    """Дополняет результат ссылками, совместимыми с shared/types.ts (Panorama)."""
    manifest = dict(result)
    manifest["id"] = Path(result.get("full", "panorama")).stem
    manifest["type"] = result.get("type", "panorama")
    manifest["url"] = public_url(public_prefix, result["full"])
    manifest["previewUrl"] = public_url(public_prefix, result["preview"])

    extra = dict(metadata or {})
    manifest["floorId"] = extra.get("floorId", "")
    manifest["x"] = extra.get("x", 0)
    manifest["y"] = extra.get("y", 0)
    manifest["yawOffset"] = extra.get("yawOffset", 0)
    manifest["hotspots"] = list(extra.get("hotspots", []))
    return manifest


def write_manifest(output_dir: Path | str, name: str, manifest: dict) -> Path:
    path = Path(output_dir) / f"{name}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    try:
        tmp_path.write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        os.replace(tmp_path, path)
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except OSError:
            pass
    return path


def iter_images(directory: Path | str) -> Iterable[Path]:
    directory = Path(directory)
    for entry in sorted(directory.iterdir()):
        if entry.is_file() and is_supported_image(entry):
            yield entry

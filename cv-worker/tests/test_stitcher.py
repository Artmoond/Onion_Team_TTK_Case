from pathlib import Path

from PIL import Image

from stitcher import (
    PANORAMA_ASPECT,
    build_manifest,
    compress_panorama,
    crop_to_aspect,
    public_url,
)


def make_image(path: Path, size: tuple[int, int]) -> Path:
    Image.new("RGB", size, (30, 60, 90)).save(path)
    return path


def test_crop_to_aspect_from_wide_and_tall():
    wide = Image.new("RGB", (3000, 1000))
    tall = Image.new("RGB", (1000, 3000))

    for image in (wide, tall):
        cropped = crop_to_aspect(image, PANORAMA_ASPECT)
        assert cropped.width / cropped.height == PANORAMA_ASPECT


def test_compress_creates_full_and_preview(tmp_path):
    source = make_image(tmp_path / "pano.png", (5000, 2500))
    result = compress_panorama(source, tmp_path / "out")

    full = Path(result["full"])
    preview = Path(result["preview"])
    assert full.exists() and preview.exists()
    assert result["width"] == 4096
    assert result["height"] == 2048

    with Image.open(full) as image:
        assert image.format == "WEBP"
        assert image.width <= 4096
    with Image.open(preview) as image:
        assert image.size == (1024, 512)


def test_preview_is_not_upscaled(tmp_path):
    source = make_image(tmp_path / "small.png", (800, 400))
    result = compress_panorama(source, tmp_path / "out")

    assert result["width"] == 800
    assert result["previewWidth"] == 800
    assert result["previewHeight"] == 400
    assert not list((tmp_path / "out").glob(".*.tmp"))


def test_compress_non_equirectangular_is_cropped(tmp_path):
    source = make_image(tmp_path / "square.png", (2000, 2000))
    result = compress_panorama(source, tmp_path / "out")
    assert result["aspectRatio"] == PANORAMA_ASPECT


def test_manifest_contains_public_urls(tmp_path):
    source = make_image(tmp_path / "lobby.png", (2048, 1024))
    result = compress_panorama(source, tmp_path / "out")
    manifest = build_manifest(result, "/uploads/panoramas")

    assert manifest["id"] == "lobby"
    assert manifest["url"] == "/uploads/panoramas/lobby.webp"
    assert manifest["previewUrl"] == "/uploads/panoramas/lobby_preview.webp"
    assert public_url("/uploads/panoramas/", "/x/y.webp") == "/uploads/panoramas/y.webp"

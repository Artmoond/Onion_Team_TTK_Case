import os
import sys
import time
from pathlib import Path
from typing import List, Optional
import cv2
from PIL import Image

def process_and_compress(image_path: Path, output_dir: Path) -> dict:
    """
    Создает WebP-версии панорамы:
    1. full (макс 4096x2048)
    2. preview (1024x512) для мгновенного старта на мобильном
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    stem = image_path.stem

    with Image.open(image_path) as img:
        img = img.convert("RGB")
        w, h = img.size

        # Превью 1024x512
        preview_img = img.resize((1024, 512), Image.Resampling.LANCZOS)
        preview_path = output_dir / f"{stem}_preview.webp"
        preview_img.save(preview_path, "WEBP", quality=75)

        # Основная панорама
        if w > 4096:
            new_h = int(h * (4096 / w))
            img = img.resize((4096, new_h), Image.Resampling.LANCZOS)
        
        full_path = output_dir / f"{stem}.webp"
        img.save(full_path, "WEBP", quality=85)

    return {
        "full": str(full_path),
        "preview": str(preview_path)
    }

def stitch_images(image_paths: List[str], output_path: str) -> bool:
    """
    Сшивает серию фотографий в единую панораму с помощью OpenCV Stitcher
    """
    print(f"Запуск сшивки {len(image_paths)} кадров...")
    images = []
    for p in image_paths:
        img = cv2.imread(p)
        if img is not None:
            images.append(img)
        else:
            print(f"Предупреждение: не удалось прочитать {p}")

    if len(images) < 2:
        print("Ошибка: для сшивки требуется минимум 2 кадра")
        return False

    stitcher = cv2.Stitcher_create(cv2.Stitcher_PANORAMA)
    status, pano = stitcher.stitch(images)

    if status != cv2.Stitcher_OK:
        print(f"Ошибка OpenCV stitcher status={status}")
        return False

    # Кроп к соотношению 2:1 для equirectangular
    h, w = pano.shape[:2]
    if w / h > 2.0:
        new_w = int(h * 2)
        x0 = (w - new_w) // 2
        pano = pano[:, x0:x0 + new_w]

    cv2.imwrite(output_path, pano)
    print(f"Панорама успешно сшита: {output_path}")
    return True

if __name__ == "__main__":
    print("CV Stitcher Worker готов к работе. Режим ожидания задач...")
    # Демонстрационный цикл ожидания
    while True:
        time.sleep(10)

"""Regenerate the website's responsive WebP photos with Python and Pillow."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageOps

ASSETS = Path(__file__).resolve().parents[1] / "public" / "assets" / "generated"


def encode(source, widths, quality):
    destination = source.parent / "responsive"
    destination.mkdir(exist_ok=True)
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original).convert("RGB")
        for width in widths:
            if width > image.width:
                raise ValueError(f"{source.name} is too small for a {width}px variant")
            height = round(image.height * width / image.width)
            resized = image.resize((width, height), Image.Resampling.LANCZOS)
            resized.save(destination / f"{source.stem}-{width}.webp",
                         format="WEBP", quality=quality, method=6)


if __name__ == "__main__":
    menu = ASSETS / "menu"
    scenes = ASSETS / "scene"
    with ThreadPoolExecutor(max_workers=4) as pool:
        jobs = [pool.submit(encode, path, (160, 420, 720, 1080), 77)
                for path in sorted(menu.glob("*.jpg"))]
        for source in (*sorted(scenes.glob("interior-*.jpg")),
                       *sorted(scenes.glob("hero-interior-*-v2.png"))):
            jobs.append(pool.submit(encode, source, (420, 720, 1080), 80))
        for job in jobs:
            job.result()

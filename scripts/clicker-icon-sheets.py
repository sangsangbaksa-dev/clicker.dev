#!/usr/bin/env python3
"""Cut AI-generated 2x2 icon sheets into per-item icons.

Each sheet (black background, four icons in quadrants) maps to four catalog ids in
sheets.json; the black is keyed to alpha and each quadrant is saved as
public/clicker/<kind>/<id>.webp.

    python3 scripts/clicker-icon-sheets.py sheets.json sheetmap.json <blob dir>
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent / "public" / "clicker"
OUT = 160


def cutout(tile: Image.Image) -> Image.Image:
    tile = tile.resize((OUT, OUT), Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.2, 60, 2))
    rgb = np.asarray(tile, float) / 255
    lum = rgb.max(axis=2)
    alpha = np.clip((lum - 0.04) / 0.12, 0, 1)
    h, w = alpha.shape
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.hypot((xx - w / 2) / (w / 2), (yy - h / 2) / (h / 2))
    alpha = np.maximum(alpha, np.clip((0.45 - r) / 0.25, 0, 1) * (lum > 0.015))
    alpha *= np.clip((1.02 - r) / 0.12, 0, 1)
    return Image.fromarray((np.dstack([rgb, alpha]) * 255).round().astype(np.uint8), "RGBA")


def main():
    sheets = json.load(open(sys.argv[1]))
    blobs = json.load(open(sys.argv[2]))
    folder = Path(sys.argv[3])
    done = 0
    for key, name in blobs.items():
        sheet = sheets[int(key)]
        im = Image.open(folder / name).convert("RGB")
        w, h = im.size
        if len(sheet["items"]) == 1:
            tiles = [im]
        else:
            tiles = [im.crop((x * w // 2, y * h // 2, (x + 1) * w // 2, (y + 1) * h // 2)) for y in (0, 1) for x in (0, 1)]
        for (kind, item_id), tile in zip(sheet["items"], tiles):
            cutout(tile).save(ROOT / kind / f"{item_id}.webp", "WEBP", quality=90, method=6)
            done += 1
    print(done, "icons")


if __name__ == "__main__":
    main()

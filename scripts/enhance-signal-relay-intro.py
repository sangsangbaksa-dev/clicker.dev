#!/usr/bin/env python3
"""Re-export Signal Relay cinematic assets from the 4K masters (commit 78b59b1).

Downscales to 1920×1080 with Lanczos, light denoise, and unsharp mask, then writes:
  - public/clicker/region/signal_relay_still.webp
  - public/clicker/bg/region_signal_relay.webp

Run `python3 scripts/clicker-region-intros.py signal_relay` afterward to rebuild the intro MP4.

    python3 scripts/enhance-signal-relay-intro.py
"""
from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public" / "clicker"
MASTER_COMMIT = "78b59b1"
OUT_W, OUT_H = 1920, 1080

SOURCES = {
    PUBLIC / "region" / "signal_relay_still.webp": f"{MASTER_COMMIT}:public/clicker/region/signal_relay_still.webp",
    PUBLIC / "bg" / "region_signal_relay.webp": f"{MASTER_COMMIT}:public/clicker/bg/region_signal_relay.webp",
}

# Match peer region poster/still weights (bf55c8f exports).
TARGET_BYTES = {
    PUBLIC / "region" / "signal_relay_still.webp": (240_000, 290_000),
    PUBLIC / "bg" / "region_signal_relay.webp": (140_000, 175_000),
}


def git_show(spec: str) -> bytes:
    return subprocess.check_output(["git", "show", spec], cwd=ROOT)


def cover_crop_16_9(im: Image.Image) -> Image.Image:
    scale = max(OUT_W / im.width, OUT_H / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    left, top = (im.width - OUT_W) // 2, (im.height - OUT_H) // 2
    return im.crop((left, top, left + OUT_W, top + OUT_H))


def enhance_master(blob: bytes) -> Image.Image:
    import io

    im = Image.open(io.BytesIO(blob)).convert("RGB")
    im = cover_crop_16_9(im)
    # Crush compression blocks before sharpening.
    im = im.filter(ImageFilter.MedianFilter(size=3))
    im = im.filter(ImageFilter.UnsharpMask(radius=1.4, percent=135, threshold=2))
    return im


def save_webp(im: Image.Image, dest: Path, byte_range: tuple[int, int]) -> None:
    lo, hi = byte_range
    best_q = 92
    best = io_bytes_write(im, 92)
    for q in range(78, 99):
        buf = io_bytes_write(im, q)
        if lo <= len(buf) <= hi:
            best_q, best = q, buf
            break
        if len(buf) < lo:
            best_q, best = q, buf
        elif len(buf) > hi and len(buf) < len(best):
            best_q, best = q, buf
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(best)
    print(f"wrote {dest.relative_to(ROOT)} ({len(best)} bytes, q≈{best_q})")


def io_bytes_write(im: Image.Image, quality: int) -> bytes:
    import io

    buf = io.BytesIO()
    im.save(buf, format="WEBP", quality=quality, method=6)
    return buf.getvalue()


def main() -> int:
    for dest, spec in SOURCES.items():
        raw = git_show(spec)
        im = enhance_master(raw)
        save_webp(im, dest, TARGET_BYTES[dest])
    print("Next: python3 scripts/clicker-region-intros.py signal_relay")
    return 0


if __name__ == "__main__":
    sys.exit(main())

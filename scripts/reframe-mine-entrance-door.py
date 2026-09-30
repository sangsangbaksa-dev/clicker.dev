#!/usr/bin/env python3
"""Shift mine entrance still + door-walk video left so the door hex sits at frame center."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public" / "clicker" / "mine"

# Cyan door trim midpoint in v2 still (1280×720): 708px; frame center = 640px.
SHIFT_PX = 68

STILL_IN = PUBLIC / "mine_entrance_hub_closed_door_v2.webp"
VIDEO_IN = PUBLIC / "mine_enter_door_walk_v11.mp4"
VIDEO_OUT = PUBLIC / "mine_enter_door_walk_v11.mp4"


def shift_still(path: Path) -> None:
    im = Image.open(path)
    w, h = im.size
    out = Image.new("RGB", (w, h))
    out.paste(im, (-SHIFT_PX, 0))
    out.paste(im.crop((w - SHIFT_PX, 0, w, h)), (w - SHIFT_PX, 0))
    out.save(path, quality=92, method=6)


def shift_video(path: Path) -> None:
    tmp = path.with_suffix(".reframe.tmp.mp4")
    # Crop from x=SHIFT (door moves left), then pad the right edge back to 1280.
    vf = f"crop={1280 - SHIFT_PX}:720:{SHIFT_PX}:0,pad=1280:720:0:0"
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(path),
        "-vf",
        vf,
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-c:a",
        "copy",
        str(tmp),
    ]
    subprocess.run(cmd, check=True)
    tmp.replace(path)


def main() -> None:
    if not STILL_IN.is_file():
        sys.exit(f"missing still: {STILL_IN}")
    shift_still(STILL_IN)
    if VIDEO_IN.is_file():
        shift_video(VIDEO_IN)
    print(f"reframed door left by {SHIFT_PX}px ({STILL_IN.name}, {VIDEO_IN.name})")


if __name__ == "__main__":
    main()

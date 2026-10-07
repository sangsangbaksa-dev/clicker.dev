#!/usr/bin/env python3
"""Re-render mine enter polish v1: drop shake/rotation, keep a smooth dolly (zoom) only.

Pass 1: vidstab detect. Pass 2: transform with strong smoothing + slight zoom fill.
Pass 3: smooth zoom envelope (ease in-out) so motion reads as forward/back only.

    python3 scripts/mine-enter-polish-steady.py

Overwrites public/clicker/mine/mine_enter_polish_v1_1080p.mp4, _720p.mp4, and poster webp.
"""
from __future__ import annotations

import math
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MINE = ROOT / "public" / "clicker" / "mine"
SRC = MINE / "mine_enter_polish_v1_1080p.mp4"
OUT_1080 = MINE / "mine_enter_polish_v1_1080p.mp4"
OUT_720 = MINE / "mine_enter_polish_v1_720p.mp4"
POSTER = MINE / "mine_enter_polish_v1_poster.webp"
FPS = 60
W, H = 1920, 1080


def run(cmd: list[str], **kw) -> None:
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True, **kw)


def main() -> int:
    if not SRC.is_file():
        print(f"missing source: {SRC}", file=sys.stderr)
        return 1
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        source = td_path / "source.mp4"
        run(["cp", str(SRC), str(source)])
        trf = td_path / "transforms.trf"
        stab = td_path / "stab.mp4"
        # Pass 1 — motion vectors
        run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(source),
                "-vf",
                f"vidstabdetect=stepsize=6:shakiness=8:accuracy=15:result={trf}",
                "-f",
                "null",
                "-",
            ],
        )
        # Pass 2 — stabilize (smoothing kills jitter; zoom fills borders)
        run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(source),
                "-vf",
                f"vidstabtransform=smoothing=60:input={trf}:zoom=8:optzoom=2:crop=black:interpol=bilinear",
                "-c:v",
                "libx264",
                "-crf",
                "17",
                "-preset",
                "medium",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "copy",
                str(stab),
            ],
        )
        # Pass 3 — gentle dolly: zoom 1.0 -> 1.14 over 10 s, fixed centre (no pan / rotate)
        z0, z1 = 1.0, 1.14
        # zoompan: z expressed per frame; on increments each output frame
        zoom_expr = f"if(lte(on,1),{z0},{z0}+({z1}-{z0})*(1-cos(PI*on/{FPS * 10}))/2)"
        vf = (
            f"zoompan=z='{zoom_expr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
            f"d=1:s={W}x{H}:fps={FPS}"
        )
        tmp_out = td_path / "final.mp4"
        run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(stab),
                "-vf",
                vf,
                "-c:v",
                "libx264",
                "-crf",
                "17",
                "-preset",
                "medium",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "copy",
                str(tmp_out),
            ],
        )
        run(["cp", str(tmp_out), str(OUT_1080)])
        run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(OUT_1080),
                "-vf",
                "scale=1280:720",
                "-c:v",
                "libx264",
                "-crf",
                "18",
                "-preset",
                "medium",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "copy",
                str(OUT_720),
            ],
        )
        run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(OUT_1080),
                "-frames:v",
                "1",
                "-q:v",
                "90",
                str(POSTER),
            ],
        )
    print("done:", OUT_1080, OUT_720, POSTER)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

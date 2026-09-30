#!/usr/bin/env python3
"""Retime the world intro cinematics: drop the fade-up at the head, linger on the ending.

Each 9s intro becomes: [HEAD_CUT .. SLOW_FROM] at normal speed, then [SLOW_FROM .. end] at
SLOW_FACTOR speed (audio time-stretched without changing pitch). A metadata tag marks a
retimed file so running the script again leaves it alone; re-render an intro first
(e.g. scripts/clicker-home-intro.py) to retime it again.

Usage: python3 scripts/clicker-intro-retime.py [intro.mp4 ...]   (default: every *_intro.mp4)
"""
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
REGION = Path(__file__).resolve().parent.parent / "public" / "clicker" / "region"
HEAD_CUT = 2.0
SLOW_FROM = 6.0
SLOW_FACTOR = 0.5
TAG = "aurelia-retimed"


def is_retimed(path: Path) -> bool:
    probe = subprocess.run([FF, "-hide_banner", "-i", str(path)], capture_output=True, text=True)
    return TAG in probe.stderr


def retime(path: Path) -> None:
    if is_retimed(path):
        print(f"skip {path.name} (already retimed)")
        return
    slow_pts = 1 / SLOW_FACTOR
    graph = (
        f"[0:v]trim={HEAD_CUT}:{SLOW_FROM},setpts=PTS-STARTPTS[v1];"
        f"[0:v]trim=start={SLOW_FROM},setpts={slow_pts}*(PTS-STARTPTS)[v2];"
        f"[v1][v2]concat=n=2:v=1:a=0[v];"
        f"[0:a]atrim={HEAD_CUT}:{SLOW_FROM},asetpts=PTS-STARTPTS[a1];"
        f"[0:a]atrim=start={SLOW_FROM},asetpts=PTS-STARTPTS,atempo={SLOW_FACTOR}[a2];"
        f"[a1][a2]concat=n=2:v=0:a=1[a]"
    )
    tmp = path.with_suffix(".retime.mp4")
    subprocess.run(
        [
            FF, "-loglevel", "error", "-y", "-i", str(path),
            "-filter_complex", graph, "-map", "[v]", "-map", "[a]",
            "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart",
            "-metadata", f"comment={TAG}", str(tmp),
        ],
        check=True,
    )
    tmp.replace(path)
    print(f"retimed {path.name}")


if __name__ == "__main__":
    targets = [Path(p) for p in sys.argv[1:]] or sorted(REGION.glob("*_intro.mp4"))
    for target in targets:
        retime(target)

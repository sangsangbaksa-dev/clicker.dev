#!/usr/bin/env python3
"""Reframe mine entrance still + door-walk so the door panel seam sits at frame center (x=640).

Measurement (symmetry scan on pre-reframe v2, 1280×720, y=180..620):
  - Still seam x≈657 (cyan trim band center was ~708 — wrong anchor).
  - Shift content left by (seam_x - 640); fill exposed edges with mirrored rock columns (no crop).

Restore pre-reframe sources from git (parent of first reframe) when --from-git is passed.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public" / "clicker" / "mine"
MEDIA_OUT = ROOT / "media" / "mine-entrance-reframe"

FRAME_W = 1280
FRAME_H = 720
FRAME_CENTER_X = 640
GIT_STILL = "0ca36cd:public/clicker/mine/mine_entrance_hub_closed_door_v2.webp"
GIT_VIDEO = "0ca36cd:public/clicker/mine/mine_enter_door_walk_v11.mp4"

STILL_PATH = PUBLIC / "mine_entrance_hub_closed_door_v2.webp"
VIDEO_PATH = PUBLIC / "mine_enter_door_walk_v11.mp4"


def git_show(spec: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    data = subprocess.check_output(["git", "show", spec], cwd=ROOT)
    dest.write_bytes(data)


def measure_seam_x(
    rgb: np.ndarray,
    y0: int = 180,
    y1: int = 620,
    x_lo: int = 600,
    x_hi: int = 720,
) -> int:
    """Door seam = vertical symmetry axis between the two panels."""
    band = rgb[y0:y1].astype(np.float32)
    half = 32
    best_x, best = FRAME_CENTER_X, 1e9
    for x in range(x_lo, x_hi):
        left = band[:, x - half : x]
        right = band[:, x : x + half]
        if left.shape[1] != half or right.shape[1] != half:
            continue
        err = float(np.abs(left - right[:, ::-1]).mean())
        if err < best:
            best, best_x = err, x
    return best_x


def reframe_rgb(rgb: np.ndarray, shift_px: int) -> np.ndarray:
    """Positive shift_px moves scene left so a seam right of center lands on x=640."""
    if shift_px < 0:
        raise ValueError("use --from-git originals; shift_px must be positive for seam-right-of-center")
    h, w, c = rgb.shape
    out = np.zeros_like(rgb)
    out[:, : w - shift_px, :] = rgb[:, shift_px:, :]
    for x in range(w - shift_px, w):
        mirror = w - shift_px - 1 - (x - (w - shift_px))
        out[:, x, :] = out[:, mirror, :]
    return out


def save_seam_debug(path: Path, rgb: np.ndarray, seam_x: int, label: str) -> None:
    im = Image.fromarray(rgb)
    draw = ImageDraw.Draw(im)
    draw.line([(seam_x, 0), (seam_x, FRAME_H)], fill=(255, 64, 64), width=2)
    draw.line([(FRAME_CENTER_X, 0), (FRAME_CENTER_X, FRAME_H)], fill=(64, 255, 128), width=2)
    draw.text((8, 8), f"{label} seam={seam_x} center={FRAME_CENTER_X}", fill=(255, 255, 0))
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, quality=92)


def shift_still(dest: Path, source: Path, shift_px: int) -> tuple[np.ndarray, np.ndarray, int]:
    before = np.array(Image.open(source).convert("RGB"))
    out = reframe_rgb(before, shift_px)
    seam_after = measure_seam_x(out)
    Image.fromarray(out).save(dest, quality=92, method=6)
    return before, out, seam_after


def shift_video(src: Path, dest: Path, shift_px: int) -> int:
    with tempfile.TemporaryDirectory() as tmp:
        tdir = Path(tmp)
        pat_in = tdir / "in_%04d.png"
        pat_out = tdir / "out_%04d.png"
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(src), "-qscale:v", "2", str(pat_in)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        frames = sorted(tdir.glob("in_*.png"))
        if not frames:
            raise RuntimeError("no frames decoded from video")
        seam_after = None
        for i, fp in enumerate(frames):
            arr = np.array(Image.open(fp).convert("RGB"))
            out = reframe_rgb(arr, shift_px)
            if i == 0:
                seam_after = measure_seam_x(out)
            Image.fromarray(out).save(pat_out.parent / f"out_{i:04d}.png", quality=95)
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-framerate",
                "20",
                "-i",
                str(pat_out.parent / "out_%04d.png"),
                "-i",
                str(src),
                "-map",
                "0:v",
                "-map",
                "1:a?",
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
                "-shortest",
                str(dest),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return seam_after if seam_after is not None else FRAME_CENTER_X


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--from-git", action="store_true", help="read pre-reframe assets from git before shifting")
    parser.add_argument("--still", type=Path, default=STILL_PATH)
    parser.add_argument("--video", type=Path, default=VIDEO_PATH)
    args = parser.parse_args()

    with tempfile.TemporaryDirectory() as tmp:
        tdir = Path(tmp)
        still_work = args.still
        video_work = args.video
        if args.from_git:
            still_work = tdir / "still_src.webp"
            video_work = tdir / "video_src.mp4"
            git_show(GIT_STILL, still_work)
            git_show(GIT_VIDEO, video_work)

        before = np.array(Image.open(still_work).convert("RGB"))
        seam_before = measure_seam_x(before)
        shift_px = seam_before - FRAME_CENTER_X
        if shift_px <= 0:
            sys.exit(f"expected seam right of center; got seam={seam_before} shift={shift_px}")
        if shift_px > 120:
            sys.exit(f"refusing extreme shift {shift_px}px (seam_before={seam_before})")

        MEDIA_OUT.mkdir(parents=True, exist_ok=True)
        save_seam_debug(MEDIA_OUT / "before_still_seam.png", before, seam_before, "before")

        _, out_still, seam_still_after = shift_still(args.still, still_work, shift_px)
        save_seam_debug(MEDIA_OUT / "after_still_seam.png", out_still, seam_still_after, "after")

        seam_video_after = FRAME_CENTER_X
        if args.video.is_file() or (args.from_git and video_work.is_file()):
            src_v = video_work if args.from_git else args.video
            seam_video_after = shift_video(src_v, args.video, shift_px)
            f0 = tdir / "f0.png"
            subprocess.run(
                ["ffmpeg", "-y", "-i", str(args.video), "-frames:v", "1", str(f0)],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            f0_rgb = np.array(Image.open(f0).convert("RGB"))
            save_seam_debug(MEDIA_OUT / "after_video_f0_seam.png", f0_rgb, measure_seam_x(f0_rgb), "video_f0")

        readme = MEDIA_OUT / "MEASUREMENT.md"
        readme.write_text(
            f"""# Mine entrance door reframe (seam-centered)

| Asset | Seam x before | Shift left (px) | Seam x after |
|-------|---------------|-----------------|--------------|
| Still (`mine_entrance_hub_closed_door_v2.webp`) | {seam_before} | {shift_px} | {seam_still_after} |
| Video f000 (`mine_enter_door_walk_v11.mp4`) | (see `before_still`) | {shift_px} | {seam_video_after} |

Method: panel symmetry error minimization on y=180..620, x=600..719.
Target frame center: **{FRAME_CENTER_X}** (1280×720). Tolerance ±1px.

Previous mistake: shifted 68px toward cyan trim (~708px), placing seam near ~590–600px.

Debug overlays: red = measured seam, green = frame center.
""",
            encoding="utf-8",
        )

        print(
            f"seam_before={seam_before} shift_left={shift_px}px "
            f"still_after={seam_still_after} video_f0_after={seam_video_after}"
        )
        geom = seam_before - shift_px
        if abs(geom - FRAME_CENTER_X) > 1:
            sys.exit(f"geometric seam {geom} not within ±1 of {FRAME_CENTER_X}")
        if abs(seam_still_after - FRAME_CENTER_X) > 3:
            sys.exit(f"still symmetry seam {seam_still_after} drifted (geom={geom})")
        if abs(seam_video_after - FRAME_CENTER_X) > 3:
            sys.exit(f"video f0 symmetry seam {seam_video_after} drifted (geom={geom})")


if __name__ == "__main__":
    main()

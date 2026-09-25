#!/usr/bin/env python3
"""Title-screen ambient loop over the closed mine door (hub f000).

Adds what the CSS drift on the still can't: a breathing cyan glow on the door
frame, low floor fog and drifting dust. Every motion term completes a whole
number of cycles per loop, so the last frame flows back into the first.

    pip install numpy pillow imageio-ffmpeg
    python3 media/video/make_title_ambient_loop.py

Writes public/clicker/mine/mine_title_ambient_loop_v1.{webm,mp4} (1280x720, 24 fps, 8 s,
silent) — VP9 first for browsers without H.264, H.264 for Safari.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "public/clicker/mine/mine_entrance_hub_closed_door_v1.png"
OUT = ROOT / "public/clicker/mine/mine_title_ambient_loop_v1"
W, H = 1280, 720
FPS = 24
SECONDS = 8
FRAMES = FPS * SECONDS
CYAN = np.array([0.25, 0.95, 1.0])
RNG = np.random.default_rng(11)


def cyan_mask(img: np.ndarray) -> np.ndarray:
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    return np.clip((np.minimum(g, b) - r - 0.06) * 6.0, 0, 1)


def blur(a: np.ndarray, radius: float) -> np.ndarray:
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32) / 255


def fog_layer(t: float, xs: np.ndarray, ys: np.ndarray) -> np.ndarray:
    """Horizontally periodic wisps; integer x-frequencies and loop speeds keep it seamless."""
    f = np.zeros_like(xs)
    for k, m, amp, phase, tilt in ((2, 1, 0.5, 0.3, 1.7), (3, -1, 0.35, 1.9, 2.9), (5, 2, 0.2, 4.1, 4.3), (7, -2, 0.12, 2.6, 6.1)):
        f += amp * np.sin(2 * np.pi * (k * xs + m * t) + phase + tilt * ys)
    f = (f - f.min()) / (f.max() - f.min() + 1e-6)
    floor = np.clip((ys - 0.62) / 0.3, 0, 1) ** 1.4  # lower third only
    return f**2 * floor


def main() -> None:
    base = np.asarray(Image.open(SRC).convert("RGB").resize((W, H), Image.LANCZOS), dtype=np.float32) / 255
    mask = cyan_mask(base)
    halo = blur(mask, 14) * 1.6 + blur(mask, 4) * 0.8

    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    xs /= W
    ys /= H

    n = 110
    p_x = RNG.uniform(0, 1, n)
    p_y = RNG.uniform(0, 1, n)
    p_dx = RNG.integers(-1, 2, n)          # whole screen-widths per loop
    p_dy = RNG.integers(1, 3, n)           # rises 1–2 screen-heights per loop
    p_wob = RNG.uniform(0.004, 0.015, n)
    p_size = RNG.uniform(0.8, 2.4, n)
    p_bright = RNG.uniform(0.15, 0.55, n)
    p_twinkle = RNG.integers(1, 4, n)
    p_phase = RNG.uniform(0, 2 * np.pi, n)
    far = p_size < 1.4
    p_dx = np.where(far, 0, p_dx)

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    raw_in = ["-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-an"]
    encoders = [
        ["-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
         f"{OUT}.mp4"],
        ["-c:v", "libvpx-vp9", "-crf", "36", "-b:v", "0", "-row-mt", "1", "-pix_fmt", "yuv420p", f"{OUT}.webm"],
    ]
    procs = [
        subprocess.Popen([ffmpeg, "-y", "-loglevel", "error", *raw_in, *enc], stdin=subprocess.PIPE)
        for enc in encoders
    ]

    for i in range(FRAMES):
        t = i / FRAMES
        pulse = 0.5 + 0.5 * np.sin(2 * np.pi * t) * 0.8 + 0.1 * np.sin(4 * np.pi * t + 1.1)
        frame = base * (1 + mask[..., None] * (0.35 * pulse))
        frame = frame + halo[..., None] * CYAN * (0.05 + 0.13 * pulse)

        fog = fog_layer(t, xs, ys)
        frame = frame + fog[..., None] * np.array([0.16, 0.22, 0.26]) * 0.55

        dust = np.zeros((H, W), np.float32)
        px = ((p_x + p_dx * t + p_wob * np.sin(2 * np.pi * (2 * t) + p_phase)) % 1) * W
        py = ((p_y - p_dy * t) % 1) * H
        tw = 0.55 + 0.45 * np.sin(2 * np.pi * p_twinkle * t + p_phase)
        for x, y, s, b in zip(px, py, p_size, p_bright * tw):
            r = int(np.ceil(s * 3))
            x0, x1 = max(0, int(x) - r), min(W, int(x) + r + 1)
            y0, y1 = max(0, int(y) - r), min(H, int(y) + r + 1)
            if x0 >= x1 or y0 >= y1:
                continue
            gx = xs[y0:y1, x0:x1] * W - x
            gy = ys[y0:y1, x0:x1] * H - y
            dust[y0:y1, x0:x1] += b * np.exp(-(gx**2 + gy**2) / (2 * s * s))
        frame = frame + dust[..., None] * np.array([0.7, 0.95, 1.0])

        data = (np.clip(frame, 0, 1) * 255).astype(np.uint8).tobytes()
        for proc in procs:
            proc.stdin.write(data)

    for proc in procs:
        proc.stdin.close()
        proc.wait()


if __name__ == "__main__":
    main()

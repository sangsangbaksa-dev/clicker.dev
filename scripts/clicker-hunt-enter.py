#!/usr/bin/env python3
"""Hunting-ground entry clips (1920x1080/30fps), rendered so both cuts are seamless.

Frame 0 is the world's still exactly as the world screen shows it; the camera leans in and then
rushes forward into the dark while the region's own light flares, and the lair background arrives
pushed-in and eases out onto its exact framing (the hunt screen's backdrop) on the last frame.
No white flash: the crossfade dips through a dark, tinted glow. Each clip keeps its soundtrack.

    pip install numpy pillow imageio-ffmpeg
    python3 scripts/clicker-hunt-enter.py [world ...]
"""
from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageFilter

PUBLIC = Path(__file__).resolve().parent.parent / "public" / "clicker"
W, H, FPS = 1920, 1080, 30
WORLDS = {
    "phase_vault": 5.0,
    "storm_spire": 4.6,
    "deep_fault": 5.0,
}
YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)


def load(rel: str) -> Image.Image:
    im = Image.open(PUBLIC / rel).convert("RGB")
    s = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    left, top = (im.width - W) // 2, (im.height - H) // 2
    return im.crop((left, top, left + W, top + H))


def zoom(img: Image.Image, scale: float, cx: float = 0.0, cy: float = 0.0, blur: float = 0.0) -> np.ndarray:
    if abs(scale - 1) < 1e-6 and cx == 0 and cy == 0:
        out = img
    else:
        ox, oy = W / 2 + cx * W, H / 2 + cy * H
        m = (1 / scale, 0, ox - W / 2 / scale, 0, 1 / scale, oy - H / 2 / scale)
        out = img.transform((W, H), Image.AFFINE, m, resample=Image.BICUBIC)
    if blur > 0.3:
        out = out.filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(out, np.float32) / 255


def smooth(x: float) -> float:
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def ease_out(x: float, k: float = 3.0) -> float:
    x = min(1.0, max(0.0, x))
    return 1 - (1 - x) ** k


def ease_in(x: float, k: float = 2.4) -> float:
    x = min(1.0, max(0.0, x))
    return x**k


def light_tint(img: Image.Image) -> np.ndarray:
    a = np.asarray(img.resize((480, 270)), np.float32)
    mx, mn = a.max(axis=2), a.min(axis=2)
    mask = (mx > 120) & ((mx - mn) / np.maximum(mx, 1) > 0.35)
    tint = a[mask].mean(axis=0) if mask.sum() > 40 else np.array([120.0, 200.0, 255.0])
    return (tint / tint.max()).astype(np.float32)


def frames(still: Image.Image, bg: Image.Image, length: float):
    tint = light_tint(bg)
    vignette = np.clip(1 - 0.5 * (((XX - W / 2) / (W / 2)) ** 2 + ((YY - H / 2) / (H / 2)) ** 2), 0.25, 1)[..., None]
    glow = np.exp(-(((XX - W / 2) / (W * 0.32)) ** 2 + ((YY - H * 0.48) / (H * 0.34)) ** 2))[..., None]
    a0, a1 = 0.9, 2.3  # rush into the dark
    b0, b1 = 1.7, 3.0  # lair arrives
    n = int(round(length * FPS))
    for f in range(n):
        t = f / FPS
        last = f == n - 1
        # Still: a slow lean, then an accelerating rush forward with a little motion blur.
        lean = 0.04 * smooth(t / a0)
        rush = 0.55 * ease_in((t - a0) / (a1 - a0))
        a = zoom(still, 1 + lean + rush, 0, -0.02 * smooth(t / a1), blur=8 * ease_in((t - a0) / (a1 - a0)))
        dark_a = 1 - 0.85 * smooth((t - a0) / (a1 - a0))
        # Lair: arrives pushed in and blurred, settles onto its exact framing by the last frame.
        u = ease_out((t - b0) / (length - b0 - 1 / FPS), 3.4)
        b = bg_frame = zoom(bg, 1 + 0.22 * (1 - u), 0, 0.015 * (1 - u), blur=7 * (1 - smooth((t - b0) / 0.9)))
        mix = smooth((t - b0) / (b1 - b0))
        img = a * dark_a * (1 - mix) + b * mix
        # Dark passage between the two: the region's light flares from the centre instead of white.
        pass_t = smooth((t - (a1 - 0.5)) / 0.5) * (1 - smooth((t - b0 - 0.2) / 0.9))
        img = 1 - (1 - img) * (1 - glow * tint * 0.55 * pass_t)
        img = img * (vignette * pass_t * 0.6 + (1 - pass_t * 0.6))
        if last:
            img = bg_frame
        yield (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)


def render(world: str, length: float) -> None:
    out = PUBLIC / "region" / f"{world}_hunt_enter.mp4"
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    still = load(f"region/{world}_still.webp")
    bg = load(f"bg/region_{world}.webp")
    with tempfile.TemporaryDirectory() as tmp:
        audio = Path(tmp) / "audio.m4a"
        subprocess.run([ff, "-y", "-i", str(out), "-vn", "-c:a", "copy", str(audio)], check=True, stderr=subprocess.DEVNULL)
        video = Path(tmp) / "video.mp4"
        proc = subprocess.Popen(
            [ff, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
             "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", "19", "-preset", "slow", str(video)],
            stdin=subprocess.PIPE,
        )
        for frame in frames(still, bg, length):
            proc.stdin.write(frame.tobytes())
        proc.stdin.close()
        proc.wait()
        subprocess.run(
            [ff, "-y", "-loglevel", "error", "-i", str(video), "-i", str(audio), "-map", "0:v", "-map", "1:a",
             "-c:v", "copy", "-c:a", "copy", "-movflags", "+faststart", "-shortest", str(out)],
            check=True,
        )
    print("wrote", out.relative_to(PUBLIC.parent.parent))


if __name__ == "__main__":
    for world in sys.argv[1:] or list(WORLDS):
        render(world, WORLDS[world])

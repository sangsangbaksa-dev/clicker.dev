#!/usr/bin/env python3
"""Re-render the world arrival cinematics from each world's own art — no particles.

10s at 1280x720/30fps: the world's poster fades up under a drifting sub-pixel push-in with a
breathing light sweep, the camera speeds in through a crossfade to its still, and the still eases
out onto the exact framing the world screen shows next. The picture is new;
the soundtrack is lifted from the existing video, so each world keeps its score.

    pip install numpy pillow imageio-ffmpeg
    python3 scripts/clicker-region-intros.py [world_id ...]   (default: every world below)
"""
from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from PIL import Image

PUBLIC = Path(__file__).resolve().parent.parent / "public" / "clicker"
W, H, FPS, LENGTH = 1280, 720, 30, 10.0

WORLDS = {
    "signal_relay": ("bg/region_signal_relay.webp", "region/signal_relay_still.webp"),
    "phase_vault": ("bg/region_phase_vault.webp", "region/phase_vault_still.webp"),
    "storm_spire": ("bg/region_storm_spire.webp", "region/storm_spire_still.webp"),
    "deep_fault": ("bg/region_deep_fault.webp", "region/deep_fault_still.webp"),
    "core_heart": ("bg/region_core_heart.jpg", "region/core_heart_still.webp"),
}


def load(path: Path) -> np.ndarray:
    im = Image.open(path).convert("RGB")
    # Cover-crop to 16:9 so nothing is stretched.
    scale = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    left, top = (im.width - W) // 2, (im.height - H) // 2
    return np.asarray(im.crop((left, top, left + W, top + H)), dtype=np.float32) / 255


def zoom(img: np.ndarray, scale: float, cx: float = 0.0, cy: float = 0.0) -> np.ndarray:
    """Sub-pixel push-in: scale about the frame centre shifted by (cx, cy) frame-fractions, so slow
    moves glide instead of stepping a whole pixel at a time."""
    if abs(scale - 1) < 1e-6 and cx == 0 and cy == 0:
        return img
    src = Image.fromarray((img * 255).astype(np.uint8))
    ox, oy = W / 2 + cx * W, H / 2 + cy * H
    # output (x, y) → input ((x - W/2) / s + ox, (y - H/2) / s + oy)
    m = (1 / scale, 0, ox - W / 2 / scale, 0, 1 / scale, oy - H / 2 / scale)
    return np.asarray(src.transform((W, H), Image.AFFINE, m, resample=Image.BICUBIC), dtype=np.float32) / 255


def smooth(x: float) -> float:
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def ease_out(x: float, k: float = 3.0) -> float:
    x = min(1.0, max(0.0, x))
    return 1 - (1 - x) ** k


def frames(poster: np.ndarray, still: np.ndarray):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    vignette = (1 - 0.42 * (((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)).clip(0.3, 1)[..., None]
    X0, X1 = 4.2, 7.0  # crossfade window (s)
    for f in range(int(LENGTH * FPS)):
        t = f / FPS
        # Poster: a slow drifting push that speeds up into the crossfade (the camera "goes in").
        drift = smooth(t / X1)
        a = zoom(poster, 1.03 + 0.09 * drift + 0.22 * smooth((t - X0 + 0.6) / (X1 - X0 + 0.6)) ** 2,
                 cx=-0.018 + 0.03 * drift, cy=0.01 - 0.016 * drift)
        # Still: arrives slightly pushed in and off-centre, then settles with a long ease-out onto
        # the exact framing of the world screen (scale 1, centred) by the last frame.
        u = ease_out((t - X0) / (LENGTH - X0), 3.2)
        b = zoom(still, 1.0 + 0.14 * (1 - u), cx=0.02 * (1 - u), cy=-0.012 * (1 - u))
        mix = smooth((t - X0) / (X1 - X0))
        img = a * (1 - mix) + b * mix
        # Light breathes on the poster and a soft glow sweeps across it; both fade with the poster.
        breath = 1 + 0.06 * np.sin(t * 2.1) * (1 - mix)
        sweep_x = W * (-0.3 + 1.6 * smooth(t / X1))
        sweep = np.exp(-(((xx - sweep_x) / (W * 0.22)) ** 2))[..., None] * 0.12 * (1 - mix)
        img = img * breath + sweep * img
        # Vignette eases out as the still settles, so the last frame matches the screen.
        v = vignette * (1 - mix) + mix
        fade = smooth(t / 1.0)
        yield (np.clip(img * v * fade, 0, 1) * 255).astype(np.uint8)


def render(world: str) -> None:
    poster_rel, still_rel = WORLDS[world]
    out = PUBLIC / "region" / f"{world}_intro.mp4"
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    with tempfile.TemporaryDirectory() as tmp:
        audio = Path(tmp) / "audio.m4a"
        subprocess.run([ff, "-y", "-i", str(out), "-vn", "-c:a", "copy", str(audio)], check=True, stderr=subprocess.DEVNULL)
        video = Path(tmp) / "video.mp4"
        proc = subprocess.Popen(
            [ff, "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
             "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", "22", "-preset", "slow", str(video)],
            stdin=subprocess.PIPE, stderr=subprocess.DEVNULL,
        )
        for frame in frames(load(PUBLIC / poster_rel), load(PUBLIC / still_rel)):
            proc.stdin.write(frame.tobytes())
        proc.stdin.close()
        proc.wait()
        subprocess.run(
            [ff, "-y", "-i", str(video), "-i", str(audio), "-map", "0:v", "-map", "1:a", "-c", "copy",
             "-shortest", "-movflags", "+faststart", str(out)],
            check=True, stderr=subprocess.DEVNULL,
        )
    print("wrote", out.relative_to(PUBLIC.parent.parent))


if __name__ == "__main__":
    for name in sys.argv[1:] or list(WORLDS):
        render(name)

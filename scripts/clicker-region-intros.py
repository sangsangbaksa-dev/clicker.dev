#!/usr/bin/env python3
"""Re-render the world arrival cinematics from each world's own art — no particles.

10s at 1920x1080/30fps: one continuous push-in on the world's still. No second plate
and no mid-shot crossfade. The camera eases onto the exact framing the world screen
shows next. The soundtrack is lifted from the existing video.

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
W, H, FPS, LENGTH = 1920, 1080, 30, 10.0

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


def frames(still: np.ndarray):
    """One steady, centered push-in on the same plate. No lateral drift or crossfade."""
    for f in range(int(LENGTH * FPS)):
        t = f / FPS
        u = ease_out(t / LENGTH, 2.4)
        img = zoom(still, 1.12 - 0.12 * u)
        fade = smooth(min(1.0, t / 0.45))
        yield (np.clip(img * fade, 0, 1) * 255).astype(np.uint8)


def render(world: str) -> None:
    _poster_rel, still_rel = WORLDS[world]
    out = PUBLIC / "region" / f"{world}_intro.mp4"
    crf = 14 if world in {"signal_relay", "core_heart"} else 20
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    with tempfile.TemporaryDirectory() as tmp:
        audio = Path(tmp) / "audio.m4a"
        subprocess.run([ff, "-y", "-i", str(out), "-vn", "-c:a", "copy", str(audio)], check=True, stderr=subprocess.DEVNULL)
        video = Path(tmp) / "video.mp4"
        proc = subprocess.Popen(
            [ff, "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
             "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", str(crf), "-preset", "slow", str(video)],
            stdin=subprocess.PIPE, stderr=subprocess.DEVNULL,
        )
        for frame in frames(load(PUBLIC / still_rel)):
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

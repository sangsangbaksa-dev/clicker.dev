#!/usr/bin/env python3
"""Re-render the world arrival cinematics from each world's own art — no particles.

10s at 1280x720/30fps: the world's poster fades up under a slow push-in, crossfades to its
still and settles on the exact still framing the world screen shows next. The picture is new;
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


def zoom(img: np.ndarray, scale: float) -> np.ndarray:
    """Crop-and-scale push-in about the centre."""
    if scale <= 1.0001:
        return img
    cw, ch = int(W / scale), int(H / scale)
    x0, y0 = (W - cw) // 2, (H - ch) // 2
    crop = Image.fromarray((img[y0 : y0 + ch, x0 : x0 + cw] * 255).astype(np.uint8))
    return np.asarray(crop.resize((W, H), Image.BILINEAR), dtype=np.float32) / 255


def smooth(x: float) -> float:
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def frames(poster: np.ndarray, still: np.ndarray):
    yy, xx = np.mgrid[0:H, 0:W]
    vignette = (1 - 0.4 * (((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)).clip(0.35, 1)[..., None]
    for f in range(int(LENGTH * FPS)):
        t = f / FPS
        a = zoom(poster, 1.0 + 0.10 * t / LENGTH)
        # The still ends at scale 1.0 — the exact framing of the world screen that follows.
        b = zoom(still, 1.08 - 0.08 * smooth((t - 4.5) / 5.5))
        mix = smooth((t - 4.5) / 2.5)
        img = a * (1 - mix) + b * mix
        # Vignette eases out as the still settles, so the last frame matches the screen.
        v = vignette * (1 - mix) + mix
        fade = smooth(t / 1.2)
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

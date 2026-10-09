#!/usr/bin/env python3
"""Render the Core Mine (home) arrival cinematic from the home art, with its own score.

9s at 1920x1080/30fps: one continuous push-in on the mine entrance (no mid-shot
crossfade). Cyan lights flicker awake, and the shot settles on the same framing
as the home hub. The existing score is kept. Scored originally in D minor with
a door thud at the end. Needs the instruments in scripts/clicker-bgm.py.

    pip install numpy pillow soundfile imageio-ffmpeg
    python3 scripts/clicker-home-intro.py
"""
from __future__ import annotations

import importlib.util
import subprocess
import tempfile
from pathlib import Path

import imageio_ffmpeg
import numpy as np
import soundfile as sf
from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
PUBLIC = HERE.parent / "public" / "clicker"
OUT = PUBLIC / "region" / "core_chamber_intro.mp4"
W, H, FPS, LENGTH = 1920, 1080, 30, 9.0

spec = importlib.util.spec_from_file_location("bgm", HERE / "clicker-bgm.py")
bgm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bgm)  # type: ignore[union-attr]


def load(path: Path) -> np.ndarray:
    im = Image.open(path).convert("RGB").resize((W, H), Image.LANCZOS)
    return np.asarray(im, dtype=np.float32) / 255


def zoom(img: np.ndarray, scale: float, cy: float = 0.5) -> np.ndarray:
    """Sub-pixel push-in about the centre (cy shifts the focus vertically), so the slow move
    glides instead of stepping a whole pixel at a time."""
    if abs(scale - 1) < 1e-6:
        return img
    src = Image.fromarray((img * 255).astype(np.uint8))
    ox, oy = W / 2, H / 2 + (cy - 0.5) * H * (1 - 1 / scale)
    m = (1 / scale, 0, ox - W / 2 / scale, 0, 1 / scale, oy - H / 2 / scale)
    return np.asarray(src.transform((W, H), Image.AFFINE, m, resample=Image.BICUBIC), dtype=np.float32) / 255


def smooth(t: float) -> float:
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def frames():
    gate = load(PUBLIC / "mine" / "mine_entrance_hub_closed_door_v2.webp")
    lit = ((gate[..., 2] > 0.45) & (gate[..., 2] > gate[..., 0] * 1.4)).astype(np.float32)
    glow = np.asarray(Image.fromarray((lit * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(12)), np.float32)[..., None] / 255
    lit = lit[..., None]
    total = int(LENGTH * FPS)
    for f in range(total):
        t = f / FPS
        # One shot on the gate, easing out onto scale 1.0 — the exact hub framing.
        u = 1 - (1 - min(1.0, t / (LENGTH - 1 / FPS))) ** 3
        img = zoom(gate, 1.1 - 0.1 * u)
        # The trim lights power up: two soft stutters, then a steady glow that settles to the still.
        on = smooth((t - 4.6) / 1.6)
        stutter = 0.35 * np.exp(-((t - 5.0) / 0.12) ** 2) + 0.25 * np.exp(-((t - 5.5) / 0.1) ** 2)
        surge = (on * (1 - smooth((t - 7.2) / 1.6)) + stutter) * 0.9
        img = img * (1 - lit * 0.55 * (1 - on)) + (lit * img + glow * 0.35) * surge
        if f == total - 1:
            img = gate
        fade = smooth(t / 0.6)
        yield (np.clip(img * fade, 0, 1) * 255 + 0.5).astype(np.uint8)


def score() -> np.ndarray:
    n = int(LENGTH * bgm.SR)
    l = np.zeros(n + bgm.SR * 4)
    r = np.zeros(n + bgm.SR * 4)

    def add(t: float, x: np.ndarray, gain: float, pan: float = 0.0) -> None:
        i = int(t * bgm.SR)
        end = min(len(l), i + len(x))
        seg = x[: end - i] * gain
        l[i:end] += seg * np.sqrt((1 - pan) / 2)
        r[i:end] += seg * np.sqrt((1 + pan) / 2)

    hz = bgm.hz
    add(0, bgm.drone(hz("D1"), 9.0), 0.45)
    add(0.3, bgm.swell(8.5, 300, 1 / 9, 0.6), 0.18)
    add(0.8, bgm.toll(hz("D3"), 4.5), 0.22, -0.2)
    add(1.2, bgm.choir(bgm.chord("D", "m", 3), 4.2), 0.3)
    add(3.4, bgm.choir(bgm.chord("A#", "M", 3), 3.6), 0.3)
    add(2.2, bgm.brass(hz("D3"), 1.8), 0.4)
    add(4.0, bgm.brass(hz("F3"), 1.4), 0.42)
    add(5.4, bgm.brass(hz("A3"), 3.2), 0.44)
    add(5.4, bgm.brass(hz("D3"), 3.2), 0.3, 0.2)
    add(5.4, bgm.toll(hz("A2"), 3.5), 0.2, 0.3)
    add(7.6, bgm.taiko(1.4), 0.8)  # the door settles
    add(7.62, bgm.kick(0.5), 0.5)

    out = []
    ir_len = int(3.0 * bgm.SR)
    tt = np.arange(ir_len) / bgm.SR
    for ch in (l, r):
        ir = np.random.default_rng(5).standard_normal(ir_len) * np.exp(-tt * 1.0)
        ir /= np.sqrt(np.sum(ir**2))
        out.append((ch + bgm.fft_convolve(ch, ir)[: len(ch)] * 0.4)[:n])
    stereo = np.stack(out, axis=1)
    stereo = np.tanh(stereo / np.max(np.abs(stereo)) * 1.3) / np.tanh(1.3) * 10 ** (-3.5 / 20)
    fade = int(0.6 * bgm.SR)
    stereo[-fade:] *= np.linspace(1, 0, fade)[:, None]
    return stereo


def main() -> None:
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    with tempfile.TemporaryDirectory() as tmp:
        audio = Path(tmp) / "audio.m4a"
        subprocess.run([ff, "-y", "-i", str(OUT), "-vn", "-c:a", "copy", str(audio)], check=True, stderr=subprocess.DEVNULL)
        video = Path(tmp) / "video.mp4"
        proc = subprocess.Popen(
            [ff, "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
             "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "slow", str(video)],
            stdin=subprocess.PIPE, stderr=subprocess.DEVNULL,
        )
        for frame in frames():
            proc.stdin.write(frame.tobytes())
        proc.stdin.close()
        proc.wait()
        subprocess.run(
            [ff, "-y", "-i", str(video), "-i", str(audio), "-map", "0:v", "-map", "1:a", "-c", "copy",
             "-shortest", "-movflags", "+faststart", str(OUT)],
            check=True, stderr=subprocess.DEVNULL,
        )
    print(f"wrote {OUT.relative_to(HERE.parent)}")


if __name__ == "__main__":
    main()

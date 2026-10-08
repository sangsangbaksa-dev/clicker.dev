#!/usr/bin/env python3
"""Render the Core Mine (home) arrival cinematic from the home art, with its own score.

9s at 1280x720/30fps: one continuous push-in on the mine entrance (no mid-shot
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
from PIL import Image

HERE = Path(__file__).resolve().parent
PUBLIC = HERE.parent / "public" / "clicker"
OUT = PUBLIC / "region" / "core_chamber_intro.mp4"
W, H, FPS, LENGTH = 1280, 720, 30, 9.0

spec = importlib.util.spec_from_file_location("bgm", HERE / "clicker-bgm.py")
bgm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bgm)  # type: ignore[union-attr]


def load(path: Path) -> np.ndarray:
    im = Image.open(path).convert("RGB").resize((W, H), Image.LANCZOS)
    return np.asarray(im, dtype=np.float32) / 255


def zoom(img: np.ndarray, scale: float, cy: float = 0.5) -> np.ndarray:
    """Crop-and-scale push-in about the centre (cy shifts the focus vertically)."""
    cw, ch = int(W / scale), int(H / scale)
    x0 = (W - cw) // 2
    y0 = int(np.clip((H - ch) * cy, 0, H - ch))
    crop = Image.fromarray((img[y0 : y0 + ch, x0 : x0 + cw] * 255).astype(np.uint8))
    return np.asarray(crop.resize((W, H), Image.BILINEAR), dtype=np.float32) / 255


def smooth(t: float) -> float:
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def frames():
    gate = load(PUBLIC / "mine" / "mine_entrance_hub_closed_door_v2.webp")
    total = int(LENGTH * FPS)
    for f in range(total):
        t = f / FPS
        # One shot on the gate. Ends at scale 1.0 — the exact hub framing.
        u = smooth(t / LENGTH)
        img = zoom(gate, 1.08 - 0.08 * u)
        if t > 5.4:
            flicker = 0.6 + 0.4 * np.sin(t * 9) * (1 if (int(t * 7) % 5) else 0.2)
            lit = ((img[..., 2] > 0.45) & (img[..., 2] > img[..., 0] * 1.4)).astype(np.float32)[..., None]
            img = img + lit * img * flicker * 0.9
        fade = smooth(min(1.0, t / 0.45)) * (1 - 0.35 * smooth((t - 8.3) / 0.7))
        yield (np.clip(img * fade, 0, 1) * 255).astype(np.uint8)


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
             "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", "23", "-preset", "slow", str(video)],
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

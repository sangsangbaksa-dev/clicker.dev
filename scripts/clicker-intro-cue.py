#!/usr/bin/env python3
"""Score the one silent world intro (Deep Fault) and mux the cue into its MP4.

Reuses the instruments in scripts/clicker-bgm.py. The cue follows the video: a molten
rumble and distant drums while the hall fades up, a low choir and brass swell as the
lava reveals itself, one heavy impact, then a fading brass tail.

    pip install numpy soundfile imageio-ffmpeg
    python3 scripts/clicker-intro-cue.py
"""
from __future__ import annotations

import importlib.util
import subprocess
import tempfile
from pathlib import Path

import imageio_ffmpeg
import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("bgm", HERE / "clicker-bgm.py")
bgm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bgm)  # type: ignore[union-attr]

SR = bgm.SR
VIDEO = HERE.parent / "public" / "clicker" / "region" / "deep_fault_intro.mp4"
LENGTH = 9.0


def deep_fault_cue() -> np.ndarray:
    n = int(LENGTH * SR)
    l = np.zeros(n + SR * 4)
    r = np.zeros(n + SR * 4)

    def add(t: float, x: np.ndarray, gain: float, pan: float = 0.0) -> None:
        i = int(t * SR)
        end = min(len(l), i + len(x))
        seg = x[: end - i] * gain
        l[i:end] += seg * np.sqrt((1 - pan) / 2)
        r[i:end] += seg * np.sqrt((1 + pan) / 2)

    hz = bgm.hz
    # Fade-up: sub rumble swelling out of silence, embers, a drone on E.
    rumble = bgm.swell(LENGTH, 120, 1 / 12, 0.2) * np.linspace(0.2, 1.0, int(LENGTH * SR)) ** 1.5
    add(0, rumble, 0.55)
    add(0.2, bgm.drone(hz("E1"), 8.6), 0.4)
    add(0.5, bgm.crackle(8.3, 16), 0.22, -0.4)
    add(0.9, bgm.crackle(8.0, 11), 0.2, 0.4)
    # Distant war drums while the hall comes into view.
    for t, g in ((1.0, 0.35), (2.6, 0.42), (3.6, 0.3), (4.4, 0.48)):
        add(t, bgm.taiko(1.2), g, float(np.random.default_rng(int(t * 10)).uniform(-0.3, 0.3)))
    # The lava reveals itself: low choir and a Phrygian brass swell (E - F - E).
    add(3.2, bgm.choir(bgm.chord("E", "m", 2) + bgm.chord("E", "m", 3), 5.6), 0.34)
    add(3.6, bgm.brass(hz("E3"), 1.2), 0.42)
    add(4.8, bgm.brass(hz("F3"), 1.1), 0.44)
    # Impact.
    add(6.0, bgm.taiko(1.6), 0.9)
    add(6.02, bgm.taiko(1.2), 0.5, 0.3)
    add(6.0, bgm.toll(hz("E2"), 3.0), 0.3)
    add(6.0, bgm.dist_bass(hz("E1"), 2.6), 0.5)
    add(6.0, bgm.thunder(3.0) * 0.6, 0.35)
    # Tail: brass holds the root and fades with the picture.
    add(6.05, bgm.brass(hz("E3"), 2.9), 0.46)
    add(6.05, bgm.brass(hz("B3"), 2.9), 0.22, 0.2)

    out = []
    ir_len = int(2.6 * SR)
    t = np.arange(ir_len) / SR
    for ch in (l, r):
        ir = np.random.default_rng(3).standard_normal(ir_len) * np.exp(-t * 3 / 2.6)
        ir /= np.sqrt(np.sum(ir**2))
        wet = bgm.fft_convolve(ch, ir)[: len(ch)]
        out.append((ch + wet * 0.35)[:n])
    stereo = np.stack(out, axis=1)
    stereo = np.tanh(stereo / np.max(np.abs(stereo)) * 1.3) / np.tanh(1.3) * 10 ** (-3.5 / 20)
    fade = int(0.8 * SR)
    stereo[-fade:] *= np.linspace(1, 0, fade)[:, None]
    stereo[: int(0.05 * SR)] *= np.linspace(0, 1, int(0.05 * SR))[:, None]
    return stereo


def main() -> None:
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "cue.wav"
        sf.write(wav, deep_fault_cue(), SR)
        # Keep only the original picture (in case this is re-run on an already-scored file).
        muxed = Path(tmp) / "out.mp4"
        subprocess.run(
            [ff, "-y", "-i", str(VIDEO), "-i", str(wav), "-map", "0:v:0", "-map", "1:a:0",
             "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", str(muxed)],
            check=True, capture_output=True,
        )
        VIDEO.write_bytes(muxed.read_bytes())
    print(f"scored {VIDEO.name}")


if __name__ == "__main__":
    main()

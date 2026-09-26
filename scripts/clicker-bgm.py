#!/usr/bin/env python3
"""Render the clicker BGM loops (hub / mine / chamber) as seamless MP3 files (plays on iOS Safari too).

Each track is composed on a bar grid so the loop point lands on a downbeat, and the
reverb tail is folded back onto the start so the seam is inaudible. Every track has
a clear lead melody on top (bell / square lead / horn) over pads, bass and drums.

    pip install numpy soundfile
    python3 scripts/clicker-bgm.py
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import soundfile as sf

SR = 44100
OUT = Path(__file__).resolve().parent.parent / "public" / "clicker" / "audio"
RNG = np.random.default_rng(7)

NOTE = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}


def hz(name: str) -> float:
    """'A4' → 440.0"""
    pitch, octave = name[:-1], int(name[-1])
    midi = NOTE[pitch] + (octave + 1) * 12
    return 440.0 * 2 ** ((midi - 69) / 12)


def env(n: int, attack: float, release: float, sustain: float = 1.0) -> np.ndarray:
    a = max(1, int(attack * SR))
    r = max(1, int(release * SR))
    e = np.full(n, sustain)
    e[: min(a, n)] = np.linspace(0, 1, min(a, n)) * sustain
    if r < n:
        e[-r:] *= np.linspace(1, 0, r)
    return e


def lowpass(x: np.ndarray, cutoff: float) -> np.ndarray:
    """One-pole lowpass (vectorised via FFT of its impulse response)."""
    k = np.exp(-2 * np.pi * cutoff / SR)
    ir = (1 - k) * k ** np.arange(int(SR * 0.05))
    return fft_convolve(x, ir)[: len(x)]


def fft_convolve(x: np.ndarray, ir: np.ndarray) -> np.ndarray:
    n = len(x) + len(ir) - 1
    size = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:n]


def saw(f: float, t: np.ndarray) -> np.ndarray:
    return 2 * ((f * t) % 1) - 1


def square(f: float, t: np.ndarray, duty: float = 0.5) -> np.ndarray:
    return np.where((f * t) % 1 < duty, 1.0, -1.0)


# ---------- instruments (return mono buffers) ----------

def bell(f: float, dur: float) -> np.ndarray:
    """FM bell: bright attack, long clear ring — the hub melody voice."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    mod = np.sin(2 * np.pi * f * 3.5 * t) * 2.2 * np.exp(-t * 6)
    tone = np.sin(2 * np.pi * f * t + mod) + 0.3 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t * 3)
    return tone * np.exp(-t * 2.4) * env(n, 0.003, 0.05)


def pluck(f: float, dur: float) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = saw(f, t) * 0.6 + square(f * 0.5, t) * 0.25
    return lowpass(x * np.exp(-t * 7), 2600) * env(n, 0.002, 0.03)


def lead(f: float, dur: float, bright: float = 3400) -> np.ndarray:
    """Square/saw lead with vibrato — the mine melody voice."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.5 * t) * np.clip(t * 3, 0, 1)
    phase = np.cumsum(f * vib) / SR
    x = 0.55 * (2 * (phase % 1) - 1) + 0.45 * np.where(phase % 1 < 0.5, 1.0, -1.0)
    return lowpass(x, bright) * env(n, 0.01, 0.08, 0.9)


def horn(f: float, dur: float) -> np.ndarray:
    """Brassy swell for the chamber theme."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    vib = 1 + 0.005 * np.sin(2 * np.pi * 4.8 * t) * np.clip(t * 1.5, 0, 1)
    phase = np.cumsum(f * vib) / SR
    x = sum(np.sin(2 * np.pi * phase * k) / k ** 1.1 for k in range(1, 8))
    swell = np.clip(t / 0.18, 0, 1)
    return lowpass(x * swell, 2200) * env(n, 0.05, 0.25, 0.9)


def pad(freqs: list[float], dur: float, cutoff: float = 1400, attack: float = 0.6) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for f in freqs:
        for det in (-0.004, 0.0, 0.004):
            x += saw(f * (1 + det), t + RNG.random())
    x /= len(freqs) * 3
    return lowpass(x, cutoff) * env(n, attack, min(0.8, dur / 3))


def choir(freqs: list[float], dur: float) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for f in freqs:
        for det in (-0.006, -0.002, 0.002, 0.006):
            ph = 2 * np.pi * f * (1 + det) * t + RNG.random() * 6
            x += np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.2 * np.sin(3 * ph)
    x /= len(freqs) * 4
    return lowpass(x, 1800) * env(n, 0.9, 1.0)


def bass(f: float, dur: float) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.35 * saw(f, t)
    return lowpass(x, 700) * env(n, 0.005, 0.06, 0.95)


def kick(dur: float = 0.35) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)


def hat(dur: float = 0.06) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = RNG.standard_normal(n)
    x = x - lowpass(x, 7000)
    return x * np.exp(-t * 60) * 0.5


def snare(dur: float = 0.22) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = RNG.standard_normal(n)
    noise = noise - lowpass(noise, 1500)
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 25)
    return (noise * 0.6 + body) * np.exp(-t * 16)


def timpani(f: float, dur: float = 1.2) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 1.5 * t)
    return lowpass(x * np.exp(-t * 3.5), 900)


# ---------- arrangement helpers ----------

class Track:
    def __init__(self, bpm: float, bars: int):
        self.beat = 60 / bpm
        self.bars = bars
        self.n = int(round(bars * 4 * self.beat * SR))
        self.l = np.zeros(self.n + SR * 4)
        self.r = np.zeros(self.n + SR * 4)

    def at(self, beat: float) -> int:
        return int(round(beat * self.beat * SR))

    def add(self, beat: float, x: np.ndarray, gain: float, pan: float = 0.0):
        i = self.at(beat)
        end = min(len(self.l), i + len(x))
        seg = x[: end - i] * gain
        self.l[i:end] += seg * np.sqrt((1 - pan) / 2)
        self.r[i:end] += seg * np.sqrt((1 + pan) / 2)

    def render(self, reverb: float, room: float) -> np.ndarray:
        # Exponential-noise IR reverb, then fold everything past the loop point back to the start.
        ir_len = int(room * SR)
        t = np.arange(ir_len) / SR
        ir_l = RNG.standard_normal(ir_len) * np.exp(-t * 3 / room)
        ir_r = RNG.standard_normal(ir_len) * np.exp(-t * 3 / room)
        ir_l /= np.sqrt(np.sum(ir_l**2))
        ir_r /= np.sqrt(np.sum(ir_r**2))
        wet_l = fft_convolve(self.l, ir_l)
        wet_r = fft_convolve(self.r, ir_r)
        out = []
        for dry, wet in ((self.l, wet_l), (self.r, wet_r)):
            mix = np.zeros(len(wet))
            mix[: len(dry)] += dry
            mix += wet * reverb
            loop = mix[: self.n].copy()
            tail = mix[self.n :]
            for k in range(0, len(tail), self.n):
                chunk = tail[k : k + self.n]
                loop[: len(chunk)] += chunk
            out.append(loop)
        stereo = np.stack(out, axis=1)
        stereo = np.tanh(stereo / np.max(np.abs(stereo)) * 1.3) / np.tanh(1.3)
        return stereo * 10 ** (-1.5 / 20)


def chord(root: str, quality: str, octave: int = 3) -> list[float]:
    base = hz(f"{root}{octave}")
    steps = {"m": [0, 3, 7], "M": [0, 4, 7], "sus": [0, 5, 7]}[quality]
    return [base * 2 ** (s / 12) for s in steps]


def hub() -> np.ndarray:
    """A minor, 84 BPM, 8 bars — calm mine entrance with a clear bell melody."""
    tr = Track(84, 8)
    prog = [("A", "m"), ("F", "M"), ("C", "M"), ("G", "M")] * 2
    for bar, (root, q) in enumerate(prog):
        b = bar * 4
        tr.add(b, pad(chord(root, q, 3), 4 * tr.beat, 1200), 0.22, 0)
        tr.add(b, bass(hz(f"{root}2"), 2 * tr.beat * 0.95), 0.32)
        tr.add(b + 2, bass(hz(f"{root}2"), 2 * tr.beat * 0.95), 0.26)
        # Soft arpeggio under the melody.
        for i, f in enumerate(chord(root, q, 4) * 2):
            tr.add(b + i * 0.5, pluck(f, 0.4), 0.07, (-0.4 if i % 2 else 0.4))
    melody = [
        ("E5", 0, 1), ("C5", 1, 0.5), ("D5", 1.5, 0.5), ("E5", 2, 1.5), ("A4", 3.5, 0.5),
        ("F5", 4, 1), ("E5", 5, 0.5), ("C5", 5.5, 0.5), ("A4", 6, 2),
        ("G4", 8, 0.5), ("C5", 8.5, 0.5), ("E5", 9, 1), ("G5", 10, 1.5), ("E5", 11.5, 0.5),
        ("D5", 12, 1), ("B4", 13, 1), ("D5", 14, 2),
        ("E5", 16, 1), ("A5", 17, 1), ("G5", 18, 0.5), ("E5", 18.5, 0.5), ("C5", 19, 1),
        ("F5", 20, 1), ("E5", 21, 0.5), ("D5", 21.5, 0.5), ("C5", 22, 2),
        ("C5", 24, 0.5), ("D5", 24.5, 0.5), ("E5", 25, 1), ("G5", 26, 1), ("C6", 27, 1),
        ("B5", 28, 1), ("G5", 29, 1), ("A5", 30, 2),
    ]
    for note, beat, length in melody:
        tr.add(beat, bell(hz(note), max(1.4, length * tr.beat + 0.9)), 0.42, 0.1)
    for bar in range(8):
        tr.add(bar * 4, kick(0.3), 0.18)
        tr.add(bar * 4 + 2.5, kick(0.3), 0.1)
    return tr.render(reverb=0.35, room=2.4)


def mine() -> np.ndarray:
    """E minor, 124 BPM, 16 bars — driving drill rhythm with a bright lead hook."""
    tr = Track(124, 16)
    prog = [("E", "m"), ("C", "M"), ("G", "M"), ("D", "M")] * 4
    for bar, (root, q) in enumerate(prog):
        b = bar * 4
        tr.add(b, pad(chord(root, q, 3), 4 * tr.beat, 1600, 0.15), 0.08)
        for e in range(8):
            octave = 1 if e % 2 == 0 else 2
            tr.add(b + e * 0.5, bass(hz(f"{root}{octave + 1}"), tr.beat * 0.45), 0.3)
        for s in range(16):
            f = chord(root, q, 4)[[0, 1, 2, 1][s % 4]] * (2 if s % 8 >= 4 else 1)
            tr.add(b + s * 0.25, pluck(f, 0.18), 0.03, 0.5 if s % 2 else -0.5)
        for beat in range(4):
            tr.add(b + beat, kick(), 0.5)
            tr.add(b + beat + 0.5, hat(), 0.18, 0.3)
        tr.add(b + 1, snare(), 0.3)
        tr.add(b + 3, snare(), 0.3)
    hook = [
        ("B4", 0, 0.5), ("E5", 0.5, 0.5), ("G5", 1, 1), ("F#5", 2, 0.5), ("E5", 2.5, 0.5), ("D5", 3, 1),
        ("E5", 4, 0.5), ("G5", 4.5, 0.5), ("C6", 5, 1), ("B5", 6, 1), ("G5", 7, 1),
        ("D5", 8, 0.5), ("G5", 8.5, 0.5), ("B5", 9, 1), ("A5", 10, 0.5), ("G5", 10.5, 0.5), ("F#5", 11, 1),
        ("A5", 12, 1), ("F#5", 13, 0.5), ("D5", 13.5, 0.5), ("E5", 14, 2),
    ]
    answer = [
        ("G5", 0, 1), ("B5", 1, 1), ("E6", 2, 1.5), ("D6", 3.5, 0.5),
        ("C6", 4, 1), ("B5", 5, 0.5), ("G5", 5.5, 0.5), ("E5", 6, 2),
        ("D5", 8, 0.5), ("F#5", 8.5, 0.5), ("A5", 9, 1), ("D6", 10, 1), ("C6", 11, 1),
        ("B5", 12, 1.5), ("A5", 13.5, 0.5), ("B5", 14, 2),
    ]
    for start, phrase in ((0, hook), (16, hook), (32, answer), (48, hook)):
        for note, beat, length in phrase:
            tr.add(start + beat, lead(hz(note), length * tr.beat * 0.92), 0.3, -0.1)
            tr.add(start + beat + 0.75, lead(hz(note), length * tr.beat * 0.6, 2200), 0.05, 0.6)  # echo
    return tr.render(reverb=0.22, room=1.4)


def chamber() -> np.ndarray:
    """D minor, 70 BPM, 8 bars — rebirth / ending: choir, timpani and a horn theme."""
    tr = Track(70, 8)
    prog = [("D", "m"), ("A#", "M"), ("F", "M"), ("A", "M")] * 2
    for bar, (root, q) in enumerate(prog):
        b = bar * 4
        tr.add(b, choir(chord(root, q, 3), 4 * tr.beat + 0.6), 0.2)
        tr.add(b, bass(hz(f"{root}2"), 4 * tr.beat * 0.95), 0.28)
        tr.add(b, timpani(hz(f"{root}2")), 0.35)
        tr.add(b + 3.5, timpani(hz(f"{root}2"), 0.6), 0.18)
    theme = [
        ("D4", 0, 1), ("A4", 1, 1), ("F4", 2, 1.5), ("E4", 3.5, 0.5),
        ("D4", 4, 1), ("F4", 5, 1), ("A#4", 6, 2),
        ("A4", 8, 1), ("C5", 9, 1), ("F5", 10, 1.5), ("E5", 11.5, 0.5),
        ("C#5", 12, 1), ("E5", 13, 1), ("A4", 14, 2),
        ("D5", 16, 1.5), ("C5", 17.5, 0.5), ("A#4", 18, 1), ("A4", 19, 1),
        ("A#4", 20, 1), ("D5", 21, 1), ("F5", 22, 2),
        ("E5", 24, 1), ("F5", 25, 1), ("G5", 26, 1), ("A5", 27, 1),
        ("E5", 28, 1.5), ("C#5", 29.5, 0.5), ("D5", 30, 2),
    ]
    for note, beat, length in theme:
        tr.add(beat, horn(hz(note), length * tr.beat * 0.97), 0.44, 0.05)
        tr.add(beat, horn(hz(note) / 2, length * tr.beat * 0.97), 0.12, -0.2)
    return tr.render(reverb=0.38, room=3.0)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, fn in (("bgm_hub_v2", hub), ("bgm_mine_v2", mine), ("bgm_chamber_v2", chamber)):
        audio = fn()
        sf.write(OUT / f"{name}.mp3", audio, SR, format="MP3", subtype="MPEG_LAYER_III")
        print(f"{name}.mp3  {len(audio) / SR:.1f}s")


if __name__ == "__main__":
    main()

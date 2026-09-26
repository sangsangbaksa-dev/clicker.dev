#!/usr/bin/env python3
"""Render the clicker BGM loops (hub / mine / chamber) as seamless MP3 files (plays on iOS Safari too).

Each track is composed on a bar grid so the loop point lands on a downbeat, and the
reverb tail is folded back onto the start so the seam is inaudible. Every track has
a clear lead melody on top (mallet + flute / square lead / horn) over pads, bass and drums.

    pip install numpy soundfile
    python3 scripts/clicker-bgm.py            # all tracks
    python3 scripts/clicker-bgm.py hub        # just one
"""
from __future__ import annotations

import sys
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


def epiano(f: float, dur: float) -> np.ndarray:
    """FM tine electric piano — warm body, glassy attack. Hub chord comping."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * f * t + 1.1 * np.exp(-t * 2.5) * np.sin(2 * np.pi * f * t))
    tine = 0.18 * np.sin(2 * np.pi * f * 14 * t) * np.exp(-t * 24)
    return (body * np.exp(-t * 1.6) + tine) * env(n, 0.004, 0.12)


def mallet(f: float, dur: float) -> np.ndarray:
    """Soft marimba/kalimba — the hub melody voice."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t * 14)
    x += 0.12 * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t * 40)
    return x * np.exp(-t * 3.2) * env(n, 0.002, 0.08)


def flute(f: float, dur: float) -> np.ndarray:
    """Breathy sine lead with delayed vibrato — the hub B-section voice."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5 * t) * np.clip((t - 0.15) * 3, 0, 1)
    phase = np.cumsum(f * vib) / SR
    x = np.sin(2 * np.pi * phase) + 0.12 * np.sin(4 * np.pi * phase)
    breath = RNG.standard_normal(n)
    breath = lowpass(breath - lowpass(breath, 1200), 5000) * 0.08
    return (x + breath) * env(n, 0.06, 0.15, 0.85)


def shaker(dur: float = 0.08) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = RNG.standard_normal(n)
    x = lowpass(x - lowpass(x, 4500), 11000)
    return x * np.clip(t / 0.01, 0, 1) * np.exp(-t * 45)


def rim(dur: float = 0.12) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    click = np.sin(2 * np.pi * 820 * t) + 0.5 * np.sin(2 * np.pi * 1650 * t)
    noise = RNG.standard_normal(n)
    noise = noise - lowpass(noise, 2500)
    return (click * np.exp(-t * 60) + noise * 0.4 * np.exp(-t * 80))


def notes(spec: str) -> list[float]:
    return [hz(n) for n in spec.split()]


def hub() -> np.ndarray:
    """D major, 92 BPM, 16 bars — relaxed lo-fi groove: e-piano comping, mallet hook,
    breathy flute answer in the B section, walking sub bass and brushed drums."""
    tr = Track(92, 16)
    # (bass root, bass fifth, e-piano voicing, approach note into next bar)
    prog = [
        ("D2", "A2", "A3 C#4 E4 F#4", "A#2"),   # Dmaj7
        ("B1", "F#2", "A3 B3 D4 F#4", "F#2"),   # Bm7
        ("G1", "D2", "F#3 A3 B3 D4", "G#1"),    # Gmaj7
        ("A1", "E2", "G3 A3 D4 E4", "C#2"),     # A7sus
        ("D2", "A2", "A3 C#4 E4 F#4", "E2"),    # Dmaj7
        ("F#2", "C#2", "E3 A3 C#4 F#4", "F#2"), # F#m7
        ("G1", "D2", "F#3 A3 B3 D4", "G#1"),    # Gmaj7
        ("A1", "E2", "G3 A3 C#4 E4", "D#2"),    # A7
        ("E2", "B1", "G3 B3 D4 E4", "E2"),      # Em7
        ("F#2", "C#2", "E3 A3 C#4 F#4", "F#2"), # F#m7
        ("G1", "D2", "F#3 A3 B3 D4", "E2"),     # Gmaj7
        ("F#2", "A2", "A3 C#4 D4 F#4", "D#2"),  # D/F#
        ("E2", "B1", "G3 B3 D4 E4", "G#1"),     # Em7
        ("A1", "E2", "G3 A3 C#4 E4", "C#2"),    # A7
        ("D2", "A2", "A3 C#4 E4 F#4", "B1"),    # Dmaj7
        ("A1", "E2", "G3 A3 D4 E4", "C#2"),     # A7sus → loops to Dmaj7
    ]
    for bar, (root, fifth, voicing, approach) in enumerate(prog):
        b = bar * 4
        chord_f = notes(voicing)
        # E-piano comping: long chord on 1, push on the "and" of 2, ghost on 4.
        for beat, length, gain in ((0, 2.4, 0.1), (2.5, 1.4, 0.075), (3.5, 0.5, 0.04)):
            for i, f in enumerate(chord_f):
                tr.add(b + beat + i * 0.012, epiano(f, length * tr.beat), gain, -0.25 + i * 0.15)
        tr.add(b, pad(chord_f, 4 * tr.beat, 900, 0.8), 0.07, 0)
        # Walking sub bass.
        tr.add(b, bass(hz(root), 1.4 * tr.beat), 0.34)
        tr.add(b + 1.5, bass(hz(root), 0.4 * tr.beat), 0.2)
        tr.add(b + 2, bass(hz(fifth), 1.4 * tr.beat), 0.28)
        tr.add(b + 3.5, bass(hz(approach), 0.45 * tr.beat), 0.22)
        # Brushed drums.
        tr.add(b, kick(0.3), 0.32)
        tr.add(b + 2.5, kick(0.3), 0.22)
        if bar % 2:
            tr.add(b + 3.75, kick(0.25), 0.12)
        tr.add(b + 1, rim(), 0.2, 0.15)
        tr.add(b + 3, rim(), 0.2, 0.15)
        for s in range(16):
            tr.add(b + s * 0.25, shaker(), 0.1 if s % 2 else 0.05, -0.45)
    # Turnaround fill so the loop point feels like a phrase start.
    for beat in (62.5, 62.75, 63.25, 63.5, 63.75):
        tr.add(beat, rim(), 0.08, 0.15)

    hook = [  # A section, bars 1–8 — mallet
        ("F#5", 0, .5), ("A5", .5, .5), ("C#6", 1, 1.5), ("A5", 2.5, .5), ("F#5", 3, 1),
        ("D5", 4, .5), ("F#5", 4.5, .5), ("B5", 5, 1.5), ("A5", 6.5, .5), ("F#5", 7, 1),
        ("G5", 8, .5), ("B5", 8.5, .5), ("D6", 9, 1), ("C#6", 10, .5), ("B5", 10.5, .5), ("A5", 11, 1),
        ("E5", 12, 1), ("G5", 13, .5), ("A5", 13.5, 2),
        ("F#5", 16, .5), ("A5", 16.5, .5), ("C#6", 17, 1), ("E6", 18, 1), ("C#6", 19, 1),
        ("A5", 20, 1.5), ("E5", 21.5, .5), ("F#5", 22, 1), ("C#5", 23, 1),
        ("D5", 24, .5), ("G5", 24.5, .5), ("B5", 25, 1), ("A5", 26, .5), ("G5", 26.5, .5), ("F#5", 27, 1),
        ("E5", 28, 1), ("G5", 29, .5), ("C#6", 29.5, .5), ("E6", 30, 1.5),
    ]
    answer = [  # B section, bars 9–16 — flute, mallet doubling an octave down
        ("B5", 32, 1), ("G5", 33, .5), ("E5", 33.5, .5), ("D6", 34, 1.5), ("B5", 35.5, .5),
        ("C#6", 36, 1), ("A5", 37, .5), ("F#5", 37.5, .5), ("E6", 38, 1), ("C#6", 39, 1),
        ("D6", 40, .5), ("B5", 40.5, .5), ("F#6", 41, 1.5), ("E6", 42.5, .5), ("D6", 43, 1),
        ("A5", 44, 2), ("F#5", 46, .5), ("A5", 46.5, .5), ("B5", 47, .5), ("C#6", 47.5, .5),
        ("D6", 48, 1), ("B5", 49, 1), ("G5", 50, .5), ("A5", 50.5, .5), ("B5", 51, 1),
        ("C#6", 52, 1), ("E6", 53, .5), ("C#6", 53.5, .5), ("A5", 54, 1), ("G5", 55, 1),
        ("F#5", 56, 1.5), ("E5", 57.5, .5), ("D5", 58, 1), ("A4", 59, 1),
        ("A4", 60, 1), ("D5", 61, .5), ("E5", 61.5, .5), ("E5", 62, 1.5),
    ]
    for note, beat, length in hook:
        tr.add(beat, mallet(hz(note), max(1.2, length * tr.beat + 0.6)), 0.34, 0.15)
        tr.add(beat + 0.75, mallet(hz(note), 0.9), 0.06, -0.55)  # dotted-8th echo
    for note, beat, length in answer:
        tr.add(beat, flute(hz(note), length * tr.beat * 0.95), 0.2, 0.05)
        tr.add(beat, mallet(hz(note) / 2, max(1.0, length * tr.beat + 0.4)), 0.14, -0.2)
    # Sparkle at the end of each 8-bar phrase.
    for start in (30, 62):
        for i, n in enumerate(("A6", "F#6", "D6", "A5")):
            tr.add(start + 1 + i * 0.25, mallet(hz(n), 1.0), 0.06, 0.5 - i * 0.3)
    return tr.render(reverb=0.3, room=2.2)


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
    tracks = {"hub": ("bgm_hub_v3", hub), "mine": ("bgm_mine_v2", mine), "chamber": ("bgm_chamber_v2", chamber)}
    for key in sys.argv[1:] or tracks:
        name, fn = tracks[key]
        audio = fn()
        sf.write(OUT / f"{name}.mp3", audio, SR, format="MP3", subtype="MPEG_LAYER_III")
        print(f"{name}.mp3  {len(audio) / SR:.1f}s")


if __name__ == "__main__":
    main()

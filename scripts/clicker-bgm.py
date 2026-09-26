#!/usr/bin/env python3
"""Render the clicker BGM loops (hub / mine / chamber) as seamless MP3 files (plays on iOS Safari too).

Each track is composed on a bar grid so the loop point lands on a downbeat, and the
reverb tail is folded back onto the start so the seam is inaudible.

v3 set:
  hub      D dorian lo-fi, 88 BPM — electric piano, flute lead, brushed swing drums
  mine     F# minor synthwave, 128 BPM — sidechained supersaws, 16th bass, bright lead
  chamber  C minor cinematic, 72 BPM — strings, choir, piano ostinato, taiko, horn theme

Every file is written as [PRE_ROLL of loop end][loop][PRE_ROLL of loop start], so the
player can loop between PRE_ROLL and PRE_ROLL + loop length sample-accurately no matter
how much encoder delay the browser's MP3 decoder leaves in.

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


# ---------- v3 instruments ----------

def highpass(x: np.ndarray, cutoff: float) -> np.ndarray:
    return x - lowpass(x, cutoff)


def epiano(f: float, dur: float) -> np.ndarray:
    """FM electric piano (Rhodes-ish): soft bark on the attack, warm sustain, faint tine."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    index = 1.4 * np.exp(-t * 5) + 0.25
    body = np.sin(2 * np.pi * f * t + index * np.sin(2 * np.pi * f * t))
    tine = 0.25 * np.sin(2 * np.pi * f * 14 * t) * np.exp(-t * 22)
    trem = 1 + 0.08 * np.sin(2 * np.pi * 4.2 * t)
    return (body + tine) * np.exp(-t * 1.6) * trem * env(n, 0.004, 0.12)


def flute(f: float, dur: float) -> np.ndarray:
    """Breathy sine lead with delayed vibrato."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    vib = 1 + 0.007 * np.sin(2 * np.pi * 5.2 * t) * np.clip((t - 0.15) * 3, 0, 1)
    phase = np.cumsum(f * vib) / SR
    tone = np.sin(2 * np.pi * phase) + 0.18 * np.sin(4 * np.pi * phase) + 0.06 * np.sin(6 * np.pi * phase)
    breath = lowpass(highpass(RNG.standard_normal(n), 1800), 5000) * 0.08
    return (tone + breath) * env(n, 0.06, 0.12, 0.85)


def supersaw(freqs: list[float], dur: float, cutoff: float = 3000, attack: float = 0.01, release: float = 0.1) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    dets = (-0.011, -0.006, -0.002, 0.0, 0.002, 0.006, 0.011)
    for f in freqs:
        for d in dets:
            x += saw(f * (1 + d), t + RNG.random())
    x /= len(freqs) * len(dets) * 0.6
    return lowpass(x, cutoff) * env(n, attack, release)


def saw_bass(f: float, dur: float, cutoff: float = 900) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = 0.7 * saw(f, t) + 0.5 * np.sin(2 * np.pi * f * t) + 0.3 * saw(f * 1.004, t)
    sweep = cutoff * (0.5 + 1.5 * np.exp(-t * 18))
    # Two passes at the start/end cutoffs approximate a closing filter.
    x = lowpass(x, float(sweep[0])) * np.exp(-t * 3) + lowpass(x, cutoff * 0.5) * (1 - np.exp(-t * 3))
    return x * env(n, 0.003, 0.03)


def sub(f: float, dur: float) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) + 0.15 * np.sin(4 * np.pi * f * t)) * env(n, 0.01, 0.08)


def arp(f: float, dur: float) -> np.ndarray:
    """Glassy pluck for arpeggios."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = square(f, t, 0.3) * 0.5 + saw(f * 2, t) * 0.25 + np.sin(2 * np.pi * f * t) * 0.4
    return lowpass(x * np.exp(-t * 11), 4200) * env(n, 0.001, 0.02)


def synth_lead(f: float, dur: float, bright: float = 4200) -> np.ndarray:
    """Detuned square/saw lead with a little pitch scoop and vibrato."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    scoop = 1 - 0.03 * np.exp(-t * 40)
    vib = 1 + 0.008 * np.sin(2 * np.pi * 5.8 * t) * np.clip((t - 0.12) * 4, 0, 1)
    ph1 = np.cumsum(f * scoop * vib) / SR
    ph2 = np.cumsum(f * 1.006 * scoop * vib) / SR
    x = 0.45 * np.where(ph1 % 1 < 0.5, 1.0, -1.0) + 0.45 * (2 * (ph2 % 1) - 1) + 0.3 * np.sin(2 * np.pi * ph1 * 2)
    return lowpass(x, bright) * env(n, 0.008, 0.07, 0.9)


def piano(f: float, dur: float) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    index = 1.1 * np.exp(-t * 7)
    x = np.sin(2 * np.pi * f * t + index * np.sin(2 * np.pi * f * 2 * t))
    x += 0.25 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t * 4)
    hammer = lowpass(RNG.standard_normal(n), 3000) * np.exp(-t * 180) * 0.3
    return (x * np.exp(-t * 1.8) + hammer) * env(n, 0.002, 0.1)


def strings(freqs: list[float], dur: float) -> np.ndarray:
    return supersaw(freqs, dur, cutoff=1900, attack=0.7, release=0.9) * 0.9


def taiko(dur: float = 0.9) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 55 + 70 * np.exp(-t * 20)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5)
    skin = lowpass(RNG.standard_normal(n), 900) * np.exp(-t * 35) * 0.6
    return body + skin


def swell(dur: float) -> np.ndarray:
    """Reverse cymbal: noise rising into the next downbeat."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = highpass(RNG.standard_normal(n), 4000)
    return x * (t / dur) ** 3 * 0.5


def clap(dur: float = 0.25) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = lowpass(highpass(RNG.standard_normal(n), 900), 5000)
    e = np.zeros(n)
    for off in (0.0, 0.011, 0.022):
        k = int(off * SR)
        e[k:] += np.exp(-(t[: n - k]) * (55 if off < 0.02 else 18))
    return x * e * 0.6


def shaker(dur: float = 0.08) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    return highpass(RNG.standard_normal(n), 4500) * np.sin(np.pi * np.clip(t / dur, 0, 1)) * 0.35


def rim(dur: float = 0.12) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * 820 * t) * np.exp(-t * 60)
    click = highpass(RNG.standard_normal(n), 2500) * np.exp(-t * 90)
    return tone * 0.6 + click * 0.5


def crackle(seconds: float) -> np.ndarray:
    n = int(seconds * SR)
    x = np.zeros(n)
    pops = RNG.integers(0, n, int(seconds * 9))
    x[pops] = RNG.uniform(-1, 1, len(pops))
    return lowpass(x, 3500) * 3 + lowpass(RNG.standard_normal(n), 900) * 0.01


def ext_chord(root: str, quality: str, octave: int = 3) -> list[float]:
    base = hz(f"{root}{octave}")
    steps = {
        "m": [0, 3, 7], "M": [0, 4, 7], "m7": [0, 3, 7, 10], "M7": [0, 4, 7, 11],
        "7": [0, 4, 7, 10], "m9": [0, 3, 7, 10, 14], "sus": [0, 5, 7], "add9": [0, 4, 7, 14],
    }[quality]
    return [base * 2 ** (st / 12) for st in steps]


PRE_ROLL = 0.5


def duck_envelope(n: int, kicks: list[int], depth: float, recover: float) -> np.ndarray:
    """Sidechain gain: dips on each kick and recovers exponentially."""
    g = np.ones(n)
    t = np.arange(int(recover * 6 * SR)) / SR
    shape = 1 - depth * np.exp(-t / recover)
    for k in kicks:
        if k >= n:
            continue
        end = min(n, k + len(shape))
        g[k:end] = np.minimum(g[k:end], shape[: end - k])
    return g


def with_pre_roll(loop: np.ndarray) -> np.ndarray:
    k = int(PRE_ROLL * SR)
    return np.concatenate([loop[-k:], loop, loop[:k]])


class DuckTrack(Track):
    """Track with a second bus that is sidechained to the kick before mixing."""

    def __init__(self, bpm: float, bars: int):
        super().__init__(bpm, bars)
        self.dl = np.zeros_like(self.l)
        self.dr = np.zeros_like(self.r)
        self.kicks: list[int] = []

    def add_duck(self, beat: float, x: np.ndarray, gain: float, pan: float = 0.0):
        i = self.at(beat)
        end = min(len(self.dl), i + len(x))
        seg = x[: end - i] * gain
        self.dl[i:end] += seg * np.sqrt((1 - pan) / 2)
        self.dr[i:end] += seg * np.sqrt((1 + pan) / 2)

    def render(self, reverb: float, room: float, depth: float = 0.6) -> np.ndarray:
        g = duck_envelope(len(self.dl), self.kicks + [k + self.n for k in self.kicks], depth, 0.09)
        self.l += self.dl * g
        self.r += self.dr * g
        return super().render(reverb, room)


# ---------- v3 arrangements ----------

def hub() -> np.ndarray:
    """D dorian lo-fi, 88 BPM, 16 bars — warm electric piano, flute melody, swung brushes."""
    tr = Track(88, 16)
    prog = [("D", "m9"), ("G", "7"), ("C", "M7"), ("A", "m7"),
            ("D", "m9"), ("G", "7"), ("F", "M7"), ("E", "7")] * 2
    swing = 0.16
    for bar, (root, q) in enumerate(prog):
        b = bar * 4
        voicing = ext_chord(root, q, 3)[1:] + [ext_chord(root, q, 4)[0]]
        # Comping: a held chord on 1 and a lighter push on the "and" of 2.
        for f in voicing:
            tr.add(b, epiano(f, 2.2 * tr.beat), 0.11, -0.25)
            tr.add(b + 2.5 + swing, epiano(f, 1.3 * tr.beat), 0.07, 0.25)
        tr.add(b, sub(hz(f"{root}2"), 1.6 * tr.beat), 0.34)
        tr.add(b + 2.5 + swing, sub(hz(f"{root}2"), 0.9 * tr.beat), 0.26)
        tr.add(b + 3.5 + swing, sub(ext_chord(root, q, 2)[2], 0.45 * tr.beat), 0.2)
        tr.add(b, kick(0.3), 0.3)
        tr.add(b + 2.5 + swing, kick(0.3), 0.18)
        tr.add(b + 1, rim(), 0.16, 0.2)
        tr.add(b + 3, rim(), 0.16, 0.2)
        for e in range(8):
            off = e * 0.5 + (swing if e % 2 else 0)
            tr.add(b + off, shaker(), 0.14 if e % 2 else 0.22, -0.4)
    melody_a = [
        ("A4", 0, 1.5), ("C5", 1.5, 0.5), ("D5", 2, 1), ("F5", 3, 1),
        ("E5", 4, 1.5), ("D5", 5.5, 0.5), ("B4", 6, 2),
        ("C5", 8, 1), ("E5", 9, 1), ("G5", 10, 1.5), ("E5", 11.5, 0.5),
        ("E5", 12, 1), ("D5", 13, 1), ("C5", 14, 2),
        ("A4", 16, 1), ("D5", 17, 1), ("F5", 18, 1), ("A5", 19, 1),
        ("G5", 20, 1.5), ("F5", 21.5, 0.5), ("D5", 22, 2),
        ("C5", 24, 1), ("A4", 25, 1), ("C5", 26, 1), ("F5", 27, 1),
        ("E5", 28, 2), ("G#4", 30, 2),
    ]
    melody_b = [
        ("D5", 0, 1), ("F5", 1, 0.5), ("A5", 1.5, 1.5), ("G5", 3, 1),
        ("F5", 4, 1), ("E5", 5, 1), ("D5", 6, 2),
        ("E5", 8, 0.5), ("G5", 8.5, 0.5), ("B5", 9, 1.5), ("A5", 10.5, 0.5), ("G5", 11, 1),
        ("E5", 12, 1.5), ("C5", 13.5, 0.5), ("A4", 14, 2),
        ("F5", 16, 1), ("E5", 17, 0.5), ("D5", 17.5, 0.5), ("C5", 18, 1), ("D5", 19, 1),
        ("B4", 20, 1), ("D5", 21, 1), ("F5", 22, 2),
        ("E5", 24, 1), ("C5", 25, 1), ("A4", 26, 1), ("C5", 27, 1),
        ("B4", 28, 1), ("G#4", 29, 1), ("A4", 30, 2),
    ]
    for start, phrase in ((0, melody_a), (32, melody_b)):
        for note, beat, length in phrase:
            tr.add(start + beat, flute(hz(note), length * tr.beat * 0.95 + 0.1), 0.26, 0.1)
    tr.add(0, crackle(tr.n / SR), 0.5)
    return tr.render(reverb=0.3, room=2.2)


def mine() -> np.ndarray:
    """F# minor synthwave, 128 BPM, 32 bars — pumping supersaws, 16th bass, hook lead."""
    tr = DuckTrack(128, 32)
    prog = [("F#", "m"), ("D", "M"), ("A", "M"), ("E", "M")] * 8
    for bar, (root, q) in enumerate(prog):
        b = bar * 4
        section = bar // 8  # 0 intro-drive, 1 build, 2 lift, 3 peak
        half_time = section == 2 and bar % 8 < 4
        tr.add_duck(b, supersaw(chord(root, q, 3) + [hz(f"{root}4")], 4 * tr.beat, 2400 + 600 * section), 0.16)
        for s in range(16):
            octave = 1 if s % 2 == 0 else 2
            tr.add_duck(b + s * 0.25, saw_bass(hz(f"{root}{octave}"), tr.beat * 0.22, 700), 0.22)
        arp_notes = chord(root, q, 4) + [chord(root, q, 5)[0]]
        pattern = [0, 1, 2, 3, 2, 1, 2, 3]
        if section >= 1:
            for s in range(16):
                f = arp_notes[pattern[s % 8]] * (2 if (s // 8) % 2 and section == 3 else 1)
                tr.add(b + s * 0.25, arp(f, 0.2), 0.05, 0.55 if s % 2 else -0.55)
        for beat in range(4):
            if half_time and beat % 2:
                continue
            k = tr.at(b + beat)
            tr.kicks.append(k)
            tr.add(b + beat, kick(0.4), 0.6)
            tr.add(b + beat + 0.5, hat(0.12), 0.16, 0.35)
        for s in range(16):
            if s % 2:
                tr.add(b + s * 0.25, hat(0.04), 0.06, -0.3)
        if not half_time:
            tr.add(b + 1, clap(), 0.34)
            tr.add(b + 3, clap(), 0.34)
        else:
            tr.add(b + 2, clap(), 0.34)
        if bar % 8 == 7:
            tr.add(b, swell(4 * tr.beat), 0.5)
    hook = [
        ("C#5", 0, 0.5), ("F#5", 0.5, 0.5), ("A5", 1, 0.75), ("G#5", 1.75, 0.75), ("F#5", 2.5, 0.5), ("E5", 3, 1),
        ("F#5", 4, 0.5), ("A5", 4.5, 0.5), ("D6", 5, 1), ("C#6", 6, 0.5), ("A5", 6.5, 1.5),
        ("E5", 8, 0.5), ("A5", 8.5, 0.5), ("C#6", 9, 1), ("B5", 10, 0.5), ("A5", 10.5, 0.5), ("G#5", 11, 1),
        ("B5", 12, 1), ("G#5", 13, 0.5), ("E5", 13.5, 0.5), ("F#5", 14, 2),
    ]
    answer = [
        ("A5", 0, 1), ("C#6", 1, 1), ("F#6", 2, 1.5), ("E6", 3.5, 0.5),
        ("D6", 4, 1), ("C#6", 5, 0.5), ("A5", 5.5, 0.5), ("F#5", 6, 2),
        ("E5", 8, 0.5), ("G#5", 8.5, 0.5), ("B5", 9, 1), ("E6", 10, 1), ("D6", 11, 1),
        ("C#6", 12, 1.5), ("B5", 13.5, 0.5), ("C#6", 14, 2),
    ]
    # Bars 16–19 (the half-time lift) leave the lead out; the last hook doubles an octave up.
    plan = [(0, hook, False), (16, hook, False), (32, answer, False), (48, hook, False),
            (80, answer, False), (96, hook, True), (112, answer, False)]
    for start, phrase, octave_up in plan:
        for note, beat, length in phrase:
            f = hz(note)
            tr.add(start + beat, synth_lead(f, length * tr.beat * 0.9), 0.24, -0.08)
            tr.add(start + beat + 0.75, synth_lead(f, length * tr.beat * 0.6, 2600), 0.05, 0.6)
            if octave_up:
                tr.add(start + beat, synth_lead(f * 2, length * tr.beat * 0.9, 5200), 0.09, 0.3)
    return tr.render(reverb=0.2, room=1.3, depth=0.55)


def chamber() -> np.ndarray:
    """C minor cinematic, 72 BPM, 16 bars — strings, choir, piano ostinato, taiko, horn theme."""
    tr = Track(72, 16)
    prog = [("C", "m"), ("G#", "M"), ("D#", "M"), ("A#", "M"),
            ("C", "m"), ("G#", "M"), ("F", "m"), ("G", "M")] * 2
    for bar, (root, q) in enumerate(prog):
        b = bar * 4
        second_half = bar >= 8
        tr.add(b, strings(chord(root, q, 3), 4 * tr.beat + 0.5), 0.2 if not second_half else 0.26)
        tr.add(b, choir(chord(root, q, 4), 4 * tr.beat + 0.5), 0.1 if not second_half else 0.16)
        tr.add(b, bass(hz(f"{root}2"), 4 * tr.beat * 0.95), 0.3)
        notes = chord(root, q, 4)
        figure = [0, 1, 2, 1, 0, 1, 2, 1]
        for e in range(8):
            tr.add(b + e * 0.5, piano(notes[figure[e]] * (2 if e == 2 else 1), 1.2), 0.1, -0.3 if e % 2 else 0.3)
        tr.add(b, taiko(), 0.4)
        if second_half:
            tr.add(b + 1.5, taiko(0.6), 0.22)
            tr.add(b + 2, taiko(0.7), 0.3)
            tr.add(b + 3.5, taiko(0.5), 0.18)
        if bar in (7, 15):
            tr.add(b, swell(4 * tr.beat), 0.4)
    theme = [
        ("G4", 0, 1), ("C5", 1, 1), ("D#5", 2, 1.5), ("D5", 3.5, 0.5),
        ("C5", 4, 1), ("D#5", 5, 1), ("G5", 6, 2),
        ("G#5", 8, 1.5), ("G5", 9.5, 0.5), ("F5", 10, 1), ("D#5", 11, 1),
        ("D5", 12, 1), ("A#4", 13, 1), ("F5", 14, 2),
        ("D#5", 16, 1), ("G5", 17, 1), ("C6", 18, 1.5), ("A#5", 19.5, 0.5),
        ("G#5", 20, 1), ("G5", 21, 1), ("D#5", 22, 2),
        ("F5", 24, 1), ("G#5", 25, 1), ("C6", 26, 1), ("D6", 27, 1),
        ("B5", 28, 2), ("G5", 30, 2),
    ]
    for note, beat, length in theme:
        tr.add(32 + beat, horn(hz(note), length * tr.beat * 0.97), 0.34, 0.05)
        tr.add(32 + beat, horn(hz(note) / 2, length * tr.beat * 0.97), 0.1, -0.2)
    # First half: the theme is sketched softly on piano an octave up.
    for note, beat, length in theme:
        tr.add(beat, piano(hz(note) * 2, max(1.0, length * tr.beat)), 0.09, 0.2)
    return tr.render(reverb=0.4, room=3.0)


def master(stereo: np.ndarray, low_cut: float, presence: float, air: float) -> np.ndarray:
    """Phone-speaker friendly EQ: tame sub/low end, lift presence and air, then re-limit.

    low_cut   fraction of the <130 Hz band removed (0.6 ≈ -8 dB)
    presence  gain added to the 1.8–6 kHz band
    air       gain added above 6 kHz
    """
    # Filter circularly (wrap a second of the loop around it) so the seam stays click-free.
    k = SR
    out = []
    for ch in stereo.T:
        x = np.concatenate([ch[-k:], ch, ch[:k]])
        x = highpass(x, 35)
        x = x - low_cut * lowpass(x, 130)
        mid = highpass(x, 1800)
        x = x + presence * (mid - highpass(mid, 6000)) + air * highpass(x, 6000)
        out.append(x[k:-k])
    y = np.stack(out, axis=1)
    y = np.tanh(y / np.max(np.abs(y)) * 1.3) / np.tanh(1.3)
    return y * 10 ** (-1.5 / 20)


# name, arrangement, (low_cut, presence, air)
TRACKS = (
    ("bgm_hub_v3", hub, (0.55, 2.2, 1.2)),
    ("bgm_mine_v3", mine, (0.45, 0.9, 0.5)),
    ("bgm_chamber_v3", chamber, (0.75, 2.0, 0.8)),
)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, fn, eq in TRACKS:
        loop = master(fn(), *eq)
        sf.write(OUT / f"{name}.mp3", with_pre_roll(loop), SR, format="MP3", subtype="MPEG_LAYER_III")
        # The player needs this exact loop length (seconds) — see use-clicker-bgm.ts.
        print(f"{name}.mp3  loop {len(loop) / SR:.6f}s  (+{PRE_ROLL}s pre/post roll)")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Render the clicker BGM loops (hub / mine / chamber and one theme per world) as seamless MP3 files (plays on iOS Safari too).

The score is dark and grand to match the art: minor keys and Phrygian, low brass themes
over choir, organ, cellos, sub drones, tolling bells and war drums. Each track is composed
on a bar grid so the loop point lands on a downbeat, and the reverb tail is folded back
onto the start so the seam is inaudible.

    pip install numpy soundfile
    python3 scripts/clicker-bgm.py
"""
from __future__ import annotations

import math
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


# ---------- world instruments ----------

def glass(f: float, dur: float) -> np.ndarray:
    """Crystal bell: inharmonic FM partials that ring and shimmer — Phase Vault."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    mod = np.sin(2 * np.pi * f * 7.0 * t) * 1.4 * np.exp(-t * 4)
    x = np.sin(2 * np.pi * f * t + mod) + 0.45 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 2.5)
    x += 0.2 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 6)
    shimmer = 1 + 0.08 * np.sin(2 * np.pi * 5.2 * t)
    return x * shimmer * np.exp(-t * 1.5) * env(n, 0.002, 0.08)


def arp(f: float, dur: float) -> np.ndarray:
    """Pulse-width synth with a closing filter — the relay's data stream."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    duty = 0.3 + 0.15 * np.sin(2 * np.pi * 0.7 * t)
    x = np.where((f * t) % 1 < duty, 1.0, -1.0) * 0.7 + saw(f * 1.003, t) * 0.3
    bright = lowpass(x, 5200) * np.exp(-t * 9)
    dull = lowpass(x, 900) * np.exp(-t * 4)
    return (bright * 0.7 + dull * 0.3) * env(n, 0.002, 0.02)


def blip(f: float) -> np.ndarray:
    n = int(0.07 * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * f * t) * np.exp(-t * 55)


def strings(freqs: list[float], dur: float, trem: float = 0.0) -> np.ndarray:
    """Saw ensemble; `trem` Hz adds a bowed tremolo for storm tension."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for f in freqs:
        for det in (-0.005, -0.0015, 0.0015, 0.005):
            x += saw(f * (1 + det), t + RNG.random())
    x /= len(freqs) * 4
    if trem:
        x *= 0.65 + 0.35 * np.sin(2 * np.pi * trem * t) ** 2
    return lowpass(x, 2600) * env(n, 0.08, min(0.4, dur / 3))


def tom(f: float, dur: float = 0.5) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    pitch = f * (1 + 0.8 * np.exp(-t * 30))
    return np.sin(2 * np.pi * np.cumsum(pitch) / SR) * np.exp(-t * 7)


def taiko(dur: float = 1.1) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    pitch = 52 + 60 * np.exp(-t * 18)
    body = np.sin(2 * np.pi * np.cumsum(pitch) / SR) * np.exp(-t * 4)
    skin = lowpass(RNG.standard_normal(n), 900) * np.exp(-t * 40) * 1.5
    return body + skin


def swell(dur: float, cutoff: float, rate: float, depth: float = 0.8) -> np.ndarray:
    """Filtered noise breathing in and out — waves, wind, magma."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = lowpass(lowpass(RNG.standard_normal(n), cutoff), cutoff)
    x /= np.max(np.abs(x)) + 1e-9
    return x * (1 - depth + depth * (0.5 - 0.5 * np.cos(2 * np.pi * rate * t))) * env(n, 0.5, 0.5)


def thunder(dur: float = 3.0) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    crack = (RNG.standard_normal(n) - lowpass(RNG.standard_normal(n), 3000)) * np.exp(-t * 18)
    rumble = lowpass(lowpass(RNG.standard_normal(n), 140), 140)
    rumble /= np.max(np.abs(rumble)) + 1e-9
    rumble *= np.exp(-t * 1.1) * (0.6 + 0.4 * np.sin(2 * np.pi * 1.7 * t) ** 2)
    return crack * 0.35 + rumble


def crackle(dur: float, density: float = 18) -> np.ndarray:
    """Sparse ember pops."""
    n = int(dur * SR)
    x = np.zeros(n)
    for _ in range(int(dur * density)):
        i = int(RNG.random() * (n - 400))
        pop = RNG.standard_normal(400) * np.exp(-np.arange(400) / 40)
        x[i : i + 400] += pop * RNG.random()
    return x - lowpass(x, 1800)


def dist_bass(f: float, dur: float) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.tanh((saw(f, t) + 0.6 * saw(f * 0.5, t)) * 2.6)
    return lowpass(x, 520) * env(n, 0.01, 0.1, 0.95)


def heartbeat() -> np.ndarray:
    """Lub-dub: two soft thumps."""
    a = kick(0.45) * 0.9
    b = kick(0.4) * 0.6
    gap = int(0.24 * SR)
    x = np.zeros(gap + len(b))
    x[: len(a)] += a
    x[gap:] += b
    return lowpass(x, 400) * 1.6


def play(tr: "Track", melody, voice, gain: float, pan: float = 0.0, stretch: float = 0.95, tail: float = 0.0):
    for note, beat, length in melody:
        tr.add(beat, voice(hz(note), length * tr.beat * stretch + tail), gain, pan)


# ---------- dark, grand palette ----------

def organ(freqs: list[float], dur: float, cutoff: float = 2400) -> np.ndarray:
    """Cathedral organ: drawbar partials with a slow chorus."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for f in freqs:
        for k, amp in ((0.5, 0.6), (1, 1.0), (2, 0.55), (3, 0.3), (4, 0.22), (6, 0.1)):
            for det in (-0.0015, 0.0015):
                x += amp * np.sin(2 * np.pi * f * k * (1 + det) * t + RNG.random() * 6)
    x /= len(freqs) * 5
    x *= 1 + 0.06 * np.sin(2 * np.pi * 0.35 * t)
    return lowpass(x, cutoff) * env(n, 0.35, min(0.9, dur / 3))


def low_strings(freqs: list[float], dur: float, trem: float = 0.0) -> np.ndarray:
    """Cellos and basses: darker, slower bow than `strings`."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for f in freqs:
        for det in (-0.004, -0.001, 0.002, 0.005):
            x += saw(f * (1 + det), t + RNG.random())
    x /= len(freqs) * 4
    if trem:
        x *= 0.6 + 0.4 * np.sin(2 * np.pi * trem * t) ** 2
    return lowpass(lowpass(x, 1300), 1300) * env(n, 0.25, min(0.6, dur / 3))


def brass(f: float, dur: float) -> np.ndarray:
    """Low brass: the horn doubled an octave down with a harder bite."""
    return horn(f, dur) * 0.75 + horn(f / 2, dur) * 0.55


def toll(f: float, dur: float = 4.0) -> np.ndarray:
    """Great bell: inharmonic partials, long decay — marks the downbeat."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for r, a, d in ((0.5, 0.8, 0.7), (1, 1.0, 0.9), (1.19, 0.5, 1.3), (1.56, 0.35, 1.6), (2.0, 0.4, 1.4), (2.74, 0.25, 2.2)))
    return x * env(n, 0.004, 0.2)


def drone(f: float, dur: float) -> np.ndarray:
    """Sub drone with a slow filter breath."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.5 * saw(f, t) + 0.3 * saw(f * 1.5, t)
    x *= 0.8 + 0.2 * np.sin(2 * np.pi * 0.12 * t)
    return lowpass(lowpass(x, 260), 260) * env(n, 1.2, 1.2)


def war_drums(tr: "Track", b: float, pattern: str, gain: float = 0.5):
    """Taiko pattern over one bar: 'X' = big hit, 'x' = ghost, '.' = rest (16th grid)."""
    for i, c in enumerate(pattern):
        if c == "X":
            tr.add(b + i * 0.25, taiko(), gain, float(RNG.uniform(-0.2, 0.2)))
        elif c == "x":
            tr.add(b + i * 0.25, taiko(0.5), gain * 0.4, float(RNG.uniform(-0.5, 0.5)))


def minor_chord(root: str, q: str, octave: int) -> list[float]:
    return chord(root, q, octave)


# ---------- themes (all dark and grand) ----------

def hub() -> np.ndarray:
    """Core Mine hub — D minor, 64 BPM, 8 bars: tolling bell, choir, organ and a low horn lament."""
    tr = Track(64, 8)
    prog = [("D", "m"), ("A#", "M"), ("G", "m"), ("A", "M")] * 2
    for bar, (root, q) in enumerate(prog):
        b = bar * 4
        tr.add(b, choir(chord(root, q, 3), 4 * tr.beat + 0.8), 0.24)
        tr.add(b, organ(chord(root, q, 2), 4 * tr.beat), 0.14)
        tr.add(b, drone(hz(f"{root}1"), 4 * tr.beat), 0.3)
        tr.add(b, toll(hz(f"{root}3")), 0.16, -0.2)
        tr.add(b, taiko(1.4), 0.3)
        tr.add(b + 2.5, taiko(0.6), 0.12)
    theme = [
        ("D4", 0, 2), ("F4", 2, 1), ("E4", 3, 1),
        ("D4", 4, 1.5), ("C4", 5.5, 0.5), ("A#3", 6, 2),
        ("G3", 8, 1), ("A#3", 9, 1), ("D4", 10, 1.5), ("C4", 11.5, 0.5),
        ("A3", 12, 1), ("C#4", 13, 1), ("E4", 14, 2),
        ("F4", 16, 2), ("E4", 18, 1), ("D4", 19, 1),
        ("A#3", 20, 1), ("D4", 21, 1), ("F4", 22, 2),
        ("G4", 24, 1.5), ("F4", 25.5, 0.5), ("E4", 26, 1), ("D4", 27, 1),
        ("C#4", 28, 1.5), ("E4", 29.5, 0.5), ("D4", 30, 2),
    ]
    play(tr, theme, brass, 0.42, 0.05, 0.97)
    return tr.render(reverb=0.45, room=3.4)


def cello(f: float, dur: float) -> np.ndarray:
    """Solo cello: one bowed voice with a slow, aching vibrato."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    vib = 1 + 0.007 * np.sin(2 * np.pi * 5.0 * t) * np.clip(t * 1.2, 0, 1)
    phase = np.cumsum(f * vib) / SR
    x = sum(np.sin(2 * np.pi * phase * k) / k ** 1.4 for k in range(1, 9))
    bow = np.clip(t / 0.25, 0, 1) * (0.85 + 0.15 * np.sin(2 * np.pi * 0.6 * t))
    return lowpass(x * bow, 1800) * env(n, 0.12, 0.35, 0.9)


def mine() -> np.ndarray:
    """Mine run — A minor, 84 BPM, 16 bars: a lone cello and horn lament over a slow heartbeat drum."""
    tr = Track(84, 16)
    prog = [("A", "m"), ("F", "M"), ("C", "M"), ("E", "M"), ("D", "m"), ("A", "m"), ("E", "M"), ("A", "m")] * 2
    for bar, (root, q) in enumerate(prog):
        b = bar * 4
        tr.add(b, choir(chord(root, q, 3), 4 * tr.beat + 0.6), 0.16)
        tr.add(b, low_strings(chord(root, q, 2), 4 * tr.beat), 0.13)
        tr.add(b, drone(hz(f"{root}1"), 4 * tr.beat), 0.2)
        # Falling bell arpeggio, like water dripping in the dark.
        tones = sorted(chord(root, q, 4), reverse=True) + [chord(root, q, 3)[2]]
        for i, f in enumerate(tones):
            tr.add(b + 0.5 + i, bell(f, 2.2), 0.05, (-0.5, -0.15, 0.15, 0.5)[i])
        # Slow heartbeat drum, not a march.
        tr.add(b, taiko(1.3), 0.3)
        tr.add(b + 0.4, taiko(0.7), 0.12)
        tr.add(b + 2, taiko(1.1), 0.18)
    lament = [
        ("E4", 0, 1.5), ("C4", 1.5, 0.5), ("A3", 2, 2),
        ("A3", 4, 1), ("C4", 5, 1), ("F4", 6, 1.5), ("E4", 7.5, 0.5),
        ("E4", 8, 1), ("D4", 9, 1), ("C4", 10, 1), ("G3", 11, 1),
        ("G#3", 12, 2), ("B3", 14, 2),
        ("A3", 16, 1), ("F4", 17, 1.5), ("E4", 18.5, 0.5), ("D4", 19, 1),
        ("C4", 20, 1.5), ("B3", 21.5, 0.5), ("A3", 22, 2),
        ("B3", 24, 1), ("D4", 25, 1), ("G#3", 26, 2),
        ("A3", 28, 4),
    ]
    answer = [
        ("A4", 0, 2), ("G4", 2, 1), ("E4", 3, 1),
        ("F4", 4, 1.5), ("E4", 5.5, 0.5), ("D4", 6, 1), ("C4", 7, 1),
        ("E4", 8, 2), ("G4", 10, 1), ("E4", 11, 1),
        ("D4", 12, 1), ("B3", 13, 1), ("G#3", 14, 2),
        ("F4", 16, 2), ("E4", 18, 1), ("D4", 19, 1),
        ("C4", 20, 1), ("E4", 21, 1), ("A4", 22, 2),
        ("G#4", 24, 1.5), ("E4", 25.5, 0.5), ("B3", 26, 2),
        ("A3", 28, 4),
    ]
    play(tr, lament, cello, 0.44, -0.1, 0.98)
    play(tr, [(n, bt + 32, l) for n, bt, l in answer], horn, 0.36, 0.1, 0.97)
    play(tr, [(n[:-1] + str(int(n[-1]) - 1), bt + 32, l) for n, bt, l in answer], cello, 0.2, -0.2, 0.98)
    return tr.render(reverb=0.46, room=3.4)


def chamber() -> np.ndarray:
    """Rebirth chamber / ending — B-flat minor, 56 BPM, 8 bars: organ, full choir, timpani and a funeral brass hymn."""
    tr = Track(56, 8)
    prog = [("A#", "m"), ("F#", "M"), ("C#", "M"), ("F", "M"), ("A#", "m"), ("D#", "m"), ("F", "M"), ("A#", "m")]
    for bar, (root, q) in enumerate(prog):
        b = bar * 4
        tr.add(b, organ(chord(root, q, 3) + [hz(f"{root}2")], 4 * tr.beat + 0.5, 2000), 0.2)
        tr.add(b, choir(chord(root, q, 3), 4 * tr.beat + 0.8), 0.24)
        tr.add(b, drone(hz(f"{root}1"), 4 * tr.beat), 0.26)
        tr.add(b, timpani(hz(f"{root}2"), 1.6), 0.36)
        if bar % 2 == 1:
            for k in range(6):
                tr.add(b + 3 + k * 0.16, timpani(hz(f"{root}2"), 0.4), 0.08 + k * 0.03)
        tr.add(b, toll(hz(f"{root}2"), 5), 0.14, 0.3)
    hymn = [
        ("A#3", 0, 2), ("C#4", 2, 1), ("C4", 3, 1),
        ("A#3", 4, 2), ("F3", 6, 2),
        ("G#3", 8, 1.5), ("A#3", 9.5, 0.5), ("C4", 10, 2),
        ("A3", 12, 2), ("C4", 14, 2),
        ("C#4", 16, 2), ("D#4", 18, 1), ("F4", 19, 1),
        ("F#4", 20, 1.5), ("F4", 21.5, 0.5), ("D#4", 22, 2),
        ("C#4", 24, 1), ("C4", 25, 1), ("A#3", 26, 1), ("A3", 27, 1),
        ("A#3", 28, 4),
    ]
    play(tr, hymn, brass, 0.44, 0.0, 0.98)
    return tr.render(reverb=0.5, room=3.8)


def relay() -> np.ndarray:
    """Signal Relay — F# minor, 92 BPM, 8 bars: a cold machine pulse under war drums and brass."""
    tr = Track(92, 8)
    prog = [("F#", "m"), ("D", "M"), ("B", "m"), ("C#", "M")] * 2
    for bar, (root, q) in enumerate(prog):
        b = bar * 4
        tones = chord(root, q, 3)
        for s16 in range(16):
            tr.add(b + s16 * 0.25, arp(tones[[0, 2, 1, 2][s16 % 4]] / 2, 0.14), 0.05, 0.4 if s16 % 2 else -0.4)
        tr.add(b, low_strings(chord(root, q, 2), 4 * tr.beat), 0.2)
        tr.add(b, drone(hz(f"{root}1"), 4 * tr.beat), 0.3)
        war_drums(tr, b, "X.....x.X...x...", 0.45)
        tr.add(b + 2, snare(0.3), 0.18)
        if bar % 4 == 0:
            tr.add(b, toll(hz(f"{root}3")), 0.12)
    theme = [
        ("F#3", 0, 1.5), ("A3", 1.5, 0.5), ("C#4", 2, 2),
        ("D4", 4, 1), ("C#4", 5, 1), ("A3", 6, 2),
        ("B3", 8, 1.5), ("D4", 9.5, 0.5), ("F#4", 10, 2),
        ("E#4", 12, 1), ("C#4", 13, 1), ("G#3", 14, 2),
        ("F#3", 16, 1), ("A3", 17, 1), ("C#4", 18, 1), ("F#4", 19, 1),
        ("E4", 20, 1.5), ("D4", 21.5, 0.5), ("C#4", 22, 2),
        ("B3", 24, 1), ("D4", 25, 1), ("E#4", 26, 1), ("G#4", 27, 1),
        ("F#4", 28, 4),
    ]
    NOTE["E#"] = 5
    play(tr, theme, brass, 0.4, 0.05, 0.96)
    return tr.render(reverb=0.36, room=2.6)


def vault() -> np.ndarray:
    """Phase Vault — C# minor, 60 BPM, 8 bars: a drowned cathedral — choir, sea, cold bells, low brass."""
    tr = Track(60, 8)
    prog = [("C#", "m"), ("A", "M"), ("F#", "m"), ("G#", "M")] * 2
    for bar, (root, q) in enumerate(prog):
        b = bar * 4
        tr.add(b, choir(chord(root, q, 3), 4 * tr.beat + 0.8), 0.26)
        tr.add(b, organ(chord(root, q, 2), 4 * tr.beat, 1500), 0.12)
        tr.add(b, drone(hz(f"{root}1"), 4 * tr.beat), 0.3)
        for i, f in enumerate(chord(root, q, 5)):
            tr.add(b + 1 + i * 0.75, glass(f, 3.0), 0.035, (-0.6, 0.0, 0.6)[i])
        tr.add(b, taiko(1.3), 0.26)
    sea = swell(tr.bars * 4 * tr.beat, 400, 1 / (2 * 4 * tr.beat), 0.8)
    tr.add(0, sea, 0.18, -0.3)
    tr.add(0, np.roll(sea, len(sea) // 2), 0.16, 0.3)
    theme = [
        ("C#4", 0, 2), ("E4", 2, 1), ("D#4", 3, 1),
        ("C#4", 4, 2), ("A3", 6, 2),
        ("F#3", 8, 1), ("A3", 9, 1), ("C#4", 10, 2),
        ("B#3", 12, 2), ("G#3", 14, 2),
        ("E4", 16, 2), ("F#4", 18, 1), ("E4", 19, 1),
        ("C#4", 20, 2), ("E4", 22, 2),
        ("F#4", 24, 1), ("E4", 25, 1), ("D#4", 26, 1), ("B#3", 27, 1),
        ("C#4", 28, 4),
    ]
    NOTE["B#"] = 12
    play(tr, theme, brass, 0.4, 0.05, 0.98)
    return tr.render(reverb=0.52, room=4.0)


def storm() -> np.ndarray:
    """Storm Spire — D minor, 126 BPM, 16 bars: tremolo low strings, war drums, thunder and battle brass."""
    tr = Track(126, 16)
    prog = [("D", "m"), ("A#", "M"), ("C", "M"), ("A", "M"), ("D", "m"), ("F", "M"), ("G", "m"), ("A", "M")] * 2
    for bar, (root, q) in enumerate(prog):
        b = bar * 4
        tr.add(b, low_strings(chord(root, q, 2) + [chord(root, q, 3)[0]], 4 * tr.beat, trem=12), 0.24)
        tr.add(b, choir(chord(root, q, 3), 4 * tr.beat + 0.3), 0.12)
        for beat in range(4):
            f = hz(f"{root}1")
            tr.add(b + beat, bass(f, tr.beat * 0.3), 0.3)
            tr.add(b + beat + 0.5, bass(f, tr.beat * 0.2), 0.22)
            tr.add(b + beat + 0.75, bass(f, tr.beat * 0.2), 0.22)
        war_drums(tr, b, "X.x.X.x.X.x.XxXx" if bar % 4 == 3 else "X...x.X.X...x.X.", 0.55)
        tr.add(b + 1, snare(), 0.26)
        tr.add(b + 3, snare(), 0.26)
        if bar % 8 == 0:
            tr.add(b, thunder(4), 0.34, float(RNG.uniform(-0.5, 0.5)))
    tr.add(0, swell(tr.bars * 4 * tr.beat, 900, 1 / (4 * 4 * tr.beat), 0.6), 0.08, 0.4)
    call = [
        ("D4", 0, 1.5), ("A3", 1.5, 0.5), ("D4", 2, 1), ("F4", 3, 1),
        ("A#4", 4, 1.5), ("A4", 5.5, 0.5), ("G4", 6, 2),
        ("C5", 8, 1.5), ("A#4", 9.5, 0.5), ("A4", 10, 1), ("G4", 11, 1),
        ("C#4", 12, 1), ("E4", 13, 1), ("A4", 14, 2),
        ("D5", 16, 1.5), ("C5", 17.5, 0.5), ("A4", 18, 1), ("F4", 19, 1),
        ("C5", 20, 1), ("A4", 21, 1), ("F4", 22, 2),
        ("A#4", 24, 1), ("A4", 25, 1), ("G4", 26, 1), ("A#4", 27, 1),
        ("A4", 28, 2), ("C#5", 30, 2),
    ]
    play(tr, call, brass, 0.4, 0.05, 0.96)
    play(tr, [(n[:-1] + str(int(n[-1]) + 1), bt + 32, l) for n, bt, l in call], brass, 0.36, -0.05, 0.96)
    return tr.render(reverb=0.34, room=2.6)


def fault() -> np.ndarray:
    """Deep Fault — E Phrygian, 76 BPM, 8 bars: molten drones, war drums, embers and a low chant."""
    tr = Track(76, 8)
    prog = [("E", "m"), ("F", "M"), ("E", "m"), ("D", "M"), ("E", "m"), ("F", "M"), ("G", "M"), ("F", "M")]
    for bar, (root, q) in enumerate(prog):
        b = bar * 4
        tr.add(b, choir(chord(root, q, 2) + chord(root, q, 3), 4 * tr.beat + 0.6), 0.22)
        tr.add(b, dist_bass(hz(f"{root}1"), 2 * tr.beat), 0.3)
        tr.add(b + 2, dist_bass(hz(f"{root}1"), 2 * tr.beat * 0.95), 0.26)
        tr.add(b, drone(hz(f"{root}1"), 4 * tr.beat), 0.3)
        war_drums(tr, b, "X..X..X.X.x.X.xx", 0.6)
        tr.add(b, toll(hz(f"{root}2"), 4), 0.12, -0.3)
    total = tr.bars * 4 * tr.beat
    tr.add(0, swell(total, 160, 1 / (2 * 4 * tr.beat), 0.5), 0.22)
    tr.add(0, crackle(total, 12), 0.18, -0.4)
    tr.add(0, crackle(total, 9), 0.16, 0.4)
    theme = [
        ("E3", 0, 1.5), ("F3", 1.5, 0.5), ("G3", 2, 1), ("B3", 3, 1),
        ("C4", 4, 1.5), ("B3", 5.5, 0.5), ("A3", 6, 2),
        ("G3", 8, 1), ("A3", 9, 1), ("B3", 10, 1.5), ("C4", 11.5, 0.5),
        ("B3", 12, 1), ("A3", 13, 1), ("F3", 14, 2),
        ("E4", 16, 1.5), ("D4", 17.5, 0.5), ("C4", 18, 1), ("B3", 19, 1),
        ("C4", 20, 1), ("A3", 21, 1), ("F3", 22, 2),
        ("G3", 24, 1), ("B3", 25, 1), ("D4", 26, 1), ("C4", 27, 1),
        ("B3", 28, 1.5), ("F3", 29.5, 0.5), ("E3", 30, 2),
    ]
    play(tr, theme, brass, 0.46, 0.0, 0.97)
    return tr.render(reverb=0.36, room=3.0)


def heart() -> np.ndarray:
    """Core Heart — B minor, 58 BPM, 8 bars: a slow heartbeat under organ, full choir and a rising brass anthem."""
    tr = Track(58, 8)
    prog = [("B", "m"), ("G", "M"), ("D", "M"), ("A", "M"), ("B", "m"), ("G", "M"), ("E", "m"), ("F#", "M")]
    for bar, (root, q) in enumerate(prog):
        b = bar * 4
        tr.add(b, choir(chord(root, q, 3) + [chord(root, q, 4)[0]], 4 * tr.beat + 0.8), 0.26)
        tr.add(b, organ(chord(root, q, 2) + [hz(f"{root}1")], 4 * tr.beat, 1800), 0.16)
        tr.add(b, low_strings(chord(root, q, 2), 4 * tr.beat), 0.12)
        tr.add(b, heartbeat(), 0.6)
        tr.add(b + 2, heartbeat(), 0.5)
        if bar % 2 == 1:
            for k in range(8):
                tr.add(b + 2 + k * 0.25, timpani(hz(f"{root}2"), 0.5), 0.06 + k * 0.03)
        tr.add(b, toll(hz(f"{root}2"), 5), 0.12, 0.25)
    theme = [
        ("B3", 0, 2), ("D4", 2, 1), ("C#4", 3, 1),
        ("B3", 4, 1), ("D4", 5, 1), ("G4", 6, 2),
        ("F#4", 8, 1.5), ("E4", 9.5, 0.5), ("D4", 10, 2),
        ("C#4", 12, 1), ("E4", 13, 1), ("A4", 14, 2),
        ("B4", 16, 2), ("A4", 18, 1), ("F#4", 19, 1),
        ("G4", 20, 1), ("F#4", 21, 1), ("D4", 22, 2),
        ("E4", 24, 1), ("G4", 25, 1), ("B4", 26, 1), ("A4", 27, 1),
        ("A#4", 28, 2), ("B4", 30, 2),
    ]
    play(tr, theme, brass, 0.44, 0.05, 0.97)
    return tr.render(reverb=0.5, room=3.8)


def crash(dur: float = 3.5, rise: float = 0.0) -> np.ndarray:
    """Orchestral cymbal: bright noise; `rise` seconds of swell before the hit."""
    n = int((dur + rise) * SR)
    t = np.arange(n) / SR
    x = RNG.standard_normal(n)
    x = lowpass(x - lowpass(x, 2500), 7000)
    shape = np.where(t < rise, (t / max(rise, 1e-3)) ** 3 * 0.6, np.exp(-(t - rise) * 1.6))
    return x * shape


def ending() -> np.ndarray:
    """Ending — D major, 70 BPM, 16 bars: after eight dark minor worlds the score finally turns to
    light. Bells and choir rise, then full brass carries the anthem over strings, organ and
    timpani, closing on a ♭VI–♭VII–I cadence back to the opening."""
    tr = Track(70, 16)

    def warm(freqs: list[float], dur: float) -> np.ndarray:
        return lowpass(lowpass(strings(freqs, dur), 1700), 2400)

    def bells(f: float, dur: float) -> np.ndarray:
        return lowpass(glass(f, dur), 2600)

    prog = [
        ("D", "M"), ("B", "m"), ("G", "M"), ("A", "M"),
        ("D", "M"), ("A", "M"), ("B", "m"), ("G", "M"),
        ("G", "M"), ("A", "M"), ("F#", "m"), ("B", "m"),
        ("G", "M"), ("A", "M"), ("A#", "M"), ("C", "M"),
    ]
    for bar, (root, q) in enumerate(prog):
        b = bar * 4
        full = bar >= 4
        big = bar >= 8
        dur = 4 * tr.beat
        tr.add(b, choir(chord(root, q, 3) + chord(root, q, 4)[:2], dur + 0.8), 0.22 if full else 0.16)
        tr.add(b, warm(chord(root, q, 3) + chord(root, q, 4), dur), 0.10 if big else 0.06 if full else 0.03)
        tr.add(b, low_strings([hz(f"{root}2"), hz(f"{root}1")], dur), 0.16 if full else 0.08)
        tr.add(b, organ(chord(root, q, 2) + [hz(f"{root}1")], dur, 2600), 0.13 if full else 0.08)
        tr.add(b, toll(hz(f"{root}3"), 5), 0.10, -0.3)
        # Glittering bell arpeggio over every bar.
        notes = chord(root, q, 4)
        for k in range(8):
            tr.add(b + k * 0.5, bells(notes[k % 3] * (2 if k >= 6 else 1), 1.4), 0.035 if full else 0.05, 0.4 - 0.1 * (k % 3))
        if full:
            tr.add(b, timpani(hz(f"{root}2"), 1.6), 0.32)
            tr.add(b + 2, timpani(hz(f"{root}2"), 1.0), 0.18)
        if big:
            tr.add(b + 1, timpani(hz(f"{root}2"), 0.8), 0.12)
            tr.add(b + 3, timpani(hz(f"{root}2"), 0.8), 0.14)
            tr.add(b + 3.5, timpani(hz(f"{root}2"), 0.6), 0.12)
    # Crescendo into the anthem and the climax; cymbal hits on the big downbeats.
    for bar in range(0, 4):
        for k in range(16):
            tr.add(bar * 4 + k * 0.25, timpani(hz("A1"), 0.4), 0.004 * (bar * 16 + k) / 4)
    tr.add(16 - 2, crash(4.0, 2 * tr.beat), 0.06)
    tr.add(32 - 2, crash(4.0, 2 * tr.beat), 0.07)
    tr.add(56 - 2, crash(5.0, 2 * tr.beat), 0.08)
    for k in range(16):  # timpani roll into the loop's downbeat
        tr.add(60 + k * 0.25, timpani(hz("C2"), 0.4), 0.05 + 0.012 * k)
    # Horn call over the intro, then the brass anthem.
    call = [("A3", 4, 1.5), ("D4", 5.5, 0.5), ("F#4", 6, 2), ("E4", 12, 1), ("F#4", 13, 1), ("A4", 14, 2)]
    play(tr, call, horn, 0.22, -0.15, 0.97)
    anthem = [
        ("F#4", 16, 1.5), ("E4", 17.5, 0.5), ("D4", 18, 1), ("A4", 19, 1),
        ("A4", 20, 1.5), ("G4", 21.5, 0.5), ("E4", 22, 2),
        ("F#4", 24, 1), ("D4", 25, 1), ("B3", 26, 1), ("D4", 27, 1),
        ("D4", 28, 1), ("E4", 29, 1), ("G4", 30, 2),
        ("B4", 32, 1.5), ("A4", 33.5, 0.5), ("G4", 34, 1), ("D5", 35, 1),
        ("C#5", 36, 1.5), ("B4", 37.5, 0.5), ("A4", 38, 2),
        ("A4", 40, 1), ("C#5", 41, 1), ("F#5", 42, 1), ("E5", 43, 1),
        ("D5", 44, 1.5), ("C#5", 45.5, 0.5), ("B4", 46, 2),
        ("B4", 48, 1), ("D5", 49, 1), ("G5", 50, 2),
        ("E5", 52, 1), ("F#5", 53, 1), ("A5", 54, 2),
        ("F5", 56, 2), ("D5", 58, 2),
        ("E5", 60, 2), ("G5", 62, 2),
    ]
    play(tr, anthem, brass, 0.40, 0.05, 0.97)
    # Strings double the anthem an octave down from the climax on.
    play(tr, [(n[:-1] + str(int(n[-1]) - 1), b, l) for n, b, l in anthem if b >= 32], lambda f, d: warm([f], d), 0.16, -0.25, 0.97)
    return tr.render(reverb=0.5, room=4.0)


# ---------- per-rebirth hub themes (one per mine gate; index = rebirth count mod 8) ----------

def soft(x: np.ndarray, cutoff: float = 1800) -> np.ndarray:
    return lowpass(lowpass(x, cutoff), cutoff * 1.4)


def hub_rune() -> np.ndarray:
    """Rebirth 1 · Rune Vault — A Dorian, 60 BPM: frame drum, organ, choir and a wooden flute-like horn."""
    tr = Track(60, 8)
    prog = [("A", "m"), ("G", "M"), ("D", "M"), ("A", "m"), ("F", "M"), ("G", "M"), ("E", "m"), ("A", "m")]
    for bar, (root, q) in enumerate(prog):
        b = bar * 4
        tr.add(b, organ(chord(root, q, 2) + [hz(f"{root}1")], 4 * tr.beat, 1500), 0.16)
        tr.add(b, choir(chord(root, q, 3), 4 * tr.beat + 0.8), 0.2)
        tr.add(b, drone(hz(f"{root}1"), 4 * tr.beat), 0.24)
        for k, g in ((0, 0.34), (1.5, 0.14), (2, 0.24), (3.5, 0.12)):
            tr.add(b + k, tom(hz("A1") if k % 2 == 0 else hz("E2"), 0.6), g, float(RNG.uniform(-0.3, 0.3)))
        tr.add(b, toll(hz(f"{root}3"), 4), 0.08, 0.35)
    theme = [
        ("E4", 0, 1.5), ("D4", 1.5, 0.5), ("C4", 2, 1), ("A3", 3, 1),
        ("B3", 4, 1), ("D4", 5, 1), ("G4", 6, 2),
        ("F#4", 8, 1), ("E4", 9, 1), ("D4", 10, 1.5), ("F#4", 11.5, 0.5),
        ("E4", 12, 3), ("A3", 15, 1),
        ("C4", 16, 1), ("E4", 17, 1), ("A4", 18, 2),
        ("G4", 20, 1.5), ("F#4", 21.5, 0.5), ("D4", 22, 2),
        ("E4", 24, 1), ("G4", 25, 1), ("B4", 26, 1), ("A4", 27, 1),
        ("E4", 28, 2), ("A4", 30, 2),
    ]
    play(tr, theme, lambda f, d: soft(horn(f, d), 1500), 0.4, -0.1, 0.95)
    return tr.render(reverb=0.5, room=3.6)


def hub_bulkhead() -> np.ndarray:
    """Rebirth 2 · Bulkhead — E minor, 88 BPM: machine pulse, distorted bass, war drums and a hard brass riff."""
    tr = Track(88, 8)
    prog = [("E", "m"), ("E", "m"), ("C", "M"), ("D", "M"), ("E", "m"), ("G", "M"), ("A", "m"), ("B", "M")]
    for bar, (root, q) in enumerate(prog):
        b = bar * 4
        for k in range(8):
            tr.add(b + k * 0.5, dist_bass(hz(f"{root}1"), 0.5 * tr.beat * 0.9), 0.22 if k % 2 == 0 else 0.14)
            tr.add(b + k * 0.5 + 0.25, lowpass(hat(), 5000), 0.06, 0.3)
        tr.add(b, kick(), 0.5)
        tr.add(b + 1, soft(snare(), 3500), 0.3, -0.1)
        tr.add(b + 2, kick(), 0.45)
        tr.add(b + 2.5, kick(), 0.3)
        tr.add(b + 3, soft(snare(), 3500), 0.34, 0.1)
        tr.add(b, soft(strings(chord(root, q, 3), 4 * tr.beat), 1600), 0.1)
        tr.add(b, choir(chord(root, q, 2), 4 * tr.beat + 0.5), 0.14)
    riff = [
        ("E3", 0, 0.75), ("E3", 0.75, 0.25), ("G3", 1, 1), ("F#3", 2, 1), ("D3", 3, 1),
        ("E3", 4, 0.75), ("E3", 4.75, 0.25), ("B3", 5, 1), ("A3", 6, 2),
        ("G3", 8, 1), ("E3", 9, 1), ("C4", 10, 1.5), ("B3", 11.5, 0.5),
        ("A3", 12, 1), ("F#3", 13, 1), ("D3", 14, 2),
        ("E3", 16, 0.75), ("E3", 16.75, 0.25), ("G3", 17, 1), ("B3", 18, 1), ("E4", 19, 1),
        ("D4", 20, 1.5), ("B3", 21.5, 0.5), ("G3", 22, 2),
        ("A3", 24, 1), ("C4", 25, 1), ("E4", 26, 1), ("C4", 27, 1),
        ("B3", 28, 1), ("D#4", 29, 1), ("F#4", 30, 2),
    ]
    play(tr, riff, brass, 0.4, 0.0, 0.9)
    return tr.render(reverb=0.3, room=2.4)


def hub_crystal() -> np.ndarray:
    """Rebirth 3 · Amethyst — F# minor, 72 BPM: glassy arpeggios over choir, a soft pulse and a high bell melody."""
    tr = Track(72, 8)
    prog = [("F#", "m"), ("D", "M"), ("A", "M"), ("E", "M"), ("F#", "m"), ("B", "m"), ("D", "M"), ("C#", "M")]
    for bar, (root, q) in enumerate(prog):
        b = bar * 4
        notes = chord(root, q, 4)
        for k in range(16):
            tr.add(b + k * 0.25, soft(glass(notes[(k * 2) % 3] * (2 if k % 4 == 3 else 1), 0.9), 2200), 0.04, 0.5 * math.sin(k))
        tr.add(b, choir(chord(root, q, 3), 4 * tr.beat + 0.8), 0.22)
        tr.add(b, pad(chord(root, q, 2), 4 * tr.beat, 900), 0.12)
        tr.add(b, bass(hz(f"{root}1"), 4 * tr.beat * 0.95), 0.2)
        tr.add(b, kick(0.5), 0.2)
        tr.add(b + 2, kick(0.5), 0.14)
    theme = [
        ("C#5", 0, 2), ("A4", 2, 1), ("F#4", 3, 1),
        ("D5", 4, 1.5), ("C#5", 5.5, 0.5), ("A4", 6, 2),
        ("E5", 8, 1), ("C#5", 9, 1), ("A4", 10, 2),
        ("G#4", 12, 2), ("B4", 14, 2),
        ("C#5", 16, 1), ("F#5", 17, 1), ("E5", 18, 2),
        ("D5", 20, 1), ("B4", 21, 1), ("F#4", 22, 2),
        ("A4", 24, 1), ("D5", 25, 1), ("F#5", 26, 2),
        ("F5", 28, 2), ("C#5", 30, 2),
    ]
    play(tr, theme, bell, 0.3, 0.15, 0.97, tail=1.2)
    return tr.render(reverb=0.6, room=4.2)


def hub_frost() -> np.ndarray:
    """Rebirth 4 · Frost Gate — D minor, 54 BPM: wind, tremolo strings, high choir and sparse ice bells."""
    tr = Track(54, 8)
    prog = [("D", "m"), ("B", "M"), ("G", "m"), ("A", "M"), ("D", "m"), ("F", "M"), ("C", "M"), ("A", "M")]
    total = tr.bars * 4 * tr.beat
    tr.add(0, swell(total, 900, 1 / (4 * tr.beat), 0.7), 0.16, -0.3)
    tr.add(0, swell(total, 1400, 1 / (3 * tr.beat), 0.6), 0.1, 0.3)
    for bar, (root, q) in enumerate(prog):
        b = bar * 4
        tr.add(b, soft(strings(chord(root, q, 3), 4 * tr.beat, trem=6.5), 1500), 0.12)
        tr.add(b, choir(chord(root, q, 4), 4 * tr.beat + 1.0), 0.16)
        tr.add(b, low_strings([hz(f"{root}2")], 4 * tr.beat), 0.16)
        tr.add(b, timpani(hz(f"{root}2"), 2.0), 0.12)
        for k in (0.5, 2.25, 3.0):
            tr.add(b + k, soft(glass(chord(root, q, 5)[int(k * 2) % 3], 2.0), 3200), 0.035, 0.45)
    theme = [
        ("A4", 0, 3), ("F4", 3, 1),
        ("D4", 4, 2), ("E4", 6, 2),
        ("F4", 8, 1.5), ("G4", 9.5, 0.5), ("A4", 10, 2),
        ("C#5", 12, 4),
        ("D5", 16, 2), ("C5", 18, 1), ("A4", 19, 1),
        ("C5", 20, 2), ("A4", 22, 2),
        ("G4", 24, 1), ("E4", 25, 1), ("C5", 26, 2),
        ("A4", 28, 4),
    ]
    play(tr, theme, lambda f, d: soft(horn(f, d), 1700), 0.3, 0.0, 0.98)
    return tr.render(reverb=0.65, room=4.6)


def hub_forge() -> np.ndarray:
    """Rebirth 5 · Magma Forge — C minor, 80 BPM: anvil strikes, taiko, embers and a molten brass march."""
    tr = Track(80, 8)
    prog = [("C", "m"), ("G#", "M"), ("D#", "M"), ("G", "M"), ("C", "m"), ("F", "m"), ("G#", "M"), ("G", "M")]
    total = tr.bars * 4 * tr.beat
    tr.add(0, soft(crackle(total, 14), 3000), 0.16, -0.4)
    tr.add(0, swell(total, 200, 1 / (2 * 4 * tr.beat), 0.5), 0.2)
    for bar, (root, q) in enumerate(prog):
        b = bar * 4
        war_drums(tr, b, "X...X.x.X...X.xx" if bar % 2 == 0 else "X..xX.x.X.x.XxXx", 0.55)
        for k in (1, 3):
            tr.add(b + k, soft(toll(hz("C5") * (1.0 if k == 1 else 1.06), 0.7), 2600), 0.06, 0.4)  # anvil
        tr.add(b, dist_bass(hz(f"{root}1"), 4 * tr.beat * 0.95), 0.26)
        tr.add(b, choir(chord(root, q, 2) + chord(root, q, 3), 4 * tr.beat + 0.5), 0.18)
        tr.add(b, low_strings(chord(root, q, 2), 4 * tr.beat), 0.12)
    theme = [
        ("C4", 0, 1), ("C4", 1, 0.5), ("D#4", 1.5, 0.5), ("G4", 2, 2),
        ("G#4", 4, 1), ("G4", 5, 1), ("D#4", 6, 2),
        ("D#4", 8, 1), ("F4", 9, 1), ("G4", 10, 1.5), ("A#4", 11.5, 0.5),
        ("B4", 12, 2), ("G4", 14, 2),
        ("C5", 16, 1.5), ("A#4", 17.5, 0.5), ("G#4", 18, 1), ("G4", 19, 1),
        ("F4", 20, 1), ("G#4", 21, 1), ("C5", 22, 2),
        ("D#5", 24, 1), ("D5", 25, 1), ("C5", 26, 1), ("G#4", 27, 1),
        ("B4", 28, 2), ("D5", 30, 2),
    ]
    play(tr, theme, brass, 0.44, 0.05, 0.92)
    return tr.render(reverb=0.38, room=3.0)


def hub_temple() -> np.ndarray:
    """Rebirth 6 · Sun Temple — G Phrygian dominant, 66 BPM: plucked harp runs, temple bells, choir and a solemn horn."""
    tr = Track(66, 8)
    prog = [("G", "M"), ("G#", "M"), ("G", "M"), ("F", "m"), ("G", "M"), ("G#", "M"), ("A#", "m"), ("G", "M")]
    for bar, (root, q) in enumerate(prog):
        b = bar * 4
        notes = chord(root, q, 3) + chord(root, q, 4)
        for k in range(8):
            tr.add(b + k * 0.5, pluck(notes[k % 6], 0.9), 0.07, -0.4 + 0.1 * (k % 6))
        tr.add(b, choir(chord(root, q, 3), 4 * tr.beat + 0.8), 0.2)
        tr.add(b, organ(chord(root, q, 2), 4 * tr.beat, 1600), 0.1)
        tr.add(b, drone(hz("G1"), 4 * tr.beat), 0.24)
        tr.add(b, toll(hz("G3"), 5), 0.12, -0.25)
        tr.add(b + 2, toll(hz("D4"), 3), 0.06, 0.25)
        tr.add(b, timpani(hz("G2"), 1.4), 0.2)
    theme = [
        ("G4", 0, 1.5), ("G#4", 1.5, 0.5), ("B4", 2, 2),
        ("C5", 4, 1), ("B4", 5, 1), ("G#4", 6, 2),
        ("G4", 8, 1), ("F4", 9, 1), ("D#4", 10, 1), ("F4", 11, 1),
        ("G4", 12, 4),
        ("D5", 16, 1.5), ("C5", 17.5, 0.5), ("B4", 18, 2),
        ("C5", 20, 1), ("G#4", 21, 1), ("F4", 22, 2),
        ("A#4", 24, 1), ("G#4", 25, 1), ("G4", 26, 1), ("F4", 27, 1),
        ("G4", 28, 4),
    ]
    play(tr, theme, lambda f, d: soft(horn(f, d), 1900), 0.4, 0.05, 0.96)
    return tr.render(reverb=0.55, room=4.0)


def hub_hive() -> np.ndarray:
    """Rebirth 7 · Hive Gate — B minor, 74 BPM: a living heartbeat, wet pulses, breathing swells and an eerie lead."""
    tr = Track(74, 8)
    prog = [("B", "m"), ("C", "M"), ("B", "m"), ("G", "M"), ("B", "m"), ("C", "M"), ("E", "m"), ("F#", "M")]
    total = tr.bars * 4 * tr.beat
    tr.add(0, swell(total, 500, 1 / (2 * tr.beat), 0.8), 0.18)
    for bar, (root, q) in enumerate(prog):
        b = bar * 4
        tr.add(b, heartbeat(), 0.55)
        tr.add(b + 2, heartbeat(), 0.45)
        for k in range(8):
            tr.add(b + k * 0.5, soft(arp(chord(root, q, 3)[k % 3] * (2 if k % 4 == 2 else 1), 0.4), 1400), 0.07, 0.35 * (-1) ** k)
        tr.add(b, drone(hz(f"{root}1"), 4 * tr.beat), 0.3)
        tr.add(b, pad(chord(root, q, 2) + chord(root, q, 3), 4 * tr.beat, 700, 1.2), 0.16)
        tr.add(b, choir([hz(f"{root}4")], 4 * tr.beat + 0.6), 0.1)
    theme = [
        ("F#4", 0, 2), ("G4", 2, 1), ("F#4", 3, 1),
        ("E4", 4, 1), ("D4", 5, 1), ("C4", 6, 2),
        ("B3", 8, 1.5), ("D4", 9.5, 0.5), ("F#4", 10, 2),
        ("G4", 12, 1), ("F#4", 13, 1), ("D4", 14, 2),
        ("B4", 16, 2), ("C5", 18, 1), ("B4", 19, 1),
        ("G4", 20, 1), ("E4", 21, 1), ("C4", 22, 2),
        ("E4", 24, 1), ("G4", 25, 1), ("B4", 26, 1), ("G4", 27, 1),
        ("A#4", 28, 2), ("F#4", 30, 2),
    ]
    play(tr, theme, lambda f, d: lead(f, d, 1800), 0.18, 0.1, 0.95)
    return tr.render(reverb=0.5, room=3.6)


def mine_of(hub_audio: np.ndarray) -> np.ndarray:
    """The mine variant of a hub loop: low-passed, narrowed, a light cave echo (wrapped so the
    loop stays seamless) and about 6 dB under the hub mix."""
    x = np.stack([lowpass(lowpass(hub_audio[:, c], 1100), 1600) for c in range(2)], axis=1)
    mid = x.mean(axis=1, keepdims=True)
    x = mid + (x - mid) * 0.45
    for delay, gain in ((0.19, 0.28), (0.41, 0.16), (0.67, 0.08)):
        x = x + np.roll(x, int(delay * SR), axis=0) * gain
    x = x / np.max(np.abs(x)) * 10 ** (-1.5 / 20)
    return x * 10 ** (-6 / 20)


HUB_VARIANTS = {1: hub_rune, 2: hub_bulkhead, 3: hub_crystal, 4: hub_frost, 5: hub_forge, 6: hub_temple, 7: hub_hive}


TRACKS = {
    "bgm_hub_v2": hub,
    "bgm_mine_v2": mine,
    "bgm_chamber_v2": chamber,
    "bgm_world_relay": relay,
    "bgm_world_vault": vault,
    "bgm_world_storm": storm,
    "bgm_world_fault": fault,
    "bgm_world_heart": heart,
    "bgm_ending": ending,
    **{f"bgm_hub_r{k}": fn for k, fn in HUB_VARIANTS.items()},
}


def main() -> None:
    """Render every track, or just the ones named: `python3 scripts/clicker-bgm.py bgm_world_storm`."""
    import sys

    OUT.mkdir(parents=True, exist_ok=True)
    for name in sys.argv[1:] or list(TRACKS):
        audio = TRACKS[name]()
        sf.write(OUT / f"{name}.mp3", audio, SR, format="MP3", subtype="MPEG_LAYER_III")
        print(f"{name}.mp3  {len(audio) / SR:.1f}s")
        if name.startswith("bgm_hub_r"):
            # Each rebirth's hub theme also gives that rebirth its mine bed.
            mine_name = name.replace("bgm_hub_r", "bgm_mine_r")
            sf.write(OUT / f"{mine_name}.mp3", mine_of(audio), SR, format="MP3", subtype="MPEG_LAYER_III")
            print(f"{mine_name}.mp3")


if __name__ == "__main__":
    main()

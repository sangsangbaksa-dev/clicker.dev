#!/usr/bin/env python3
"""Render the clicker BGM loops (hub / mine / chamber and one theme per world) as seamless MP3 files (plays on iOS Safari too).

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


# ---------- world themes ----------

def relay() -> np.ndarray:
    """Signal Relay — F# minor, 104 BPM, 8 bars: pulsing data arps and a bright synth lead."""
    tr = Track(104, 8)
    prog = [("F#", "m"), ("D", "M"), ("A", "M"), ("E", "M")] * 2
    for bar, (root, q) in enumerate(prog):
        b = bar * 4
        pumped = pad(chord(root, q, 3), 4 * tr.beat, 1500, 0.05)
        beat_n = int(tr.beat * SR)
        duck = np.tile(np.clip(np.linspace(0.2, 1.3, beat_n), 0, 1), 5)[: len(pumped)]
        tr.add(b, pumped * duck, 0.16)
        for e in range(8):
            tr.add(b + e * 0.5, bass(hz(f"{root}2") * (2 if e % 4 == 3 else 1), tr.beat * 0.42), 0.3)
        tones = chord(root, q, 4) + [chord(root, q, 5)[0]]
        for s in range(16):
            tr.add(b + s * 0.25, arp(tones[[0, 1, 2, 3, 2, 1, 0, 2][s % 8]], 0.16), 0.05, 0.45 if s % 2 else -0.45)
        for beat in range(4):
            tr.add(b + beat, kick(0.3), 0.42)
            tr.add(b + beat + 0.5, hat(), 0.14, 0.35)
            tr.add(b + beat + 0.75, hat(0.03), 0.07, -0.35)
        tr.add(b + 1, snare(0.18), 0.22)
        tr.add(b + 3, snare(0.18), 0.22)
        for k in range(3):
            tr.add(b + int(RNG.integers(0, 16)) * 0.25, blip(hz(f"{root}6") * 2 ** (RNG.integers(0, 12) / 12)), 0.05, float(RNG.uniform(-0.8, 0.8)))
    theme = [
        ("C#5", 0, 0.5), ("F#5", 0.5, 0.5), ("A5", 1, 1), ("G#5", 2, 0.5), ("F#5", 2.5, 0.5), ("E5", 3, 1),
        ("F#5", 4, 1), ("A5", 5, 0.5), ("D6", 5.5, 1.5), ("C#6", 7, 1),
        ("C#6", 8, 0.5), ("B5", 8.5, 0.5), ("A5", 9, 1), ("E5", 10, 1.5), ("C#5", 11.5, 0.5),
        ("E5", 12, 1), ("G#5", 13, 1), ("B5", 14, 2),
        ("C#6", 16, 1), ("A5", 17, 0.5), ("F#5", 17.5, 0.5), ("C#6", 18, 1), ("E6", 19, 1),
        ("D6", 20, 1.5), ("C#6", 21.5, 0.5), ("A5", 22, 2),
        ("A5", 24, 0.5), ("B5", 24.5, 0.5), ("C#6", 25, 1), ("E6", 26, 1), ("C#6", 27, 1),
        ("B5", 28, 1), ("G#5", 29, 1), ("F#5", 30, 2),
    ]
    play(tr, theme, lambda f, d: lead(f, d, 4200), 0.24, -0.05, 0.9)
    play(tr, [(n, b + 0.75, l) for n, b, l in theme], lambda f, d: lead(f, d, 2400), 0.05, 0.6, 0.6)
    return tr.render(reverb=0.24, room=1.6)


def vault() -> np.ndarray:
    """Phase Vault — C# minor, 76 BPM, 8 bars: crystal bells over a drowned choir and the sea."""
    tr = Track(76, 8)
    prog = [("C#", "m"), ("A", "M"), ("F#", "m"), ("G#", "M")] * 2
    for bar, (root, q) in enumerate(prog):
        b = bar * 4
        tr.add(b, choir(chord(root, q, 3), 4 * tr.beat + 0.8), 0.2)
        tr.add(b, bass(hz(f"{root}2"), 4 * tr.beat * 0.97), 0.26)
        for i, f in enumerate(chord(root, q, 5)):
            tr.add(b + 0.5 + i * 1.25, glass(f, 2.6), 0.07, (-0.6, 0.0, 0.6)[i])
        tr.add(b, tom(hz(f"{root}2") * 2, 0.8), 0.16)
        tr.add(b + 2.5, tom(hz(f"{root}2") * 1.5, 0.6), 0.1)
    sea = swell(tr.bars * 4 * tr.beat, 600, 1 / (2 * 4 * tr.beat), 0.75)
    tr.add(0, sea, 0.14, -0.3)
    tr.add(0, np.roll(sea, len(sea) // 2), 0.12, 0.3)
    theme = [
        ("G#5", 0, 1), ("C#6", 1, 1), ("E6", 2, 1.5), ("D#6", 3.5, 0.5),
        ("C#6", 4, 1), ("E6", 5, 1), ("A5", 6, 2),
        ("F#5", 8, 1), ("A5", 9, 1), ("C#6", 10, 1.5), ("B5", 11.5, 0.5),
        ("G#5", 12, 1), ("B#5", 13, 1), ("D#6", 14, 2),
        ("E6", 16, 1.5), ("D#6", 17.5, 0.5), ("C#6", 18, 1), ("G#5", 19, 1),
        ("A5", 20, 1), ("C#6", 21, 1), ("E6", 22, 2),
        ("F#6", 24, 1), ("E6", 25, 1), ("C#6", 26, 1), ("A5", 27, 1),
        ("G#5", 28, 1.5), ("B5", 29.5, 0.5), ("C#6", 30, 2),
    ]
    NOTE["B#"] = 12  # B#5 == C6
    play(tr, theme, glass, 0.4, 0.1, 1.0, 1.6)
    play(tr, [(n[:-1] + str(int(n[-1]) - 1), b, l) for n, b, l in theme], lambda f, d: bell(f, d), 0.08, -0.2, 1.0, 0.8)
    return tr.render(reverb=0.45, room=3.2)


def storm() -> np.ndarray:
    """Storm Spire — D minor, 140 BPM, 16 bars: tremolo strings, galloping bass, thunder, horns."""
    tr = Track(140, 16)
    prog = [("D", "m"), ("A#", "M"), ("F", "M"), ("C", "M"), ("D", "m"), ("A#", "M"), ("G", "m"), ("A", "M")] * 2
    for bar, (root, q) in enumerate(prog):
        b = bar * 4
        tr.add(b, strings(chord(root, q, 3) + [chord(root, q, 4)[0]], 4 * tr.beat, trem=11), 0.2)
        for beat in range(4):
            f = hz(f"{root}2")
            tr.add(b + beat, bass(f, tr.beat * 0.3), 0.32)
            tr.add(b + beat + 0.5, bass(f, tr.beat * 0.2), 0.24)
            tr.add(b + beat + 0.75, bass(f, tr.beat * 0.2), 0.24)
            tr.add(b + beat, kick(0.3), 0.5 if beat % 2 == 0 else 0.35)
            tr.add(b + beat + 0.5, hat(), 0.12, 0.3)
        tr.add(b + 1, snare(), 0.32)
        tr.add(b + 3, snare(), 0.32)
        if bar % 4 == 3:
            for k, fq in enumerate((220, 180, 150, 120)):
                tr.add(b + 3 + k * 0.25, tom(fq), 0.3, (-0.4, -0.1, 0.1, 0.4)[k])
        if bar % 8 == 0:
            tr.add(b, thunder(3.5), 0.3, float(RNG.uniform(-0.5, 0.5)))
    wind = swell(tr.bars * 4 * tr.beat, 1400, 1 / (4 * 4 * tr.beat), 0.6)
    tr.add(0, wind, 0.06, 0.4)
    call = [
        ("D5", 0, 1.5), ("A4", 1.5, 0.5), ("D5", 2, 1), ("F5", 3, 1),
        ("A#5", 4, 1.5), ("A5", 5.5, 0.5), ("F5", 6, 2),
        ("A5", 8, 1.5), ("G5", 9.5, 0.5), ("F5", 10, 1), ("E5", 11, 1),
        ("C5", 12, 1), ("E5", 13, 1), ("G5", 14, 2),
        ("F5", 16, 1.5), ("E5", 17.5, 0.5), ("D5", 18, 1), ("A5", 19, 1),
        ("A#5", 20, 1), ("D6", 21, 1), ("C6", 22, 2),
        ("A#5", 24, 1), ("A5", 25, 1), ("G5", 26, 1), ("A#5", 27, 1),
        ("A5", 28, 2), ("C#5", 30, 2),
    ]
    rise = [
        ("A5", 0, 1), ("D6", 1, 1), ("F6", 2, 1.5), ("E6", 3.5, 0.5),
        ("D6", 4, 1), ("C6", 5, 1), ("A#5", 6, 2),
        ("C6", 8, 1), ("F6", 9, 1), ("E6", 10, 1), ("C6", 11, 1),
        ("A5", 12, 1), ("C6", 13, 1), ("G5", 14, 2),
        ("A5", 16, 1), ("D6", 17, 1), ("F6", 18, 1.5), ("E6", 19.5, 0.5),
        ("D6", 20, 1), ("A#5", 21, 1), ("D6", 22, 2),
        ("G6", 24, 1), ("F6", 25, 1), ("E6", 26, 1), ("D6", 27, 1),
        ("C#6", 28, 2), ("E6", 30, 2),
    ]
    play(tr, call, horn, 0.42, 0.05, 0.97)
    play(tr, [(n, b + 32, l) for n, b, l in rise], horn, 0.38, 0.05, 0.97)
    play(tr, [(n, b + 32, l) for n, b, l in rise], lambda f, d: lead(f, d, 3000), 0.08, -0.4, 0.9)
    return tr.render(reverb=0.3, room=2.2)


def fault() -> np.ndarray:
    """Deep Fault — E Phrygian, 86 BPM, 8 bars: taiko, molten bass, embers and a low horn."""
    tr = Track(86, 8)
    prog = [("E", "m"), ("F", "M"), ("E", "m"), ("D", "M"), ("E", "m"), ("F", "M"), ("G", "M"), ("F", "M")]
    for bar, (root, q) in enumerate(prog):
        b = bar * 4
        tr.add(b, pad(chord(root, q, 2) + chord(root, q, 3), 4 * tr.beat, 700, 0.3), 0.18)
        tr.add(b, dist_bass(hz(f"{root}1"), 1.5 * tr.beat), 0.3)
        tr.add(b + 1.5, dist_bass(hz(f"{root}1"), 0.5 * tr.beat), 0.24)
        tr.add(b + 2, dist_bass(hz(f"{root}1"), 2 * tr.beat * 0.95), 0.28)
        tr.add(b, taiko(), 0.55)
        tr.add(b + 1.5, taiko(0.6), 0.25, -0.3)
        tr.add(b + 2, taiko(), 0.45)
        tr.add(b + 3, tom(110, 0.4), 0.22, 0.4)
        tr.add(b + 3.5, tom(90, 0.4), 0.22, -0.4)
        tr.add(b + 1, snare(0.3), 0.12)
        tr.add(b + 3, snare(0.3), 0.14)
    total = tr.bars * 4 * tr.beat
    tr.add(0, swell(total, 180, 1 / (2 * 4 * tr.beat), 0.5), 0.2)
    tr.add(0, crackle(total, 14), 0.2, -0.4)
    tr.add(0, crackle(total, 10), 0.18, 0.4)
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
    play(tr, theme, horn, 0.5, 0.0, 0.97)
    play(tr, [(n[:-1] + str(int(n[-1]) + 1), b, l) for n, b, l in theme], lambda f, d: lead(f, d, 1600), 0.07, 0.3, 0.9)
    return tr.render(reverb=0.32, room=2.6)


def heart() -> np.ndarray:
    """Core Heart — B minor, 66 BPM, 8 bars: a heartbeat under choir, bells and a rising horn."""
    tr = Track(66, 8)
    prog = [("B", "m"), ("G", "M"), ("D", "M"), ("A", "M"), ("B", "m"), ("G", "M"), ("E", "m"), ("F#", "M")]
    for bar, (root, q) in enumerate(prog):
        b = bar * 4
        tr.add(b, choir(chord(root, q, 3) + [chord(root, q, 4)[0]], 4 * tr.beat + 0.8), 0.22)
        tr.add(b, strings(chord(root, q, 4), 4 * tr.beat), 0.07)
        tr.add(b, bass(hz(f"{root}2"), 4 * tr.beat * 0.97), 0.26)
        tr.add(b, heartbeat(), 0.6)
        tr.add(b + 2, heartbeat(), 0.5)
        if bar % 2 == 1:
            tr.add(b + 3, timpani(hz(f"{root}2"), 1.4), 0.3)
        for i, f in enumerate(chord(root, q, 5)):
            tr.add(b + 1 + i * 0.5, bell(f, 1.6), 0.05, (-0.5, 0.0, 0.5)[i])
    theme = [
        ("F#4", 0, 1), ("B4", 1, 1), ("D5", 2, 1.5), ("C#5", 3.5, 0.5),
        ("B4", 4, 1), ("D5", 5, 1), ("G5", 6, 2),
        ("F#5", 8, 1.5), ("E5", 9.5, 0.5), ("D5", 10, 1), ("A4", 11, 1),
        ("C#5", 12, 1), ("E5", 13, 1), ("A5", 14, 2),
        ("B5", 16, 1.5), ("A5", 17.5, 0.5), ("F#5", 18, 1), ("D5", 19, 1),
        ("G5", 20, 1), ("F#5", 21, 1), ("D5", 22, 2),
        ("E5", 24, 1), ("G5", 25, 1), ("B5", 26, 1), ("A5", 27, 1),
        ("A#5", 28, 1.5), ("C#6", 29.5, 0.5), ("B5", 30, 2),
    ]
    play(tr, theme, horn, 0.4, 0.05, 0.97)
    play(tr, theme, lambda f, d: bell(f * 2, d), 0.14, -0.25, 1.0, 1.0)
    return tr.render(reverb=0.42, room=3.4)


TRACKS = {
    "bgm_hub_v2": hub,
    "bgm_mine_v2": mine,
    "bgm_chamber_v2": chamber,
    "bgm_world_relay": relay,
    "bgm_world_vault": vault,
    "bgm_world_storm": storm,
    "bgm_world_fault": fault,
    "bgm_world_heart": heart,
}


def main() -> None:
    """Render every track, or just the ones named: `python3 scripts/clicker-bgm.py bgm_world_storm`."""
    import sys

    OUT.mkdir(parents=True, exist_ok=True)
    for name in sys.argv[1:] or list(TRACKS):
        audio = TRACKS[name]()
        sf.write(OUT / f"{name}.mp3", audio, SR, format="MP3", subtype="MPEG_LAYER_III")
        print(f"{name}.mp3  {len(audio) / SR:.1f}s")


if __name__ == "__main__":
    main()

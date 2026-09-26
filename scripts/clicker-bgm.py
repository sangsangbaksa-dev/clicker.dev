#!/usr/bin/env python3
"""Compose and render the clicker BGM (hub / mine / hunt / chamber) as seamless MP3 loops.

v3 — written as music first: every track is a through-composed piece with sections
(statement, development, bridge, return) instead of a 4-chord loop, so a player who sits in
the hub for ten minutes hears a 2-minute piece come round, not a 20-second jingle.

Instruments are small physical/FM models rendered with numpy + scipy:
  piano    additive partials with stretch tuning, per-partial decay and a hammer thump
  epiano   two-operator FM tine (Rhodes-like), velocity sets the bark
  harp     Karplus–Strong string, pitch-corrected
  strings  detuned saw ensemble, delayed vibrato, lowpassed; `violin` for solo lines
  choir    saw source through vowel formant filters
  brass    saw stack whose brightness follows the envelope (dark → bright → dark)
  bell     FM bell;  bass, sub, pluck, arp synth;  kick, snare, hats, shaker, taiko,
           timpani, cymbal swell, riser
Mixing: per-note reverb send into a stereo decaying-noise hall (highs die first), an optional
sidechain duck bus keyed from the kick, then a gentle glue stage. Everything past the loop
point (reverb tails, held notes) is folded back onto the start, so the seam is inaudible.

    pip install numpy scipy soundfile
    python3 scripts/clicker-bgm.py            # all tracks
    python3 scripts/clicker-bgm.py hunt hub   # just these
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal

SR = 44100
OUT = Path(__file__).resolve().parent.parent / "public" / "clicker" / "audio"
VERSION = "v3"
RNG = np.random.default_rng(20260926)

NOTE = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6,
        "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}


def midi(name: str) -> int:
    """'A4' → 69"""
    return NOTE[name[:-1]] + (int(name[-1]) + 1) * 12


def hz(name: str | int | float) -> float:
    m = midi(name) if isinstance(name, str) else name
    return 440.0 * 2 ** ((m - 69) / 12)


def notes(spec: str) -> list[float]:
    """'D3 A3 F4' → frequencies."""
    return [hz(n) for n in spec.split()]


# ---------------------------------------------------------------- DSP helpers

def t_axis(n: int) -> np.ndarray:
    return np.arange(n) / SR


def adsr(n: int, a: float, d: float, s: float, r: float) -> np.ndarray:
    """Linear attack, exponential-ish decay to sustain, release at the tail. Times in seconds."""
    e = np.full(n, s, dtype=float)
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    na = min(na, n)
    if na > 0:
        e[:na] = np.linspace(0, 1, na, endpoint=False)
    nd = min(nd, n - na)
    if nd > 0:
        e[na:na + nd] = s + (1 - s) * np.exp(-5 * np.linspace(0, 1, nd))
    nr = min(nr, n)
    if nr > 0:
        e[-nr:] *= np.linspace(1, 0, nr) ** 1.5
    return e


def lp(x: np.ndarray, cutoff: float, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, min(cutoff, SR * 0.45), "low", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def hp(x: np.ndarray, cutoff: float, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, cutoff, "high", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def bp(x: np.ndarray, lo: float, hi: float, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, [lo, min(hi, SR * 0.45)], "band", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def sweep_lp(x: np.ndarray, env: np.ndarray, lo: float, hi: float) -> np.ndarray:
    """Envelope-controlled brightness: crossfade between a dark and a bright filtered copy."""
    dark, bright = lp(x, lo), lp(x, hi)
    return dark + (bright - dark) * np.clip(env, 0, 1)


def saw(phase: np.ndarray) -> np.ndarray:
    return 2 * (phase % 1.0) - 1


def noise(n: int) -> np.ndarray:
    return RNG.standard_normal(n)


def vibrato(n: int, rate: float = 5.2, depth: float = 0.004, delay: float = 0.35) -> np.ndarray:
    t = t_axis(n)
    ramp = np.clip((t - delay) / 0.5, 0, 1)
    return 1 + depth * ramp * np.sin(2 * np.pi * rate * t + RNG.random() * 6)


def phase_of(f: float | np.ndarray, n: int) -> np.ndarray:
    if np.isscalar(f):
        return f * t_axis(n) + RNG.random()
    return np.cumsum(f) / SR + RNG.random()


# ---------------------------------------------------------------- instruments (mono)

def piano(f: float, dur: float, vel: float = 0.7) -> np.ndarray:
    """Soft grand: stretched partials, higher ones die faster, felt-hammer thump."""
    ring = min(6.0, dur + 2.5 * (440 / f) ** 0.3)
    n = int(ring * SR)
    t = t_axis(n)
    x = np.zeros(n)
    b = 0.00035  # inharmonicity
    for k in range(1, 12):
        fk = f * k * np.sqrt(1 + b * k * k)
        if fk > SR * 0.45:
            break
        amp = (1 / k ** 1.25) * (0.55 + 0.45 * vel) ** (k * 0.35)
        decay = 0.55 + 0.45 * k + (f / 600)
        x += amp * np.sin(2 * np.pi * fk * t + RNG.random() * 0.3) * np.exp(-t * decay)
    thump = lp(noise(n), 900) * np.exp(-t * 60) * 0.12 * vel
    x = (x + thump) * adsr(n, 0.002, 0.0, 1.0, 0.12)
    # Damper: once the key is released the string stops over ~0.25 s.
    off = int(dur * SR)
    if off < n:
        x[off:] *= np.exp(-np.arange(n - off) / (0.25 * SR))
    return x * (0.35 + 0.65 * vel)


def epiano(f: float, dur: float, vel: float = 0.6) -> np.ndarray:
    """FM tine electric piano; harder hits bark more."""
    n = int((dur + 0.6) * SR)
    t = t_axis(n)
    index = (0.6 + 2.2 * vel) * np.exp(-t * 3.5)
    mod = np.sin(2 * np.pi * f * t) * index
    tone = np.sin(2 * np.pi * f * t + mod)
    tine = np.sin(2 * np.pi * f * 14.0 * t) * np.exp(-t * 40) * 0.25 * vel
    env = np.exp(-t * (0.9 + f / 900)) * adsr(n, 0.002, 0, 1, 0.08)
    off = int(dur * SR)
    if off < n:
        env[off:] *= np.exp(-np.arange(n - off) / (0.12 * SR))
    return (tone + tine) * env * (0.4 + 0.6 * vel)


def harp(f: float, dur: float = 2.5, bright: float = 0.5) -> np.ndarray:
    """Karplus–Strong string; the delay length is rounded, then the output is resampled to pitch."""
    n_out = int(dur * SR)
    period = SR / f
    # The two-tap averaging filter adds half a sample to the loop, so the string's real period
    # is N + 0.5; the output is resampled by what's left over.
    N = max(2, int(period - 0.5))
    ratio = period / (N + 0.5)
    n = int(n_out / ratio) + 4
    burst = noise(N)
    burst = lp(burst, 1500 + 6000 * bright)
    x = np.zeros(n)
    x[:N] = burst
    g = 0.4985 + 0.001 * (1 - f / 2000)
    a = np.zeros(N + 2)
    a[0] = 1
    a[N] -= g
    a[N + 1] -= g
    y = signal.lfilter([1.0], a, x)
    src = np.arange(n_out) / ratio
    y = np.interp(src, np.arange(n), y)
    return y * adsr(n_out, 0.001, 0, 1, 0.3) / (np.max(np.abs(y)) + 1e-9)


def strings(freqs: list[float], dur: float, attack: float = 0.6, bright: float = 2600, release: float = 0.9) -> np.ndarray:
    """Section strings: 5 detuned saws per note with independent vibrato."""
    n = int((dur + release) * SR)
    x = np.zeros(n)
    for f in freqs:
        for det in (-0.007, -0.003, 0.0, 0.003, 0.007):
            x += saw(phase_of(f * (1 + det) * vibrato(n, 5 + RNG.random(), 0.0035, 0.2), n))
    x /= len(freqs) * 5
    x = lp(x, bright, 2)
    x = hp(x, 90)
    return x * adsr(n, attack, 0.3, 0.9, release)


def violin(f: float, dur: float, bright: float = 3800) -> np.ndarray:
    """Solo line: one bowed saw with vibrato, a formant bump and bow noise."""
    n = int((dur + 0.35) * SR)
    x = saw(phase_of(f * vibrato(n, 5.6, 0.006, 0.25), n))
    x += 0.5 * saw(phase_of(f * 1.003 * vibrato(n, 5.1, 0.005, 0.25), n))
    x = lp(x, bright) + 0.5 * bp(x, 2400, 3400)
    x += lp(noise(n), 5000) * 0.02
    return hp(x, 180) * adsr(n, 0.12, 0.2, 0.85, 0.3)


VOWELS = {"a": [(800, 1.0), (1150, 0.5), (2900, 0.25)], "o": [(450, 1.0), (800, 0.45), (2830, 0.15)],
          "u": [(325, 1.0), (700, 0.25), (2530, 0.1)], "e": [(400, 1.0), (1600, 0.35), (2700, 0.25)]}


def choir(freqs: list[float], dur: float, vowel: str = "a", attack: float = 0.9) -> np.ndarray:
    """Pad choir: detuned saws through vowel formants, slow swell."""
    n = int((dur + 1.2) * SR)
    src = np.zeros(n)
    for f in freqs:
        for det in (-0.006, -0.002, 0.002, 0.006):
            src += saw(phase_of(f * (1 + det) * vibrato(n, 4.6 + RNG.random(), 0.005, 0.4), n))
    src /= len(freqs) * 4
    x = np.zeros(n)
    for fc, g in VOWELS[vowel]:
        x += g * bp(src, fc * 0.85, fc * 1.15)
    x += 0.08 * lp(src, 600)
    return x * adsr(n, attack, 0.4, 0.9, 1.1) * 2.2


def brass(f: float, dur: float, bright: float = 3200, attack: float = 0.06, vel: float = 0.8) -> np.ndarray:
    """Brass: the filter opens with the swell, so loud notes are brighter."""
    n = int((dur + 0.25) * SR)
    ph = phase_of(f * vibrato(n, 5.0, 0.004, 0.3), n)
    x = saw(ph) + 0.6 * saw(ph * 1.004 + 0.3) + 0.3 * saw(ph * 0.5)
    env = adsr(n, attack, 0.25, 0.8, 0.22)
    y = sweep_lp(x, env * vel, 350, bright)
    return hp(y, 70) * env * 0.5


def bell(f: float, dur: float = 2.2) -> np.ndarray:
    n = int(dur * SR)
    t = t_axis(n)
    mod = np.sin(2 * np.pi * f * 3.5 * t) * 1.8 * np.exp(-t * 5)
    x = np.sin(2 * np.pi * f * t + mod) + 0.25 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 4)
    return x * np.exp(-t * 2.2) * adsr(n, 0.002, 0, 1, 0.05)


def bass(f: float, dur: float, bright: float = 700) -> np.ndarray:
    n = int((dur + 0.08) * SR)
    ph = phase_of(f, n)
    x = np.sin(2 * np.pi * ph) + 0.35 * saw(ph)
    return lp(x, bright) * adsr(n, 0.006, 0.15, 0.85, 0.07)


def sub(f: float, dur: float) -> np.ndarray:
    n = int((dur + 0.05) * SR)
    return np.sin(2 * np.pi * phase_of(f, n)) * adsr(n, 0.01, 0.1, 0.9, 0.05)


def synth_bass(f: float, dur: float, vel: float = 0.8) -> np.ndarray:
    """Plucky analog bass for the mine: saw + square, filter snaps shut."""
    n = int((dur + 0.05) * SR)
    t = t_axis(n)
    ph = phase_of(f, n)
    x = saw(ph) + 0.6 * np.sign(np.sin(2 * np.pi * ph)) + 0.8 * np.sin(2 * np.pi * ph * 0.5)
    env = np.exp(-t * 14)
    y = sweep_lp(x, env * vel, 180, 2200)
    return y * adsr(n, 0.003, 0.1, 0.8, 0.04) * 0.6


def arp_synth(f: float, dur: float, bright: float = 4200) -> np.ndarray:
    n = int((dur + 0.05) * SR)
    t = t_axis(n)
    ph = phase_of(f, n)
    x = saw(ph) * 0.6 + saw(ph * 1.005) * 0.4
    y = sweep_lp(x, np.exp(-t * 18), 600, bright)
    return y * adsr(n, 0.002, 0.05, 0.6, 0.04)


def lead(f: float, dur: float, bright: float = 3600) -> np.ndarray:
    """Singing synth lead for the mine hook: two saws, glide-in, vibrato."""
    n = int((dur + 0.2) * SR)
    t = t_axis(n)
    glide = 1 - 0.02 * np.exp(-t * 40)
    fv = f * glide * vibrato(n, 5.8, 0.006, 0.18)
    x = saw(phase_of(fv, n)) + 0.7 * saw(phase_of(fv * 1.006, n))
    return lp(x, bright) * adsr(n, 0.01, 0.2, 0.75, 0.15) * 0.6


# ---------------------------------------------------------------- percussion (mono)

def kick(punch: float = 1.0, dur: float = 0.45) -> np.ndarray:
    n = int(dur * SR)
    t = t_axis(n)
    f = 44 + 120 * np.exp(-t * 32)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    click = hp(noise(n), 3000) * np.exp(-t * 300) * 0.25 * punch
    return np.tanh((body + click) * (1 + punch))


def snare(dur: float = 0.3, tone: float = 185) -> np.ndarray:
    n = int(dur * SR)
    t = t_axis(n)
    rattle = bp(noise(n), 1800, 9000) * np.exp(-t * 18)
    body = np.sin(2 * np.pi * tone * t) * np.exp(-t * 28) + 0.5 * np.sin(2 * np.pi * tone * 1.6 * t) * np.exp(-t * 35)
    return rattle * 0.7 + body * 0.8


def rim(dur: float = 0.12) -> np.ndarray:
    n = int(dur * SR)
    t = t_axis(n)
    return (np.sin(2 * np.pi * 1650 * t) * 0.6 + bp(noise(n), 2500, 7000)) * np.exp(-t * 60)


def hat(open_: bool = False) -> np.ndarray:
    dur = 0.35 if open_ else 0.06
    n = int(dur * SR)
    t = t_axis(n)
    return hp(noise(n), 7500, 4) * np.exp(-t * (9 if open_ else 70))


def shaker() -> np.ndarray:
    n = int(0.09 * SR)
    t = t_axis(n)
    return bp(noise(n), 4000, 11000) * np.sin(np.pi * np.clip(t / 0.09, 0, 1)) ** 2


def taiko(f: float = 62, dur: float = 1.1, hard: float = 1.0) -> np.ndarray:
    n = int(dur * SR)
    t = t_axis(n)
    pitch = f * (1 + 0.5 * np.exp(-t * 25))
    body = np.sin(2 * np.pi * np.cumsum(pitch) / SR) * np.exp(-t * 4.5)
    skin = lp(noise(n), 900) * np.exp(-t * 30) * 0.6 * hard
    return np.tanh((body + skin) * 1.6)


def timpani(f: float, dur: float = 1.6) -> np.ndarray:
    n = int(dur * SR)
    t = t_axis(n)
    x = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 1.5 * t) + 0.25 * np.sin(2 * np.pi * f * 1.98 * t)
    x += lp(noise(n), 400) * np.exp(-t * 20) * 0.5
    return lp(x * np.exp(-t * 2.8), 1200)


def cymbal(dur: float = 3.0, swell: bool = False) -> np.ndarray:
    n = int(dur * SR)
    t = t_axis(n)
    x = hp(noise(n), 4500, 2) + 0.4 * bp(noise(n), 3000, 6000)
    env = (t / dur) ** 2.2 * adsr(n, 0, 0, 1, 0.03) if swell else np.exp(-t * 1.6) * adsr(n, 0.002, 0, 1, 0.2)
    return x * env * 0.5


def riser(dur: float) -> np.ndarray:
    n = int(dur * SR)
    t = t_axis(n)
    x = noise(n)
    # Filter opens over the riser: crossfade dark → bright.
    return sweep_lp(x, (t / dur) ** 2, 400, 9000) * (t / dur) ** 2 * adsr(n, 0, 0, 1, 0.03) * 0.6


# ---------------------------------------------------------------- mixing

class Track:
    """A bar grid with a dry bus, a reverb send and a duckable pad bus."""

    def __init__(self, bpm: float, bars: int, beats_per_bar: int = 4):
        self.beat = 60 / bpm
        self.bpb = beats_per_bar
        self.bars = bars
        self.n = int(round(bars * beats_per_bar * self.beat * SR))
        pad = SR * 8
        self.dry = np.zeros((2, self.n + pad))
        self.wet = np.zeros((2, self.n + pad))
        self.duck = np.zeros((2, self.n + pad))
        self.key = np.zeros(self.n + pad)  # sidechain envelope source

    def at(self, beat: float) -> int:
        return int(round(beat * self.beat * SR))

    def secs(self, beats: float) -> float:
        return beats * self.beat

    def add(self, beat: float, x: np.ndarray, gain: float, pan: float = 0.0, send: float = 0.25,
            ducked: bool = False, humanize: float = 0.004):
        i = self.at(beat) + int(RNG.normal(0, humanize) * SR) if humanize else self.at(beat)
        i = max(0, i)
        end = min(self.dry.shape[1], i + len(x))
        seg = x[: end - i] * gain
        lg, rg = np.sqrt((1 - pan) / 2), np.sqrt((1 + pan) / 2)
        bus = self.duck if ducked else self.dry
        bus[0, i:end] += seg * lg
        bus[1, i:end] += seg * rg
        if send:
            self.wet[0, i:end] += seg * lg * send
            self.wet[1, i:end] += seg * rg * send

    def sidechain(self, beat: float, depth: float = 0.6, release: float = 0.22):
        i = self.at(beat)
        n = int(release * 3 * SR)
        env = depth * np.exp(-np.arange(n) / (release * SR))
        end = min(len(self.key), i + n)
        self.key[i:end] = np.maximum(self.key[i:end], env[: end - i])

    def render(self, room: float = 2.6, wet: float = 0.32, target_rms_db: float = -17.0) -> np.ndarray:
        # Hall: stereo decaying noise, high band decays faster than the low band, early reflections.
        ir_n = int(room * SR)
        t = t_axis(ir_n)
        irs = []
        for _ in range(2):
            lo = lp(noise(ir_n), 2500) * np.exp(-t * 6.9 / room)
            hi = hp(noise(ir_n), 2500) * np.exp(-t * 6.9 / (room * 0.45))
            ir = lo + 0.6 * hi
            ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
            for d, g in ((0.017, 0.5), (0.029, 0.35), (0.041, 0.28), (0.063, 0.2)):
                k = int((d + RNG.random() * 0.004) * SR)
                ir[k] += g
            irs.append(ir / np.sqrt(np.sum(ir ** 2)))
        verb = np.stack([signal.fftconvolve(self.wet[c], irs[c])[: self.wet.shape[1]] for c in range(2)])
        verb = hp(verb, 180)
        ducked = self.duck * (1 - self.key)
        mix = self.dry + ducked + verb * wet
        # Fold everything that rings past the loop point back onto the start.
        loop = mix[:, : self.n].copy()
        tail = mix[:, self.n :]
        for k in range(0, tail.shape[1], self.n):
            chunk = tail[:, k : k + self.n]
            loop[:, : chunk.shape[1]] += chunk
        loop = hp(loop, 38)
        # Air shelf (~+3 dB above 5 kHz) so the mix speaks on phone speakers.
        loop = loop + 0.4 * hp(loop, 5000)
        # Loudness: RMS to target, then a soft knee so peaks stay under -1 dBFS.
        rms = np.sqrt(np.mean(loop ** 2)) + 1e-12
        loop *= 10 ** (target_rms_db / 20) / rms
        ceiling = 10 ** (-1.2 / 20)
        loop = np.tanh(loop / ceiling * 0.95) * ceiling
        return loop.T.astype(np.float32)


# ---------------------------------------------------------------- composition helpers

def play_line(tr: Track, start: float, line: list[tuple[str, float, float]], inst, gain: float,
              pan: float = 0.0, send: float = 0.3, octave: int = 0, legato: float = 1.0, **kw):
    """line: (note, beat, length_in_beats)."""
    for name, beat, length in line:
        if name == "r":
            continue
        f = hz(midi(name) + 12 * octave)
        tr.add(start + beat, inst(f, tr.secs(length) * legato, **kw), gain, pan, send)


def chord_bar(spec: str) -> list[float]:
    return notes(spec)


# ================================================================ HUB
# D minor (Dorian colour), 76 BPM, 40 bars ≈ 2:06.
# A (statement) · B (development, drums enter) · A' (strings sing it) · C (bridge, lifts to
# F major) · A'' (piano alone, walks back to the top).

HUB_A = ["D3 A3 C4 E4 F4", "Bb2 F3 A3 D4", "A2 F3 A3 C4", "C3 G3 C4 F4|C3 G3 C4 E4",
         "D3 A3 D4 F4", "G2 F3 Bb3 D4", "Bb2 F3 A3 D4", "A2 G3 D4 E4|A2 G3 C#4 E4"]
HUB_B = ["Bb2 F3 A3 D4", "C3 G3 C4 E4", "A2 G3 C4 E4", "D3 A3 D4 F4",
         "G2 F3 Bb3 D4", "C3 G3 Bb3 E4", "F2 E3 A3 C4", "A2 G3 C#4 E4"]
HUB_C = ["F2 E3 A3 C4", "E2 G3 C4 E4", "D3 F3 A3 C4", "Bb2 F3 A3 D4",
         "G2 F3 Bb3 D4", "A2 G3 C4 E4", "Bb2 F3 A3 D4", "C3 G3 C4 F4|C3 G3 C4 E4"]

HUB_MEL_A = [("A4", 0, 1.5), ("G4", 1.5, .5), ("F4", 2, 1), ("E4", 3, 1),
             ("D4", 4, 2), ("F4", 6, 1), ("A4", 7, 1),
             ("C5", 8, 1.5), ("Bb4", 9.5, .5), ("A4", 10, 2),
             ("G4", 12, 1), ("F4", 13, .5), ("G4", 13.5, .5), ("E4", 14, 2),
             ("A4", 16, 1.5), ("G4", 17.5, .5), ("F4", 18, 1), ("A4", 19, 1),
             ("D5", 20, 2), ("C5", 22, 1), ("Bb4", 23, 1),
             ("A4", 24, 1), ("Bb4", 25, .5), ("C5", 25.5, .5), ("D5", 26, 2),
             ("E5", 28, 1.5), ("D5", 29.5, .5), ("C#5", 30, 2)]
HUB_MEL_B = [("F5", 0, 1), ("D5", 1, 1), ("Bb4", 2, 1.5), ("C5", 3.5, .5),
             ("E5", 4, 1), ("G5", 5, 1), ("E5", 6, 1), ("C5", 7, 1),
             ("E5", 8, 1.5), ("D5", 9.5, .5), ("C5", 10, 1), ("A4", 11, 1),
             ("D5", 12, 3), ("A4", 15, 1),
             ("Bb4", 16, 1), ("D5", 17, 1), ("F5", 18, 1.5), ("E5", 19.5, .5),
             ("G5", 20, 2), ("E5", 22, 1), ("G5", 23, 1),
             ("F5", 24, 1), ("E5", 25, .5), ("C5", 25.5, .5), ("A4", 26, 2),
             ("C#5", 28, 1), ("E5", 29, 1), ("G5", 30, 1), ("E5", 31, 1)]
HUB_MEL_C = [("A5", 0, 3), ("G5", 3, 1), ("G5", 4, 2), ("E5", 6, 2),
             ("F5", 8, 3), ("D5", 11, 1), ("D5", 12, 2), ("F5", 14, 2),
             ("G5", 16, 3), ("F5", 19, 1), ("E5", 20, 2), ("C5", 22, 2),
             ("D5", 24, 2), ("F5", 26, 1), ("G5", 27, 1), ("G5", 28, 2), ("E5", 30, 2)]
# Counter-line for A' (cellos under the strings' melody).
HUB_COUNTER = [("F3", 0, 2), ("E3", 2, 2), ("D3", 4, 4), ("C3", 8, 4), ("G3", 12, 2), ("E3", 14, 2),
               ("F3", 16, 4), ("G3", 20, 4), ("F3", 24, 2), ("A3", 26, 2), ("E3", 28, 2), ("C#3", 30, 2)]


def split_bar(spec: str) -> list[tuple[float, float, str]]:
    """'X|Y' → two half-bar chords; plain → one full bar."""
    if "|" in spec:
        a, b = spec.split("|")
        return [(0, 2, a), (2, 2, b)]
    return [(0, 4, spec)]


def hub() -> np.ndarray:
    tr = Track(76, 40)
    sections = [("A", HUB_A, 0), ("B", HUB_B, 8), ("A2", HUB_A, 16), ("C", HUB_C, 24), ("A3", HUB_A, 32)]
    for name, prog, bar0 in sections:
        for i, spec in enumerate(prog):
            b = (bar0 + i) * 4
            for off, length, chord in split_bar(spec):
                fs = chord_bar(chord)
                root = fs[0]
                # Pad: strings everywhere but the intimate outro; choir joins the bridge.
                pad_gain = {"A": 0.16, "B": 0.18, "A2": 0.2, "C": 0.2, "A3": 0.12}[name]
                tr.add(b + off, strings([f for f in fs[1:]], tr.secs(length), attack=0.9, bright=1900), pad_gain, 0, 0.45)
                if name == "C":
                    tr.add(b + off, choir(fs[1:], tr.secs(length), "a"), 0.13, 0, 0.5)
                # Bass: root on 1, fifth or approach on 3 (the outro keeps only the root).
                tr.add(b + off, bass(root, tr.secs(min(length, 2)) * 0.95), 0.24, 0, 0.05)
                if length == 4 and name not in ("A", "A3"):
                    tr.add(b + 2, bass(root * 1.5 if i % 2 else root, tr.secs(2) * 0.9), 0.19, 0, 0.05)
                # Keys.
                if name in ("A", "A2"):
                    for k, (beat, vel) in enumerate(((0, 0.5), (1.5, 0.4), (2.5, 0.45))):
                        if beat < off or beat >= off + length:
                            continue
                        for f in fs[1:]:
                            tr.add(b + beat, epiano(f, tr.secs(1.2), vel), 0.07, (-0.3 if k % 2 else 0.3), 0.3)
                elif name == "B":
                    arp = fs[1:] + fs[2:][::-1]
                    for s in range(int(length * 2)):
                        f = arp[s % len(arp)] * (2 if s % 8 >= 4 else 1)
                        tr.add(b + off + s * 0.5, epiano(f, tr.secs(0.6), 0.45), 0.075, 0.45 if s % 2 else -0.45, 0.3)
                elif name == "C":
                    arp = fs[1:] + [f * 2 for f in fs[1:]]
                    for s in range(int(length * 4)):
                        f = arp[(s * 2 + s // 4) % len(arp)]
                        tr.add(b + off + s * 0.25, harp(f, 1.6, 0.4 + 0.3 * (s % 4 == 0)), 0.09, -0.5 + (s % 8) / 7, 0.4)
                else:  # A3: sparse harp on the downbeat only.
                    tr.add(b + off, harp(fs[-1] * 2, 2.4, 0.3), 0.08, 0.4, 0.5)

    # Melodies.
    play_line(tr, 0, HUB_MEL_A, piano, 0.36, 0.08, 0.3, vel=0.55)
    play_line(tr, 32, HUB_MEL_B, piano, 0.34, 0.08, 0.3, vel=0.6)
    play_line(tr, 32, HUB_MEL_B, bell, 0.05, -0.3, 0.45, octave=1)
    play_line(tr, 64, HUB_MEL_A, violin, 0.2, 0.12, 0.4, octave=1)
    play_line(tr, 64, HUB_COUNTER, violin, 0.13, -0.35, 0.35, bright=1800)
    play_line(tr, 96, HUB_MEL_C, bell, 0.14, 0.2, 0.5)
    play_line(tr, 96, HUB_MEL_C, violin, 0.14, -0.1, 0.45)
    play_line(tr, 128, HUB_MEL_A, piano, 0.3, 0.05, 0.35, octave=-1, vel=0.45)

    # Drums: brushed and far back — B, A' and a half-time bridge.
    for bar in range(8, 32):
        b = bar * 4
        half = bar >= 24
        tr.add(b, kick(0.4), 0.14, 0, 0.05)
        if not half:
            tr.add(b + 2.5, kick(0.3), 0.12, 0, 0.05)
        tr.add(b + (2 if half else 1), rim(), 0.06, 0.2, 0.2)
        if not half:
            tr.add(b + 3, rim(), 0.06, 0.2, 0.2)
        for e in range(8):
            tr.add(b + e * 0.5, shaker(), 0.035 * (1.2 if e % 2 else 0.7), 0.35, 0.1)
    tr.add(31 * 4, cymbal(3.5, swell=True), 0.12, 0, 0.3)
    tr.add(32 * 4, cymbal(3.5), 0.06, 0, 0.4)
    return tr.render(room=3.2, wet=0.34, target_rms_db=-14.5)


# ================================================================ MINE
# E minor, 128 BPM, 32 bars = 60 s: four-on-the-floor drill groove, pumping pads, a hook
# that answers itself, a half-time breakdown and a riser back into the top.

MINE_PROG_A = ["E", "C", "G", "D"]
MINE_PROG_B = ["A", "E", "C", "D"]
MINE_CHORDS = {"E": "E3 B3 E4 G4", "C": "C3 G3 C4 E4", "G": "G2 D3 G3 B3 D4", "D": "D3 A3 D4 F#4", "A": "A2 E3 A3 C4 E4"}
MINE_HOOK = [("B4", 0, .5), ("E5", .5, .5), ("G5", 1, .75), ("F#5", 1.75, .25), ("E5", 2, .5), ("D5", 2.5, .5), ("E5", 3, 1),
             ("E5", 4, .5), ("G5", 4.5, .5), ("C6", 5, .75), ("B5", 5.75, .25), ("G5", 6, 1), ("E5", 7, 1),
             ("D5", 8, .5), ("G5", 8.5, .5), ("B5", 9, .75), ("A5", 9.75, .25), ("G5", 10, .5), ("F#5", 10.5, .5), ("D5", 11, 1),
             ("F#5", 12, 1), ("A5", 13, .5), ("F#5", 13.5, .5), ("E5", 14, 2)]
MINE_ANSWER = [("E6", 0, 1.5), ("D6", 1.5, .5), ("B5", 2, 1), ("G5", 3, 1),
               ("G5", 4, .5), ("A5", 4.5, .5), ("B5", 5, 1), ("E5", 6, 2),
               ("G5", 8, .5), ("A5", 8.5, .5), ("B5", 9, 1), ("G5", 10, 1), ("E5", 11, 1),
               ("F#5", 12, 1.5), ("G5", 13.5, .5), ("A5", 14, 1), ("B5", 15, 1)]


def mine() -> np.ndarray:
    tr = Track(128, 32)
    progs = MINE_PROG_A * 2 + MINE_PROG_B * 2 + MINE_PROG_A * 2 + MINE_PROG_A * 2
    for bar, root in enumerate(progs):
        b = bar * 4
        section = bar // 8  # 0 A · 1 B · 2 A' · 3 breakdown
        fs = chord_bar(MINE_CHORDS[root])
        breakdown = section == 3
        # Pumping pad (ducked by the kick).
        tr.add(b, strings(fs[1:], tr.secs(4), attack=0.05, bright=3400 if not breakdown else 1500), 0.17, 0, 0.3, ducked=True)
        # Bass: offbeat pluck groove; the breakdown drops to a held sub.
        if not breakdown:
            for e in range(8):
                oct_ = 2 if e % 2 else 1
                tr.add(b + e * 0.5, synth_bass(fs[0] * oct_ / (2 if fs[0] > 120 else 1), tr.secs(0.45), 0.9 if e % 2 else 0.6), 0.24, 0, 0.02, ducked=True)
        else:
            tr.add(b, sub(fs[0] / 2, tr.secs(4)), 0.18, 0, 0)
        # 16th arp.
        arp = [fs[1], fs[2], fs[3] if len(fs) > 3 else fs[1] * 2, fs[2]]
        for s in range(16):
            if breakdown and s % 2:
                continue
            f = arp[s % 4] * (2 if (s // 4) % 2 else 1)
            tr.add(b + s * 0.25, arp_synth(f, tr.secs(0.22), 5200 if section == 2 else 3600), 0.07, 0.55 if s % 2 else -0.55, 0.22, ducked=True)
        # Drums.
        if not breakdown:
            for beat in range(4):
                tr.add(b + beat, kick(1.0), 0.42, 0, 0.02, humanize=0)
                tr.sidechain(b + beat, 0.55, 0.16)
                tr.add(b + beat + 0.5, hat(open_=beat % 2 == 1), 0.11 if beat % 2 else 0.09, 0.25, 0.08)
                for q in (0.25, 0.75):
                    tr.add(b + beat + q, hat(), 0.05, -0.2, 0.05)
            tr.add(b + 1, snare(), 0.34, 0, 0.18)
            tr.add(b + 3, snare(), 0.34, 0, 0.18)
            if bar % 8 == 7:  # fill into the next phrase
                for k, q in enumerate((2.5, 2.75, 3.25, 3.5, 3.75)):
                    tr.add(b + q, snare(0.2, 200 + k * 25), 0.18 + k * 0.03, -0.3 + k * 0.15, 0.2)
        else:
            tr.add(b, kick(0.8), 0.36, 0, 0.05)
            tr.sidechain(b, 0.4, 0.3)
            tr.add(b + 2, snare(0.4), 0.3, 0, 0.35)
            for e in range(8):
                tr.add(b + e * 0.5, shaker(), 0.05, 0.3, 0.1)
    # Crash on each phrase start; riser at the end of the loop into bar 1.
    for bar in (0, 8, 16):
        tr.add(bar * 4, cymbal(2.5), 0.1, 0, 0.3)
    tr.add(28 * 4, riser(tr.secs(16)), 0.2, 0, 0.3)
    # Hook: A states it, B answers, A' doubles it an octave up, breakdown hums it on strings.
    play_line(tr, 0, MINE_HOOK, lead, 0.24, 0.05, 0.28)
    play_line(tr, 16, MINE_HOOK, lead, 0.22, 0.05, 0.28, bright=3000)
    play_line(tr, 32, MINE_ANSWER, lead, 0.24, 0.05, 0.3)
    play_line(tr, 48, MINE_ANSWER, lead, 0.22, 0.05, 0.3)
    play_line(tr, 64, MINE_HOOK, lead, 0.22, -0.05, 0.3)
    play_line(tr, 64, MINE_HOOK, bell, 0.05, 0.4, 0.4, octave=1)
    play_line(tr, 80, MINE_HOOK, lead, 0.22, -0.05, 0.3)
    play_line(tr, 80, MINE_HOOK, bell, 0.05, 0.4, 0.4, octave=1)
    play_line(tr, 96, MINE_HOOK, violin, 0.14, 0, 0.5, octave=-1, legato=1.2)
    return tr.render(room=1.8, wet=0.22, target_rms_db=-13.5)


# ================================================================ HUNT
# C minor, 148 BPM, 40 bars ≈ 65 s — the battle.
# A: taiko + spiccato strings ostinato · B: horns take the theme · C: choir and full brass
# climax · D: Neapolitan tension, timpani roll, rising strings · E: the theme once more, higher.

HUNT_PROG = {
    "A": ["Cm", "Cm", "Ab", "Bb", "Cm", "Cm", "Ab", "G"],
    "B": ["Cm", "Ab", "Eb", "Bb", "Fm", "Cm", "Ab", "G"],
    "C": ["Ab", "Bb", "Gm", "Cm", "Fm", "Db", "G", "G"],
    "D": ["Db", "Db", "Bbm", "Bbm", "Ab", "Ab", "G", "G"],
    "E": ["Cm", "Ab", "Eb", "Bb", "Fm", "Cm", "Ab", "G"],
}
HUNT_CHORDS = {"Cm": "C3 G3 C4 Eb4", "Ab": "Ab2 Eb3 Ab3 C4", "Bb": "Bb2 F3 Bb3 D4", "G": "G2 D3 G3 B3",
               "Eb": "Eb3 Bb3 Eb4 G4", "Fm": "F2 C3 F3 Ab3", "Gm": "G2 D3 G3 Bb3", "Db": "Db3 Ab3 Db4 F4",
               "Bbm": "Bb2 F3 Bb3 Db4"}
# Ostinato (in scale steps over each chord root): driving 8ths.
HUNT_OSTINATO = [0, 0, 7, 0, 12, 0, 7, 3]
HUNT_THEME = [("G4", 0, 1.5), ("C5", 1.5, .5), ("Eb5", 2, 1), ("D5", 3, .5), ("C5", 3.5, .5),
              ("Eb5", 4, 1.5), ("F5", 5.5, .5), ("G5", 6, 2),
              ("Ab5", 8, 1.5), ("G5", 9.5, .5), ("F5", 10, 1), ("Eb5", 11, 1),
              ("F5", 12, 1.5), ("Eb5", 13.5, .5), ("D5", 14, 2),
              ("G4", 16, 1.5), ("C5", 16 + 1.5, .5), ("Eb5", 18, 1), ("G5", 19, 1),
              ("C6", 20, 2), ("Bb5", 22, 1), ("G5", 23, 1),
              ("Ab5", 24, 1.5), ("G5", 25.5, .5), ("F5", 26, 1), ("Eb5", 27, 1),
              ("D5", 28, 2), ("B4", 30, 2)]
HUNT_CLIMAX = [("C6", 0, 2), ("Bb5", 2, 1), ("C6", 3, 1), ("D6", 4, 2), ("Bb5", 6, 2),
               ("Bb5", 8, 1.5), ("Ab5", 9.5, .5), ("G5", 10, 1), ("Bb5", 11, 1), ("C6", 12, 4),
               ("Ab5", 16, 2), ("C6", 18, 2), ("Db6", 20, 2), ("F6", 22, 2),
               ("D6", 24, 2), ("B5", 26, 2), ("D6", 28, 2), ("G6", 30, 2)]


def hunt() -> np.ndarray:
    tr = Track(148, 40)
    order = ["A", "B", "C", "D", "E"]
    for si, sec in enumerate(order):
        for i, name in enumerate(HUNT_PROG[sec]):
            bar = si * 8 + i
            b = bar * 4
            fs = chord_bar(HUNT_CHORDS[name])
            root = fs[0]
            # Spiccato low strings ostinato (every section but the tense D keeps it).
            if sec != "D":
                for e, step in enumerate(HUNT_OSTINATO):
                    f = root * 2 ** (step / 12)
                    tr.add(b + e * 0.5, strings([f], tr.secs(0.32), attack=0.008, bright=2600, release=0.12), 0.34, -0.25, 0.18)
                    tr.add(b + e * 0.5, strings([f * 2], tr.secs(0.3), attack=0.008, bright=3400, release=0.1), 0.16, 0.3, 0.2)
            else:
                # Tremolo strings climbing a semitone every two bars.
                for s in range(16):
                    f = fs[1] * 2 ** ((i // 2) / 12) * 2
                    tr.add(b + s * 0.25, strings([f, f * 1.5], tr.secs(0.2), attack=0.01, bright=3000, release=0.08), 0.1, (-0.4 if s % 2 else 0.4), 0.3)
            # Low brass/strings pad + sub.
            pad_gain = {"A": 0.12, "B": 0.14, "C": 0.2, "D": 0.16, "E": 0.2}[sec]
            tr.add(b, strings(fs[1:], tr.secs(4), attack=0.25, bright=2200), pad_gain, 0, 0.35)
            tr.add(b, sub(root / 2, tr.secs(4) * 0.98), 0.13, 0, 0)
            if sec in ("C", "E"):
                tr.add(b, choir(fs[1:] + [fs[2] * 2], tr.secs(4), "o" if sec == "C" else "a", attack=0.3), 0.2, 0, 0.45)
            # Brass stabs on the off-beats (A, E) / on 1 and the "and" of 2 (B, C).
            if sec in ("A", "E"):
                for q in (1.5, 3.5):
                    for f in fs[1:]:
                        tr.add(b + q, brass(f, tr.secs(0.35), 3800, attack=0.01, vel=1.0), 0.085, 0, 0.25)
            elif sec in ("B", "C"):
                for q in (0, 2.5):
                    for f in fs[1:]:
                        tr.add(b + q, brass(f, tr.secs(0.5), 3400, attack=0.015, vel=0.9), 0.07, 0, 0.3)
            # Percussion.
            if sec == "D":
                tr.add(b, taiko(55, 1.4), 0.28, 0, 0.3)
                if i >= 4:
                    for s in range(16):
                        tr.add(b + s * 0.25, timpani(hz("G2"), 0.4), 0.08 + 0.02 * s / 16 + 0.03 * (i - 4), 0, 0.3)
                continue
            pattern = [(0, 1.0, 58), (1.5, 0.7, 72), (2, 0.9, 58), (2.75, 0.6, 90), (3, 0.9, 64), (3.5, 0.6, 90)]
            for q, v, f in pattern:
                tr.add(b + q, taiko(f, 1.0, v), 0.22 * v, (q - 2) / 4, 0.28)
            tr.add(b + 1, snare(0.35, 170), 0.2, 0.1, 0.35)
            tr.add(b + 3, snare(0.35, 170), 0.22, 0.1, 0.35)
            for e in range(8):
                tr.add(b + e * 0.5, hat(), 0.075, 0.3, 0.1)
            if i == 7:  # fill
                for k in range(8):
                    tr.add(b + 2 + k * 0.25, taiko(70 + k * 6, 0.5, 0.8), 0.22 + 0.02 * k, -0.5 + k / 7, 0.3)
    for bar in (0, 8, 16, 32):
        tr.add(bar * 4, cymbal(3.0), 0.14, 0, 0.35)
    tr.add(30 * 4, cymbal(tr.secs(8), swell=True), 0.16, 0, 0.3)
    tr.add(38 * 4, riser(tr.secs(8)), 0.14, 0, 0.3)
    # Melody: horns in B (doubled an octave down), full brass + strings in C, back in E higher.
    play_line(tr, 32, HUNT_THEME, brass, 0.2, 0.1, 0.35, bright=2600, attack=0.05)
    play_line(tr, 32, HUNT_THEME, brass, 0.12, -0.2, 0.35, octave=-1, bright=1800, attack=0.05)
    play_line(tr, 64, HUNT_CLIMAX, brass, 0.2, 0.05, 0.4, bright=3400, attack=0.04)
    play_line(tr, 64, HUNT_CLIMAX, violin, 0.13, -0.25, 0.4)
    play_line(tr, 128, HUNT_THEME, brass, 0.2, 0.1, 0.4, octave=1, bright=3600, attack=0.04)
    play_line(tr, 128, HUNT_THEME, violin, 0.14, -0.2, 0.4)
    play_line(tr, 128, HUNT_THEME, brass, 0.12, -0.1, 0.35, bright=2000, attack=0.05)
    return tr.render(room=2.4, wet=0.28, target_rms_db=-13.0)


# ================================================================ CHAMBER
# B minor → D major, 64 BPM, 24 bars = 90 s — rebirth and the ending. Piano and strings state
# the theme, choir and a solo horn carry it, and the full ensemble resolves to D before the
# loop falls back into B minor.

CH_PROG = [
    ["B2 F#3 B3 D4", "G2 D3 G3 B3", "D3 A3 D4 F#4", "A2 E3 A3 C#4", "E3 G3 B3 E4", "G2 D3 B3 D4", "F#2 C#3 A#3 C#4", "F#2 C#3 A#3 E4"],
    ["B2 F#3 B3 D4", "G2 D3 G3 B3", "E3 B3 E4 G4", "A2 E3 A3 C#4", "D3 A3 D4 F#4", "G2 D3 B3 D4", "E3 G3 B3 E4", "F#2 C#3 A#3 C#4"],
    ["G2 D3 G3 B3", "A2 E3 A3 C#4", "B2 F#3 B3 D4", "D3 A3 D4 F#4", "G2 D3 G3 B3", "A2 E3 A3 C#4", "D3 A3 D4 F#4", "F#2 C#3 A#3 C#4"],
]
CH_THEME = [("F#4", 0, 2), ("D4", 2, 1), ("B3", 3, 1), ("B4", 4, 3), ("A4", 7, 1),
            ("A4", 8, 2), ("F#4", 10, 1), ("D4", 11, 1), ("E4", 12, 3), ("C#4", 15, 1),
            ("G4", 16, 2), ("F#4", 18, 1), ("E4", 19, 1), ("D4", 20, 2), ("B3", 22, 2),
            ("C#4", 24, 3), ("A#3", 27, 1), ("C#4", 28, 2), ("F#4", 30, 2)]
CH_THEME2 = [("F#5", 0, 2), ("D5", 2, 1), ("B4", 3, 1), ("B5", 4, 3), ("A5", 7, 1),
             ("G5", 8, 2), ("E5", 10, 1), ("B4", 11, 1), ("C#5", 12, 3), ("E5", 15, 1),
             ("F#5", 16, 2), ("A5", 18, 1), ("F#5", 19, 1), ("D5", 20, 2), ("B4", 22, 2),
             ("E5", 24, 2), ("D5", 26, 1), ("B4", 27, 1), ("C#5", 28, 4)]
CH_FINALE = [("D5", 0, 2), ("E5", 2, 1), ("F#5", 3, 1), ("E5", 4, 3), ("A4", 7, 1),
             ("B4", 8, 2), ("C#5", 10, 1), ("D5", 11, 1), ("F#5", 12, 4),
             ("G5", 16, 2), ("F#5", 18, 1), ("E5", 19, 1), ("E5", 20, 2), ("A5", 22, 2),
             ("F#5", 24, 4), ("E5", 28, 2), ("C#5", 30, 2)]


def chamber() -> np.ndarray:
    tr = Track(64, 24)
    for si, prog in enumerate(CH_PROG):
        for i, spec in enumerate(prog):
            bar = si * 8 + i
            b = bar * 4
            fs = chord_bar(spec)
            tr.add(b, strings(fs[1:], tr.secs(4), attack=1.0, bright=1600 + 600 * si), 0.16 + 0.04 * si, 0, 0.5)
            tr.add(b, bass(fs[0], tr.secs(4) * 0.97, 500), 0.2, 0, 0.1)
            # Piano arpeggio (8ths) in every section, softer under the choir.
            arp = [fs[0], fs[1], fs[2], fs[3], fs[2] * 2, fs[3], fs[2], fs[1]]
            for e, f in enumerate(arp):
                tr.add(b + e * 0.5, piano(f * 2 if e else f, tr.secs(1.2), 0.35 + 0.1 * (e == 0)), 0.14 if si == 0 else 0.09, -0.3 + e / 12, 0.4)
            if si >= 1:
                tr.add(b, choir(fs[1:], tr.secs(4), "a" if si == 1 else "o"), 0.15 + 0.05 * (si == 2), 0, 0.55)
            if si == 2:
                tr.add(b, timpani(fs[0], 2.0), 0.18, 0, 0.35)
                if i in (3, 7):
                    tr.add(b + 2, timpani(fs[0], 1.4), 0.12, 0, 0.35)
    tr.add(15 * 4, cymbal(tr.secs(4), swell=True), 0.1, 0, 0.4)
    tr.add(16 * 4, cymbal(4.0), 0.07, 0, 0.5)
    play_line(tr, 0, CH_THEME, piano, 0.36, 0.1, 0.4, octave=1, vel=0.55)
    play_line(tr, 32, CH_THEME2, brass, 0.16, 0.1, 0.5, bright=1500, attack=0.18, vel=0.6)
    play_line(tr, 32, CH_THEME2, violin, 0.1, -0.2, 0.5, octave=-1, bright=2200)
    play_line(tr, 64, CH_FINALE, violin, 0.18, -0.1, 0.5)
    play_line(tr, 64, CH_FINALE, brass, 0.15, 0.15, 0.5, octave=-1, bright=1800, attack=0.15, vel=0.7)
    play_line(tr, 64, CH_FINALE, bell, 0.05, 0.4, 0.55)
    return tr.render(room=3.8, wet=0.4, target_rms_db=-14.0)


TRACKS = {"hub": hub, "mine": mine, "hunt": hunt, "chamber": chamber}


def main(names: list[str]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name in names or list(TRACKS):
        audio = TRACKS[name]()
        path = OUT / f"bgm_{name}_{VERSION}.mp3"
        sf.write(path, audio, SR, format="MP3", subtype="MPEG_LAYER_III", compression_level=0.55, bitrate_mode="VARIABLE")
        peak = 20 * np.log10(np.max(np.abs(audio)) + 1e-12)
        rms = 20 * np.log10(np.sqrt(np.mean(audio ** 2)) + 1e-12)
        print(f"{path.name}  {len(audio) / SR:6.1f}s  peak {peak:5.1f} dBFS  rms {rms:5.1f} dBFS  {path.stat().st_size / 1024:6.0f} KB")


if __name__ == "__main__":
    main(sys.argv[1:])

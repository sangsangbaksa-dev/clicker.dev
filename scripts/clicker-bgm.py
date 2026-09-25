#!/usr/bin/env python3
"""Procedural orchestral BGM — one loop per region plus the timed mine.

Warm and wide rather than bright: saw ensembles filtered hard below ~2 kHz, formant
choir, low brass, timpani/taiko, a long synthetic hall, and a master rolloff so
nothing on top reads as piercing.

Each loop is rendered circularly (note tails and reverb wrap onto the start), then
written as `loop + LOOP_PREROLL` seconds so the player can loop [PREROLL_START,
PREROLL_START + loop) without depending on the MP3 decoder's encoder-delay handling.
Keep LOOP_PREROLL / the per-track loop lengths in sync with `use-clicker-bgm.ts`.

    pip install numpy scipy soundfile
    python3 scripts/clicker-bgm.py            # all tracks
    python3 scripts/clicker-bgm.py storm_spire
"""
from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import fftconvolve

SR = 44100
OUT = Path(__file__).resolve().parent.parent / "public" / "clicker" / "audio"
LOOP_PREROLL = 1.0
TAIL = 8.0
RNG = np.random.default_rng(7)

NOTE = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6,
        "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
QUALITY = {"": (0, 4, 7), "m": (0, 3, 7), "maj7": (0, 4, 7, 11), "m7": (0, 3, 7, 10), "sus4": (0, 5, 7)}


def midi(name: str) -> int:
    """'Eb4' → 63."""
    pc, octave = (name[:2], name[2:]) if len(name) > 2 and name[1] in "#b" else (name[:1], name[1:])
    return NOTE[pc] + 12 * (int(octave) + 1)


def hz(m: float) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


def parse_chord(sym: str) -> tuple[int, tuple[int, ...]]:
    root = sym[:2] if len(sym) > 1 and sym[1] in "#b" else sym[:1]
    return NOTE[root], QUALITY[sym[len(root):]]


def voice(pcs: list[int], lo: int, hi: int) -> list[int]:
    """Every chord tone once, placed at its lowest octave inside [lo, hi]."""
    out = []
    for pc in pcs:
        m = lo + ((pc - lo) % 12)
        if m <= hi:
            out.append(m)
    return sorted(out)


def parse_line(line: str) -> list[tuple[float, float, int | None]]:
    """'D4:3 E4:1 r:2' → [(beat, dur, midi|None)]."""
    beat, notes = 0.0, []
    for tok in line.split():
        name, dur = tok.split(":")
        notes.append((beat, float(dur), None if name == "r" else midi(name)))
        beat += float(dur)
    return notes


# ---------------------------------------------------------------------------
# DSP helpers
# ---------------------------------------------------------------------------

def spectral(x: np.ndarray, gain_fn) -> np.ndarray:
    n = len(x)
    X = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(n, 1 / SR)
    g = gain_fn(f)
    return np.fft.irfft(X * (g[:, None] if X.ndim == 2 else g), n=n, axis=0)


def lowpass(x: np.ndarray, cutoff: float, order: int = 4) -> np.ndarray:
    return spectral(x, lambda f: 1 / np.sqrt(1 + (f / cutoff) ** (2 * order)))


def highpass(x: np.ndarray, cutoff: float, order: int = 2) -> np.ndarray:
    return spectral(x, lambda f: 1 / np.sqrt(1 + (cutoff / np.maximum(f, 1e-3)) ** (2 * order)))


def formant(x: np.ndarray, peaks: list[tuple[float, float, float]]) -> np.ndarray:
    """Sum of gaussian bumps (centre, width, gain) — a soft vowel."""
    def g(f):
        out = np.full_like(f, 0.04)
        for c, w, a in peaks:
            out += a * np.exp(-0.5 * ((f - c) / w) ** 2)
        return out
    return spectral(x, g)


def saw_osc(freq: float, n: int, cents: float = 0.0, vib_hz: float = 5.0, vib_depth: float = 0.0,
            vib_delay: float = 0.4) -> np.ndarray:
    t = np.arange(n) / SR
    f = freq * 2 ** (cents / 1200)
    vib = vib_depth * np.sin(2 * np.pi * vib_hz * t + RNG.uniform(0, 6.28)) * np.clip(t / max(vib_delay, 1e-3), 0, 1)
    phase = np.cumsum(f * (1 + vib)) / SR + RNG.uniform(0, 1)
    return 2 * (phase % 1.0) - 1


def adsr(n: int, attack: float, release: float, hold_n: int) -> np.ndarray:
    """Linear-ish attack, flat hold, exponential release after `hold_n`."""
    e = np.ones(n)
    a = max(1, int(attack * SR))
    e[: min(a, n)] = np.sin(np.linspace(0, np.pi / 2, a))[: min(a, n)] ** 2
    if hold_n < n:
        rel = np.exp(-np.arange(n - hold_n) / (release * SR / 4.0))
        e[hold_n:] *= rel * e[min(hold_n, n - 1)]
    return e


def hall_ir(seconds: float = 4.5, decay: float = 2.8, damp: float = 3500.0) -> np.ndarray:
    n = int(seconds * SR)
    t = np.arange(n) / SR
    env = np.exp(-6.9 * t / decay)  # decay = RT60
    ir = RNG.standard_normal((n, 2)) * env[:, None]
    ir = lowpass(ir, damp, 2)
    # Later reflections get darker still.
    dark = lowpass(ir, damp * 0.35, 2)
    mix = np.clip(t / (seconds * 0.6), 0, 1)[:, None]
    ir = ir * (1 - mix) + dark * mix
    pre = int(0.025 * SR)
    ir = np.concatenate([np.zeros((pre, 2)), ir])
    return ir / np.sqrt(np.sum(ir ** 2) / 2)


# ---------------------------------------------------------------------------
# Instruments — each renders mono/stereo into a Track bus
# ---------------------------------------------------------------------------

@dataclass
class Track:
    loop_s: float
    bpm: float
    n_loop: int = 0
    buses: dict[str, np.ndarray] = field(default_factory=dict)

    def __post_init__(self):
        self.n_loop = int(round(self.loop_s * SR))

    def bus(self, name: str) -> np.ndarray:
        if name not in self.buses:
            self.buses[name] = np.zeros((self.n_loop + int(TAIL * SR), 2))
        return self.buses[name]

    def beat(self, b: float) -> int:
        return int(round(b * 60 / self.bpm * SR))

    def add(self, name: str, start: int, sig: np.ndarray, pan: float = 0.0):
        buf = self.bus(name)
        if sig.ndim == 1:
            left, right = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
            sig = np.column_stack([sig * left, sig * right]) * np.sqrt(2)
        end = min(len(buf), start + len(sig))
        buf[start:end] += sig[: end - start]


def ensemble(freq: float, n: int, hold_n: int, attack: float, release: float, voices: int,
             spread_cents: float, vib: float) -> np.ndarray:
    """Stereo detuned saw section (not yet filtered)."""
    out = np.zeros((n, 2))
    env = adsr(n, attack, release, hold_n)
    for i in range(voices):
        c = (i - (voices - 1) / 2) * spread_cents * 2 / max(voices - 1, 1)
        s = saw_osc(freq, n, c, vib_hz=RNG.uniform(4.6, 5.6), vib_depth=vib) * env
        pan = (i / max(voices - 1, 1)) * 1.6 - 0.8
        out[:, 0] += s * np.cos((pan + 1) * np.pi / 4)
        out[:, 1] += s * np.sin((pan + 1) * np.pi / 4)
    return out / voices


def strings(tr: Track, bus: str, m: int, beat: float, dur: float, amp: float, attack=0.9, release=1.6):
    n_hold = tr.beat(dur)
    n = n_hold + int(release * SR * 1.5)
    sig = ensemble(hz(m), n, n_hold, attack, release, voices=5, spread_cents=9, vib=0.0022)
    tr.add(bus, tr.beat(beat), sig * amp)


def choir(tr: Track, bus: str, m: int, beat: float, dur: float, amp: float, attack=1.2, release=2.0):
    n_hold = tr.beat(dur)
    n = n_hold + int(release * SR * 1.5)
    sig = ensemble(hz(m), n, n_hold, attack, release, voices=4, spread_cents=12, vib=0.003)
    tr.add(bus, tr.beat(beat), sig * amp)


def brass(tr: Track, bus: str, m: int, beat: float, dur: float, amp: float, bright: float = 1.0,
          attack=0.18, release=0.9, pan=0.0):
    """Horn-ish: brightness swells with the note, then settles."""
    n_hold = tr.beat(dur)
    n = n_hold + int(release * SR * 1.5)
    f = hz(m)
    raw = (saw_osc(f, n, -4, vib_depth=0.0015, vib_delay=0.8) + saw_osc(f, n, 4, vib_depth=0.0015, vib_delay=0.8)) / 2
    dark = lowpass(raw, min(4.0 * f, 900) * bright, 3)
    lit = lowpass(raw, min(9.0 * f, 2200) * bright, 3)
    t = np.arange(n) / SR
    swell = np.clip(t / max(attack * 3, 0.05), 0, 1) * np.exp(-t / (0.6 + dur * 60 / tr.bpm))
    sig = (dark * (1 - swell) + lit * swell) * adsr(n, attack, release, n_hold)
    tr.add(bus, tr.beat(beat), sig * amp, pan)


def pluck(tr: Track, bus: str, m: int, beat: float, amp: float, pan: float = 0.0, decay: float = 1.6):
    """Warm harp: few harmonics, upper ones die fast."""
    n = int((decay * 2.5) * SR)
    t = np.arange(n) / SR
    f = hz(m)
    sig = np.zeros(n)
    for k in range(1, 7):
        if k * f > 3000:
            break
        sig += np.sin(2 * np.pi * k * f * t) / k ** 1.6 * np.exp(-t * k / decay)
    sig *= np.clip(t / 0.006, 0, 1)
    tr.add(bus, tr.beat(beat), sig * amp, pan)


def spiccato(tr: Track, bus: str, m: int, beat: float, amp: float, length: float = 0.22, pan: float = 0.0):
    """Short low-string stroke for ostinatos."""
    n = int((length + 0.5) * SR)
    f = hz(m)
    raw = (saw_osc(f, n, -6) + saw_osc(f, n, 6)) / 2
    raw = lowpass(raw, min(6 * f, 1400), 3)
    t = np.arange(n) / SR
    env = np.clip(t / 0.012, 0, 1) * np.where(t < length, 1.0, np.exp(-(t - length) / 0.09)) * np.exp(-t / 0.5)
    tr.add(bus, tr.beat(beat), raw * env * amp, pan)


def timpani(tr: Track, bus: str, m: int, beat: float, amp: float, decay: float = 1.4):
    n = int(decay * 3 * SR)
    t = np.arange(n) / SR
    f = hz(m)
    bend = 1 + 0.04 * np.exp(-t / 0.05)
    ph = 2 * np.pi * np.cumsum(f * bend) / SR
    body = (np.sin(ph) + 0.5 * np.sin(1.5 * ph) * np.exp(-t / 0.3) + 0.3 * np.sin(1.98 * ph) * np.exp(-t / 0.2))
    body *= np.exp(-t / decay)
    thud = lowpass(RNG.standard_normal(n) * np.exp(-t / 0.03), 400, 2) * 0.6
    sig = (body + thud) * np.clip(t / 0.003, 0, 1)
    tr.add(bus, tr.beat(beat), sig * amp, RNG.uniform(-0.2, 0.2))


def taiko(tr: Track, bus: str, beat: float, amp: float, pitch: float = 58.0, pan: float = 0.0):
    n = int(1.4 * SR)
    t = np.arange(n) / SR
    f = pitch * (1 + 0.6 * np.exp(-t / 0.04))
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.35)
    skin = lowpass(highpass(RNG.standard_normal(n), 120, 2), 700, 2) * np.exp(-t / 0.05) * 0.5
    sig = (body + skin) * np.clip(t / 0.002, 0, 1)
    tr.add(bus, tr.beat(beat), sig * amp, pan)


def roll(tr: Track, bus: str, m: int, beat: float, beats: float, amp: float):
    """Timpani crescendo roll into `beat + beats`."""
    hits = int(beats * 6)
    for i in range(hits):
        k = i / max(hits - 1, 1)
        timpani(tr, bus, m, beat + i * beats / hits, amp * (0.12 + 0.55 * k ** 2), decay=0.8)


def drone(tr: Track, bus: str, m: int, amp: float):
    """Loop-length sub + fifth drone with a slow breath."""
    n = tr.n_loop
    t = np.arange(n) / SR
    cycles = max(1, round(tr.loop_s / 12))
    breath = 0.75 + 0.25 * np.sin(2 * np.pi * cycles * t / tr.loop_s)
    f = hz(m)
    # Whole cycles per loop so the drone itself is seamless.
    f1 = round(f * tr.loop_s) / tr.loop_s
    f2 = round(f * 1.5 * tr.loop_s) / tr.loop_s
    sig = (np.sin(2 * np.pi * f1 * t) + 0.3 * np.sin(2 * np.pi * f2 * t)) * breath
    tr.add(bus, 0, sig * amp)


# ---------------------------------------------------------------------------
# Mixdown
# ---------------------------------------------------------------------------

BUS_FX = {
    # name: (post-filter, dry, wet) — dry/wet also set each section's level in the mix
    "strings": (lambda x: lowpass(highpass(x, 70), 2000, 3), 0.55, 0.75),
    "hi_strings": (lambda x: lowpass(highpass(x, 180), 2600, 3), 0.8, 1.5),
    "low_strings": (lambda x: lowpass(highpass(x, 35), 1100, 3), 0.7, 0.45),
    "choir": (lambda x: lowpass(formant(highpass(x, 120), [(650, 180, 1.0), (1100, 220, 0.55), (2500, 300, 0.12)]), 3000, 3), 0.9, 2.0),
    "choir_oo": (lambda x: lowpass(formant(highpass(x, 90), [(380, 120, 1.0), (800, 180, 0.35)]), 2200, 3), 0.6, 1.3),
    "brass": (lambda x: highpass(x, 60), 0.6, 0.6),
    "harp": (lambda x: lowpass(x, 3000, 2), 0.18, 0.28),
    "perc": (lambda x: lowpass(highpass(x, 28), 2500, 2), 0.3, 0.12),
    "sub": (lambda x: lowpass(x, 160, 2), 0.6, 0.0),
}


def mixdown(tr: Track) -> np.ndarray:
    ir = hall_ir()
    total = np.zeros((tr.n_loop, 2))

    def fold(x: np.ndarray) -> np.ndarray:
        out = np.zeros((tr.n_loop, 2))
        for i in range(0, len(x), tr.n_loop):
            chunk = x[i: i + tr.n_loop]
            out[: len(chunk)] += chunk
        return out

    wet_send = np.zeros((tr.n_loop, 2))
    for name, buf in tr.buses.items():
        fx, dry, wet = BUS_FX[name]
        x = fold(fx(buf))
        total += x * dry
        wet_send += x * wet
    # Circular reverb: wrap the tail back onto the start.
    rev = np.zeros((tr.n_loop + len(ir), 2))
    for ch in range(2):
        padded = np.concatenate([wet_send[:, ch], wet_send[:, ch]])
        full = fftconvolve(padded, ir[:, ch])[: tr.n_loop * 2]
        rev[: tr.n_loop, ch] = full[tr.n_loop: tr.n_loop * 2]
    total += rev[: tr.n_loop] * 0.32

    # Master: tame the top, clean the bottom, gentle glue.
    total = highpass(total, 30, 2)
    total = spectral(total, lambda f: 1 / np.sqrt(1 + (f / 5500) ** 4))
    rms = np.sqrt(np.mean(total ** 2))
    total *= 10 ** (-19 / 20) / rms
    total = np.tanh(total * 1.3) / 1.3
    peak = np.max(np.abs(total))
    if peak > 10 ** (-2 / 20):
        total *= 10 ** (-2 / 20) / peak
    return total


# ---------------------------------------------------------------------------
# Arrangement helpers + per-region scores
# ---------------------------------------------------------------------------

def pad_chords(tr: Track, chords: list[str], beats_per: float, *, strings_amp=0.0, hi_amp=0.0,
               choir_amp=0.0, choir_bus="choir", low_amp=0.0, brass_amp=0.0, bass_oct=2,
               str_range=(52, 69), hi_range=(67, 81), choir_range=(57, 72), brass_range=(48, 62)):
    """Sustained harmony; each chord overlaps the next by its release."""
    for i, sym in enumerate(chords):
        root, q = parse_chord(sym)
        pcs = [(root + iv) % 12 for iv in q]
        b = i * beats_per
        if strings_amp:
            for m in voice(pcs, *str_range):
                strings(tr, "strings", m, b, beats_per, strings_amp)
        if hi_amp:
            for m in voice(pcs, *hi_range):
                strings(tr, "hi_strings", m, b, beats_per, hi_amp, attack=1.4)
        if choir_amp:
            for m in voice(pcs, *choir_range):
                choir(tr, choir_bus, m, b, beats_per, choir_amp)
        if low_amp:
            bass = root + 12 * (bass_oct + 1)
            strings(tr, "low_strings", bass, b, beats_per, low_amp, attack=0.6)
            strings(tr, "low_strings", bass + 12, b, beats_per, low_amp * 0.5, attack=0.6)
        if brass_amp:
            for m in voice(pcs, *brass_range):
                brass(tr, "brass", m, b, beats_per, brass_amp, bright=0.8, attack=0.5, release=1.4)


def lead(tr: Track, line: str, amp: float, kind: str = "brass", bright: float = 1.0, octave: int = 0):
    for b, d, m in parse_line(line):
        if m is None:
            continue
        m += 12 * octave
        if kind == "brass":
            brass(tr, "brass", m, b, d * 0.95, amp, bright=bright, pan=-0.15)
        elif kind == "hi_strings":
            strings(tr, "hi_strings", m, b, d, amp, attack=0.35, release=1.2)
        elif kind == "strings":
            strings(tr, "strings", m, b, d, amp, attack=0.3, release=1.0)


def ostinato(tr: Track, chords: list[str], beats_per: float, pattern: list[int], step: float, amp: float, octave=2):
    """Low spiccato 8ths/16ths on chord tones; pattern indexes (root, third, fifth, octave)."""
    for i, sym in enumerate(chords):
        root, q = parse_chord(sym)
        tones = [root + 12 * (octave + 1) + iv for iv in q[:3]] + [root + 12 * (octave + 2)]
        steps = int(beats_per / step)
        for s in range(steps):
            m = tones[pattern[s % len(pattern)]]
            accent = 1.0 if s % 4 == 0 else 0.7
            spiccato(tr, "low_strings", m, i * beats_per + s * step, amp * accent, length=step * 60 / tr.bpm * 0.6)


def arp(tr: Track, chords: list[str], beats_per: float, step: float, amp: float, lo=62, hi=81):
    for i, sym in enumerate(chords):
        root, q = parse_chord(sym)
        tones = voice([(root + iv) % 12 for iv in q], lo, lo + 11)
        tones = tones + [t + 12 for t in tones if t + 12 <= hi]
        seq = tones + tones[-2:0:-1]
        for s in range(int(beats_per / step)):
            pluck(tr, "harp", seq[s % len(seq)], i * beats_per + s * step, amp, pan=0.35 * np.sin(s * 0.9))


def score_core_chamber() -> Track:
    """Home: heroic but patient D minor — strings, horns, soft timpani."""
    bpm, per = 72, 8
    chords = ["Dm", "Bb", "F", "C", "Dm", "Gm", "Bb", "A"]
    tr = Track(len(chords) * per * 60 / bpm, bpm)
    pad_chords(tr, chords, per, strings_amp=0.12, low_amp=0.16, choir_amp=0.05, hi_amp=0.035)
    lead(tr, "D4:3 E4:1 F4:2 A4:2  D4:4 C4:2 Bb3:2  A3:4 C4:4  G3:2 C4:2 E4:4 "
             "F4:3 E4:1 D4:2 A3:2  Bb3:4 D4:4  F4:3 D4:1 Bb3:4  C#4:4 E4:2 A3:2", 0.11, bright=0.9)
    for i, sym in enumerate(chords):
        root, _ = parse_chord(sym)
        m = 36 + root if root <= 9 else 24 + root  # timpani range Bb1–A2
        timpani(tr, "perc", m, i * per, 0.35)
        timpani(tr, "perc", m, i * per + 4, 0.18)
    roll(tr, "perc", 45, 60, 4, 0.5)
    drone(tr, "sub", midi("D2"), 0.05)
    return tr


def score_signal_relay() -> Track:
    """Echoing corridor: E minor choir and harp, weightless strings."""
    bpm, per = 66, 8
    chords = ["Em", "Cmaj7", "G", "D", "Em", "Am", "C", "B"]
    tr = Track(len(chords) * per * 60 / bpm, bpm)
    pad_chords(tr, chords, per, choir_amp=0.10, choir_bus="choir_oo", strings_amp=0.07, low_amp=0.1, hi_amp=0.03)
    arp(tr, chords, per, 0.5, 0.07)
    lead(tr, "E4:4 G4:2 F#4:2  E4:4 B3:4  D4:4 G4:4  F#4:6 A4:2  G4:4 F#4:2 E4:2  C4:4 E4:4  E4:4 G4:4  F#4:4 D#4:4",
         0.06, kind="hi_strings", octave=1)
    for i in range(0, len(chords), 2):
        timpani(tr, "perc", midi("E2"), i * per, 0.18, decay=2.0)
    drone(tr, "sub", midi("E2"), 0.045)
    return tr


def score_phase_vault() -> Track:
    """Deep vault: slow F# minor, low choir and cellos, horns from far away."""
    bpm, per = 64, 8
    chords = ["F#m", "D", "Bm", "C#", "F#m", "E", "D", "C#sus4"]
    tr = Track(len(chords) * per * 60 / bpm, bpm)
    pad_chords(tr, chords, per, choir_amp=0.11, choir_bus="choir_oo", low_amp=0.17, strings_amp=0.06,
               choir_range=(50, 66), str_range=(45, 62))
    lead(tr, "F#3:6 A3:2  F#3:4 D3:4  B3:4 D4:2 C#4:2  C#4:8  A3:4 C#4:4  B3:4 G#3:4  A3:3 F#3:1 D3:4  C#3:4 F#3:4",
         0.1, bright=0.6)
    for i in range(len(chords)):
        timpani(tr, "perc", midi("F#2") if i % 2 == 0 else midi("C#2"), i * per, 0.22, decay=2.2)
    drone(tr, "sub", midi("F#1"), 0.06)
    return tr


def score_storm_spire() -> Track:
    """Storm: driving C minor, taiko, low-string ostinato, brass and full choir."""
    bpm, per = 92, 4
    chords = ["Cm", "Cm", "Ab", "Ab", "Eb", "Eb", "Bb", "Bb", "Cm", "Cm", "Ab", "Ab", "Fm", "Fm", "G", "G"]
    tr = Track(len(chords) * per * 60 / bpm, bpm)
    pad_chords(tr, chords, per, choir_amp=0.07, strings_amp=0.07, brass_amp=0.035)
    ostinato(tr, chords, per, [0, 0, 3, 0, 2, 0, 3, 2], 0.5, 0.14)
    lead(tr, "G3:3 C4:1 Eb4:4  C4:4 Ab3:4  Bb3:3 Eb4:1 G4:4  F4:4 D4:4  G4:3 F4:1 Eb4:4  Eb4:3 D4:1 C4:4  Ab3:4 C4:4  B3:4 D4:4",
         0.12, bright=1.1)
    for bar in range(len(chords)):
        b = bar * per
        taiko(tr, "perc", b, 0.55, 55, -0.2)
        taiko(tr, "perc", b + 1.5, 0.28, 72, 0.3)
        taiko(tr, "perc", b + 2, 0.4, 58, 0.1)
        taiko(tr, "perc", b + 3, 0.25, 72, -0.3)
        if bar % 4 == 3:
            taiko(tr, "perc", b + 3.5, 0.3, 64, 0.2)
    roll(tr, "perc", midi("G2"), 60, 4, 0.55)
    drone(tr, "sub", midi("C2"), 0.05)
    return tr


def score_deep_fault() -> Track:
    """The fault: heavy A minor, trombones, timpani rolls, a dark choir."""
    bpm, per = 62, 8
    chords = ["Am", "F", "Dm", "E", "Am", "C", "Dm", "E"]
    tr = Track(len(chords) * per * 60 / bpm, bpm)
    pad_chords(tr, chords, per, brass_amp=0.06, low_amp=0.2, choir_amp=0.08, bass_oct=1,
               brass_range=(43, 57), choir_range=(52, 67))
    lead(tr, "A3:4 C4:2 B3:2  A3:4 F3:4  D3:4 F3:2 A3:2  E3:4 G#3:4  A3:4 E4:4  G3:4 C4:4  F3:2 A3:2 D4:4  B3:4 G#3:4",
         0.13, bright=0.7, octave=-1)
    for i, sym in enumerate(chords):
        root, _ = parse_chord(sym)
        m = 36 + root if root <= 7 else 24 + root
        timpani(tr, "perc", m + 12, i * per, 0.5, decay=2.0)
        taiko(tr, "perc", i * per + 6, 0.25, 48)
        if i % 4 == 3:
            roll(tr, "perc", midi("E2"), i * per + 5, 3, 0.5)
    drone(tr, "sub", midi("A1"), 0.07)
    return tr


def score_drone_foundry() -> Track:
    """Foundry: mechanical G minor ostinato, horns, measured taiko."""
    bpm, per = 84, 4
    chords = ["Gm", "Gm", "Eb", "Eb", "Cm", "Cm", "D", "D", "Gm", "Gm", "Bb", "Bb", "Eb", "Eb", "D", "D"]
    tr = Track(len(chords) * per * 60 / bpm, bpm)
    pad_chords(tr, chords, per, strings_amp=0.08, choir_amp=0.05, brass_amp=0.03)
    ostinato(tr, chords, per, [0, 3, 0, 2, 0, 3, 1, 2], 0.5, 0.13)
    lead(tr, "D4:3 G4:1 Bb4:4  G4:2 F4:2 Eb4:4  Eb4:3 D4:1 C4:4  A3:4 F#3:4  D4:3 G4:1 Bb4:4  A4:2 Bb4:2 F4:4  G4:3 F4:1 Eb4:4  D4:4 F#4:4",
         0.1, bright=0.85, octave=-1)
    for bar in range(len(chords)):
        b = bar * per
        taiko(tr, "perc", b, 0.5, 52)
        taiko(tr, "perc", b + 2, 0.32, 60, 0.25)
        taiko(tr, "perc", b + 2.5, 0.18, 66, -0.25)
    drone(tr, "sub", midi("G1"), 0.05)
    return tr


def score_mine() -> Track:
    """Timed mine run: urgent E minor, taiko drive, strings and horn calls."""
    bpm, per = 100, 4
    chords = ["Em", "Em", "C", "C", "D", "D", "B", "B", "Em", "Em", "C", "C", "Am", "Am", "B", "B"]
    tr = Track(len(chords) * per * 60 / bpm, bpm)
    pad_chords(tr, chords, per, strings_amp=0.07, choir_amp=0.05, brass_amp=0.03)
    ostinato(tr, chords, per, [0, 0, 2, 0, 3, 0, 2, 1], 0.5, 0.14)
    lead(tr, "B3:3 E4:1 G4:4  E4:4 C4:4  F#4:3 A4:1 D4:4  D#4:4 F#4:4  G4:3 F#4:1 E4:4  E4:2 D4:2 C4:4  C4:3 E4:1 A3:4  B3:4 D#4:4",
         0.1, bright=1.0)
    for bar in range(len(chords)):
        b = bar * per
        taiko(tr, "perc", b, 0.5, 56)
        taiko(tr, "perc", b + 1, 0.22, 70, 0.3)
        taiko(tr, "perc", b + 2, 0.38, 58)
        taiko(tr, "perc", b + 2.5, 0.2, 70, -0.3)
        taiko(tr, "perc", b + 3, 0.26, 64, 0.2)
    drone(tr, "sub", midi("E2"), 0.045)
    return tr


SCORES = {
    "core_chamber": score_core_chamber,
    "signal_relay": score_signal_relay,
    "phase_vault": score_phase_vault,
    "storm_spire": score_storm_spire,
    "deep_fault": score_deep_fault,
    "drone_foundry": score_drone_foundry,
    "mine": score_mine,
}


def render(key: str) -> float:
    tr = SCORES[key]()
    loop = mixdown(tr)
    out = np.concatenate([loop, loop[: int(LOOP_PREROLL * SR)]])
    path = OUT / f"bgm_{key}.mp3"
    sf.write(path, out.astype(np.float32), SR, format="MP3", subtype="MPEG_LAYER_III")
    print(f"  {path.name}: loop {tr.loop_s:.4f}s  {path.stat().st_size / 1e6:.2f} MB")
    return tr.loop_s


if __name__ == "__main__":
    keys = sys.argv[1:] or list(SCORES)
    lengths = {k: round(render(k), 4) for k in keys}
    print(json.dumps(lengths, indent=2))

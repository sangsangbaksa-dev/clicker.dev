#!/usr/bin/env python3
"""Procedural BGM — one quiet, melodic RPG-style loop per region plus the timed mine.

Each track is a 16-bar tune (a repeated motif with clear cadences) on a soft flute or
harp over harp arpeggios, string pads and a cello bass — town/field/dungeon music, kept
gentle and melancholy.

Everything is kept soft-edged and hazy: felt piano, strings and an "oo" choir are
filtered low (nothing sings above ~1.7 kHz), note onsets are smeared through a short
diffuse early-reflection stage, then sent into a long dark hall. The master rolls off
from ~3 kHz and loudness sits around -24 dBFS RMS so music stays under the SFX.

Each loop is rendered circularly (note tails and reverb wrap onto the start), then
written as `loop + LOOP_PREROLL` seconds so the player can loop [PREROLL_START,
PREROLL_START + loop) without depending on the MP3 decoder's encoder-delay handling.
Loop lengths are written to src/data/clicker/bgm-loops.ts for use-clicker-bgm.ts;
LOOP_PREROLL must stay in sync with its LOOP_START window.

    pip install numpy scipy soundfile
    python3 scripts/clicker-bgm.py            # all tracks
    python3 scripts/clicker-bgm.py storm_spire
"""
from __future__ import annotations

import sys
from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import fftconvolve

SR = 44100
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "clicker" / "audio"
LOOPS_TS = ROOT / "src" / "data" / "clicker" / "bgm-loops.ts"
LOOP_PREROLL = 1.0
TAIL = 8.0
RNG = np.random.default_rng(7)

NOTE = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6,
        "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
QUALITY = {"": (0, 4, 7), "m": (0, 3, 7), "maj7": (0, 4, 7, 11), "m7": (0, 3, 7, 10), "sus4": (0, 5, 7),
           "sus2": (0, 2, 7), "madd9": (0, 3, 7, 14), "add9": (0, 4, 7, 14)}


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


def felt(tr: Track, bus: str, m: int, beat: float, amp: float, pan: float = 0.0, dur: float | None = None):
    """Felt piano: soft hammer, few harmonics, upper partials die fast. `dur` (beats) damps it."""
    f = hz(m)
    decay = float(np.clip(3.2 * (262 / f) ** 0.35, 1.6, 5.5))
    n = int(decay * 2.4 * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for ch, cents in ((0, -1.6), (1, 1.6)):
        fc = f * 2 ** (cents / 1200)
        sig = np.zeros(n)
        for k in range(1, 9):
            fk = k * fc * np.sqrt(1 + 0.0003 * k * k)
            if fk > 2400:
                break
            sig += np.sin(2 * np.pi * fk * t + RNG.uniform(0, 6.28)) / k ** 2.3 * np.exp(-t * k ** 0.8 / decay)
        out[:, ch] = sig
    thump = lowpass(RNG.standard_normal(n) * np.exp(-t / 0.03), 200, 2) * 0.05
    out += thump[:, None]
    # Slow, rounded onset: the hammer is felt through a blanket.
    out *= (np.sin(np.clip(t / 0.07, 0, 1) * np.pi / 2) ** 2)[:, None]
    if dur is not None:
        hold = tr.beat(dur)
        if hold < n:
            out[hold:] *= np.exp(-np.arange(n - hold) / (0.35 * SR))[:, None]
    left, right = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    out[:, 0] *= left * np.sqrt(2)
    out[:, 1] *= right * np.sqrt(2)
    tr.add(bus, tr.beat(beat), out * amp)


def flute(tr: Track, bus: str, m: int, beat: float, dur: float, amp: float, pan: float = -0.1):
    """Soft flute/ocarina lead: few harmonics, a breath of air, vibrato that blooms late."""
    f = hz(m)
    hold = tr.beat(dur)
    release = 0.35
    n = hold + int(release * 3 * SR)
    t = np.arange(n) / SR
    vib = 1 + 0.0045 * np.sin(2 * np.pi * 5.2 * t) * np.clip((t - 0.25) / 0.5, 0, 1)
    phase = 2 * np.pi * np.cumsum(f * vib) / SR
    sig = np.sin(phase) + 0.32 * np.sin(2 * phase) + 0.12 * np.sin(3 * phase) + 0.04 * np.sin(4 * phase)
    breath = lowpass(highpass(RNG.standard_normal(n), f * 1.5, 2), f * 3, 2) * 0.08
    env = adsr(n, 0.07, release, hold)
    # A touch more air at the start of each note, like a real attack.
    chiff = np.exp(-t / 0.06) * 0.6 + 1
    tr.add(bus, tr.beat(beat), (sig + breath * chiff) * env * amp, pan)


def harp(tr: Track, bus: str, m: int, beat: float, amp: float, pan: float = 0.0):
    """Concert-harp pluck: warm partials, upper ones fade first, a long ring."""
    f = hz(m)
    decay = float(np.clip(2.6 * (262 / f) ** 0.4, 1.0, 4.0))
    n = int(decay * 2.2 * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for k in range(1, 8):
        if k * f > 3200:
            break
        sig += np.sin(2 * np.pi * k * f * t + RNG.uniform(0, 6.28)) / k ** 1.5 * np.exp(-t * k ** 0.9 / decay)
    sig *= np.clip(t / 0.005, 0, 1)
    tr.add(bus, tr.beat(beat), sig * amp, pan)


# ---------------------------------------------------------------------------
# Mixdown
# ---------------------------------------------------------------------------

def _smear_ir() -> np.ndarray:
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    # Swells in over ~25 ms then fades, so the smear rounds attacks instead of echoing them.
    ir = RNG.standard_normal((n, 2)) * ((1 - np.exp(-t / 0.025)) * np.exp(-t / 0.075))[:, None]
    ir = lowpass(ir, 1800, 2)
    ir[0] += 0.6  # a little direct sound, mostly haze
    return ir / np.sqrt(np.sum(ir ** 2) / 2)


SMEAR_IR = _smear_ir()


def smear(x: np.ndarray) -> np.ndarray:
    """Diffuse the first ~200 ms of every note so attacks read as blurred, not struck."""
    return np.column_stack([fftconvolve(x[:, ch], SMEAR_IR[:, ch])[: len(x)] for ch in range(2)])


BUS_FX = {
    # name: (post-filter, dry, wet) — dry/wet also set each section's level in the mix
    "strings": (lambda x: smear(lowpass(highpass(x, 70), 1300, 3)), 0.5, 0.9),
    "hi_strings": (lambda x: smear(lowpass(highpass(x, 200), 1700, 3)), 0.45, 1.2),
    "low_strings": (lambda x: lowpass(highpass(x, 35), 800, 3), 0.7, 0.5),
    "choir_oo": (lambda x: smear(lowpass(formant(highpass(x, 90), [(380, 120, 1.0), (760, 170, 0.3)]), 1500, 3)), 0.45, 1.3),
    "horn": (lambda x: smear(lowpass(highpass(x, 60), 900, 2)), 0.5, 0.8),
    "piano": (lambda x: smear(lowpass(x, 1250, 2)), 0.5, 1.1),
    "lead": (lambda x: smear(lowpass(highpass(x, 150), 1500, 3)), 0.5, 1.1),
    "flute": (lambda x: lowpass(highpass(x, 180), 3000, 2), 0.95, 0.95),
    "harp": (lambda x: lowpass(highpass(x, 80), 2400, 2), 0.55, 0.9),
    "perc": (lambda x: lowpass(highpass(x, 28), 700, 2), 0.6, 0.45),
    "sub": (lambda x: lowpass(x, 120, 2), 0.5, 0.0),
}


def mixdown(tr: Track, target_rms_db: float = -24.0) -> np.ndarray:
    ir = hall_ir(seconds=6.0, decay=4.2, damp=2400.0)

    def fold(x: np.ndarray) -> np.ndarray:
        out = np.zeros((tr.n_loop, 2))
        for i in range(0, len(x), tr.n_loop):
            chunk = x[i: i + tr.n_loop]
            out[: len(chunk)] += chunk
        return out

    total = np.zeros((tr.n_loop, 2))
    wet_send = np.zeros((tr.n_loop, 2))
    for name, buf in tr.buses.items():
        fx, dry, wet = BUS_FX[name]
        x = fold(fx(buf))
        total += x * dry
        wet_send += x * wet
    # Circular reverb: wrap the tail back onto the start.
    for ch in range(2):
        padded = np.concatenate([wet_send[:, ch], wet_send[:, ch]])
        full = fftconvolve(padded, ir[:, ch])[: tr.n_loop * 2]
        total[:, ch] += full[tr.n_loop: tr.n_loop * 2] * 0.42

    # Master: dark top, clean bottom, quiet overall.
    total = highpass(total, 32, 2)
    total = lowpass(total, 3200, 2)
    total *= 10 ** (target_rms_db / 20) / np.sqrt(np.mean(total ** 2))
    total = np.tanh(total * 1.1) / 1.1
    peak = np.max(np.abs(total))
    if peak > 10 ** (-6 / 20):
        total *= 10 ** (-6 / 20) / peak
    return total


# ---------------------------------------------------------------------------
# Arrangement helpers
# ---------------------------------------------------------------------------

def total_beats(tr: Track) -> float:
    return round(tr.loop_s * tr.bpm / 60, 6)


def pad_chords(tr: Track, chords: list[str], beats_per: float, *, strings_amp=0.0, hi_amp=0.0,
               choir_amp=0.0, low_amp=0.0, horn_amp=0.0, bass_oct=2,
               str_range=(50, 67), hi_range=(64, 79), choir_range=(55, 70), horn_range=(46, 60)):
    """Sustained harmony with slow swells; each chord overlaps the next by its release."""
    for i, sym in enumerate(chords):
        root, q = parse_chord(sym)
        pcs = [(root + iv) % 12 for iv in q]
        b = i * beats_per
        if strings_amp:
            for m in voice(pcs, *str_range):
                strings(tr, "strings", m, b, beats_per, strings_amp, attack=1.6, release=2.4)
        if hi_amp:
            for m in voice(pcs, *hi_range):
                strings(tr, "hi_strings", m, b, beats_per, hi_amp, attack=2.2, release=2.8)
        if choir_amp:
            for m in voice(pcs, *choir_range):
                choir(tr, "choir_oo", m, b, beats_per, choir_amp, attack=2.0, release=3.0)
        if low_amp:
            bass = root + 12 * (bass_oct + 1)
            strings(tr, "low_strings", bass, b, beats_per, low_amp, attack=1.0, release=2.2)
            strings(tr, "low_strings", bass + 12, b, beats_per, low_amp * 0.4, attack=1.2, release=2.2)
        if horn_amp:
            for m in voice(pcs, *horn_range):
                brass(tr, "horn", m, b, beats_per, horn_amp, bright=0.4, attack=1.2, release=2.4)


def lead(tr: Track, line: str, amp: float, kind: str = "piano", octave: int = 0):
    notes = parse_line(line)
    beats = sum(d for _, d, _ in notes)
    assert abs(beats - total_beats(tr)) < 1e-6, f"melody is {beats} beats, loop is {total_beats(tr)}"
    for b, d, m in notes:
        if m is None:
            continue
        m += 12 * octave
        if kind == "piano":
            felt(tr, "piano", m, b, amp, pan=0.1, dur=d + 0.5)
        elif kind == "lead":
            strings(tr, "lead", m, b, d, amp, attack=0.8, release=2.2)
        elif kind == "horn":
            brass(tr, "horn", m, b, d * 0.95, amp, bright=0.45, attack=0.7, release=2.0, pan=-0.15)
        elif kind == "flute":
            flute(tr, "flute", m, b, d * 0.96, amp)
        elif kind == "harp":
            harp(tr, "harp", m, b, amp, pan=0.15)


def broken(tr: Track, chords: list[str], beats_per: float, step: float, amp: float, lo: int,
           order: tuple[int, ...] = (0, 1, 2, 3, 2, 1)):
    """Slow broken chords on felt piano, voiced from `lo` upward."""
    for i, sym in enumerate(chords):
        root, q = parse_chord(sym)
        tones = voice([(root + iv) % 12 for iv in q[:3]], lo, lo + 11)
        tones = tones + [tones[0] + 12]
        for s in range(int(beats_per / step)):
            m = tones[order[s % len(order)] % len(tones)]
            accent = 1.0 if s == 0 else 0.75
            felt(tr, "piano", m, i * beats_per + s * step, amp * accent, pan=-0.25 + 0.5 * (s % 2))


def harp_arp(tr: Track, chords: list[str], beats_per: float, step: float, amp: float, lo: int,
             order: tuple[int, ...] = (0, 1, 2, 3, 2, 1, 2, 1)):
    """Rolling harp arpeggio under the tune (root position, voiced from `lo`)."""
    for i, sym in enumerate(chords):
        root, q = parse_chord(sym)
        tones = voice([(root + iv) % 12 for iv in q[:3]], lo, lo + 11)
        tones = tones + [tones[0] + 12]
        for s_ in range(int(beats_per / step)):
            m = tones[order[s_ % len(order)] % len(tones)]
            accent = 1.0 if s_ == 0 else 0.7
            harp(tr, "harp", m, i * beats_per + s_ * step, amp * accent, pan=-0.3 + 0.6 * ((s_ * 0.37) % 1))


def low_pulse(tr: Track, chords: list[str], beats_per: float, step: float, amp: float, octave: int = 2):
    """Quiet felt-piano root/fifth heartbeat in the bass."""
    for i, sym in enumerate(chords):
        root, q = parse_chord(sym)
        base = root + 12 * (octave + 1)
        for s in range(int(beats_per / step)):
            m = base if s % 2 == 0 else base + q[2]
            felt(tr, "piano", m, i * beats_per + s * step, amp * (1.0 if s % 4 == 0 else 0.7), dur=step * 1.5)


def bass_notes(tr: Track, chords: list[str], beats_per: float, amp: float, octave: int = 2):
    for i, sym in enumerate(chords):
        root, _ = parse_chord(sym)
        felt(tr, "piano", root + 12 * (octave + 1), i * beats_per, amp)


def new_track(chords: list[str], per: float, bpm: float) -> Track:
    return Track(len(chords) * per * 60 / bpm, bpm)


# ---------------------------------------------------------------------------
# Scores — slow, minor, sparse. "per" = beats per chord.
# ---------------------------------------------------------------------------

def score_core_chamber() -> Track:
    """Home: a hopeful-but-wistful D minor village theme on flute over harp."""
    chords = ["Dm", "Bb", "F", "C", "Dm", "Bb", "Gm", "A", "Bb", "C", "F", "Dm", "Gm", "A", "Dm", "A"]
    tr = new_track(chords, 4, 76)
    pad_chords(tr, chords, 4, strings_amp=0.07, low_amp=0.11, choir_amp=0.025)
    harp_arp(tr, chords, 4, 0.5, 0.05, lo=50)
    lead(tr, "A4:1.5 G4:0.5 F4:1 E4:1  D4:3 F4:1  C5:1.5 A4:0.5 F4:1 A4:1  G4:4 "
             "A4:1.5 G4:0.5 F4:1 E4:1  D4:2 F4:1 Bb4:1  Bb4:1.5 A4:0.5 G4:1 F4:1  E4:4 "
             "F4:1 G4:1 A4:1 Bb4:1  C5:3 Bb4:1  A4:3 C5:1  D5:4 "
             "D5:1.5 C5:0.5 Bb4:1 A4:1  C#5:3 A4:1  A4:1.5 F4:0.5 D4:2  E4:3 r:1", 0.075, kind="flute")
    drone(tr, "sub", midi("D2"), 0.03)
    return tr


def score_signal_relay() -> Track:
    """Echoing corridor: a floating E minor air, choir and harp shimmering around it."""
    chords = ["Em", "C", "G", "D", "Em", "C", "Am", "B", "C", "D", "Bm", "Em", "Am", "D", "Bsus4", "B"]
    tr = new_track(chords, 4, 70)
    pad_chords(tr, chords, 4, choir_amp=0.06, hi_amp=0.018, low_amp=0.08)
    harp_arp(tr, chords, 4, 0.5, 0.045, lo=59, order=(0, 1, 2, 3, 2, 3, 2, 1))
    lead(tr, "E4:1 G4:1 B4:2  C5:3 B4:1  D5:2 B4:2  A4:4 "
             "E4:1 G4:1 B4:2  C5:2 E5:2  D5:1 C5:1 A4:2  B4:4 "
             "E5:2 D5:1 C5:1  D5:2 A4:2  B4:2 F#4:2  G4:4 "
             "A4:1 B4:1 C5:2  D5:1 C5:1 A4:2  B4:4  F#4:2 D#4:2", 0.07, kind="flute")
    drone(tr, "sub", midi("E2"), 0.025)
    return tr


def score_phase_vault() -> Track:
    """Deep vault: a solemn, ancient F# minor chant on flute over low choir and cellos."""
    chords = ["F#m", "D", "E", "C#m", "F#m", "Bm", "C#sus4", "C#", "D", "E", "C#m", "F#m", "Bm", "E", "C#sus4", "C#"]
    tr = new_track(chords, 4, 62)
    pad_chords(tr, chords, 4, choir_amp=0.08, low_amp=0.12, strings_amp=0.04, horn_amp=0.018,
               choir_range=(50, 65), str_range=(45, 62))
    harp_arp(tr, chords, 4, 1, 0.05, lo=54, order=(0, 1, 2, 1))
    lead(tr, "C#5:2 A4:1 F#4:1  A4:3 F#4:1  G#4:2 B4:2  G#4:4 "
             "C#5:2 A4:1 F#4:1  D5:2 C#5:1 B4:1  F#4:4  F4:4 "
             "F#4:1 A4:1 D5:2  E5:2 B4:2  C#5:2 G#4:2  A4:4 "
             "B4:1.5 C#5:0.5 D5:2  E5:1 D5:1 B4:2  F#4:2 G#4:2  G#4:2 F4:2", 0.065, kind="flute")
    drone(tr, "sub", midi("F#1"), 0.04)
    return tr


def score_storm_spire() -> Track:
    """After the storm: a brave, bittersweet C minor march on flute, low heartbeat under it."""
    chords = ["Cm", "Ab", "Eb", "Bb", "Cm", "Ab", "Fm", "G", "Ab", "Bb", "Gm", "Cm", "Fm", "G", "Cm", "G"]
    tr = new_track(chords, 4, 80)
    pad_chords(tr, chords, 4, strings_amp=0.07, choir_amp=0.04, low_amp=0.1)
    low_pulse(tr, chords, 4, 0.5, 0.025)
    harp_arp(tr, chords, 4, 1, 0.035, lo=55, order=(0, 2, 1, 2))
    lead(tr, "C5:1.5 Bb4:0.5 G4:1 Eb4:1  Ab4:3 C5:1  Bb4:1.5 G4:0.5 Eb4:2  D5:2 Bb4:2 "
             "C5:1.5 Bb4:0.5 G4:1 Eb4:1  Ab4:2 C5:2  Ab4:1 G4:1 F4:2  D5:2 B4:2 "
             "C5:2 Eb5:2  D5:2 F5:1 D5:1  D5:1 C5:1 Bb4:2  C5:4 "
             "C5:2 Ab4:2  B4:2 D5:2  Eb5:1.5 D5:0.5 C5:2  B4:2 G4:2", 0.07, kind="flute")
    for bar in range(0, len(chords), 4):
        timpani(tr, "perc", midi("C2"), bar * 4, 0.1, decay=1.8)
    drone(tr, "sub", midi("C2"), 0.03)
    return tr


def score_deep_fault() -> Track:
    """The fault: a slow A minor lament sung by cellos, flute answering an octave up."""
    chords = ["Am", "F", "Dm", "E", "Am", "F", "G", "E", "F", "G", "Em", "Am", "Dm", "E", "Am", "E"]
    tr = new_track(chords, 4, 58)
    pad_chords(tr, chords, 4, low_amp=0.1, choir_amp=0.06, horn_amp=0.02, bass_oct=1, choir_range=(50, 65))
    harp_arp(tr, chords, 4, 1, 0.04, lo=52, order=(0, 1, 2, 1))
    tune = ("E4:2 A4:2  C5:3 A4:1  F4:2 D4:2  E4:3 G#4:1 "
            "A4:2 C5:1 B4:1  A4:2 F4:2  G4:1 B4:1 D5:2  B4:4 "
            "C5:2 A4:2  B4:2 D5:2  E5:2 B4:2  A4:4 "
            "F4:1 A4:1 D5:2  E5:1 D5:1 B4:2  C5:1 B4:1 A4:2  G#4:2 E4:2")
    lead(tr, tune, 0.06, kind="lead", octave=-1)
    lead(tr, tune, 0.03, kind="flute")
    for i in range(0, len(chords), 4):
        timpani(tr, "perc", midi("A1"), i * 4, 0.12, decay=2.4)
    drone(tr, "sub", midi("A1"), 0.045)
    return tr


def score_drone_foundry() -> Track:
    """Abandoned foundry: a lonely G minor music-box tune on harp, flute shadowing an octave below."""
    chords = ["Gm", "Eb", "Bb", "F", "Gm", "Eb", "Cm", "D", "Eb", "F", "Dm", "Gm", "Cm", "D", "Gm", "D"]
    tr = new_track(chords, 4, 72)
    pad_chords(tr, chords, 4, strings_amp=0.06, low_amp=0.1, choir_amp=0.02)
    bass_notes(tr, chords, 4, 0.04, octave=2)
    tune = ("D5:1 Bb4:1 G4:1 Bb4:1  G4:1 Bb4:1 Eb5:2  D5:1 C5:1 Bb4:2  A4:2 C5:2 "
            "D5:1 Bb4:1 G4:1 Bb4:1  G4:1 Bb4:1 Eb5:1 D5:1  C5:2 Eb5:2  D5:2 F#4:2 "
            "G4:1 Bb4:1 Eb5:2  F5:2 C5:2  D5:1 F5:1 A4:2  Bb4:4 "
            "Eb5:1 D5:1 C5:2  A4:1 C5:1 F#4:2  G4:2 Bb4:1 D5:1  F#4:2 A4:2")
    lead(tr, tune, 0.09, kind="harp")
    lead(tr, tune, 0.03, kind="flute", octave=-1)
    drone(tr, "sub", midi("G1"), 0.03)
    return tr


def score_mine() -> Track:
    """Timed mine run: an adventurous E minor dungeon theme — still soft, with a pulse."""
    chords = ["Em", "C", "D", "Bm", "Em", "C", "Am", "B", "C", "D", "Em", "Em", "Am", "B", "Em", "B"]
    tr = new_track(chords, 4, 92)
    pad_chords(tr, chords, 4, strings_amp=0.06, choir_amp=0.03, low_amp=0.08)
    low_pulse(tr, chords, 4, 0.5, 0.035)
    harp_arp(tr, chords, 4, 0.5, 0.035, lo=55)
    lead(tr, "E4:0.5 G4:0.5 B4:1 E5:1 B4:1  C5:1.5 B4:0.5 G4:2  A4:1 F#4:1 D5:2  B4:3 r:1 "
             "E4:0.5 G4:0.5 B4:1 E5:1 B4:1  E5:1.5 D5:0.5 C5:2  C5:1 B4:1 A4:2  F#4:4 "
             "G4:1 C5:1 E5:2  D5:1 A4:1 F#4:2  G4:1 B4:1 E5:2  E5:2 D5:1 B4:1 "
             "C5:1.5 B4:0.5 A4:2  D#5:2 B4:2  E5:1.5 B4:0.5 G4:1 E4:1  F#4:2 D#4:2", 0.065, kind="flute")
    for bar in range(0, len(chords), 2):
        timpani(tr, "perc", midi("E2"), bar * 4, 0.09, decay=1.4)
    drone(tr, "sub", midi("E2"), 0.025)
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
    global RNG
    RNG = np.random.default_rng(sum(map(ord, key)))  # same key → same file, whatever the order
    tr = SCORES[key]()
    loop = mixdown(tr)
    out = np.concatenate([loop, loop[: int(LOOP_PREROLL * SR)]])
    path = OUT / f"bgm_{key}.mp3"
    sf.write(path, out.astype(np.float32), SR, format="MP3", subtype="MPEG_LAYER_III")
    print(f"  {path.name}: loop {tr.loop_s:.4f}s  {path.stat().st_size / 1e6:.2f} MB")
    # Exact sample count, not the nominal length: a loop point even 2 samples off is audible as a tick.
    return tr.n_loop / SR


def write_loops(lengths: dict[str, float]) -> None:
    """Merge into the generated TS table so partial renders keep the other tracks."""
    known: dict[str, float] = {}
    if LOOPS_TS.exists():
        for line in LOOPS_TS.read_text().splitlines():
            parts = line.strip().rstrip(",").split(":")
            if len(parts) == 2 and parts[0].strip() in SCORES:
                known[parts[0].strip()] = float(parts[1])
    known.update(lengths)
    body = "".join(f"  {k}: {known[k]!r},\n" for k in SCORES if k in known)
    LOOPS_TS.write_text(
        "// Generated by scripts/clicker-bgm.py — re-run it instead of editing by hand.\n"
        "/** Seconds of seamless loop in each bgm_<key>.mp3 (the file carries 1s of pre-roll on top). */\n"
        f"export const BGM_LOOP_SECONDS = {{\n{body}}} as const\n"
    )


if __name__ == "__main__":
    keys = sys.argv[1:] or list(SCORES)
    with ProcessPoolExecutor() as pool:
        lengths = dict(zip(keys, pool.map(render, keys)))
    write_loops(lengths)

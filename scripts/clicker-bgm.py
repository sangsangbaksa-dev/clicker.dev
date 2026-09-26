#!/usr/bin/env python3
"""Render the clicker BGM loops (hub / mine / chamber) as seamless MP3 files (plays on iOS Safari too).

Each track is composed on a bar grid so the loop point lands on a downbeat, and the
reverb tail is folded back onto the start so the seam is inaudible. Every track has
a clear lead melody on top (felt piano / strings / horn) over pads, bass and drums.

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


def felt_piano(f: float, dur: float) -> np.ndarray:
    """Muted felt piano: soft hammer, dark body, long fade — the hub motif voice."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * f * k * (1 + 0.0004 * k * k) * t) * np.exp(-t * (0.9 + k * 0.7)) / k**1.4
            for k in range(1, 7))
    return lowpass(x, 1300) * env(n, 0.008, 0.6)


def drone(freqs: list[float], dur: float) -> np.ndarray:
    """Low, slowly breathing saw drone — the hub's constant floor."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for f in freqs:
        for det in (-0.003, 0.003):
            x += np.sin(2 * np.pi * f * (1 + det) * t) + 0.3 * saw(f * (1 + det), t + RNG.random())
    breathe = 0.8 + 0.2 * np.sin(2 * np.pi * t / (dur / 2))
    return lowpass(x / (len(freqs) * 2), 260) * breathe * env(n, 2.0, 2.0)


def shimmer(f: float, dur: float = 4.0) -> np.ndarray:
    """Faint detuned crystal ring, like the core resonating far away."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + np.sin(2 * np.pi * f * 1.003 * t) + 0.3 * np.sin(2 * np.pi * f * 2.76 * t)
    return x * np.exp(-t * 1.1) * env(n, 0.3, 0.8) / 2.3


def quiet(out: np.ndarray, rms_db: float = -22) -> np.ndarray:
    """Scale a mix down to a low RMS so it sits well under the SFX."""
    rms = np.sqrt(np.mean(out**2))
    return out * min(1.0, 10 ** (rms_db / 20) / rms)


def notes(spec: str) -> list[float]:
    return [hz(n) for n in spec.split()]


def hub() -> np.ndarray:
    """D minor, 66 BPM, 16 bars — dark, quiet ambience: a low D pedal drone, slow pads,
    a sparse felt-piano motif, a distant heartbeat pulse and faint crystal rings."""
    tr = Track(66, 16)
    # Two-bar chords; the D pedal stays under all of them (dissonant against E♭).
    prog = [
        ("D1", "D3 F3 A3"), ("A#0", "A#2 D3 F3"), ("G1", "G2 A#2 D3"), ("A1", "A2 C#3 E3"),
        ("D1", "D3 F3 A3"), ("D#1", "D#3 G3 A#3"), ("A#0", "A#2 D3 F3"), ("A1", "A2 C#3 E3"),
    ]
    tr.add(-0.0, drone(notes("D2 A2"), 32 * tr.beat + 2), 0.28)
    tr.add(32, drone(notes("D2 A2"), 32 * tr.beat + 2), 0.28)
    for i, (root, voicing) in enumerate(prog):
        b = i * 8
        tr.add(b, pad(notes(voicing), 8 * tr.beat + 1.5, 650, 1.8), 0.2)
        tr.add(b, bass(hz(root) * 2, 7.6 * tr.beat), 0.14)
        if i >= 4:  # second half: low choir swells in
            tr.add(b, choir(notes(voicing), 8 * tr.beat + 1.5), 0.07)
    # Distant heartbeat in the second half.
    for bar in range(8, 16):
        tr.add(bar * 4, lowpass(kick(0.5), 180), 0.16)
        tr.add(bar * 4 + 0.45, lowpass(kick(0.4), 180), 0.08)
    motif = [
        ("D5", 0, 2), ("A4", 2, 2), ("F4", 4, 1), ("E4", 5, 3),
        ("D4", 8, 2), ("F4", 10, 3), ("A4", 13, 3),
        ("G4", 16, 2), ("A#4", 18, 2), ("A4", 21, 3),
        ("C#5", 24, 2), ("E5", 26, 2), ("D5", 30, 2),
        ("D5", 32, 1.5), ("F5", 33.5, .5), ("E5", 34, 2), ("A4", 36, 4),
        ("G4", 40, 2), ("A#4", 42, 2), ("D5", 44, 1), ("D#5", 45, 3),
        ("D5", 48, 2), ("F4", 50, 2), ("G4", 52, 2), ("A#4", 54, 2),
        ("A4", 56, 2), ("C#5", 58, 2), ("E4", 60, 1), ("A4", 61, 3),
    ]
    for note, beat, length in motif:
        tr.add(beat, felt_piano(hz(note), length * tr.beat + 1.8), 0.13, 0.1)
        tr.add(beat, felt_piano(hz(note) / 2, length * tr.beat + 1.8), 0.05, -0.2)
    for beat, note in ((14, "A6"), (30, "D7"), (46, "A#6"), (62, "E6")):
        tr.add(beat, shimmer(hz(note)), 0.025, 0.6 if beat % 32 else -0.6)
    return quiet(tr.render(reverb=0.55, room=3.6))


def strings(f: float, dur: float) -> np.ndarray:
    """Slow-bowed string ensemble: detuned saws, gentle vibrato, dark and soft."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for det in (-0.005, -0.0015, 0.0015, 0.005):
        vib = 1 + 0.0035 * np.sin(2 * np.pi * (4.6 + det * 60) * t + RNG.random() * 6)
        phase = np.cumsum(f * (1 + det) * vib) / SR
        x += 2 * (phase % 1) - 1
    return lowpass(lowpass(x / 4, 1500), 1500) * env(n, 0.9, 1.2)


def mine() -> np.ndarray:
    """A minor, 58 BPM, 16 bars — mournful and quiet: a slow string lament over a low
    A drone and cello roots, with a felt piano pushed almost out of hearing."""
    tr = Track(58, 16)
    # Two-bar chords: (cello root, pad voicing, piano arpeggio)
    prog = [
        ("A1", "A3 C4 E4", "A4 C5 E5"), ("F1", "A3 C4 F4", "A4 C5 F5"),
        ("D2", "A3 D4 F4", "A4 D5 F5"), ("E2", "G#3 B3 E4", "G#4 B4 E5"),
        ("A1", "A3 C4 E4", "A4 C5 E5"), ("G1", "G3 C4 E4", "G4 C5 E5"),
        ("F1", "A3 C4 F4", "A4 C5 F5"), ("E2", "G#3 B3 E4", "G#4 B4 E5"),
    ]
    tr.add(0, drone(notes("A1 E2"), 32 * tr.beat + 2), 0.22)
    tr.add(32, drone(notes("A1 E2"), 32 * tr.beat + 2), 0.22)
    for i, (root, voicing, arp) in enumerate(prog):
        b = i * 8
        tr.add(b, strings(hz(root) * 2, 8 * tr.beat + 1.2), 0.1, -0.3)  # cello
        tr.add(b, pad(notes(voicing), 8 * tr.beat + 1.5, 600, 2.2), 0.14, 0.1)
        tr.add(b, choir(notes(voicing), 8 * tr.beat + 1.5), 0.05)
        # Piano: barely there — a few low-passed arpeggio notes under everything.
        for k, f in enumerate(notes(arp) * 2):
            tr.add(b + k * 1.25, lowpass(felt_piano(f, 3.0), 800), 0.025, 0.4 if k % 2 else -0.4)
    lament = [
        ("E5", 0, 4), ("C5", 4, 2), ("B4", 6, 2),
        ("A4", 8, 6), ("G4", 14, 2),
        ("F4", 16, 4), ("A4", 20, 2), ("D5", 22, 2),
        ("B4", 24, 4), ("G#4", 28, 4),
        ("C5", 32, 4), ("E5", 36, 2), ("D5", 38, 2),
        ("E5", 40, 3), ("D5", 43, 1), ("C5", 44, 4),
        ("A4", 48, 4), ("C5", 52, 2), ("B4", 54, 2),
        ("G#4", 56, 4), ("B4", 60, 4),
    ]
    for note, beat, length in lament:
        tr.add(beat, strings(hz(note), length * tr.beat + 0.8), 0.11, 0.15)
        tr.add(beat, strings(hz(note) / 2, length * tr.beat + 0.8), 0.05, -0.15)
    return quiet(tr.render(reverb=0.6, room=4.0))


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
    tracks = {"hub": ("bgm_hub_v5", hub), "mine": ("bgm_mine_v3", mine), "chamber": ("bgm_chamber_v2", chamber)}
    for key in sys.argv[1:] or tracks:
        name, fn = tracks[key]
        audio = fn()
        sf.write(OUT / f"{name}.mp3", audio, SR, format="MP3", subtype="MPEG_LAYER_III")
        print(f"{name}.mp3  {len(audio) / SR:.1f}s")


if __name__ == "__main__":
    main()

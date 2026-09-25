#!/usr/bin/env python3
"""SFX pack v3 — events the v2 pack does not cover (skill cast, achievement,
crisis alert/resolve, region travel, Adaptive Architect stamp, hunt kill, vault lock).

Same conventions as generate_audio.py: mono 44.1 kHz 16-bit, peak -3 dBFS,
dark sci-fi timbre. Writes WAVs next to this script; `--publish` also encodes
every wired SFX to MP3 under public/clicker/audio/ (needs imageio-ffmpeg).
"""
from __future__ import annotations

import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
PUBLIC = HERE.parent.parent / "public" / "clicker" / "audio"
SR = 44100
PEAK_DBFS = -3.0
RNG = np.random.default_rng(7)


def t_axis(dur: float) -> np.ndarray:
    return np.arange(int(dur * SR)) / SR


def env(dur: float, attack: float, decay: float) -> np.ndarray:
    """Linear attack, exponential tail that reaches ~-60 dB at `dur`."""
    t = t_axis(dur)
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-t * (6.9 / max(decay, 1e-4)))


def sweep(f0: float, f1: float, dur: float, shape: str = "sine") -> np.ndarray:
    t = t_axis(dur)
    k = np.log(f1 / f0) / dur
    phase = 2 * np.pi * f0 * (np.exp(k * t) - 1) / k
    if shape == "saw":
        return 2 * ((phase / (2 * np.pi)) % 1) - 1
    if shape == "tri":
        return 2 * np.abs(2 * ((phase / (2 * np.pi)) % 1) - 1) - 1
    return np.sin(phase)


def tone(freq: float, dur: float) -> np.ndarray:
    return np.sin(2 * np.pi * freq * t_axis(dur))


def bandnoise(dur: float, lo: float, hi: float) -> np.ndarray:
    n = int(dur * SR)
    spec = np.fft.rfft(RNG.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    spec[(f < lo) | (f > hi)] = 0
    x = np.fft.irfft(spec, n)
    return x / (np.max(np.abs(x)) + 1e-12)


def place(out: np.ndarray, x: np.ndarray, at: float, gain: float = 1.0) -> None:
    i = int(at * SR)
    j = min(len(out), i + len(x))
    out[i:j] += x[: j - i] * gain


def echo(x: np.ndarray, delay: float, fb: float, taps: int = 4) -> np.ndarray:
    d = int(delay * SR)
    y = np.concatenate([x, np.zeros(d * taps)])
    for k in range(1, taps + 1):
        y[k * d : k * d + len(x)] += x * (fb**k)
    return y


def write(name: str, x: np.ndarray) -> None:
    x = x / (np.max(np.abs(x)) + 1e-12) * 10 ** (PEAK_DBFS / 20)
    fo = min(len(x), int(0.01 * SR))
    x[-fo:] *= np.linspace(1, 0, fo)
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(HERE / f"{name}.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def skill_activate() -> np.ndarray:
    """Charge-up zip into a bright cyan burst (~0.45s)."""
    out = np.zeros(int(0.45 * SR))
    place(out, sweep(260, 1900, 0.16, "saw") * env(0.16, 0.12, 0.3) * 0.35, 0)
    burst = (tone(1320, 0.3) + 0.6 * tone(1980, 0.3) + 0.3 * tone(2640, 0.3)) * env(0.3, 0.003, 0.28)
    place(out, burst * 0.5, 0.14)
    place(out, bandnoise(0.25, 2500, 9000) * env(0.25, 0.002, 0.18) * 0.35, 0.14)
    return out


def achievement() -> np.ndarray:
    """Rising three-note glass arpeggio with a soft tail (~1.1s)."""
    notes = [784.0, 988.0, 1318.5]  # G5 B5 E6
    out = np.zeros(int(0.9 * SR))
    for i, f in enumerate(notes):
        n = (tone(f, 0.6) + 0.35 * tone(f * 2, 0.6) + 0.12 * tone(f * 3.01, 0.6)) * env(0.6, 0.004, 0.55)
        place(out, n, i * 0.085, 0.55 if i < 2 else 0.8)
    place(out, bandnoise(0.5, 5000, 12000) * env(0.5, 0.05, 0.45) * 0.08, 0.17)
    return echo(out, 0.11, 0.3, 2)


def crisis_alert() -> np.ndarray:
    """Two low dissonant pulses under a detuned siren sweep (~0.9s)."""
    out = np.zeros(int(0.9 * SR))
    for i in range(2):
        p = (tone(110, 0.3) + tone(116.5, 0.3) + 0.5 * sweep(220, 180, 0.3, "saw")) * env(0.3, 0.01, 0.28)
        place(out, p * 0.6, i * 0.34)
    siren = sweep(520, 760, 0.8, "tri") * np.minimum(1, t_axis(0.8) / 0.1) * np.exp(-t_axis(0.8) * 2.2)
    place(out, siren * 0.18, 0.02)
    return out


def crisis_resolve() -> np.ndarray:
    """Pressure-release hiss settling into a stable fifth (~0.8s)."""
    out = np.zeros(int(0.8 * SR))
    place(out, bandnoise(0.35, 800, 5000) * env(0.35, 0.005, 0.3) * 0.4, 0)
    chord = (tone(330, 0.65) + 0.8 * tone(495, 0.65) + 0.25 * tone(660, 0.65)) * env(0.65, 0.03, 0.6)
    place(out, sweep(700, 330, 0.12) * env(0.12, 0.003, 0.12) * 0.3, 0.05)
    place(out, chord * 0.45, 0.1)
    return out


def region_travel() -> np.ndarray:
    """Airy doppler whoosh with a low tech thump on arrival (~0.75s)."""
    dur = 0.75
    t = t_axis(dur)
    center = 0.32
    swell = np.exp(-((t - center) ** 2) / (2 * 0.1**2))
    out = bandnoise(dur, 300, 3500) * swell * 0.5
    out += sweep(180, 620, dur, "sine") * swell * 0.25
    thump = sweep(140, 45, 0.25) * env(0.25, 0.002, 0.22)
    place(out, thump * 0.6, 0.42)
    return out


def stamp_adaptive_architect() -> np.ndarray:
    """Worldline stamp in the v2 family: heavy press + balanced emerald chord (~1.0s)."""
    out = np.zeros(int(1.0 * SR))
    place(out, (sweep(160, 50, 0.2) + 0.5 * bandnoise(0.2, 60, 400)) * env(0.2, 0.002, 0.18) * 0.7, 0)
    root = 466.16  # A#4 — matches STAMP_ROOT.adaptive_architect in clicker-sfx.ts
    chord = sum(g * tone(root * r, 0.85) for r, g in ((1, 1), (1.25, 0.6), (1.5, 0.7), (2, 0.3)))
    place(out, chord * env(0.85, 0.01, 0.8) * 0.35, 0.03)
    return out


def monster_kill() -> np.ndarray:
    """Digital burst: bit-crushed crackle, falling zap, coin-like ping (~0.55s)."""
    out = np.zeros(int(0.55 * SR))
    crackle = bandnoise(0.18, 1500, 8000)
    crackle = np.round(crackle * 6) / 6  # crushed
    place(out, crackle * env(0.18, 0.001, 0.16) * 0.45, 0)
    place(out, sweep(1600, 120, 0.22, "saw") * env(0.22, 0.002, 0.2) * 0.3, 0)
    ping = (tone(1760, 0.3) + 0.4 * tone(2637, 0.3)) * env(0.3, 0.002, 0.28)
    place(out, ping * 0.4, 0.12)
    return out


def vault_lock() -> np.ndarray:
    """Mechanical tumbler click + short resonant chime (~0.4s)."""
    out = np.zeros(int(0.4 * SR))
    click = bandnoise(0.03, 2000, 9000) * env(0.03, 0.0005, 0.03)
    place(out, click * 0.8, 0)
    place(out, sweep(300, 90, 0.08) * env(0.08, 0.001, 0.07) * 0.6, 0.004)
    chime = (tone(988, 0.35) + 0.5 * tone(1482, 0.35)) * env(0.35, 0.003, 0.33)
    place(out, chime * 0.35, 0.02)
    return out


NEW = {
    "sfx_skill_activate": skill_activate,
    "sfx_achievement": achievement,
    "sfx_crisis_alert": crisis_alert,
    "sfx_crisis_resolve": crisis_resolve,
    "sfx_region_travel": region_travel,
    "sfx_rebirth_stamp_adaptive_architect": stamp_adaptive_architect,
    "sfx_monster_kill": monster_kill,
    "sfx_vault_lock": vault_lock,
}

# Pack SFX wired into the game (src/components/clicker/clicker-sfx.ts `SFX_FILES`).
PUBLISHED = [
    "sfx_ui_purchase",
    "sfx_ui_deny",
    "sfx_producer_buy",
    "sfx_upgrade_level",
    "sfx_skill_unlock",
    "sfx_potion_fever",
    "sfx_yield_big",
    "sfx_exit_mine",
    "sfx_session_timer_warn",
    "sfx_transcend_open",
    "sfx_rebirth_confirm_click",
    "sfx_rebirth_collapse_whoosh",
    "sfx_rebirth_void_tear",
    "sfx_rebirth_stamp_directive_pulse",
    "sfx_rebirth_stamp_aurelia_grid",
    "sfx_rebirth_stamp_resonance_protocol",
    "sfx_rebirth_stamp_volatile_core",
    "sfx_rebirth_rebuild_rise",
    "sfx_rebirth_settle_chime",
    *NEW,
]


def publish() -> None:
    import imageio_ffmpeg

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for name in PUBLISHED:
        subprocess.run(
            [ffmpeg, "-y", "-loglevel", "error", "-i", str(HERE / f"{name}.wav"),
             "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "96k", str(PUBLIC / f"{name}.mp3")],
            check=True,
        )


if __name__ == "__main__":
    for name, make in NEW.items():
        write(name, make())
    if "--publish" in sys.argv:
        publish()

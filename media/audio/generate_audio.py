#!/usr/bin/env python3
"""Procedural game audio pack for hsms-md clicker — dark sci-fi mine."""
from __future__ import annotations

import math
import os
import struct
import wave
from pathlib import Path

import numpy as np

OUT = Path("/workspace/clicker-artifacts/audio")
SR = 44100
PEAK_DBFS = -3.0
RNG = np.random.default_rng(42)


def db_to_lin(db: float) -> float:
    return 10.0 ** (db / 20.0)


def normalize(x: np.ndarray, peak_db: float = PEAK_DBFS) -> np.ndarray:
    x = np.asarray(x, dtype=np.float64)
    peak = np.max(np.abs(x))
    if peak < 1e-12:
        return x.astype(np.float64)
    return x * (db_to_lin(peak_db) / peak)


def fade(x: np.ndarray, fade_in: float = 0.0, fade_out: float = 0.0) -> np.ndarray:
    n = len(x)
    y = x.copy()
    if fade_in > 0:
        fi = min(n, int(fade_in * SR))
        if fi > 0:
            y[:fi] *= np.linspace(0, 1, fi, endpoint=False)
    if fade_out > 0:
        fo = min(n, int(fade_out * SR))
        if fo > 0:
            y[-fo:] *= np.linspace(1, 0, fo, endpoint=True)
    return y


def write_wav(path: Path, x: np.ndarray, stereo: bool = False, peak_db: float | None = None) -> None:
    peak = PEAK_DBFS if peak_db is None else peak_db
    x = normalize(x, peak)
    x = np.clip(x, -1.0, 1.0)
    pcm = (x * 32767.0).astype(np.int16)
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2 if stereo else 1)
        w.setsampwidth(2)
        w.setframerate(SR)
        if stereo:
            if pcm.ndim == 1:
                interleaved = np.column_stack([pcm, pcm]).reshape(-1)
            else:
                interleaved = pcm.T.reshape(-1)
            w.writeframes(interleaved.tobytes())
        else:
            w.writeframes(pcm.tobytes())
    print(f"  wrote {path.name}  {len(x)/SR:.2f}s  peak~{peak:.0f}dBFS")


def t_axis(dur: float) -> np.ndarray:
    n = int(dur * SR)
    return np.arange(n, dtype=np.float64) / SR


def env_exp(t: np.ndarray, attack: float, decay: float) -> np.ndarray:
    e = np.ones_like(t)
    a = int(attack * SR)
    if a > 0:
        e[:a] = np.linspace(0, 1, a, endpoint=False)
    # decay from attack end
    rem = e[a:]
    if len(rem):
        td = np.arange(len(rem)) / SR
        e[a:] = np.exp(-td / max(decay, 1e-4))
    return e


def noise(n: int) -> np.ndarray:
    return RNG.standard_normal(n)


def lowpass(x: np.ndarray, cutoff: float) -> np.ndarray:
    """Simple one-pole lowpass."""
    if len(x) == 0:
        return x
    rc = 1.0 / (2 * math.pi * cutoff)
    dt = 1.0 / SR
    alpha = dt / (rc + dt)
    y = np.zeros_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += alpha * (v - acc)
        y[i] = acc
    return y


def highpass(x: np.ndarray, cutoff: float) -> np.ndarray:
    return x - lowpass(x, cutoff)


def bandpass(x: np.ndarray, low: float, high: float) -> np.ndarray:
    return lowpass(highpass(x, low), high)


def lowpass_fft(x: np.ndarray, cutoff: float, order: int = 4) -> np.ndarray:
    """Fast soft lowpass via FFT (good for long BGM beds)."""
    n = len(x)
    if n == 0:
        return x
    X = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(n, d=1.0 / SR)
    c = max(cutoff, 1.0)
    H = 1.0 / (1.0 + (freqs / c) ** order)
    return np.fft.irfft(X * H, n=n)


def highpass_fft(x: np.ndarray, cutoff: float, order: int = 4) -> np.ndarray:
    n = len(x)
    if n == 0:
        return x
    X = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(n, d=1.0 / SR)
    c = max(cutoff, 1.0)
    H = 1.0 / (1.0 + (c / np.maximum(freqs, 1e-6)) ** order)
    H[0] = 0.0
    return np.fft.irfft(X * H, n=n)


def bandpass_fft(x: np.ndarray, low: float, high: float) -> np.ndarray:
    return lowpass_fft(highpass_fft(x, low), high)


def edge_fade(x: np.ndarray, seconds: float = 0.5) -> np.ndarray:
    """Linear edge fades for loopable beds (or soft stinger tails)."""
    return fade(x, seconds, seconds)


def loop_crossfade(x: np.ndarray, seconds: float = 0.5) -> np.ndarray:
    """Equal-power-ish crossfade of start/end for seamless looping."""
    y = x.copy()
    cf = min(len(y) // 4, int(seconds * SR))
    if cf < 8:
        return y
    fade_out = np.cos(np.linspace(0, math.pi / 2, cf)) ** 2
    fade_in = np.sin(np.linspace(0, math.pi / 2, cf)) ** 2
    head = y[:cf].copy()
    tail = y[-cf:].copy()
    mixed = head * fade_in + tail * fade_out
    y[:cf] = mixed
    y[-cf:] = mixed
    return y


def sine(t: np.ndarray, f: float, phase: float = 0.0) -> np.ndarray:
    return np.sin(2 * math.pi * f * t + phase)


def saw(t: np.ndarray, f: float) -> np.ndarray:
    return 2.0 * ((t * f) % 1.0) - 1.0


def tri(t: np.ndarray, f: float) -> np.ndarray:
    return 2.0 * np.abs(saw(t, f)) - 1.0


def soft_clip(x: np.ndarray, drive: float = 1.2) -> np.ndarray:
    return np.tanh(x * drive)


def polish_sfx(x: np.ndarray) -> np.ndarray:
    """Final SFX mastering: remove subsonic/DC energy and gently tame peaks."""
    y = np.asarray(x, dtype=np.float64)
    if len(y) == 0:
        return y
    # Keep phone playback clean without shaving useful low-end impact.
    y = highpass(y, 24.0)
    y = lowpass(y, 18000.0)
    # Very light analog-style rounding improves dense transient stacks.
    return soft_clip(y, drive=1.08)


# ---------------------------------------------------------------------------
# SFX generators
# ---------------------------------------------------------------------------

def sfx_ui_tap() -> np.ndarray:
    t = t_axis(0.08)
    click = sine(t, 1800) * env_exp(t, 0.001, 0.025)
    body = sine(t, 420) * env_exp(t, 0.002, 0.04) * 0.4
    tick = highpass(noise(len(t)), 4000) * env_exp(t, 0.0005, 0.012) * 0.15
    return fade(click * 0.55 + body + tick, 0.0, 0.01)


def sfx_ui_purchase() -> np.ndarray:
    t = t_axis(0.16)
    a = sine(t, 660) * env_exp(t, 0.002, 0.06)
    b = sine(t, 990) * env_exp(t, 0.01, 0.08) * 0.7
    c = sine(t, 1320) * env_exp(t, 0.04, 0.07) * 0.45
    shimmer = sine(t, 2640) * env_exp(t, 0.05, 0.05) * 0.2
    return fade(a * 0.5 + b * 0.35 + c * 0.25 + shimmer, 0.0, 0.02)


def sfx_ui_deny() -> np.ndarray:
    t = t_axis(0.2)
    a = sine(t, 220) * env_exp(t, 0.005, 0.12)
    b = sine(t, 185) * env_exp(t, 0.02, 0.14) * 0.8
    grit = lowpass(noise(len(t)), 800) * env_exp(t, 0.01, 0.1) * 0.25
    # slight downward pitch glide via phase
    glide = np.sin(2 * math.pi * (200 - 40 * t) * t) * env_exp(t, 0.003, 0.1) * 0.35
    return fade(a * 0.45 + b * 0.35 + grit + glide, 0.0, 0.03)


def sfx_ore_hit() -> np.ndarray:
    """Crystalline + soft thud — phone-readable, spam-safe (~110ms)."""
    t = t_axis(0.11)
    n = len(t)
    thud = sine(t, 92) * env_exp(t, 0.0008, 0.042) * 0.72
    thud += sine(t, 52) * env_exp(t, 0.0008, 0.052) * 0.38
    body = sine(t, 180) * env_exp(t, 0.001, 0.038) * 0.28  # phone mid
    crystal = sine(t, 2450) * env_exp(t, 0.0006, 0.032) * 0.48
    crystal += sine(t, 3680) * env_exp(t, 0.0008, 0.025) * 0.26
    crystal += sine(t, 5200) * env_exp(t, 0.0008, 0.018) * 0.12
    strike = highpass(noise(n), 2200) * env_exp(t, 0.0003, 0.012) * 0.32
    cyan = sine(t, 880) * env_exp(t, 0.0015, 0.045) * 0.18
    return fade(thud + body + crystal + strike + cyan, 0.0, 0.012)


def sfx_ore_hold_loop() -> np.ndarray:
    """1.5s seamless-ish hold mining pulse loop."""
    dur = 1.5
    t = t_axis(dur)
    # slow cyan energy pulse
    pulse = 0.5 + 0.5 * np.sin(2 * math.pi * 2.0 * t)  # 2 Hz
    drone = sine(t, 110) * 0.22 * pulse
    drone += sine(t, 165) * 0.12 * pulse
    grit = lowpass(noise(len(t)), 600) * 0.08 * pulse
    sparkle = sine(t, 2200 + 80 * np.sin(2 * math.pi * 3 * t)) * 0.06
    sparkle *= (0.3 + 0.7 * pulse)
    # soft tick every 0.25s
    ticks = np.zeros_like(t)
    for i in range(6):
        start = int(i * 0.25 * SR)
        tl = t_axis(0.04)
        tick = sine(tl, 1800 + i * 30) * env_exp(tl, 0.001, 0.02) * 0.18
        end = min(len(ticks), start + len(tick))
        ticks[start:end] += tick[: end - start]
    y = drone + grit + sparkle + ticks
    # crossfade edges for loop friendliness
    cf = int(0.05 * SR)
    y[:cf] = y[:cf] * np.linspace(0, 1, cf) + y[-cf:] * np.linspace(1, 0, cf)
    # flatten end to match start better
    y[-cf:] = y[:cf][::-1] * 0  # will rewrite
    # better: average ends
    avg = 0.5 * (y[:cf] + y[-cf:][::-1])
    y[:cf] = avg
    y[-cf:] = avg[::-1]
    return normalize(y, -6.0)  # softer under hold


def sfx_dust_yield_tick() -> np.ndarray:
    t = t_axis(0.08)
    a = sine(t, 1240) * env_exp(t, 0.001, 0.03)
    b = sine(t, 1860) * env_exp(t, 0.003, 0.035) * 0.5
    dust = highpass(noise(len(t)), 5000) * env_exp(t, 0.0005, 0.02) * 0.2
    return fade(a * 0.55 + b + dust, 0.0, 0.01)


def sfx_enter_mine() -> np.ndarray:
    """~1.15s cinematic enter: whoosh + cyan tech gate (stronger than soft UI)."""
    t = t_axis(1.15)
    n = len(t)
    whoosh = bandpass(noise(n), 180, 5200)
    rise = np.clip(t / 0.35, 0, 1) ** 0.7
    fall = np.exp(-np.maximum(t - 0.45, 0) / 0.38)
    whoosh *= rise * fall * 0.85
    whoosh = soft_clip(whoosh, 1.15)
    f_glide = 90 + 340 * (t / t[-1]) ** 0.85
    pad = np.sin(2 * math.pi * np.cumsum(f_glide) / SR) * env_exp(t, 0.06, 0.55) * 0.42
    pad2_f = f_glide * 1.5
    pad2 = np.sin(2 * math.pi * np.cumsum(pad2_f) / SR) * env_exp(t, 0.1, 0.45) * 0.18
    cyan = sine(t, 880) * env_exp(t, 0.12, 0.4) * 0.16
    cyan += sine(t, 1320) * env_exp(t, 0.18, 0.32) * 0.09
    sub = sine(t, 48) * env_exp(t, 0.04, 0.5) * 0.38
    sub += sine(t, 72) * env_exp(t, 0.06, 0.42) * 0.18
    gate = np.zeros_like(t)
    mask = t >= 0.52
    tg = t[mask] - 0.52
    gate[mask] = sine(tg, 440) * np.exp(-tg / 0.28) * 0.32
    gate[mask] += sine(tg, 660) * np.exp(-tg / 0.22) * 0.2
    gate[mask] += sine(tg, 990) * np.exp(-tg / 0.16) * 0.1
    tick = np.zeros_like(t)
    m2 = (t >= 0.52) & (t < 0.58)
    tick[m2] = highpass(noise(int(m2.sum())), 4000)[: int(m2.sum())] * np.linspace(1, 0, int(m2.sum())) * 0.28
    return fade(whoosh * 0.55 + pad + pad2 + cyan + sub + gate + tick, 0.015, 0.1)


def sfx_exit_mine() -> np.ndarray:
    """~0.65s leave/timeout resolve — wind-down, not alarming."""
    t = t_axis(0.65)
    n = len(t)
    whoosh = bandpass(noise(n), 140, 2600)
    whoosh *= np.exp(-t / 0.28) * 0.4
    fall_f = 280 - 180 * (t / t[-1])
    pad = np.sin(2 * math.pi * np.cumsum(np.maximum(fall_f, 40)) / SR) * np.exp(-t / 0.35) * 0.38
    sub = sine(t, 48) * np.exp(-t / 0.4) * 0.3
    chime = np.zeros_like(t)
    mask = t >= 0.18
    tc = t[mask] - 0.18
    chime[mask] = sine(tc, 520) * np.exp(-tc / 0.26) * 0.2
    chime[mask] += sine(tc, 392) * np.exp(-tc / 0.3) * 0.12
    return fade(whoosh + pad + sub + chime, 0.01, 0.1)


def sfx_session_timer_warn() -> np.ndarray:
    t = t_axis(0.35)
    # double soft beep, restrained orange-hot
    beep = np.zeros_like(t)
    for start, f in [(0.0, 880), (0.12, 880)]:
        mask = (t >= start) & (t < start + 0.09)
        tb = t[mask] - start
        beep[mask] = sine(tb, f) * np.exp(-tb / 0.05) * 0.55
        beep[mask] += sine(tb, f * 1.5) * np.exp(-tb / 0.04) * 0.15
    return fade(beep, 0.0, 0.04)


def sfx_session_timer_end() -> np.ndarray:
    """Lower resolve tone (~0.55s) — not alarm; pairs with session end."""
    t = t_axis(0.55)
    n = len(t)
    a = sine(t, 294) * env_exp(t, 0.006, 0.28) * 0.48
    b = sine(t, 220) * env_exp(t, 0.012, 0.32) * 0.4
    c = sine(t, 165) * env_exp(t, 0.02, 0.3) * 0.3
    settle = sine(t, 440) * env_exp(t, 0.04, 0.22) * 0.12
    noise_tail = lowpass(noise(n), 380) * env_exp(t, 0.02, 0.25) * 0.18
    return fade(a + b + c + settle + noise_tail, 0.0, 0.08)


def sfx_potion_fever() -> np.ndarray:
    t = t_axis(0.7)
    # rising energy swirl + hot accent
    f = 200 + 600 * (t / t[-1]) ** 1.2
    swirl = np.sin(2 * math.pi * np.cumsum(f) / SR) * env_exp(t, 0.05, 0.35) * 0.4
    spark = sine(t, 3200) * env_exp(t, 0.1, 0.2) * 0.15
    hot = sine(t, 440) * env_exp(t, 0.08, 0.25) * 0.35
    bub = highpass(noise(len(t)), 3000) * env_exp(t, 0.05, 0.3) * 0.12
    # mid pulse
    pulse = sine(t, 110) * (0.5 + 0.5 * np.sin(2 * math.pi * 6 * t)) * env_exp(t, 0.05, 0.4) * 0.25
    return fade(swirl + spark + hot + bub + pulse, 0.02, 0.1)


def sfx_rebirth_confirm_click() -> np.ndarray:
    t = t_axis(0.18)
    a = sine(t, 520) * env_exp(t, 0.002, 0.05)
    b = sine(t, 780) * env_exp(t, 0.015, 0.07) * 0.6
    c = sine(t, 1040) * env_exp(t, 0.04, 0.06) * 0.35
    return fade(a * 0.5 + b + c, 0.0, 0.02)


def sfx_rebirth_collapse_whoosh() -> np.ndarray:
    t = t_axis(1.5)
    # void whoosh — falling spectrum
    n = noise(len(t))
    # swept bandpass via modulating mix of filters (approx with amp envelope on bands)
    low = lowpass(n, 800) * (0.3 + 0.7 * (1 - t / t[-1]))
    mid = bandpass(n, 400, 2500) * np.exp(-((t - 0.4) ** 2) / 0.15)
    hi = highpass(n, 2000) * np.exp(-t / 0.5) * 0.6
    whoosh = (low * 0.5 + mid * 0.7 + hi * 0.4) * 0.9
    sub = sine(t, 40 + 20 * np.exp(-t / 0.6)) * env_exp(t, 0.05, 0.8) * 0.45
    return fade(whoosh + sub, 0.05, 0.2)


def sfx_rebirth_void_tear() -> np.ndarray:
    t = t_axis(1.1)
    n = noise(len(t))
    tear = highpass(n, 1500) * env_exp(t, 0.02, 0.45)
    # dissonant metallic scrape
    scrape = saw(t, 90 + 40 * np.sin(2 * math.pi * 2 * t))
    scrape = bandpass(scrape, 200, 3000) * env_exp(t, 0.05, 0.5) * 0.35
    void = sine(t, 55) * env_exp(t, 0.08, 0.6) * 0.4
    crack = highpass(noise(len(t)), 5000) * env_exp(t, 0.005, 0.08) * 0.5
    return fade(tear * 0.55 + scrape + void + crack * 0.3, 0.02, 0.15)


def _stamp_base(dur: float, fund: float, overtones: list[tuple[float, float]], color_noise: float) -> np.ndarray:
    t = t_axis(dur)
    y = sine(t, fund) * env_exp(t, 0.01, dur * 0.45) * 0.55
    for ratio, amp in overtones:
        y += sine(t, fund * ratio) * env_exp(t, 0.015, dur * 0.4) * amp
    # resonant pulse body
    y += sine(t, fund * 0.5) * env_exp(t, 0.02, dur * 0.5) * 0.35
    if color_noise > 0:
        y += bandpass(noise(len(t)), fund * 0.8, fund * 4) * env_exp(t, 0.005, 0.12) * color_noise
    # stamp thud
    y += sine(t, 70) * env_exp(t, 0.002, 0.08) * 0.4
    return fade(y, 0.0, 0.08)


def sfx_rebirth_stamp_directive_pulse() -> np.ndarray:
    """Cyan #00E5FF — cool, clear, protocol pulse."""
    return _stamp_base(0.7, 523.25, [(2.0, 0.35), (3.0, 0.18), (4.0, 0.1)], 0.12)


def sfx_rebirth_stamp_aurelia_grid() -> np.ndarray:
    """Gold — warmer, grid-like harmonics."""
    t = t_axis(0.75)
    y = _stamp_base(0.75, 392.0, [(1.5, 0.3), (2.0, 0.28), (3.0, 0.15)], 0.1)
    # golden shimmer
    shimmer = sine(t, 1568) * env_exp(t, 0.05, 0.35) * 0.18
    shimmer += sine(t, 1174) * env_exp(t, 0.08, 0.3) * 0.12
    return fade(y + shimmer, 0.0, 0.1)


def sfx_rebirth_stamp_resonance_protocol() -> np.ndarray:
    """Magenta — resonant, slightly glassy."""
    t = t_axis(0.8)
    y = _stamp_base(0.8, 466.16, [(2.0, 0.4), (2.5, 0.22), (5.0, 0.12)], 0.15)
    # magenta beat
    beat = sine(t, 466.16) * sine(t, 3.5) * env_exp(t, 0.02, 0.45) * 0.25
    glass = sine(t, 2330) * env_exp(t, 0.03, 0.25) * 0.15
    return fade(y + beat + glass, 0.0, 0.1)


def sfx_rebirth_stamp_volatile_core() -> np.ndarray:
    """Orange #FF6A3D — hotter, unstable edge."""
    t = t_axis(0.72)
    y = _stamp_base(0.72, 349.23, [(2.0, 0.3), (2.8, 0.2), (3.5, 0.15)], 0.22)
    instability = saw(t, 87) * env_exp(t, 0.01, 0.2)
    instability = bandpass(instability, 200, 2000) * 0.2
    crackle = highpass(noise(len(t)), 4000) * env_exp(t, 0.002, 0.1) * 0.25
    hot = sine(t, 698) * env_exp(t, 0.015, 0.2) * 0.28
    return fade(y + instability + crackle + hot, 0.0, 0.08)


def sfx_rebirth_rebuild_rise() -> np.ndarray:
    t = t_axis(1.4)
    f = 60 + 280 * (t / t[-1]) ** 0.8
    rise = np.sin(2 * math.pi * np.cumsum(f) / SR) * env_exp(t, 0.1, 0.7) * 0.4
    pad = sine(t, 220) * env_exp(t, 0.15, 0.8) * 0.25
    pad += sine(t, 330) * env_exp(t, 0.2, 0.7) * 0.18
    particles = highpass(noise(len(t)), 2500) * (t / t[-1]) * np.exp(-(1 - t / t[-1]) * 2) * 0.15
    sub = sine(t, 55) * env_exp(t, 0.12, 0.75) * 0.3
    return fade(rise + pad + particles + sub, 0.05, 0.15)


def sfx_rebirth_settle_chime() -> np.ndarray:
    t = t_axis(1.2)
    # soft settle — cyan chime stack
    freqs = [523.25, 659.25, 783.99, 1046.5]
    y = np.zeros_like(t)
    for i, f in enumerate(freqs):
        delay = 0.04 * i
        mask = t >= delay
        td = t[mask] - delay
        y[mask] += sine(td, f) * np.exp(-td / (0.35 + 0.1 * i)) * (0.35 - 0.05 * i)
    soft = sine(t, 130.81) * env_exp(t, 0.05, 0.7) * 0.2
    return fade(y + soft, 0.01, 0.15)


def sfx_transcend_open() -> np.ndarray:
    t = t_axis(1.0)
    # portal open — airy rise + harmonic bloom
    f = 100 + 400 * (t / t[-1])
    open_ = np.sin(2 * math.pi * np.cumsum(f) / SR) * env_exp(t, 0.08, 0.55) * 0.35
    air = bandpass(noise(len(t)), 800, 6000) * env_exp(t, 0.1, 0.5) * 0.3
    bloom = sine(t, 880) * env_exp(t, 0.2, 0.4) * 0.25
    bloom += sine(t, 1320) * env_exp(t, 0.25, 0.35) * 0.15
    return fade(open_ + air + bloom, 0.03, 0.12)


def sfx_worldline_select() -> np.ndarray:
    t = t_axis(0.35)
    a = sine(t, 660) * env_exp(t, 0.002, 0.08)
    b = sine(t, 990) * env_exp(t, 0.02, 0.1) * 0.55
    c = sine(t, 440) * env_exp(t, 0.01, 0.12) * 0.3
    soft = highpass(noise(len(t)), 6000) * env_exp(t, 0.001, 0.04) * 0.1
    return fade(a * 0.45 + b + c + soft, 0.0, 0.04)


# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# First-wire aliases (Waldo the First naming) — same aesthetic, exact filenames
# ---------------------------------------------------------------------------

def mine_enter_stinger() -> np.ndarray:
    """First-wire: Enter Mine / entrance→interior motion stinger."""
    return sfx_enter_mine()


def mine_ore_hit() -> np.ndarray:
    """First-wire: ore tap/hold hit."""
    return sfx_ore_hit()


def mine_session_end() -> np.ndarray:
    """First-wire: timer expire / Exit Mine resolve (~0.75s)."""
    t = t_axis(0.75)
    n = len(t)
    whoosh = bandpass(noise(n), 120, 2800)
    whoosh *= np.exp(-t / 0.32) * 0.45
    fall_f = 300 - 200 * (t / t[-1])
    pad = np.sin(2 * math.pi * np.cumsum(np.maximum(fall_f, 40)) / SR) * np.exp(-t / 0.38) * 0.38
    a = sine(t, 330) * env_exp(t, 0.008, 0.32) * 0.42
    b = sine(t, 247) * env_exp(t, 0.015, 0.38) * 0.36
    c = sine(t, 165) * env_exp(t, 0.025, 0.4) * 0.28
    chime = np.zeros_like(t)
    mask = t >= 0.22
    tc = t[mask] - 0.22
    chime[mask] = sine(tc, 523) * np.exp(-tc / 0.28) * 0.18
    chime[mask] += sine(tc, 784) * np.exp(-tc / 0.22) * 0.08
    sub = sine(t, 55) * np.exp(-t / 0.45) * 0.28
    noise_tail = lowpass(noise(n), 350) * np.exp(-t / 0.35) * 0.15
    return fade(whoosh + pad + a + b + c + chime + sub + noise_tail, 0.01, 0.12)


def mine_ambience_loop() -> np.ndarray:
    """First-wire: soft chamber ambience loop (~24s, ~−11 dBFS), rock+tech bed."""
    dur = 24.0
    t = t_axis(dur)
    n = len(t)
    pad = np.zeros(n)
    pad += _pad_voice(t, 82.41, 0.14, detune_cents=5, lfo_hz=0.04, lfo_depth=0.12, phase=0.0)
    pad += _pad_voice(t, 123.47, 0.09, detune_cents=7, lfo_hz=0.055, lfo_depth=0.14, phase=1.2)
    pad += _pad_voice(t, 164.81, 0.05, detune_cents=6, lfo_hz=0.048, lfo_depth=0.1, phase=2.0)
    pulse = 0.55 + 0.45 * (0.5 + 0.5 * np.sin(2 * math.pi * 0.35 * t))
    pulse = np.clip(pulse ** 0.9, 0.4, 1.0)
    sub = sine(t, 41.0) * pulse * 0.1
    sub += sine(t, 61.5) * pulse * 0.045
    cyan = sine(t, 660.0) * pulse * 0.012
    cyan += sine(t, 880.0) * (0.4 + 0.6 * (0.5 + 0.5 * np.sin(2 * math.pi * 0.11 * t))) * 0.014
    grit = _noise_bed(n, base_cut=320.0, lfo_hz=0.06, lfo_depth=0.35, amp=0.032, seed_offset=33)
    grit *= pulse
    grit = lowpass_fft(grit, 480.0)
    rock = saw(t, 41.0) * pulse * 0.035
    rock = soft_clip(lowpass_fft(rock, 200.0), drive=1.25) * 0.65
    ticks = _sparse_pulse_train(dur, interval=3.0, freq=2200.0, amp=0.01, pulse_dur=0.05, start_offset=0.8)
    y = pad + sub + cyan + grit + rock + ticks
    y = loop_crossfade(y, 0.6)
    y = edge_fade(y, 0.5)
    return y


# BGM v2 — richer pads, noise beds, LFO filters, sparse pulses (procedural)
# ---------------------------------------------------------------------------

BGM_PEAK_DBFS = -8.0
LOADING_PEAK_DBFS = -9.0


def _pad_voice(
    t: np.ndarray,
    freq: float,
    amp: float,
    detune_cents: float = 6.0,
    lfo_hz: float = 0.07,
    lfo_depth: float = 0.18,
    phase: float = 0.0,
) -> np.ndarray:
    """Detuned sine pair with slow amp LFO — sparse pad voice."""
    det = 2.0 ** (detune_cents / 1200.0)
    lfo = 1.0 - lfo_depth + lfo_depth * (0.5 + 0.5 * np.sin(2 * math.pi * lfo_hz * t + phase))
    a = sine(t, freq) * 0.62
    b = sine(t, freq * det, phase=1.1) * 0.38
    # faint 2nd harmonic for body (kept soft — not bright)
    c = sine(t, freq * 2.0, phase=0.4) * 0.12
    return (a + b + c) * amp * lfo


def _noise_bed(
    n: int,
    base_cut: float,
    lfo_hz: float,
    lfo_depth: float,
    amp: float,
    seed_offset: int = 0,
) -> np.ndarray:
    """Filtered noise bed with slow cutoff LFO (FFT filter)."""
    rng = np.random.default_rng(42 + seed_offset)
    raw = rng.standard_normal(n)
    t = np.arange(n, dtype=np.float64) / SR
    # Time-varying cutoff via two filtered layers crossfaded by LFO
    cut_lo = max(80.0, base_cut * (1.0 - lfo_depth))
    cut_hi = base_cut * (1.0 + lfo_depth)
    a = lowpass_fft(raw, cut_lo, order=3)
    b = lowpass_fft(raw, cut_hi, order=3)
    morph = 0.5 + 0.5 * np.sin(2 * math.pi * lfo_hz * t)
    bed = a * (1.0 - morph) + b * morph
    # gentle high shelf removal for phone speakers
    bed = lowpass_fft(bed, min(2800.0, base_cut * 3.5), order=2)
    return bed * amp


def _sparse_pulse_train(
    dur: float,
    interval: float,
    freq: float,
    amp: float,
    pulse_dur: float = 0.09,
    start_offset: float = 0.0,
) -> np.ndarray:
    """Very soft interval / protocol pulses — sparse, under SFX."""
    n = int(dur * SR)
    y = np.zeros(n, dtype=np.float64)
    t0 = start_offset
    while t0 < dur:
        start = int(t0 * SR)
        tl = t_axis(pulse_dur)
        body = sine(tl, freq) * env_exp(tl, 0.004, pulse_dur * 0.45)
        body += sine(tl, freq * 1.5) * env_exp(tl, 0.008, pulse_dur * 0.35) * 0.35
        body += sine(tl, freq * 0.5) * env_exp(tl, 0.006, pulse_dur * 0.5) * 0.25
        end = min(n, start + len(body))
        y[start:end] += body[: end - start] * amp
        t0 += interval
    return y


def _subtle_arp(
    dur: float,
    notes: list[float],
    step: float,
    amp: float,
    note_dur: float = 0.35,
) -> np.ndarray:
    """Sparse slow arpeggio — one soft note every `step` seconds."""
    n = int(dur * SR)
    y = np.zeros(n, dtype=np.float64)
    i = 0
    t0 = step * 0.5
    while t0 < dur - note_dur:
        f = notes[i % len(notes)]
        start = int(t0 * SR)
        tl = t_axis(note_dur)
        # soft triangle-ish via sine+detune, long attack
        atk = min(0.08, note_dur * 0.25)
        env = env_exp(tl, atk, note_dur * 0.55)
        tone = sine(tl, f) * 0.7 + sine(tl, f * 1.003) * 0.3
        tone += sine(tl, f * 2.0) * 0.08
        end = min(n, start + len(tone))
        y[start:end] += (tone * env)[: end - start] * amp
        i += 1
        t0 += step
    return y


def bgm_hub_loop() -> np.ndarray:
    """Calmer tech ambient — slow pulse, richer sparse pads, loop-friendly ~36s."""
    dur = 36.0
    t = t_axis(dur)
    n = len(t)

    # Cool A-minor-ish pad stack (sparse): A2, E3, C4, A3
    pad = np.zeros(n)
    pad += _pad_voice(t, 110.00, 0.16, detune_cents=5, lfo_hz=0.055, lfo_depth=0.16, phase=0.0)
    pad += _pad_voice(t, 164.81, 0.11, detune_cents=7, lfo_hz=0.068, lfo_depth=0.14, phase=1.2)
    pad += _pad_voice(t, 220.00, 0.08, detune_cents=4, lfo_hz=0.041, lfo_depth=0.12, phase=2.1)
    pad += _pad_voice(t, 329.63, 0.045, detune_cents=8, lfo_hz=0.09, lfo_depth=0.2, phase=0.7)
    # very soft fifth shimmer
    pad += _pad_voice(t, 440.00, 0.025, detune_cents=10, lfo_hz=0.05, lfo_depth=0.22, phase=3.0)

    # Clearer slow sub pulse (~0.22 Hz ≈ every ~4.5s swell)
    pulse = 0.55 + 0.45 * (0.5 + 0.5 * np.sin(2 * math.pi * 0.22 * t))
    sub = sine(t, 55.0) * pulse * 0.11
    sub += sine(t, 82.41) * pulse * 0.05

    # Filtered air / void bed
    air = _noise_bed(n, base_cut=900.0, lfo_hz=0.04, lfo_depth=0.35, amp=0.028, seed_offset=1)
    air = highpass_fft(air, 60.0)

    # Sparse protocol pulses every 4s (cyan tick feel)
    pulses = _sparse_pulse_train(dur, interval=4.0, freq=1760.0, amp=0.028, pulse_dur=0.07, start_offset=0.0)
    # quieter answering fifth every 8s
    pulses += _sparse_pulse_train(dur, interval=8.0, freq=1318.5, amp=0.018, pulse_dur=0.1, start_offset=2.0)

    # Sparse slow arp: A–C–E–G (aeolian) every 3s, very quiet
    arp = _subtle_arp(dur, [220.0, 261.63, 329.63, 392.0], step=3.0, amp=0.022, note_dur=0.55)

    # Soft mid movement — filtered saw bed under pads (industrial-ambient, not grit-heavy)
    saw_raw = saw(t, 55.0) * 0.04 * pulse
    saw_lo = lowpass_fft(saw_raw, 160.0, order=3)
    saw_hi = lowpass_fft(saw_raw, 240.0, order=3)
    saw_morph = 0.5 + 0.5 * np.sin(2 * math.pi * 0.03 * t)
    saw_bed = saw_lo * (1.0 - saw_morph) + saw_hi * saw_morph

    y = pad + sub + air + pulses + arp + saw_bed
    y = loop_crossfade(y, 0.5)
    y = edge_fade(y, 0.5)
    return y


def bgm_mine_loop() -> np.ndarray:
    """Deeper mechanical tension + cyan pulse + light tech grit — ~36s."""
    dur = 36.0
    t = t_axis(dur)
    n = len(t)

    # Deeper pad stack (E-ish / darker): E2, B2, G3, E3
    pad = np.zeros(n)
    pad += _pad_voice(t, 82.41, 0.18, detune_cents=4, lfo_hz=0.048, lfo_depth=0.14, phase=0.0)
    pad += _pad_voice(t, 123.47, 0.12, detune_cents=6, lfo_hz=0.062, lfo_depth=0.16, phase=1.5)
    pad += _pad_voice(t, 164.81, 0.09, detune_cents=5, lfo_hz=0.055, lfo_depth=0.12, phase=2.4)
    pad += _pad_voice(t, 246.94, 0.05, detune_cents=9, lfo_hz=0.08, lfo_depth=0.2, phase=0.9)

    # Mechanical pulse ~0.5 Hz (every 2s) — clearer cyan energy pump
    pulse_env = 0.5 + 0.5 * (0.5 + 0.5 * np.sin(2 * math.pi * 0.5 * t))
    # slight asymmetry for industrial feel
    pulse_env = np.clip(pulse_env ** 0.85, 0.35, 1.0)

    sub = sine(t, 41.0) * pulse_env * 0.15
    sub += sine(t, 61.5) * pulse_env * 0.07
    mid = sine(t, 82.41) * pulse_env * 0.09

    # Cyan energy shimmer (restrained)
    cyan_lfo = 0.35 + 0.65 * (0.5 + 0.5 * np.sin(2 * math.pi * 0.125 * t))
    cyan = sine(t, 880.0) * cyan_lfo * 0.028
    cyan += sine(t, 1320.0) * (0.35 + 0.65 * (0.5 + 0.5 * np.sin(2 * math.pi * 0.1 * t + 1.2))) * 0.016
    cyan += sine(t, 660.0) * pulse_env * 0.02

    # Tech grit — filtered noise gated by pulse + soft clipped mid grit
    grit = _noise_bed(n, base_cut=380.0, lfo_hz=0.07, lfo_depth=0.4, amp=0.045, seed_offset=7)
    grit *= pulse_env
    grit = lowpass_fft(grit, 550.0)

    rock = saw(t, 41.0) * pulse_env * 0.055
    rock = soft_clip(lowpass_fft(rock, 220.0), drive=1.35) * 0.7
    rock += bandpass_fft(saw(t, 82.41), 120.0, 600.0) * pulse_env * 0.03

    # Sparse energy ticks (1s) — soft under click SFX
    ticks = _sparse_pulse_train(dur, interval=1.0, freq=2400.0, amp=0.018, pulse_dur=0.045, start_offset=0.0)
    # every 4th hit a slightly lower "thock" feel
    ticks += _sparse_pulse_train(dur, interval=4.0, freq=180.0, amp=0.035, pulse_dur=0.08, start_offset=0.0)

    # Sparse interval pulse: E–B every 6s
    arp = _subtle_arp(dur, [164.81, 246.94, 329.63, 246.94], step=6.0, amp=0.02, note_dur=0.7)

    y = pad + sub + mid + cyan + grit + rock + ticks + arp
    y = loop_crossfade(y, 0.5)
    y = edge_fade(y, 0.5)
    return y


def bgm_rebirth_stinger() -> np.ndarray:
    """10.5s rebirth bed with clearly separated void, transition, rebuild, settle phases."""
    dur = 10.5
    t = t_axis(dur)
    n = len(t)

    # Deliberate phase windows: each stage has its own center of gravity instead
    # of keeping every layer active throughout the transition.
    void_in = np.clip(t / 0.35, 0.0, 1.0)
    void_out = 1.0 - np.clip((t - 2.0) / 1.55, 0.0, 1.0)
    void_env = void_in * (0.16 + 0.84 * void_out)
    collapse_env = np.exp(-((t - 2.65) ** 2) / 0.72)
    bridge_env = np.clip((t - 3.45) / 0.75, 0.0, 1.0) * (1.0 - np.clip((t - 5.0) / 0.9, 0.0, 1.0))
    rise_gate = np.clip((t - 4.25) / 1.3, 0.0, 1.0)
    rise_gate *= 1.0 - 0.22 * np.clip((t - 7.35) / 0.65, 0.0, 1.0)
    rebuild_gate = np.clip((t - 5.7) / 1.0, 0.0, 1.0)
    settle_gate = np.clip((t - 7.45) / 0.75, 0.0, 1.0) * np.exp(-np.maximum(t - 8.05, 0.0) / 1.45)

    # Phase 1: low, hollow void. No orchestral voicing; only sparse sine beds.
    void = sine(t, 36.0) * void_env * 0.22
    void += sine(t, 54.0) * void_env * 0.12
    void += sine(t, 72.0) * void_env * 0.06
    void += _pad_voice(t, 108.0, 0.05, lfo_hz=0.12, lfo_depth=0.25, phase=0.5) * void_env

    # Phase 2: one readable collapse/air event, then a short bridge into the rise.
    whoosh = bandpass_fft(noise(n), 75.0, 2100.0) * collapse_env * 0.27
    whoosh += lowpass_fft(noise(n), 180.0) * np.exp(-((t - 2.15) ** 2) / 1.25) * 0.08
    bridge = bandpass_fft(noise(n), 300.0, 1500.0) * bridge_env * 0.05

    # Phase 3: a restrained digital stamp, centered before the upward rebuild.
    stamp = np.zeros(n)
    for f, a, center in [(110.0, 0.18, 4.05), (165.0, 0.10, 4.15), (220.0, 0.065, 4.25)]:
        stamp += sine(t, f) * np.exp(-((t - center) ** 2) / 0.34) * a
    stamp += sine(t, 330.0) * np.exp(-((t - 4.35) ** 2) / 0.24) * 0.045

    # Phase 4: obvious but smooth rising partials, stopping before the settle.
    f_glide = 68.0 + 285.0 * np.clip((t - 4.35) / 3.25, 0.0, 1.0) ** 0.72
    phase = 2.0 * math.pi * np.cumsum(np.maximum(f_glide, 1.0)) / SR
    rise = np.sin(phase) * rise_gate * 0.17
    rise += np.sin(phase * 1.5 + 0.35) * rise_gate * 0.075
    rise += np.sin(phase * 2.0 + 0.8) * rise_gate * 0.025

    # Phase 5: rebuild bloom, still synth-pad scale rather than orchestra.
    bloom = _pad_voice(t, 220.0, 0.065, lfo_hz=0.15, lfo_depth=0.2) * rebuild_gate
    bloom += _pad_voice(t, 330.0, 0.04, lfo_hz=0.11, lfo_depth=0.18, phase=1.0) * rebuild_gate
    bloom += _pad_voice(t, 440.0, 0.018, lfo_hz=0.09, lfo_depth=0.2, phase=2.0) * rebuild_gate

    # Phase 6: cyan settle chord with a separate low anchor and a clean tail.
    settle = sine(t, 523.25) * settle_gate * 0.105
    settle += sine(t, 659.25) * settle_gate * 0.065
    settle += sine(t, 783.99) * settle_gate * 0.035
    settle += sine(t, 130.81) * settle_gate * 0.075
    settle += sine(t, 261.63) * settle_gate * 0.035

    air = _noise_bed(n, base_cut=620.0, lfo_hz=0.08, lfo_depth=0.28, amp=0.034, seed_offset=11)
    air *= 0.25 + 0.55 * void_env + 0.35 * rebuild_gate

    y = void + whoosh + bridge + stamp + rise + bloom + settle + air
    y = highpass_fft(y, 25.0)
    y = fade(y, 0.22, 0.92)
    return y


def bgm_loading_loop() -> np.ndarray:
    """30s soft idle neon loop: low-motion pad, dim shimmer, no hard ticks."""
    dur = 30.0
    t = t_axis(dur)
    n = len(t)

    # Dark cyan/indigo pad stack with a very slow harmonic drift. The upper
    # voice is deliberately tucked down so the loop reads as idle, not alert.
    pad = np.zeros(n)
    pad += _pad_voice(t, 130.81, 0.115, detune_cents=5, lfo_hz=0.045, lfo_depth=0.16, phase=0.0)
    pad += _pad_voice(t, 155.56, 0.052, detune_cents=6, lfo_hz=0.052, lfo_depth=0.14, phase=1.1)
    pad += _pad_voice(t, 196.00, 0.075, detune_cents=7, lfo_hz=0.058, lfo_depth=0.15, phase=1.3)
    pad += _pad_voice(t, 261.63, 0.048, detune_cents=5, lfo_hz=0.038, lfo_depth=0.13, phase=2.0)
    pad += _pad_voice(t, 311.13, 0.014, detune_cents=8, lfo_hz=0.07, lfo_depth=0.18, phase=0.6)

    # Barely breathing low anchor: stable enough for an idle screen, never a beat.
    pulse = 0.84 + 0.16 * (0.5 + 0.5 * np.sin(2 * math.pi * 0.145 * t + 0.4))
    sub = sine(t, 65.41) * pulse * 0.052
    sub += sine(t, 98.00) * pulse * 0.022

    # Soft neon air supplies motion without adding percussion or grit.
    air = _noise_bed(n, base_cut=820.0, lfo_hz=0.028, lfo_depth=0.24, amp=0.015, seed_offset=21)
    air = highpass_fft(air, 90.0)

    # Occasional dim glints, widened in time and kept below the pad.
    pulses = _sparse_pulse_train(dur, interval=7.5, freq=1318.5, amp=0.008, pulse_dur=0.18, start_offset=1.5)
    arp = _subtle_arp(dur, [261.63, 311.13, 392.00, 311.13], step=5.0, amp=0.009, note_dur=1.05)

    y = pad + sub + air + pulses + arp
    # Gentle low-pass rounds the neon edges and makes the idle bed less forward.
    y = lowpass_fft(y, 5200.0, order=3)
    y = highpass_fft(y, 28.0)
    y = loop_crossfade(y, 0.7)
    y = edge_fade(y, 0.55)
    return y


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

GENERATORS = {
    "sfx_ui_tap.wav": sfx_ui_tap,
    "sfx_ui_purchase.wav": sfx_ui_purchase,
    "sfx_ui_deny.wav": sfx_ui_deny,
    "sfx_ore_hit.wav": sfx_ore_hit,
    "sfx_ore_hold_loop.wav": sfx_ore_hold_loop,
    "sfx_dust_yield_tick.wav": sfx_dust_yield_tick,
    "sfx_enter_mine.wav": sfx_enter_mine,
    "sfx_exit_mine.wav": sfx_exit_mine,
    "sfx_session_timer_warn.wav": sfx_session_timer_warn,
    "sfx_session_timer_end.wav": sfx_session_timer_end,
    # First-wire names (Waldo the First) — keep both sets on disk
    "mine_enter_stinger.wav": mine_enter_stinger,
    "mine_ore_hit.wav": mine_ore_hit,
    "mine_session_end.wav": mine_session_end,
    "mine_ambience_loop.wav": mine_ambience_loop,
    "sfx_potion_fever.wav": sfx_potion_fever,
    "sfx_rebirth_confirm_click.wav": sfx_rebirth_confirm_click,
    "sfx_rebirth_collapse_whoosh.wav": sfx_rebirth_collapse_whoosh,
    "sfx_rebirth_void_tear.wav": sfx_rebirth_void_tear,
    "sfx_rebirth_stamp_directive_pulse.wav": sfx_rebirth_stamp_directive_pulse,
    "sfx_rebirth_stamp_aurelia_grid.wav": sfx_rebirth_stamp_aurelia_grid,
    "sfx_rebirth_stamp_resonance_protocol.wav": sfx_rebirth_stamp_resonance_protocol,
    "sfx_rebirth_stamp_volatile_core.wav": sfx_rebirth_stamp_volatile_core,
    "sfx_rebirth_rebuild_rise.wav": sfx_rebirth_rebuild_rise,
    "sfx_rebirth_settle_chime.wav": sfx_rebirth_settle_chime,
    "sfx_transcend_open.wav": sfx_transcend_open,
    "sfx_worldline_select.wav": sfx_worldline_select,
    "bgm_hub_loop.wav": bgm_hub_loop,
    "bgm_mine_loop.wav": bgm_mine_loop,
    "bgm_rebirth_stinger.wav": bgm_rebirth_stinger,
    "bgm_loading_loop.wav": bgm_loading_loop,
}

BGM_FILES = {
    "bgm_hub_loop.wav",
    "bgm_mine_loop.wav",
    "bgm_rebirth_stinger.wav",
    "bgm_loading_loop.wav",
}

BGM_PEAKS = {
    "bgm_hub_loop.wav": BGM_PEAK_DBFS,
    "bgm_mine_loop.wav": BGM_PEAK_DBFS,
    "bgm_rebirth_stinger.wav": -7.0,
    "bgm_loading_loop.wav": LOADING_PEAK_DBFS,
}

# Deliberately scoped polish pass: mine-enter, ore, session, ambience and BGM
# are left untouched by --sfx-polish-only.
SFX_POLISH_FILES = {
    "sfx_ui_tap.wav",
    "sfx_ui_purchase.wav",
    "sfx_ui_deny.wav",
    "sfx_dust_yield_tick.wav",
    "sfx_potion_fever.wav",
    "sfx_session_timer_warn.wav",
    "sfx_rebirth_confirm_click.wav",
    "sfx_rebirth_collapse_whoosh.wav",
    "sfx_rebirth_void_tear.wav",
    "sfx_rebirth_stamp_directive_pulse.wav",
    "sfx_rebirth_stamp_aurelia_grid.wav",
    "sfx_rebirth_stamp_resonance_protocol.wav",
    "sfx_rebirth_stamp_volatile_core.wav",
    "sfx_rebirth_rebuild_rise.wav",
    "sfx_rebirth_settle_chime.wav",
    "sfx_transcend_open.wav",
    "sfx_worldline_select.wav",
    "sfx_ore_hold_loop.wav",
}


def main(bgm_only: bool = False, sfx_polish_only: bool = False) -> None:
    if sfx_polish_only:
        items = {k: v for k, v in GENERATORS.items() if k in SFX_POLISH_FILES}
    elif bgm_only:
        items = {k: v for k, v in GENERATORS.items() if k in BGM_FILES}
    else:
        items = dict(GENERATORS)
    label = " [SFX polish v2]" if sfx_polish_only else (" [BGM only / polish v2]" if bgm_only else "")
    print(f"Generating {len(items)} files → {OUT}{label}")
    for name, fn in items.items():
        print(f"• {name}")
        audio = fn()
        # BGM returns unnormalized; SFX may already be shaped.
        peak = BGM_PEAKS.get(name)
        if name in SFX_POLISH_FILES:
            audio = polish_sfx(audio)
            peak = PEAK_DBFS
        if name == "mine_ambience_loop.wav":
            peak = -11.0
        write_wav(OUT / name, audio, stereo=False, peak_db=peak)
    print("DONE")


if __name__ == "__main__":
    import sys
    bgm_only = "--bgm-only" in sys.argv or "--bgm" in sys.argv
    sfx_polish_only = "--sfx-polish-only" in sys.argv or "--sfx-polish" in sys.argv
    main(bgm_only=bgm_only, sfx_polish_only=sfx_polish_only)

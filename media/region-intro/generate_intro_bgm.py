"""Procedural first-visit BGM for Signal Relay and Phase Vault (9 s, stereo 44.1 kHz)."""
import wave
import numpy as np

SR = 44100
DUR = 9.0
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def env(n, a, r):
    e = np.ones(n)
    ai, ri = int(a * SR), int(r * SR)
    if ai: e[:ai] = np.linspace(0, 1, ai)
    if ri: e[-ri:] *= np.exp(-np.linspace(0, 6, ri))
    return e


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x); acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc; y[i] = acc
    return y


def delay(x, sec, fb, mix):
    d = int(sec * SR); y = x.copy()
    for k in range(1, 6):
        g = fb ** k
        if d * k >= len(x): break
        y[d * k:] += x[:-d * k] * g
    return x * (1 - mix) + y * mix


def master(l, r, fade_in, fade_out, peak_db=-4.0):
    st = np.stack([l, r])
    fi, fo = int(fade_in * SR), int(fade_out * SR)
    st[:, :fi] *= np.linspace(0, 1, fi)
    st[:, -fo:] *= np.linspace(1, 0, fo)
    st = np.tanh(st * 1.2)
    st *= 10 ** (peak_db / 20) / np.max(np.abs(st))
    return st


def write(path, st):
    pcm = (np.clip(st, -1, 1) * 32767).astype(np.int16).T.reshape(-1)
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())


def signal_relay():
    # 120 BPM: low pulse bed + bright relay blips (A minor) bouncing between channels.
    bpm = 120; beat = 60 / bpm
    pad = np.zeros(N)
    for m in (45, 52, 57):  # A2 E3 A3
        f = hz(m)
        pad += (2 * ((t * f) % 1) - 1) * 0.25 + np.sin(2 * np.pi * f * 1.003 * t) * 0.2
    pad = lowpass(pad, 380) * (0.55 + 0.45 * np.sin(2 * np.pi * t / beat / 2) ** 2)
    pad *= np.clip(t / 2.5, 0, 1)
    kick = np.zeros(N)
    for b in np.arange(1.0, DUR - 0.5, beat):
        i = int(b * SR); n = int(0.28 * SR)
        tt = np.arange(n) / SR
        k = np.sin(2 * np.pi * (48 + 60 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 11)
        kick[i:i + n] += k[: N - i]
    notes = [69, 72, 76, 79, 76, 72, 81, 76]
    blipsL = np.zeros(N); blipsR = np.zeros(N)
    step = beat / 2
    for idx, s0 in enumerate(np.arange(2.0, DUR - 0.8, step)):
        m = notes[idx % len(notes)] + (12 if idx % 16 >= 12 else 0)
        i = int(s0 * SR); n = int(0.16 * SR); tt = np.arange(n) / SR
        b = (np.sin(2 * np.pi * hz(m) * tt) + 0.3 * np.sin(2 * np.pi * hz(m) * 2 * tt)) * np.exp(-tt * 24)
        (blipsL if idx % 2 == 0 else blipsR)[i:i + n] += b[: N - i] * 0.5
    blipsL = delay(blipsL, beat * 0.75, 0.45, 0.5); blipsR = delay(blipsR, beat * 0.75, 0.45, 0.5)
    noise = lowpass(rng.standard_normal(N), 2500) * 0.05 * np.clip((t - 0.2) / 1.5, 0, 1) * np.exp(-np.maximum(t - 1.7, 0) * 3)
    L = pad + kick * 0.9 + blipsL + blipsR * 0.35 + noise
    R = pad + kick * 0.9 + blipsR + blipsL * 0.35 + noise
    return master(L, R, 0.4, 1.4)


def phase_vault():
    # Slow D minor drone with beating detune and sparse FM bell chimes in a long tail.
    drone = np.zeros(N)
    for m, g in ((38, 0.5), (45, 0.35), (50, 0.2)):  # D2 A2 D3
        f = hz(m)
        drone += g * (np.sin(2 * np.pi * f * t) + np.sin(2 * np.pi * f * 1.004 * t))
    drone = lowpass(drone, 600) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.25 * t)) * np.clip(t / 3.0, 0, 1)
    air = lowpass(rng.standard_normal(N), 900) * 0.06 * (0.6 + 0.4 * np.sin(2 * np.pi * 0.18 * t))
    bellsL = np.zeros(N); bellsR = np.zeros(N)
    chimes = [(1.6, 74, 0), (3.1, 77, 1), (4.4, 81, 0), (5.6, 76, 1), (6.7, 86, 0)]
    for s0, m, side in chimes:
        i = int(s0 * SR); n = min(int(3.5 * SR), N - i); tt = np.arange(n) / SR
        f = hz(m)
        b = np.sin(2 * np.pi * f * tt + 1.8 * np.exp(-tt * 3) * np.sin(2 * np.pi * f * 3.5 * tt)) * np.exp(-tt * 1.4)
        (bellsL if side == 0 else bellsR)[i:i + n] += b * 0.45
        (bellsR if side == 0 else bellsL)[i:i + n] += b * 0.18
    bellsL = delay(bellsL, 0.43, 0.55, 0.55); bellsR = delay(bellsR, 0.57, 0.55, 0.55)
    swell = lowpass(rng.standard_normal(N), 300) * 0.25 * np.clip((t - 6.5) / 1.5, 0, 1) * np.clip((8.8 - t) / 0.6, 0, 1)
    L = drone + air + bellsL + swell
    R = drone * 0.97 + air + bellsR + swell
    return master(L, R, 1.0, 1.6)


write("signal_relay_intro_bgm.wav", signal_relay())
write("phase_vault_intro_bgm.wav", phase_vault())
print("ok")

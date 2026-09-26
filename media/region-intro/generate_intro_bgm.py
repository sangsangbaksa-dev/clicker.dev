"""Procedural region-entry BGM (9 s, stereo 44.1 kHz)."""
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


def storm_spire():
    # E minor tension pad, thunder cracks on the flashes, rain hiss and a rising arpeggio.
    pad = np.zeros(N)
    for m in (40, 47, 52, 55):  # E2 B2 E3 G3
        f = hz(m)
        pad += (2 * ((t * f) % 1) - 1) * 0.18 + np.sin(2 * np.pi * f * 1.006 * t) * 0.15
    pad = lowpass(pad, 500) * np.clip(t / 2.0, 0, 1)
    rain = lowpass(rng.standard_normal(N), 5000) - lowpass(rng.standard_normal(N), 800)
    rain *= 0.08 * np.clip(t / 1.5, 0, 1)
    thunderL = np.zeros(N); thunderR = np.zeros(N)
    for s0, side in STORM_FLASHES:
        i = int(s0 * SR); n = min(int(2.4 * SR), N - i); tt = np.arange(n) / SR
        crack = rng.standard_normal(n) * np.exp(-tt * 9)
        roll = lowpass(rng.standard_normal(n), 140) * 3.0 * np.exp(-tt * 1.6)
        (thunderL if side == 0 else thunderR)[i:i + n] += crack * 0.5 + roll
        (thunderR if side == 0 else thunderL)[i:i + n] += crack * 0.2 + roll * 0.8
    arp = np.zeros(N)
    for idx, s0 in enumerate(np.arange(3.0, 8.2, 0.25)):
        m = [64, 67, 71, 76][idx % 4] + (12 if idx >= 12 else 0)
        i = int(s0 * SR); n = int(0.2 * SR); tt = np.arange(n) / SR
        arp[i:i + n] += np.sin(2 * np.pi * hz(m) * tt) * np.exp(-tt * 14) * 0.3
    arp = delay(arp, 0.375, 0.4, 0.4)
    L = pad + rain + thunderL + arp
    R = pad * 0.98 + rain + thunderR + arp
    return master(L, R, 0.3, 1.2)


def deep_fault():
    # Sub rumble, slow tectonic booms and grinding stone over a C minor drone.
    drone = np.zeros(N)
    for m, g in ((24, 0.8), (31, 0.4), (36, 0.3)):  # C1 G1 C2
        f = hz(m)
        drone += g * np.sin(2 * np.pi * f * t + 0.3 * np.sin(2 * np.pi * 0.3 * t))
    drone *= np.clip(t / 2.5, 0, 1)
    rumble = lowpass(rng.standard_normal(N), 90) * 4.0 * (0.6 + 0.4 * np.sin(2 * np.pi * 0.21 * t))
    grind = lowpass(rng.standard_normal(N), 1800) * 0.07 * np.abs(np.sin(2 * np.pi * 0.7 * t)) ** 3
    booms = np.zeros(N)
    for s0 in (1.2, 3.4, 5.0, 6.4, 7.4):
        i = int(s0 * SR); n = min(int(1.6 * SR), N - i); tt = np.arange(n) / SR
        booms[i:i + n] += np.sin(2 * np.pi * (38 + 40 * np.exp(-tt * 8)) * tt) * np.exp(-tt * 2.6)
    L = drone + rumble + grind + booms * 0.9
    R = drone + rumble * 0.95 + grind * 0.8 + booms * 0.9
    return master(L, R, 0.8, 1.4)


def drone_foundry():
    # 128 BPM machine groove: anvil clanks, servo whirs and a pulsing G minor bass.
    bpm = 128; beat = 60 / bpm
    bass = np.zeros(N)
    for idx, s0 in enumerate(np.arange(1.0, DUR - 0.6, beat / 2)):
        m = [31, 31, 34, 29][(idx // 4) % 4]
        i = int(s0 * SR); n = int(beat / 2 * SR); tt = np.arange(n) / SR
        bass[i:i + n] += (2 * ((tt * hz(m)) % 1) - 1) * np.exp(-tt * 7)
    bass = lowpass(bass, 420) * 0.6
    clankL = np.zeros(N); clankR = np.zeros(N)
    for idx, s0 in enumerate(np.arange(1.0, DUR - 0.6, beat)):
        i = int(s0 * SR); n = min(int(0.4 * SR), N - i); tt = np.arange(n) / SR
        c = sum(np.sin(2 * np.pi * f * tt) for f in (523, 1307, 2210, 3571)) * np.exp(-tt * 18) * 0.25
        (clankL if idx % 2 == 0 else clankR)[i:i + n] += c
    whir = np.zeros(N)
    for s0 in (2.0, 4.0, 6.0):
        i = int(s0 * SR); n = int(1.2 * SR); tt = np.arange(n) / SR
        f = 300 + 900 * tt / 1.2
        whir[i:i + n] += np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / 1.2) * 0.18
    L = bass + clankL + clankR * 0.3 + whir
    R = bass + clankR + clankL * 0.3 + whir
    return master(L, R, 0.3, 1.3)


def core_chamber():
    # Homecoming: warm C major pad, a slow core heartbeat and a rising chime line.
    pad = np.zeros(N)
    for m, g in ((36, 0.45), (43, 0.3), (48, 0.25), (52, 0.18), (55, 0.14)):  # C2 G2 C3 E3 G3
        f = hz(m)
        pad += g * (np.sin(2 * np.pi * f * t) + 0.6 * np.sin(2 * np.pi * f * 1.003 * t))
    pad = lowpass(pad, 700) * np.clip(t / 2.2, 0, 1) * (0.85 + 0.15 * np.sin(2 * np.pi * 0.2 * t))
    beat = np.zeros(N)
    for s0 in np.arange(1.2, DUR - 0.8, 1.1):
        for off, g in ((0.0, 1.0), (0.22, 0.6)):  # lub-dub
            i = int((s0 + off) * SR); n = min(int(0.35 * SR), N - i); tt = np.arange(n) / SR
            beat[i:i + n] += g * np.sin(2 * np.pi * (44 + 30 * np.exp(-tt * 25)) * tt) * np.exp(-tt * 9)
    chimeL = np.zeros(N); chimeR = np.zeros(N)
    for idx, (s0, m) in enumerate(((2.4, 72), (3.5, 76), (4.6, 79), (5.7, 84), (6.6, 88))):
        i = int(s0 * SR); n = min(int(2.5 * SR), N - i); tt = np.arange(n) / SR
        f = hz(m)
        c = np.sin(2 * np.pi * f * tt + 0.9 * np.exp(-tt * 4) * np.sin(2 * np.pi * f * 2 * tt)) * np.exp(-tt * 1.8)
        (chimeL if idx % 2 == 0 else chimeR)[i:i + n] += c * 0.35
        (chimeR if idx % 2 == 0 else chimeL)[i:i + n] += c * 0.14
    chimeL = delay(chimeL, 0.41, 0.5, 0.5); chimeR = delay(chimeR, 0.53, 0.5, 0.5)
    L = pad + beat * 0.8 + chimeL
    R = pad * 0.98 + beat * 0.8 + chimeR
    return master(L, R, 0.8, 1.5)


# Seconds (and stereo side) of the Storm Spire lightning flashes; the video flashes on the same beats.
STORM_FLASHES = [(1.4, 0), (3.2, 1), (4.9, 0), (6.1, 1), (7.3, 0)]

write("signal_relay_intro_bgm.wav", signal_relay())
write("phase_vault_intro_bgm.wav", phase_vault())
write("storm_spire_intro_bgm.wav", storm_spire())
write("deep_fault_intro_bgm.wav", deep_fault())
write("drone_foundry_intro_bgm.wav", drone_foundry())
write("core_chamber_intro_bgm.wav", core_chamber())
print("ok")

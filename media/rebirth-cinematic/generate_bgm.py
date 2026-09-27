"""Procedural rebirth-cinematic soundtrack (9.8 s, stereo 44.1 kHz).

collapse rumble (0–2.6 s) → void-tear riser (2.6–4.3 s) → impact at 4.3 s →
bright worldline chord with bells (4.3–9.8 s). Usage: python3 generate_bgm.py OUT.wav
"""
import sys
import wave
import numpy as np

SR = 44100
DUR = 9.8
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(11)
IMPACT = 4.3


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def onepole(x, cutoff):
    # Vectorised enough: scipy is not available, so filter in chunks with a python loop.
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x); acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc; y[i] = acc
    return y


def smooth(x0, x1, a, b):
    s = np.clip((t - a) / (b - a), 0, 1)
    return x0 + (x1 - x0) * s * s * (3 - 2 * s)


def delay(x, sec, fb, mix):
    d = int(sec * SR); y = x.copy()
    for k in range(1, 8):
        if d * k >= len(x): break
        y[d * k:] += x[:-d * k] * fb ** k
    return x * (1 - mix) + y * mix


L = np.zeros(N); R = np.zeros(N)

# Collapse: sub rumble + low noise that swells, falling pitch as the world is swallowed.
sub_f = smooth(62, 34, 0, IMPACT)
sub = np.sin(2 * np.pi * np.cumsum(sub_f) / SR) * smooth(0, 0.55, 0, 2.4) * (t < IMPACT)
rumble = onepole(rng.standard_normal(N), 140) * 2.2 * smooth(0, 1, 0, 2.6) * (t < IMPACT)
L += sub + rumble; R += sub + rumble * 0.9

# Void tear: rising FM sweep and a reverse-cymbal noise swell into the impact.
riser_f = np.where(t < 2.4, 180, 180 * 2 ** ((t - 2.4) / (IMPACT - 2.4) * 2.6))
riser_env = np.clip((t - 2.2) / (IMPACT - 2.2), 0, 1) ** 2 * (t < IMPACT)
riser = np.sin(2 * np.pi * np.cumsum(riser_f) / SR + 2.5 * np.sin(2 * np.pi * np.cumsum(riser_f * 0.5) / SR)) * riser_env * 0.28
noise = rng.standard_normal(N)
hiss = (noise - onepole(noise, 2500)) * np.clip((t - 1.5) / (IMPACT - 1.5), 0, 1) ** 3 * (t < IMPACT) * 0.7
L += riser + hiss; R += riser * 0.85 + hiss * 1.1

# Impact: sub boom, noise crack, long tail.
after = np.clip(t - IMPACT, 0, None) * (t >= IMPACT)
boom_f = 30 + 70 * np.exp(-after * 9)
boom = np.sin(2 * np.pi * np.cumsum(np.where(t >= IMPACT, boom_f, 0)) / SR) * np.exp(-after * 1.6) * (t >= IMPACT) * 1.1
crack = onepole(rng.standard_normal(N), 3000) * np.exp(-after * 7) * (t >= IMPACT) * 1.4
L += boom + crack; R += boom + crack

# Worldline chord: D major add9 pad (detuned saws, low-passed) with slow bloom.
pad = np.zeros(N)
for m in (50, 57, 62, 64, 66, 69):
    for det in (-0.08, 0.08):
        f = hz(m + det)
        pad += 2 * ((t * f) % 1) - 1
pad = onepole(pad, 1400) * 0.06 * smooth(0, 1, IMPACT, IMPACT + 1.4) * (t >= IMPACT)
L += pad; R += np.roll(pad, 300)

# Bells: an ascending arpeggio that rings out over the chord.
bells = np.zeros(N)
for i, m in enumerate((74, 78, 81, 86, 90, 93)):
    st = IMPACT + 0.25 + i * 0.32
    a = np.clip(t - st, 0, None) * (t >= st)
    f = hz(m)
    bells += (np.sin(2 * np.pi * f * a) + 0.4 * np.sin(2 * np.pi * f * 2.76 * a)) * np.exp(-a * 1.8) * (t >= st) * 0.16
bells = delay(bells, 0.23, 0.45, 0.45)
L += bells; R += np.roll(bells, 2600)

st = np.stack([L, R])
fo = int(1.1 * SR)
st[:, -fo:] *= np.linspace(1, 0, fo) ** 1.5
st = np.tanh(st * 1.1)
st *= 10 ** (-3 / 20) / np.max(np.abs(st))
pcm = (np.clip(st, -1, 1) * 32767).astype(np.int16).T.reshape(-1)
with wave.open(sys.argv[1] if len(sys.argv) > 1 else "rebirth_bgm.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

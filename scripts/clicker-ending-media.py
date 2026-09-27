#!/usr/bin/env python3
"""Core Heart intro + the two ending videos (guardian fall, core awakening).

Frames are composed with PIL from existing plates plus a drawn guardian; the soundtracks
are synthesized with numpy; ffmpeg muxes them (H.264 + AAC, faststart).

    python3 scripts/clicker-ending-media.py
"""
from __future__ import annotations

import math
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parent.parent / "public" / "clicker"
W, H, FPS = 1280, 720, 24
SR = 44100


def cover(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGB")
    s = max(W / im.width, H / im.height)
    im = im.resize((math.ceil(im.width * s), math.ceil(im.height * s)), Image.LANCZOS)
    x, y = (im.width - W) // 2, (im.height - H) // 2
    return im.crop((x, y, x + W, y + H))


def zoom(im: Image.Image, z: float, dx: float = 0, dy: float = 0) -> Image.Image:
    cw, ch = W / z, H / z
    x = (W - cw) / 2 + dx
    y = (H - ch) / 2 + dy
    return im.crop((x, y, x + cw, y + ch)).resize((W, H), Image.BILINEAR)


def warden(size: int) -> Image.Image:
    """The guardian from the in-game SVG (viewBox 220×240), drawn at `size` px tall."""
    s = size / 240
    im = Image.new("RGBA", (int(220 * s), size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    P = lambda pts: [(x * s, y * s) for x, y in pts]
    d.polygon(P([(40, 100), (6, 170), (28, 180), (62, 120)]), fill=(74, 42, 24))
    d.polygon(P([(180, 100), (214, 170), (192, 180), (158, 120)]), fill=(74, 42, 24))
    d.polygon(P([(50, 70), (170, 70), (190, 190), (110, 230), (30, 190)]), fill=(93, 54, 32))
    d.polygon(P([(70, 90), (150, 90), (162, 180), (110, 206), (58, 180)]), fill=(122, 69, 38))
    d.polygon(P([(80, 20), (140, 20), (156, 72), (64, 72)]), fill=(106, 60, 34))
    d.polygon(P([(84, 14), (96, 0), (100, 20)]), fill=(255, 179, 71))
    d.polygon(P([(136, 14), (124, 0), (120, 20)]), fill=(255, 179, 71))
    d.ellipse([82 * s, 110 * s, 138 * s, 166 * s], fill=(255, 140, 26))
    d.ellipse([96 * s, 124 * s, 124 * s, 152 * s], fill=(255, 241, 194))
    d.rounded_rectangle([88 * s, 42 * s, 132 * s, 52 * s], radius=5 * s, fill=(255, 221, 85))
    return im


def glow(frame: Image.Image, cx: float, cy: float, radius: float, color, strength: float) -> Image.Image:
    yy, xx = np.mgrid[0:H, 0:W]
    r = np.hypot(xx - cx, yy - cy) / max(radius, 1)
    g = np.clip(1 - r, 0, 1) ** 2 * strength / 255
    arr = np.asarray(frame, float) + g[..., None] * np.array(color, float)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def fade(frame: Image.Image, to, amount: float) -> Image.Image:
    if amount <= 0:
        return frame
    return Image.blend(frame, Image.new("RGB", (W, H), to), min(1, amount))


# ---------- audio ----------

def env(n: int, a: float, r: float) -> np.ndarray:
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / max(r, 1e-4))


def write_wav(path: Path, x: np.ndarray):
    x = x / max(1e-6, np.abs(x).max()) * 0.85
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


def noise(n: int, rng) -> np.ndarray:
    return rng.standard_normal(n)


def lowpass(x: np.ndarray, a: float) -> np.ndarray:
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += a * (v - acc)
        y[i] = acc
    return y


def boom(n_total: int, at: float, rng, depth=1.0) -> np.ndarray:
    out = np.zeros(n_total)
    i = int(at * SR)
    n = min(int(2.2 * SR), n_total - i)
    t = np.arange(n) / SR
    f = 70 * np.exp(-t * 2) + 28
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.005, 0.7) * depth
    s += lowpass(noise(n, rng), 0.05) * env(n, 0.003, 0.4) * 2.5 * depth
    out[i : i + n] += s
    return out


def chord(n_total: int, at: float, dur: float, freqs, gain=0.2, attack=1.0) -> np.ndarray:
    out = np.zeros(n_total)
    i = int(at * SR)
    n = min(int(dur * SR), n_total - i)
    t = np.arange(n) / SR
    e = np.minimum(1, t / attack) * np.minimum(1, (dur - t) / 1.2).clip(0, 1)
    s = sum(np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 2.003 * t) for f in freqs)
    out[i : i + n] += s * e * gain
    return out


def audio_heart(sec: float) -> np.ndarray:
    rng = np.random.default_rng(3)
    n = int(sec * SR)
    t = np.arange(n) / SR
    beat = np.zeros(n)
    for k in np.arange(0.4, sec, 1.1):
        beat += boom(n, k, rng, 0.55) + boom(n, k + 0.28, rng, 0.35)
    drone = np.sin(2 * np.pi * 55 * t) * 0.25 + np.sin(2 * np.pi * 82.4 * t) * 0.12
    drone *= np.minimum(1, t / 2)
    return beat + drone + chord(n, 3.5, sec - 3.5, [220, 261.6, 329.6], 0.05, 3)


def audio_fall(sec: float) -> np.ndarray:
    rng = np.random.default_rng(7)
    n = int(sec * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for k, d in [(0.3, 1.2), (1.4, 1.0), (2.3, 1.1), (3.0, 1.4), (4.6, 1.8)]:
        x += boom(n, k, rng, d)
    roar = np.sin(2 * np.pi * np.cumsum(120 - 60 * np.clip(t / 4, 0, 1)) / SR) * env(n, 0.2, 3) * 0.4
    x += np.sign(roar) * np.abs(roar) ** 0.6 * 0.3
    rumble = lowpass(noise(n, rng), 0.02) * np.clip((t - 2.5) / 2, 0, 1) * np.clip((sec - t) / 1.5, 0, 1) * 4
    return x + rumble + chord(n, 5.0, sec - 5.0, [196, 246.9, 293.7, 392], 0.12, 1.2)


def audio_awaken(sec: float) -> np.ndarray:
    n = int(sec * SR)
    x = chord(n, 0, sec, [130.8, 196, 261.6], 0.12, 3)
    x += chord(n, 3, sec - 3, [329.6, 392, 523.3], 0.1, 3)
    x += chord(n, 6.5, sec - 6.5, [659.3, 784, 1046.5], 0.06, 2)
    rng = np.random.default_rng(11)
    for k in np.arange(1.0, sec - 1, 0.5):
        i = int(k * SR)
        m = int(0.6 * SR)
        f = 1046.5 * 2 ** (rng.integers(0, 8) * 2 / 12)
        tt = np.arange(m) / SR
        x[i : i + m] += np.sin(2 * np.pi * f * tt) * env(m, 0.005, 0.25)[: m] * 0.08
    return x


# ---------- scenes ----------

def scene_heart(i: int, n: int, bg: Image.Image, guard: Image.Image) -> Image.Image:
    p = i / (n - 1)
    f = zoom(bg, 1.0 + 0.25 * (0.5 - 0.5 * math.cos(math.pi * p)))
    pulse = 0.5 + 0.5 * math.sin(2 * math.pi * i / (FPS * 1.1))
    f = glow(f, W / 2, H * 0.45, 420, (255, 120, 20), 60 + 70 * pulse)
    if p > 0.35:
        a = min(1, (p - 0.35) / 0.3)
        g = guard.copy()
        g.putalpha(g.getchannel("A").point(lambda v: int(v * a * 0.85)))
        f.paste(g, (W // 2 - g.width // 2, int(H * 0.52 - g.height / 2)), g)
    f = fade(f, (0, 0, 0), max(0, 1 - i / (FPS * 1.2)) + max(0, (i - (n - FPS * 1.2)) / (FPS * 1.2)))
    return f


def scene_fall(i: int, n: int, bg: Image.Image, guard: Image.Image) -> Image.Image:
    t = i / FPS
    shake = 14 * math.exp(-((t - 0.3) % 1.1) * 3) if t < 4.8 else 0
    f = zoom(bg, 1.12, math.sin(t * 43) * shake, math.cos(t * 37) * shake)
    drop = max(0, t - 2.4) ** 2 * 60
    tilt = max(0, t - 2.4) * 9
    a = 1 if t < 3.6 else max(0, 1 - (t - 3.6) / 1.2)
    g = guard.rotate(tilt, expand=True, resample=Image.BICUBIC)
    if a < 1:
        g.putalpha(g.getchannel("A").point(lambda v: int(v * a)))
    if a > 0:
        f.paste(g, (W // 2 - g.width // 2, int(H * 0.5 - g.height / 2 + drop)), g)
    for k in (0.3, 1.4, 2.3, 3.0):
        if 0 <= t - k < 0.25:
            f = fade(f, (255, 240, 200), 0.6 * (1 - (t - k) / 0.25))
    core = max(0, t - 3.4)
    f = glow(f, W / 2, H * 0.55, 200 + core * 380, (255, 190, 90), min(255, core * 120))
    f = fade(f, (255, 250, 235), max(0, (t - 5.2) / 1.3))
    return f


def scene_awaken(i: int, n: int, bg: Image.Image) -> Image.Image:
    t = i / FPS
    p = i / (n - 1)
    f = ImageEnhance.Brightness(zoom(bg, 1.35 - 0.3 * p)).enhance(0.35 + 1.1 * p)
    f = glow(f, W / 2, H * 0.48, 180 + 600 * p, (120, 220, 255), 90 + 120 * p)
    d = ImageDraw.Draw(f, "RGBA")
    for k in range(18):
        ang = k / 18 * 2 * math.pi + t * 0.15
        L = 200 + 900 * p
        d.line([W / 2, H * 0.48, W / 2 + math.cos(ang) * L, H * 0.48 + math.sin(ang) * L], fill=(200, 240, 255, int(40 + 60 * p)), width=6)
    f = f.filter(ImageFilter.GaussianBlur(0.6))
    f = fade(f, (0, 0, 0), max(0, 1 - t / 1.2))
    f = fade(f, (255, 255, 255), max(0, (t - (n / FPS - 1.6)) / 1.6))
    return f


def render(name: str, sec: float, frame_fn, audio: np.ndarray, out: Path):
    n = int(sec * FPS)
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "a.wav"
        write_wav(wav, audio)
        proc = subprocess.Popen(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
             "-i", "-", "-i", str(wav), "-c:v", "libx264", "-preset", "medium", "-crf", "25", "-pix_fmt", "yuv420p",
             "-g", str(FPS), "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-shortest", str(out)],
            stdin=subprocess.PIPE,
        )
        for i in range(n):
            proc.stdin.write(frame_fn(i, n).tobytes())
        proc.stdin.close()
        proc.wait()
    print(name, out.stat().st_size // 1024, "KB")


def main():
    (ROOT / "ending").mkdir(exist_ok=True)
    heart = cover(ROOT / "bg" / "region_core_heart.jpg")
    guard = warden(430)
    render("heart", 9, lambda i, n: scene_heart(i, n, heart, guard), audio_heart(9), ROOT / "region" / "core_heart_intro.mp4")
    render("fall", 6.5, lambda i, n: scene_fall(i, n, heart, warden(470)), audio_fall(6.5), ROOT / "ending" / "ending_guardian_fall.mp4")
    wake = cover(ROOT / "bg" / "loading_core_awakening.png")
    render("awaken", 10, lambda i, n: scene_awaken(i, n, wake), audio_awaken(10), ROOT / "ending" / "ending_core_awaken.mp4")


if __name__ == "__main__":
    main()

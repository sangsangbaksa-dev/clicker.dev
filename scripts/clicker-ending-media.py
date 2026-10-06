#!/usr/bin/env python3
"""The two ending videos: the Core Guardian's fall and the core's awakening.

1920x1080/30fps. The fall uses the Core Heart arena plate and the guardian sprite: each hit
splits it with glowing cracks, then it sinks and burns away into embers while the core it
guarded floods the room with light. The awakening pushes into the awakened-core chamber under
soft turning god-rays and drifting motes. Soundtracks are synthesized with numpy; ffmpeg muxes
them (H.264 + AAC, faststart).

    pip install numpy pillow imageio-ffmpeg
    python3 scripts/clicker-ending-media.py
"""
from __future__ import annotations

import math
import subprocess
import tempfile
import wave
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent / "public" / "clicker"
W, H, FPS = 1920, 1080, 30
SR = 44100
YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)


def cover(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGB")
    s = max(W / im.width, H / im.height)
    im = im.resize((math.ceil(im.width * s), math.ceil(im.height * s)), Image.LANCZOS)
    x, y = (im.width - W) // 2, (im.height - H) // 2
    return im.crop((x, y, x + W, y + H))


def zoom(im: Image.Image, z: float, cx: float = 0.5, cy: float = 0.5, dx: float = 0, dy: float = 0) -> np.ndarray:
    """Sub-pixel push-in on (cx, cy) as a float RGB array in 0..1."""
    ox, oy = cx * W + dx, cy * H + dy
    m = (1 / z, 0, ox - ox / z, 0, 1 / z, oy - oy / z)
    return np.asarray(im.transform((W, H), Image.AFFINE, m, resample=Image.BICUBIC), np.float32) / 255


def smooth(x: float) -> float:
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def screen(base: np.ndarray, light: np.ndarray) -> np.ndarray:
    return 1 - (1 - base) * (1 - np.clip(light, 0, 1))


def radial(cx: float, cy: float, r: float) -> np.ndarray:
    return np.exp(-(((XX - cx) ** 2 + (YY - cy) ** 2) / (r * r)))


VIGNETTE = (1 - 0.55 * np.clip(np.hypot((XX - W / 2) / (W * 0.62), (YY - H / 2) / (H * 0.7)) - 0.35, 0, 1) ** 1.6)[..., None]


def dots(xs, ys, vals, blur: float) -> np.ndarray:
    """Splat soft points (additive) into an HxW float layer."""
    layer = np.zeros((H, W), np.float32)
    xi, yi = np.round(xs).astype(int), np.round(ys).astype(int)
    ok = (xi >= 0) & (xi < W) & (yi >= 0) & (yi < H) & (vals > 0)
    np.add.at(layer, (yi[ok], xi[ok]), vals[ok])
    im = Image.fromarray(np.clip(layer * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(im, np.float32) / 255 * (blur * blur * 3)


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

class Guardian:
    """The Core Guardian sprite, standing on the arena floor, with its crack and dissolve maps."""

    def __init__(self):
        src = Image.open(ROOT / "boss" / "core_guardian.webp").convert("RGBA")
        box = src.getchannel("A").getbbox()
        core = ((0.482 * src.width - box[0]) / (box[2] - box[0]), (0.378 * src.height - box[1]) / (box[3] - box[1]))
        src = src.crop(box)
        self.h = int(H * 0.9)
        self.w = round(src.width * self.h / src.height)
        self.img = src.resize((self.w, self.h), Image.LANCZOS)
        self.x0, self.y0 = (W - self.w) / 2, H * 1.01 - self.h
        self.core = (self.x0 + core[0] * self.w, self.y0 + core[1] * self.h)
        rng = np.random.default_rng(5)
        # Branching cracks out of the chest core, drawn in four waves (one per hit).
        self.cracks = []
        cx, cy = core[0] * self.w, core[1] * self.h
        for wave_i in range(4):
            layer = Image.new("L", (self.w, self.h), 0)
            d = ImageDraw.Draw(layer)
            for _ in range(5 + wave_i * 3):
                x, y = cx, cy
                ang = rng.uniform(0, 2 * math.pi)
                width = 7 - wave_i
                for _ in range(rng.integers(6, 12 + wave_i * 4)):
                    ang += rng.normal(0, 0.45)
                    step = rng.uniform(18, 46)
                    nx, ny = x + math.cos(ang) * step, y + math.sin(ang) * step * 1.15
                    d.line([x, y, nx, ny], fill=255, width=max(2, round(width)))
                    x, y = nx, ny
                    width = max(2, width - 0.4)
            sharp = np.asarray(layer, np.float32) / 255
            soft = np.asarray(layer.filter(ImageFilter.GaussianBlur(9)), np.float32) / 255
            self.cracks.append(np.clip(sharp + soft * 2.2, 0, 1.6))
        # Dissolve order: noisy, burning from the top of the body downward.
        n = rng.random((self.h // 16 + 2, self.w // 16 + 2)).astype(np.float32)
        n = np.asarray(Image.fromarray((n * 255).astype(np.uint8)).resize((self.w, self.h), Image.BICUBIC), np.float32) / 255
        fine = rng.random((self.h // 4 + 2, self.w // 4 + 2)).astype(np.float32)
        fine = np.asarray(Image.fromarray((fine * 255).astype(np.uint8)).resize((self.w, self.h), Image.BICUBIC), np.float32) / 255
        yn = np.linspace(0, 1, self.h, dtype=np.float32)[:, None]
        self.order = 0.5 * n + 0.15 * fine + 0.35 * yn
        a = np.asarray(self.img.getchannel("A"), np.float32) / 255
        ys, xs = np.nonzero(a > 0.6)
        pick = rng.choice(len(xs), 900, replace=False)
        self.ember_xy = np.stack([xs[pick], ys[pick]], 1).astype(np.float32)
        self.ember_t = self.order[ys[pick], xs[pick]]
        self.ember_v = np.stack([rng.normal(0, 40, 900), -rng.uniform(90, 260, 900)], 1).astype(np.float32)
        self.ember_b = rng.uniform(0.5, 1.0, 900).astype(np.float32)

    def layer(self, crack: float, burn: float, rim_heat: float, sink: float, tilt: float, dx: float, dy: float):
        """RGBA float layer for the full frame, plus its emissive (glow) channel."""
        rgba = np.asarray(self.img, np.float32) / 255
        rgb, a = rgba[..., :3], rgba[..., 3]
        emit = np.zeros(a.shape, np.float32)
        for k, c in enumerate(self.cracks):
            emit += c * float(np.clip(crack - k, 0, 1)) * 0.7
        if burn > 0:
            thr = burn * 1.12 - 0.06
            keep = np.clip((self.order - thr) / 0.035, 0, 1)
            rim = np.exp(-(((self.order - thr) / 0.035) ** 2)) * (keep > 0)
            emit += rim * 1.8 * rim_heat
            a = a * keep
        heat = np.clip(emit, 0, 1.6)[..., None]
        rgb = rgb * (1 - 0.25 * min(1.0, crack / 4)) + heat * np.array([1.0, 0.55, 0.18], np.float32)
        out = np.concatenate([np.clip(rgb, 0, 1), a[..., None], np.clip(heat, 0, 1)], 2)
        im = Image.fromarray((out[..., :4] * 255).astype(np.uint8), "RGBA")
        gl = Image.fromarray((out[..., 4] * 255).astype(np.uint8), "L")
        # Pivot at the feet: tilt and sink as one.
        pivot = (self.w / 2, self.h)
        im = im.rotate(tilt, resample=Image.BICUBIC, center=pivot)
        gl = gl.rotate(tilt, resample=Image.BICUBIC, center=pivot)
        frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        glow = Image.new("L", (W, H), 0)
        pos = (int(round(self.x0 + dx)), int(round(self.y0 + sink + dy)))
        frame.paste(im, pos, im)
        glow.paste(gl, pos)
        f = np.asarray(frame, np.float32) / 255
        g = np.asarray(glow.filter(ImageFilter.GaussianBlur(14)), np.float32) / 255
        return f[..., :3], f[..., 3:], g


def scene_fall(i: int, n: int, bg: Image.Image, guard: Guardian) -> np.ndarray:
    t = i / FPS
    hits = (0.3, 1.4, 2.3, 3.0)
    since = [t - k for k in hits if t >= k]
    last = min(since) if since else 9.0
    shake = (18 * math.exp(-last * 5) if t < 4.8 else 0) + 4 * smooth((t - 2.5) / 1.5) * (1 - smooth((t - 4.6) / 0.8))
    sx, sy = math.sin(t * 47) * shake, math.cos(t * 39) * shake * 0.7
    z = 1.06 + 0.05 * smooth(t / 6.5)
    core_x, core_y = guard.core
    base = zoom(bg, z, core_x / W, core_y / H, sx * 0.6, sy * 0.6) * 0.82

    crack = sum(smooth((t - k) / 0.18) for k in hits)
    burn = smooth((t - 3.3) / 1.7)
    sink = max(0.0, t - 2.4) ** 2 * 26
    tilt = -7 * smooth((t - 2.5) / 2.2) + 1.2 * math.sin(t * 9) * smooth((t - 2.4) / 0.4) * (1 - burn)
    rgb, a, glow = guard.layer(crack, burn, 1.0, sink, tilt, sx, sy)
    f = base * (1 - a) + rgb * a

    # Core light: pulses with each hit, then swells as the body burns away.
    pulse = sum(math.exp(-(t - k) * 4) for k in hits if t >= k)
    swell = smooth((t - 3.2) / 2.6)
    cx, cy = core_x + sx, core_y + sink * 0.3 + sy
    light = radial(cx, cy, 120 + 60 * pulse + 1300 * swell)[..., None] * (0.35 + 0.35 * pulse + 0.9 * swell)
    f = screen(f, light * np.array([1.0, 0.62, 0.28], np.float32))
    f = screen(f, glow[..., None] * np.array([1.0, 0.5, 0.15], np.float32) * 0.9)

    # Embers shed as the body burns.
    if burn > 0:
        thr = burn * 1.12 - 0.06
        age = np.where(guard.ember_t < thr, (thr - guard.ember_t) * 1.7 / 1.12 * 1.0, -1)
        alive = (age >= 0) & (age < 1.6)
        px = guard.x0 + guard.ember_xy[:, 0] + guard.ember_v[:, 0] * age + sx
        py = guard.y0 + sink + guard.ember_xy[:, 1] + guard.ember_v[:, 1] * age - 30 * age * age + sy
        v = np.where(alive, guard.ember_b * (1 - age / 1.6), 0).astype(np.float32)
        e = dots(px, py, v, 2.2)
        f = screen(f, e[..., None] * np.array([1.0, 0.7, 0.3], np.float32))

    for k in hits:
        if 0 <= t - k < 0.3:
            f = screen(f, np.full_like(f, 0.42 * (1 - (t - k) / 0.3)) * np.array([1.0, 0.85, 0.65], np.float32))
    f = f * VIGNETTE
    w = smooth((t - 5.0) / 1.5)
    f = f * (1 - w) + np.array([1.0, 0.98, 0.92], np.float32) * w
    return f


class Motes:
    def __init__(self, count: int, seed: int):
        rng = np.random.default_rng(seed)
        self.p = rng.random((count, 2)).astype(np.float32) * np.array([W, H], np.float32)
        self.v = np.stack([rng.normal(0, 8, count), -rng.uniform(10, 40, count)], 1).astype(np.float32)
        self.ph = rng.uniform(0, 2 * math.pi, count).astype(np.float32)
        self.b = rng.uniform(0.3, 1.0, count).astype(np.float32)

    def at(self, t: float, cx: float, cy: float, push: float):
        pos = self.p + self.v * t
        # Drift outward from the core as the camera pushes in.
        pos = np.array([cx, cy], np.float32) + (pos - np.array([cx, cy], np.float32)) * (1 + push)
        pos[:, 0] %= W
        pos[:, 1] %= H
        tw = 0.55 + 0.45 * np.sin(self.ph + t * 2.3)
        return pos[:, 0], pos[:, 1], self.b * tw


RAY_W, RAY_H = W // 4, H // 4
RY, RX = np.mgrid[0:RAY_H, 0:RAY_W].astype(np.float32)


def rays(t: float, cx: float, cy: float, reach: float) -> np.ndarray:
    dx, dy = RX - cx / 4, RY - cy / 4
    ang = np.arctan2(dy, dx)
    r = np.hypot(dx, dy) * 4
    beams = 0.6 * (0.5 + 0.5 * np.cos(11 * (ang + 0.05 * t))) ** 6 + 0.45 * (0.5 + 0.5 * np.cos(7 * (ang - 0.032 * t) + 1.3)) ** 10
    m = beams * np.exp(-r / reach) * np.clip(r / 60, 0, 1)
    im = Image.fromarray(np.clip(m * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3)).resize((W, H), Image.BICUBIC)
    return np.asarray(im, np.float32) / 255


def scene_awaken(i: int, n: int, bg: Image.Image, motes: Motes) -> np.ndarray:
    t = i / FPS
    p = i / (n - 1)
    e = 1 - (1 - p) ** 2.2
    cx, cy = W / 2, H * 0.48
    f = zoom(bg, 1.32 - 0.3 * e, 0.5, 0.48) * (0.38 + 0.8 * smooth(p * 1.2))
    breathe = 0.5 + 0.5 * math.sin(t * 2.1)
    f = screen(f, rays(t, cx, cy, 240 + 700 * e)[..., None] * np.array([0.55, 0.85, 1.0], np.float32) * (0.2 + 0.4 * e))
    core = radial(cx, cy, 70 + 260 * e + 20 * breathe)[..., None]
    f = screen(f, core * np.array([0.7, 0.92, 1.0], np.float32) * (0.5 + 0.5 * e))
    f = screen(f, radial(cx, cy, 18 + 30 * e)[..., None] * (0.6 + 0.4 * breathe))
    mx, my, mv = motes.at(t, cx, cy, 0.25 * e)
    f = screen(f, dots(mx, my, mv * (0.4 + 0.6 * e), 1.6)[..., None] * np.array([0.75, 0.95, 1.0], np.float32))
    f = f * VIGNETTE
    f = f * smooth(t / 1.4)
    w = smooth((t - (n / FPS - 1.8)) / 1.8)
    return f * (1 - w) + w


def render(name: str, sec: float, frame_fn, audio: np.ndarray, out: Path):
    n = int(sec * FPS)
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "a.wav"
        write_wav(wav, audio)
        proc = subprocess.Popen(
            [imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
             "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", str(wav), "-c:v", "libx264", "-preset", "slow",
             "-crf", "20", "-pix_fmt", "yuv420p", "-g", str(FPS), "-c:a", "aac", "-b:a", "128k",
             "-movflags", "+faststart", "-shortest", str(out)],
            stdin=subprocess.PIPE,
        )
        for i in range(n):
            frame = np.clip(frame_fn(i, n) * 255 + 0.5, 0, 255).astype(np.uint8)
            proc.stdin.write(frame.tobytes())
        proc.stdin.close()
        proc.wait()
    print(name, out.stat().st_size // 1024, "KB")


def main():
    import sys
    which = set(sys.argv[1:]) or {"fall", "awaken"}
    (ROOT / "ending").mkdir(exist_ok=True)
    if "fall" in which:
        arena = cover(ROOT / "bg" / "region_core_heart_arena.webp")
        guard = Guardian()
        render("fall", 6.5, lambda i, n: scene_fall(i, n, arena, guard), audio_fall(6.5), ROOT / "ending" / "ending_guardian_fall.mp4")
    if "awaken" in which:
        wake = cover(ROOT / "bg" / "loading_core_awakening.webp")
        motes = Motes(320, 11)
        render("awaken", 10, lambda i, n: scene_awaken(i, n, wake, motes), audio_awaken(10), ROOT / "ending" / "ending_core_awaken.mp4")


if __name__ == "__main__":
    main()

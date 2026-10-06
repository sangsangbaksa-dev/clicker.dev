#!/usr/bin/env python3
"""Mine entry cinematic v19, rendered from the game's own stills so both cuts are seamless.

Frame 0 is the hub gate still (mine_entrance_hub_closed_door_v2.webp) exactly as the hub shows it;
the camera creeps forward, the trim lights pulse twice, steam vents from the door's foot and the seam
lights up; the door cracks open along its seam (x=640) with another breath of steam, holds a beat,
then both halves (with visible thickness) slide slowly behind the frame. The doorway's edges sit in the
frame's shadow, the chamber behind powers up as it opens, and its light blooms through the gap, pools
on the floor and catches the dust in the air. Only when the doorway is mostly open does the camera glide through
the opening and the last frame is the mine plate (mine_interior_mineral_ore_v2.webp) exactly as the
timed mine shows it, with the same crystal the player strikes. Audio: the first seconds of v12's
soundtrack (door unlock + slide + whoosh) plus a steam hiss and a low thud at the crack, 10 s like the
original door walk; steady camera. `PREVIEW=t1,t2 ...` writes stills instead of the video.
Each rebirth has its own gate (see GATES); the same cinematic is rendered for every one.

    python3 scripts/clicker-mine-enter.py [gate ...]
"""
from __future__ import annotations

import math
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
MINE = ROOT / "public" / "clicker" / "mine"
GATE = MINE / "mine_entrance_hub_closed_door_v2.webp"
PLATE = MINE / "mine_interior_mineral_ore_v2.webp"
AUDIO_SRC = MINE / "mine_enter_door_walk_v12.mp4"
OUT = MINE / "mine_enter_door_walk_v19.mp4"

SRC_W, SRC_H = 1280, 720
W, H, FPS = 1920, 1080, 24
K = W / SRC_W  # source px → output px

# Door panel (inside the frame) in source px; seam at x=640.
DOOR = [(535, 175), (745, 175), (835, 310), (835, 440), (750, 580), (530, 580), (445, 440), (445, 310)]
SEAM_X = 640
DOOR_C = (640, 377)

# One gate per rebirth (index = rebirth count mod 8). Gate 0 is the original hub gate; the
# others are Canva art (public/clicker/mine/gates/gate_N.webp) with their door traced by hand
# in 1280x720 source px. Each renders its own entry cinematic onto the same mine plate.
GATES: dict[int, tuple[Path, list[tuple[int, int]], Path]] = {
    0: (GATE, DOOR, OUT),
    1: (MINE / "gates" / "gate_1.webp", [(530, 222), (730, 222), (800, 295), (800, 455), (735, 525), (525, 525), (458, 455), (458, 295)], MINE / "gates" / "enter_1_v2.mp4"),
    2: (MINE / "gates" / "gate_2.webp", [(510, 135), (770, 135), (850, 215), (850, 520), (760, 612), (520, 612), (430, 520), (430, 215)], MINE / "gates" / "enter_2_v2.mp4"),
    3: (MINE / "gates" / "gate_3.webp", [(525, 78), (755, 78), (870, 190), (870, 470), (775, 575), (505, 575), (410, 470), (410, 190)], MINE / "gates" / "enter_3_v2.mp4"),
    4: (MINE / "gates" / "gate_4.webp", [(530, 120), (750, 120), (825, 200), (825, 450), (740, 530), (540, 530), (455, 450), (455, 200)], MINE / "gates" / "enter_4_v2.mp4"),
    5: (MINE / "gates" / "gate_5.webp", [(535, 108), (745, 108), (850, 215), (850, 480), (750, 585), (530, 585), (430, 480), (430, 215)], MINE / "gates" / "enter_5_v2.mp4"),
    6: (MINE / "gates" / "gate_6.webp", [(535, 140), (745, 140), (825, 215), (825, 455), (745, 525), (535, 525), (455, 455), (455, 215)], MINE / "gates" / "enter_6_v2.mp4"),
    7: (MINE / "gates" / "gate_7.webp", [(530, 140), (750, 140), (850, 250), (855, 540), (425, 540), (430, 250)], MINE / "gates" / "enter_7_v2.mp4"),
}


def use_gate(idx: int) -> None:
    """Point the renderer at gate `idx`: its plate, door outline (seam at its centre) and output."""
    global GATE, DOOR, OUT, SEAM_X, DOOR_C, DOOR_TOP, DOOR_BOT, DOOR_L, DOOR_R, GATE_ZOOM_END
    GATE, DOOR, OUT = GATES[idx]
    xs, ys = [x for x, _ in DOOR], [y for _, y in DOOR]
    DOOR_L, DOOR_R, DOOR_TOP, DOOR_BOT = min(xs), max(xs), min(ys), max(ys)
    SEAM_X = 640
    DOOR_C = (640, (DOOR_TOP + DOOR_BOT) / 2)
    # The push ends with the doorway filling the frame whatever the door's size.
    GATE_ZOOM_END = 3.8 * 390 / (DOOR_R - DOOR_L)


DOOR_TOP, DOOR_BOT, DOOR_L, DOOR_R = 175, 580, 445, 835

# Timeline (s). No frozen tail: the push decelerates right into the last frame.
HOLD, UNLOCK, OPEN = 0.5, 1.1, 2.9
T_UNLOCK = HOLD
T_OPEN = T_UNLOCK + UNLOCK
T_PUSH = T_OPEN + OPEN * 0.45  # the push starts while the halves are still sliding
DURATION = 10.0
T_END = DURATION - 1 / 24
# Opening: a quick crack to CRACK of the travel, a held beat, then the long slide.
CRACK, CRACK_S, CRACK_HOLD = 0.07, 0.18, 0.3
# Camera kicks (time, amplitude px): the unlock clunk and the crack.
SHAKES = [(T_UNLOCK + 0.05, 4.0), (T_OPEN, 9.0)]
SUBFRAMES = 4  # motion blur while the camera is moving fast

INTERIOR_START = 0.84  # plate scale seen through the closed door: the real chamber fills the doorway, no fake surround
GATE_ZOOM_END = 3.8


def ease(t: float) -> float:
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def ease_in_out_cubic(t: float) -> float:
    t = min(1.0, max(0.0, t))
    return 4 * t * t * t if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


def push_curve(u: float) -> float:
    """Slow start, confident middle, long deceleration that lands exactly on 1 at the last frame."""
    u = min(1.0, max(0.0, u))
    a, k = 0.35, 2.2  # share of the push spent accelerating; deceleration exponent
    start = k * a / (2 + (k - 2) * a)  # value at u=a where both pieces meet with equal slope
    if u < a:
        return start * (u / a) ** 2
    return start + (1 - start) * (1 - (1 - (u - a) / (1 - a)) ** k)


def shake(t: float) -> tuple[float, float]:
    x = y = 0.0
    for t0, amp in SHAKES:
        d = t - t0
        if 0 <= d < 0.6:
            k = amp * math.exp(-d * 7)
            x += k * math.sin(d * 71)
            y += k * math.cos(d * 53) * 0.8
    return x, y


def door_open(t: float) -> float:
    """Share of the slide travelled `t` seconds after the opening starts."""
    if t <= 0:
        return 0.0
    if t < CRACK_S:
        return CRACK * (1 - (1 - t / CRACK_S) ** 3)
    if t < CRACK_S + CRACK_HOLD:
        return CRACK
    return CRACK + (1 - CRACK) * ease_in_out_cubic((t - CRACK_S - CRACK_HOLD) / (OPEN - CRACK_S - CRACK_HOLD))


def load(path: Path) -> Image.Image:
    return Image.open(path).convert("RGB").resize((W, H), Image.LANCZOS)


def door_mask(side: str = "both") -> Image.Image:
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    d.polygon([(x * K, y * K) for x, y in DOOR], fill=255)
    if side != "both":
        half = Image.new("L", (W, H), 0)
        hd = ImageDraw.Draw(half)
        if side == "left":
            hd.rectangle([0, 0, SEAM_X * K, H], fill=255)
        else:
            hd.rectangle([SEAM_X * K, 0, W, H], fill=255)
        m = Image.fromarray(np.minimum(np.asarray(m), np.asarray(half)))
    return m


def extended_interior(plate: Image.Image, pad: int = 3) -> tuple[Image.Image, float, float]:
    """The plate in the middle of a canvas `pad`× its size, the rest filled with a mirrored,
    blurred, darkened continuation of the chamber, so a far-away plate never shows black edges."""
    pw, ph = plate.size
    tile = np.asarray(plate)
    row = np.concatenate([tile[:, ::-1], tile, tile[:, ::-1]], axis=1)
    grid = np.concatenate([row[::-1], row, row[::-1]], axis=0)
    big = Image.fromarray(grid).filter(ImageFilter.GaussianBlur(18))
    yy, xx = np.mgrid[0 : big.height, 0 : big.width].astype(np.float32)
    # Distance outside the central plate, normalised; fade to near-black with depth.
    dx = np.maximum(0, np.abs(xx - big.width / 2) - pw / 2) / pw
    dy = np.maximum(0, np.abs(yy - big.height / 2) - ph / 2) / ph
    shade = np.clip(1 - 1.4 * np.sqrt(dx * dx + dy * dy), 0.12, 1)[..., None] * 0.55
    out = (np.asarray(big).astype(np.float32) * shade).astype(np.uint8)
    canvas = Image.fromarray(out)
    # Feather the real plate into its surroundings.
    mask = Image.new("L", (pw, ph), 0)
    ImageDraw.Draw(mask).rectangle([24, 24, pw - 24, ph - 24], fill=255)
    canvas.paste(plate, (pw, ph), mask.filter(ImageFilter.GaussianBlur(14)))
    return canvas, canvas.width / 2, canvas.height / 2


def zoom_about(im: Image.Image, z: float, cx: float, cy: float, tx: float, ty: float) -> Image.Image:
    """Scale `im` by z about (cx, cy) and place that point at (tx, ty)."""
    # Inverse affine: output (x, y) → input ((x - tx) / z + cx, (y - ty) / z + cy)
    a, b, c = 1 / z, 0, cx - tx / z
    d, e, f = 0, 1 / z, cy - ty / z
    return im.transform((W, H), Image.AFFINE, (a, b, c, d, e, f), resample=Image.BICUBIC)


def blur(a: np.ndarray, r: float) -> np.ndarray:
    """Gaussian blur of a 0..1 float map (via PIL, 8-bit is plenty for light and shadow)."""
    im = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))
    return np.asarray(im).astype(np.float32) / 255


def zoom_blur(mask: np.ndarray, cx: float, cy: float, reach: float, steps: int = 14) -> np.ndarray:
    """Light streaming out of `mask` away from (cx, cy): the mask averaged over growing scales
    (worked at quarter resolution — the beams are soft anyway)."""
    q = 4
    small = Image.fromarray(np.clip(mask * 255, 0, 255).astype(np.uint8)).resize((W // q, H // q), Image.BILINEAR)
    acc = np.zeros((H // q, W // q), np.float32)
    for k in range(steps):
        s = 1 + reach * k / (steps - 1)
        m = (1 / s, 0, cx / q - cx / q / s, 0, 1 / s, cy / q - cy / q / s)
        acc += np.asarray(small.transform(small.size, Image.AFFINE, m, resample=Image.BILINEAR), np.float32) * (1 - 0.5 * k / steps)
    acc /= steps * 255
    up = Image.fromarray(np.clip(acc * 255, 0, 255).astype(np.uint8)).resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(3))
    return np.asarray(up).astype(np.float32) / 255


def splat(xs: np.ndarray, ys: np.ndarray, vals: np.ndarray, r: float) -> np.ndarray:
    layer = np.zeros((H, W), np.float32)
    xi, yi = np.round(xs).astype(int), np.round(ys).astype(int)
    ok = (xi >= 0) & (xi < W) & (yi >= 0) & (yi < H) & (vals > 0)
    np.add.at(layer, (yi[ok], xi[ok]), vals[ok])
    return blur(np.clip(layer, 0, 1), r) * (r * r * 4)


def soundtrack(path: Path) -> None:
    """v12's door audio plus a pressure-release hiss at the unlock and a low thud at the crack."""
    import soundfile as sf

    x, sr = sf.read(str(path))
    if x.ndim > 1:
        x = x.mean(axis=1)
    rng = np.random.default_rng(4)

    def band(noise: np.ndarray, lo: float, hi: float) -> np.ndarray:
        f = np.fft.rfft(noise)
        fr = np.fft.rfftfreq(len(noise), 1 / sr)
        f[(fr < lo) | (fr > hi)] = 0
        return np.fft.irfft(f, len(noise))

    def add(at: float, y: np.ndarray, gain: float) -> None:
        i = int(at * sr)
        n = min(len(y), len(x) - i)
        if n > 0:
            x[i : i + n] += y[:n] * gain

    for at, dur, gain in ((T_UNLOCK + 0.15, 1.6, 0.16), (T_OPEN - 0.02, 1.1, 0.12)):
        n = int(dur * sr)
        t = np.arange(n) / sr
        hiss = band(rng.standard_normal(n), 1800, 9000)
        hiss *= np.minimum(1, t / 0.03) * np.exp(-t * 2.6)
        add(at, hiss / (np.abs(hiss).max() + 1e-6), gain)
    n = int(1.4 * sr)
    t = np.arange(n) / sr
    thud = np.sin(2 * np.pi * np.cumsum(38 + 40 * np.exp(-t * 9)) / sr) * np.exp(-t * 3.2)
    add(T_OPEN, thud, 0.32)
    x /= max(1.0, np.abs(x).max() / 0.95)
    sf.write(str(path), x, sr)


def main() -> None:
    gate = load(GATE)
    plate = load(PLATE)
    interior_src, icx, icy = extended_interior(plate)
    full_door = door_mask()
    left_mask = door_mask(side="left")
    right_mask = door_mask(side="right")
    g = np.asarray(gate).astype(np.int16)
    # The gate's own lights: bright, saturated pixels (cyan trim, amber runes, red lamps, ...).
    gf = g.astype(np.float32)
    mx, mn = gf.max(axis=2), gf.min(axis=2)
    cyan = ((mx > 120) & ((mx - mn) / np.maximum(mx, 1) > 0.45)).astype(np.float32)
    cyan_glow = blur(cyan, 10)
    # Light colour (0..1 per channel, brightest channel = 1) for flare, seam, rim and beams.
    tint = gf[cyan > 0].mean(axis=0) if cyan.sum() > 50 else np.array([90.0, 210.0, 230.0])
    tint = (tint / tint.max()).astype(np.float32)
    # The mine's own light is cyan whatever the gate: that is what streams out of the doorway.
    mine_light = np.array([0.45, 0.9, 1.0], np.float32)
    frame_only = gate.copy()
    left_panel = Image.new("RGBA", (W, H))
    left_panel.paste(gate, (0, 0), left_mask)
    right_panel = Image.new("RGBA", (W, H))
    right_panel.paste(gate, (0, 0), right_mask)
    door_w = (DOOR_R - DOOR_L) * K
    door_np = np.asarray(full_door).astype(np.float32) / 255
    # Doorway depth: the frame's thickness shades the opening's edges (ambient occlusion).
    ao = np.clip((blur(door_np, 26 * K) - 0.5) / 0.5, 0, 1) ** 0.8
    inner_shadow = (1 - ao) * door_np
    # Floor in front of the door, where the spilled light pools.
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    floor_y = DOOR_BOT * K
    rng = np.random.default_rng(9)
    # Steam puffs (gate space): vents at the door's foot and along the seam.
    noise = blur(rng.random((H // 4, W // 4)).astype(np.float32), 3)
    noise = np.asarray(Image.fromarray((noise * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)).astype(np.float32) / 255
    noise = np.clip((noise - noise.mean()) * 3 + 0.5, 0, 1)
    puffs = []
    for side in (-1, 1):
        for k in range(4):
            puffs.append((T_UNLOCK + 0.12 + 0.06 * k, (SEAM_X + side * (DOOR_R - DOOR_L) * 0.46) * K, floor_y - 6 * K,
                          side * rng.uniform(70, 170), -rng.uniform(30, 90), rng.uniform(18, 34) * K, 1.0))
    for k in range(6):
        puffs.append((T_OPEN + 0.03 * k, SEAM_X * K, (DOOR_TOP + (DOOR_BOT - DOOR_TOP) * (k + 0.5) / 6) * K,
                      rng.choice([-1, 1]) * rng.uniform(20, 60), rng.uniform(-20, 5), rng.uniform(14, 26) * K, 0.6))
    # Dust motes hanging in front of the door, lit only by the beams.
    motes_n = 260
    motes = np.stack([rng.uniform(DOOR_L * K - 300, DOOR_R * K + 300, motes_n), rng.uniform(DOOR_TOP * K - 150, floor_y + 120, motes_n)], 1)
    motes_v = np.stack([rng.normal(0, 6, motes_n), rng.uniform(-14, -3, motes_n)], 1)
    motes_ph = rng.uniform(0, 6.3, motes_n)
    motes_b = rng.uniform(0.35, 1.0, motes_n)

    n = int(round(DURATION * FPS))
    dcx, dcy = DOOR_C[0] * K, DOOR_C[1] * K
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "a.wav"
        subprocess.run(
            [FFMPEG, "-y", "-loglevel", "error", "-i", str(AUDIO_SRC), "-t", f"{DURATION:.2f}",
             "-af", f"afade=t=out:st={DURATION - 0.6:.2f}:d=0.6", "-ac", "1", "-ar", "44100", str(wav)],
            check=True,
        )
        soundtrack(wav)
        proc = subprocess.Popen(
            [FFMPEG, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
             "-i", "-", "-i", str(wav), "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p",
             "-g", str(FPS), "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-shortest", str(OUT)],
            stdin=subprocess.PIPE,
        )

        def render(t: float) -> np.ndarray:
            # Camera: push from the hub framing into the doorway; the door centre drifts to screen centre.
            p = push_curve((t - T_PUSH) / (T_END - T_PUSH))
            # A slow creep toward the door before the push, so the shot is always moving forward.
            creep = 1 + 0.1 * ease(t / T_PUSH) * (1 - p)
            z = creep * GATE_ZOOM_END ** p
            sx, sy = shake(t)
            tx, ty = dcx + (W / 2 - dcx) * p + sx * (1 - p), dcy + (H / 2 - dcy) * p + sy * (1 - p)
            # Interior is deeper than the gate, so it grows slower (parallax) and ends exactly full-frame.
            k_int = INTERIOR_START ** (1 - p)
            interior = plate if p >= 1 else zoom_about(interior_src, k_int, icx, icy, tx, ty)
            open_t = door_open(t - T_OPEN)
            slide = open_t * door_w * 0.52
            # The chamber powers up as the door opens: dim and cold behind the seam, full light at the end.
            power = 0.5 + 0.5 * ease(open_t * 1.15 + 0.6 * p)
            base = np.asarray(interior).astype(np.float32) * power
            # Panels slide apart inside the door opening (they disappear behind the frame).
            panels = Image.new("RGBA", (W, H))
            panels.alpha_composite(left_panel.transform((W, H), Image.AFFINE, (1, 0, slide, 0, 1, 0)))
            panels.alpha_composite(right_panel.transform((W, H), Image.AFFINE, (1, 0, -slide, 0, 1, 0)))
            pa = np.asarray(panels).astype(np.float32)
            if open_t > 0:
                # Door thickness: each half shows its dark inner side face with a thin rim of light.
                x_l, x_r = int(SEAM_X * K - slide), int(SEAM_X * K + slide)
                y_top, y_bot = int(DOOR_TOP * K), int(DOOR_BOT * K)
                tw = int(min(slide * 0.35, 20 * K))
                if tw >= 2:
                    grad = np.linspace(1, 0.35, tw, dtype=np.float32)[None, :, None]
                    face = np.array([34, 38, 42], np.float32) * grad
                    pa[y_top:y_bot, x_l : x_l + tw, :3] = face
                    pa[y_top:y_bot, x_l : x_l + tw, 3] = 255
                    pa[y_top:y_bot, x_r - tw : x_r, :3] = face[:, ::-1]
                    pa[y_top:y_bot, x_r - tw : x_r, 3] = 255
                    rim = mine_light * 255 * (0.35 + 0.4 * (1 - open_t))
                    pa[y_top:y_bot, x_l + tw - 2 : x_l + tw, :3] = rim
                    pa[y_top:y_bot, x_r - tw : x_r - tw + 2, :3] = rim
                # The halves dim a little as they slide into the frame's shadow.
                pa[:, :, :3] *= 1 - 0.3 * open_t
            pa[:, :, 3] = np.minimum(pa[:, :, 3], door_np * 255)
            panel_a = pa[:, :, 3:] / 255
            gap = door_np * (1 - panel_a[:, :, 0])  # open part of the doorway (gate space)
            gate_rgb = np.asarray(frame_only).astype(np.float32)
            # Punch the doorway, put the panels back, then shade the opening's edges.
            gate_alpha_map = (1 - door_np) + panel_a[:, :, 0]
            rgb = gate_rgb * (1 - door_np[..., None]) + pa[:, :, :3] * panel_a
            shade = inner_shadow * 0.8 * (1 - 0.5 * open_t)
            rgb = rgb * (1 - shade[..., None] * gate_alpha_map[..., None])
            alpha = np.clip(gate_alpha_map + shade * (1 - gate_alpha_map), 0, 1)
            # Unlock: trim lights flare, then a bright seam line before the split.
            u = ease((t - T_UNLOCK) / UNLOCK) * (1 - ease((t - T_OPEN - 0.6) / 0.8))
            if T_UNLOCK <= t < T_OPEN:
                u *= 0.55 + 0.45 * abs(math.sin(math.pi * 2 * (t - T_UNLOCK) / UNLOCK))
            if u > 0:
                flare = cyan_glow * (70 * u) + cyan * (60 * u)
                rgb += flare[..., None] * tint
                if t < T_OPEN + 0.25:
                    seam = np.zeros((H, W), np.float32)
                    x0 = int(SEAM_X * K)
                    seam[int(DOOR_TOP * K) : int(DOOR_BOT * K), x0 - 2 : x0 + 2] = 1
                    seam = blur(seam, 6)
                    s_a = u * (1 - ease((t - T_OPEN) / 0.25))
                    rgb += (seam * 255 * s_a)[..., None] * (0.5 + 0.5 * mine_light)
            # Light from the mine streams out of the gap: beams across the gate and a pool on the floor.
            beam_strength = math.sin(math.pi * min(1.0, open_t * 0.9 + 0.1)) if open_t > 0 else 0.0
            beam_strength *= 1 - ease((p - 0.55) / 0.4)
            light = np.zeros((H, W), np.float32)
            if beam_strength > 0.01:
                # Bloom around the gap, a short fan of rays, and the pool it throws on the floor.
                light += (blur(gap, 14 * K) * 0.65 + blur(gap, 46 * K) * 0.6) * beam_strength
                light += zoom_blur(gap, dcx, floor_y, 0.28) * 0.45 * beam_strength
                half = max(slide, 4 * K)
                pool = np.exp(-(((xx - dcx) / (half * 1.4 + 30 * K)) ** 2) - (((yy - floor_y - 14 * K) / (20 * K)) ** 2))
                light += pool * (yy > floor_y - 4 * K) * 0.6 * beam_strength * min(1.0, open_t * 3)
                light *= 1 - 0.9 * gap
            # Steam bursts from the vents at the unlock and along the seam at the crack.
            steam = np.zeros((H, W), np.float32)
            for t0, px, py, vx, vy, r0, amp in puffs:
                d = t - t0
                if 0 <= d < 2.0:
                    cx_, cy_ = px + vx * K * d * (1 - d / 4.0), py + vy * K * d - 14 * K * d * d
                    r = r0 + 46 * K * d
                    a = amp * (1 - d / 2.0) ** 1.8 * min(1.0, d / 0.06)
                    steam += np.exp(-(((xx - cx_) ** 2 + (yy - cy_) ** 2) / (r * r))) * a
            if steam.max() > 0.01:
                # Wisps, not balls: the turbulence texture carves the puffs, drifting upward with time.
                wisp = np.roll(noise, -int(30 * K * t), axis=0)
                steam = np.clip(steam * wisp ** 1.8 * 1.5, 0, 1) * 0.45
            # Dust in the beams.
            if beam_strength > 0.05:
                pos = motes + motes_v * K * t
                tw_ = 0.6 + 0.4 * np.sin(motes_ph + t * 2.7)
                xi = np.clip(pos[:, 0].astype(int), 0, W - 1)
                yi = np.clip(pos[:, 1].astype(int), 0, H - 1)
                lit = light[yi, xi] * motes_b * tw_
                light += splat(pos[:, 0], pos[:, 1], np.clip(lit, 0, 1).astype(np.float32), 1.3) * 0.9
            rgb = 255 - (255 - rgb) * (1 - np.clip(light, 0, 1)[..., None] * mine_light * 0.7)
            rgb = 255 - (255 - rgb) * (1 - np.clip(steam, 0, 1)[..., None] * np.array([0.75, 0.82, 0.86], np.float32))
            alpha = np.clip(alpha + np.clip(light * 0.85 + steam, 0, 1) * (1 - alpha), 0, 1)
            gate_layer = Image.fromarray(np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8), "RGBA")
            gate_view = zoom_about(gate_layer, z, dcx, dcy, tx, ty)
            # Fade the gate out once the doorway fills the screen.
            gate_alpha = 1 - ease((p - 0.82) / 0.18)
            gv = np.asarray(gate_view).astype(np.float32)
            a = gv[:, :, 3:] / 255 * gate_alpha
            return base * (1 - a) + gv[:, :, :3] * a

        preview = os.environ.get("PREVIEW")  # "t1,t2,..." seconds: write PNG stills instead of the video
        if preview:
            proc.stdin.close()
            proc.kill()
            for tt in [float(v) for v in preview.split(",")]:
                Image.fromarray(np.clip(render(tt), 0, 255).astype(np.uint8)).save(OUT.with_name(f"{OUT.stem}_t{tt:.2f}.png"))
            return
        prev_p = 0.0
        for i in range(n):
            t = i / FPS
            p_now = push_curve((t - T_PUSH) / (T_END - T_PUSH))
            fast = abs(p_now - prev_p) > 0.004 or any(0 <= t - t0 < 0.25 for t0, _ in SHAKES)
            prev_p = p_now
            if fast and i < n - 1:
                acc = sum(render(t + (k / SUBFRAMES - 0.5) / FPS * 0.8) for k in range(SUBFRAMES)) / SUBFRAMES
            else:
                acc = render(t)
            proc.stdin.write(np.clip(acc + 0.5, 0, 255).astype(np.uint8).tobytes())
        proc.stdin.close()
        proc.wait()
    print(OUT.name, f"{OUT.stat().st_size // 1024} KB", f"{DURATION:.1f}s")


def _ffmpeg() -> str:
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return "ffmpeg"


FFMPEG = _ffmpeg()

if __name__ == "__main__":
    # python3 scripts/clicker-mine-enter.py [gate ...]   (default: every gate, 0..7)
    for idx in [int(a) for a in sys.argv[1:]] or sorted(GATES):
        use_gate(idx)
        main()

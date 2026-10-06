#!/usr/bin/env python3
"""Mine entry cinematic v18, rendered from the game's own stills so both cuts are seamless.

Frame 0 is the hub gate still (mine_entrance_hub_closed_door_v2.webp) exactly as the hub shows it;
the camera creeps forward, the trim lights pulse twice and the seam lights up; the door cracks open
along its seam (x=640), holds a beat, then both halves slide slowly behind the frame while the mine's
light spills through the widening gap. Only when the doorway is mostly open does the camera glide through
the opening and the last frame is the mine plate (mine_interior_mineral_ore_v2.webp) exactly as the
timed mine shows it, with the same crystal the player strikes. Audio: the first seconds of v12's
soundtrack (door unlock + slide + whoosh), 10 s like the original door walk; steady camera.
Each rebirth has its own gate (see GATES); the same cinematic is rendered for every one.

    python3 scripts/clicker-mine-enter.py [gate ...]
"""
from __future__ import annotations

import math
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
OUT = MINE / "mine_enter_door_walk_v18.mp4"

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
    1: (MINE / "gates" / "gate_1.webp", [(530, 222), (730, 222), (800, 295), (800, 455), (735, 525), (525, 525), (458, 455), (458, 295)], MINE / "gates" / "enter_1.mp4"),
    2: (MINE / "gates" / "gate_2.webp", [(510, 135), (770, 135), (850, 215), (850, 520), (760, 612), (520, 612), (430, 520), (430, 215)], MINE / "gates" / "enter_2.mp4"),
    3: (MINE / "gates" / "gate_3.webp", [(525, 78), (755, 78), (870, 190), (870, 470), (775, 575), (505, 575), (410, 470), (410, 190)], MINE / "gates" / "enter_3.mp4"),
    4: (MINE / "gates" / "gate_4.webp", [(530, 120), (750, 120), (825, 200), (825, 450), (740, 530), (540, 530), (455, 450), (455, 200)], MINE / "gates" / "enter_4.mp4"),
    5: (MINE / "gates" / "gate_5.webp", [(535, 108), (745, 108), (850, 215), (850, 480), (750, 585), (530, 585), (430, 480), (430, 215)], MINE / "gates" / "enter_5.mp4"),
    6: (MINE / "gates" / "gate_6.webp", [(535, 140), (745, 140), (825, 215), (825, 455), (745, 525), (535, 525), (455, 455), (455, 215)], MINE / "gates" / "enter_6.mp4"),
    7: (MINE / "gates" / "gate_7.webp", [(530, 140), (750, 140), (850, 250), (855, 540), (425, 540), (430, 250)], MINE / "gates" / "enter_7.mp4"),
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
    cyan_glow = np.asarray(Image.fromarray((cyan * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(10))).astype(np.float32) / 255
    # Light colour (0..1 per channel, brightest channel = 1) for flare, seam, bevel and spill.
    tint = gf[cyan > 0].mean(axis=0) if cyan.sum() > 50 else np.array([90.0, 210.0, 230.0])
    tint = tint / tint.max()
    # The gate with the door panel removed (frame + rock), and the two panel halves on their own.
    frame_only = gate.copy()
    left_panel = Image.new("RGBA", (W, H))
    left_panel.paste(gate, (0, 0), left_mask)
    right_panel = Image.new("RGBA", (W, H))
    right_panel.paste(gate, (0, 0), right_mask)
    door_w = (DOOR_R - DOOR_L) * K

    n = int(round(DURATION * FPS))
    dcx, dcy = DOOR_C[0] * K, DOOR_C[1] * K
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "a.wav"
        subprocess.run(
            [FFMPEG, "-y", "-loglevel", "error", "-i", str(AUDIO_SRC), "-t", f"{DURATION:.2f}",
             "-af", f"afade=t=out:st={DURATION - 0.6:.2f}:d=0.6", "-ac", "1", "-ar", "44100", str(wav)],
            check=True,
        )
        proc = subprocess.Popen(
            [FFMPEG, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
             "-i", "-", "-i", str(wav), "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p",
             "-g", str(FPS), "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-shortest", str(OUT)],
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
            base = Image.new("RGB", (W, H))
            base.paste(interior, (0, 0))
            # Light rushing through the opening gap: a cyan-white wash over the interior that
            # peaks while the doorway is half open and settles as the camera goes through.
            spill = math.sin(math.pi * min(1.0, open_t)) * (1 - p) if open_t > 0 else 0.0
            if spill > 0.01:
                ba = np.asarray(base).astype(np.float32)
                yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
                glow = np.exp(-(((xx - tx) / (W * 0.18)) ** 2 + ((yy - ty) / (H * 0.32)) ** 2))[..., None]
                ba += glow * (0.35 + 0.65 * tint) * 230 * 0.28 * spill
                base = Image.fromarray(np.clip(ba, 0, 255).astype(np.uint8))
            # Panels slide apart inside the door opening (they disappear behind the frame).
            panels = Image.new("RGBA", (W, H))
            panels.alpha_composite(left_panel.transform((W, H), Image.AFFINE, (1, 0, slide, 0, 1, 0)))
            panels.alpha_composite(right_panel.transform((W, H), Image.AFFINE, (1, 0, -slide, 0, 1, 0)))
            # Each half's inner edge catches the light as a bright bevel, and the halves dim a
            # little as they slide into the frame's shadow.
            if open_t > 0:
                pa = np.asarray(panels).astype(np.float32)
                x_l, x_r = int(SEAM_X * K - slide), int(SEAM_X * K + slide)
                bevel = int(10 * K)
                y_top, y_bot = int(DOOR_TOP * K), int(DOOR_BOT * K)
                ramp = np.linspace(0, 1, bevel, dtype=np.float32)[None, :, None]
                lit = (0.4 + 0.6 * tint) * 210
                if x_l - bevel > 0:
                    pa[y_top:y_bot, x_l - bevel : x_l, :3] += ramp * lit * (0.4 + 0.6 * (1 - open_t))
                if x_r + bevel < W:
                    pa[y_top:y_bot, x_r : x_r + bevel, :3] += ramp[:, ::-1] * lit * (0.4 + 0.6 * (1 - open_t))
                pa[:, :, :3] *= 1 - 0.3 * open_t
                panels = Image.fromarray(np.clip(pa, 0, 255).astype(np.uint8), "RGBA")
            clip = Image.fromarray(np.minimum(np.asarray(panels.getchannel("A")), np.asarray(full_door)))
            panels.putalpha(clip)
            gate_layer = frame_only.copy().convert("RGBA")
            hole = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            gate_layer.paste(hole, (0, 0), full_door)  # punch the doorway
            gate_layer.alpha_composite(panels)
            arr = np.asarray(gate_layer).astype(np.float32)
            # Unlock: trim lights flare, then a bright seam line before the split.
            u = ease((t - T_UNLOCK) / UNLOCK) * (1 - ease((t - T_OPEN - 0.6) / 0.8))
            # Two heartbeat pulses of the trim lights while it unlocks.
            if T_UNLOCK <= t < T_OPEN:
                u *= 0.55 + 0.45 * abs(math.sin(math.pi * 2 * (t - T_UNLOCK) / UNLOCK))
            if u > 0:
                flare = cyan_glow * (70 * u) + cyan * (60 * u)
                for ch in range(3):
                    arr[:, :, ch] += flare * tint[ch]
                if t < T_OPEN + 0.25:
                    seam = np.zeros((H, W), np.float32)
                    x0 = int(SEAM_X * K)
                    y_top, y_bot = int(DOOR_TOP * K), int(DOOR_BOT * K)
                    seam[y_top:y_bot, x0 - 2 : x0 + 2] = 1
                    seam = np.asarray(Image.fromarray((seam * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(np.float32) / 255
                    s_a = u * (1 - ease((t - T_OPEN) / 0.25))
                    for ch in range(3):
                        arr[:, :, ch] += seam * 255 * s_a * (0.55 + 0.45 * tint[ch])
            gate_layer = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")
            gate_view = zoom_about(gate_layer, z, dcx, dcy, tx, ty)
            # Fade the gate out once the doorway fills the screen.
            gate_alpha = 1 - ease((p - 0.82) / 0.18)
            if gate_alpha < 1:
                a = np.asarray(gate_view.getchannel("A")).astype(np.float32) * gate_alpha
                gate_view.putalpha(Image.fromarray(a.astype(np.uint8)))
            frame = base.convert("RGBA")
            frame.alpha_composite(gate_view)
            return np.asarray(frame.convert("RGB")).astype(np.float32)

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

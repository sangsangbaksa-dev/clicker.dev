#!/usr/bin/env python3
"""Mine entry cinematic v13, rendered from the game's own stills so both cuts are seamless.

Frame 0 is the hub gate still (mine_entrance_hub_closed_door_v2.webp) exactly as the hub shows it;
the door panel splits along its seam (x=640) and slides behind the frame; the camera pushes through
the opening and the last frame is the mine plate (mine_interior_mineral_ore_v2.webp) exactly as the
timed mine shows it, with the same crystal the player strikes. Audio: the first seconds of v12's
soundtrack (door unlock + slide + whoosh), faded out at the end.

    python3 scripts/clicker-mine-enter.py
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
OUT = MINE / "mine_enter_door_walk_v13.mp4"

SRC_W, SRC_H = 1280, 720
W, H, FPS = 1920, 1080, 24
K = W / SRC_W  # source px → output px

# Door panel (inside the frame) in source px; seam at x=640.
DOOR = [(535, 175), (745, 175), (835, 310), (835, 440), (750, 580), (530, 580), (445, 440), (445, 310)]
SEAM_X = 640
DOOR_C = (640, 377)

# Timeline (s)
HOLD, UNLOCK, OPEN, PUSH, SETTLE = 0.6, 0.6, 1.7, 2.3, 0.5
T_UNLOCK = HOLD
T_OPEN = T_UNLOCK + UNLOCK
T_PUSH = T_OPEN + OPEN * 0.55  # the push starts while the panels are still sliding
T_END = T_OPEN + OPEN + PUSH
DURATION = T_END + SETTLE

INTERIOR_START = 0.5  # plate scale seen through the closed door (far away)
GATE_ZOOM_END = 3.8


def ease(t: float) -> float:
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def ease_in_out_cubic(t: float) -> float:
    t = min(1.0, max(0.0, t))
    return 4 * t * t * t if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


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
    cyan = ((g[:, :, 1] > 110) & (g[:, :, 2] > 110) & (g[:, :, 0] < 90)).astype(np.float32)
    cyan_glow = np.asarray(Image.fromarray((cyan * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(10))).astype(np.float32) / 255
    # The gate with the door panel removed (frame + rock), and the two panel halves on their own.
    frame_only = gate.copy()
    left_panel = Image.new("RGBA", (W, H))
    left_panel.paste(gate, (0, 0), left_mask)
    right_panel = Image.new("RGBA", (W, H))
    right_panel.paste(gate, (0, 0), right_mask)
    door_w = (835 - 445) * K

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
        for i in range(n):
            t = i / FPS
            # Camera: push from the hub framing into the doorway; the door centre drifts to screen centre.
            p = ease_in_out_cubic((t - T_PUSH) / (T_END - T_PUSH))
            z = GATE_ZOOM_END ** p
            tx, ty = dcx + (W / 2 - dcx) * p, dcy + (H / 2 - dcy) * p
            # Interior is deeper than the gate, so it grows slower (parallax) and ends exactly full-frame.
            k_int = INTERIOR_START ** (1 - p)
            interior = plate if p >= 1 else zoom_about(interior_src, k_int, icx, icy, tx, ty)
            open_t = ease_in_out_cubic((t - T_OPEN) / OPEN)
            slide = open_t * door_w * 0.52
            base = Image.new("RGB", (W, H))
            base.paste(interior, (0, 0))
            # Panels slide apart inside the door opening (they disappear behind the frame).
            panels = Image.new("RGBA", (W, H))
            panels.alpha_composite(left_panel.transform((W, H), Image.AFFINE, (1, 0, slide, 0, 1, 0)))
            panels.alpha_composite(right_panel.transform((W, H), Image.AFFINE, (1, 0, -slide, 0, 1, 0)))
            clip = Image.fromarray(np.minimum(np.asarray(panels.getchannel("A")), np.asarray(full_door)))
            panels.putalpha(clip)
            gate_layer = frame_only.copy().convert("RGBA")
            hole = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            gate_layer.paste(hole, (0, 0), full_door)  # punch the doorway
            gate_layer.alpha_composite(panels)
            arr = np.asarray(gate_layer).astype(np.float32)
            # Unlock: trim lights flare, then a bright seam line before the split.
            u = ease((t - T_UNLOCK) / UNLOCK) * (1 - ease((t - T_OPEN - 0.6) / 0.8))
            if u > 0:
                flare = cyan_glow * (70 * u) + cyan * (60 * u)
                arr[:, :, 0] += flare * 0.35
                arr[:, :, 1] += flare
                arr[:, :, 2] += flare
                if t < T_OPEN + 0.25:
                    seam = np.zeros((H, W), np.float32)
                    x0 = int(SEAM_X * K)
                    y_top, y_bot = int(175 * K), int(580 * K)
                    seam[y_top:y_bot, x0 - 2 : x0 + 2] = 1
                    seam = np.asarray(Image.fromarray((seam * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(np.float32) / 255
                    s_a = u * (1 - ease((t - T_OPEN) / 0.25))
                    arr[:, :, 1] += seam * 255 * s_a
                    arr[:, :, 2] += seam * 255 * s_a
                    arr[:, :, 0] += seam * 160 * s_a
            gate_layer = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")
            gate_view = zoom_about(gate_layer, z, dcx, dcy, tx, ty)
            # Fade the gate out once the doorway fills the screen.
            gate_alpha = 1 - ease((p - 0.82) / 0.18)
            if gate_alpha < 1:
                a = np.asarray(gate_view.getchannel("A")).astype(np.float32) * gate_alpha
                gate_view.putalpha(Image.fromarray(a.astype(np.uint8)))
            frame = base.convert("RGBA")
            frame.alpha_composite(gate_view)
            frame = frame.convert("RGB")
            proc.stdin.write(frame.tobytes())
        proc.stdin.close()
        proc.wait()
    print(OUT.name, f"{OUT.stat().st_size // 1024} KB", f"{DURATION:.1f}s")


FFMPEG = sys.argv[1] if len(sys.argv) > 1 else "ffmpeg"

if __name__ == "__main__":
    main()

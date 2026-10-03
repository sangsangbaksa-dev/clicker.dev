#!/usr/bin/env python3
"""Mine entry cinematic v14, rendered from the game's own stills so both cuts are seamless.

A steady forward dolly like the region intros: frame 0 is the hub gate still
(mine_entrance_hub_closed_door_v2.webp) exactly as the hub shows it; the camera walks toward the
closed door, passes straight through it (the door never opens), and keeps gliding into the chamber
until the last frame is the mine plate (mine_interior_mineral_ore_v2.webp) exactly as the timed
mine shows it. Audio: v12's soundtrack, trimmed and faded.

    python3 scripts/clicker-mine-enter.py [ffmpeg]
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
OUT = MINE / "mine_enter_door_walk_v14.mp4"

SRC_W, SRC_H = 1280, 720
W, H, FPS = 1920, 1080, 24
K = W / SRC_W  # source px → output px

# Centre of the door panel in source px (seam at x=640).
DOOR_C = (640, 377)

# Timeline (s): approach the door, pass through it, glide into the chamber, settle.
APPROACH, THROUGH, GLIDE, SETTLE = 2.6, 0.5, 2.0, 0.4
T_THROUGH = APPROACH
T_GLIDE = T_THROUGH + THROUGH
DURATION = T_GLIDE + GLIDE + SETTLE

GATE_ZOOM_END = 4.2  # the door panel overfills the screen by the time we reach it
INTERIOR_START = 0.72  # chamber scale just past the door; it grows to exactly 1.0


def ease(t: float) -> float:
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def load(path: Path) -> Image.Image:
    return Image.open(path).convert("RGB").resize((W, H), Image.LANCZOS)


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
    dcx, dcy = DOOR_C[0] * K, DOOR_C[1] * K
    n = int(round(DURATION * FPS))
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "a.wav"
        subprocess.run(
            [FFMPEG, "-y", "-loglevel", "error", "-i", str(AUDIO_SRC), "-t", f"{DURATION:.2f}",
             "-af", f"afade=t=out:st={DURATION - 0.7:.2f}:d=0.7", "-ac", "1", "-ar", "44100", str(wav)],
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
            # Walk toward the door: slow start, building speed (ease-in), so it feels like moving forward.
            a = min(1.0, t / (T_THROUGH + THROUGH))
            approach = a * a * (1.6 - 0.6 * a)
            z = GATE_ZOOM_END ** approach
            # A gentle walking bob that fades as we near the door.
            bob = math.sin(t * 2 * math.pi * 1.1) * 5 * (1 - approach)
            tx, ty = dcx + (W / 2 - dcx) * approach, dcy + (H / 2 - dcy) * approach + bob
            gate_view = zoom_about(gate, z, dcx, dcy, tx, ty)
            # Inside: keeps moving forward and decelerates onto the exact mine framing.
            g = min(1.0, max(0.0, (t - T_THROUGH) / (THROUGH + GLIDE)))
            glide = 1 - (1 - g) ** 3
            k_int = INTERIOR_START ** (1 - glide)
            interior = plate if g >= 1 else zoom_about(interior_src, k_int, icx, icy, W / 2, H / 2)
            # Pass through the door: a short cross-dissolve with a soft cyan light bloom.
            mix = ease((t - T_THROUGH) / THROUGH)
            frame = Image.blend(gate_view, interior, mix) if 0 < mix < 1 else (interior if mix >= 1 else gate_view)
            bloom = math.sin(math.pi * min(1.0, max(0.0, (t - T_THROUGH + 0.15) / (THROUGH + 0.3))))
            if bloom > 0.01:
                arr = np.asarray(frame).astype(np.float32)
                arr += np.array([40, 120, 140], np.float32) * (0.32 * bloom)
                frame = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
            proc.stdin.write(frame.tobytes())
        proc.stdin.close()
        proc.wait()
    print(OUT.name, f"{OUT.stat().st_size // 1024} KB", f"{DURATION:.1f}s")


FFMPEG = sys.argv[1] if len(sys.argv) > 1 else "ffmpeg"

if __name__ == "__main__":
    main()

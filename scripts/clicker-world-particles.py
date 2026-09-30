#!/usr/bin/env python3
"""Looping particle overlays for the world still screens (transparent animated WebP).

Each world gets public/clicker/region/<id>_particles.webp: FRAMES frames that loop seamlessly
(every particle runs one full cycle per loop, fading in and out at its ends), drawn over the
world's still image with `mix-blend-mode: screen`.

Usage: python3 scripts/clicker-world-particles.py [world_id ...]   (default: every world below)
"""
import math
import random
import sys
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "public" / "clicker" / "region"
W, H = 960, 540
FRAMES = 60
FRAME_MS = 50  # 3s loop

# kind: "mote" = soft round glow; "streak" = a short line along the motion (rain / sparks).
# dx, dy: travel across one loop in canvas fractions (positive dy = down).
WORLDS = {
    "signal_relay": [
        dict(n=70, kind="mote", color=(110, 190, 255), size=(1.5, 4), dx=(-0.04, 0.04), dy=(-0.35, -0.15), twinkle=2),
        dict(n=18, kind="mote", color=(170, 235, 255), size=(3, 6), dx=(-0.02, 0.02), dy=(-0.2, -0.1), twinkle=1),
    ],
    "phase_vault": [
        dict(n=80, kind="mote", color=(90, 255, 225), size=(1.5, 3.5), dx=(-0.08, 0.08), dy=(-0.12, 0.05), twinkle=3),
        dict(n=14, kind="mote", color=(200, 255, 245), size=(3, 7), dx=(-0.04, 0.04), dy=(-0.08, 0.02), twinkle=2),
    ],
    "storm_spire": [
        dict(n=90, kind="streak", color=(150, 210, 255), size=(0.8, 1.4), dx=(-0.45, -0.3), dy=(1.6, 2.2), twinkle=0, length=26),
        dict(n=40, kind="mote", color=(120, 235, 255), size=(1.5, 3.5), dx=(-0.25, 0.1), dy=(-0.1, 0.25), twinkle=4),
    ],
    "deep_fault": [
        dict(n=90, kind="mote", color=(255, 150, 60), size=(1.5, 4), dx=(-0.08, 0.08), dy=(-0.7, -0.35), twinkle=3),
        dict(n=24, kind="streak", color=(255, 200, 110), size=(0.8, 1.4), dx=(-0.06, 0.06), dy=(-0.9, -0.6), twinkle=2, length=10),
    ],
    "core_heart": [
        dict(n=80, kind="mote", color=(255, 90, 70), size=(1.5, 4), dx=(-0.1, 0.1), dy=(-0.45, -0.2), twinkle=3),
        dict(n=30, kind="mote", color=(170, 150, 150), size=(1, 2.5), dx=(0.05, 0.2), dy=(-0.05, 0.1), twinkle=1),
    ],
}


def glow_sprite(radius: float, color: tuple[int, int, int]) -> Image.Image:
    r = max(2, int(math.ceil(radius * 3)))
    size = r * 2 + 1
    sprite = Image.new("RGBA", (size, size))
    px = sprite.load()
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - r, y - r) / (radius * 3)
            if d < 1:
                a = (1 - d) ** 2.2
                core = max(0.0, 1 - d * 3)
                px[x, y] = (
                    min(255, int(color[0] + (255 - color[0]) * core)),
                    min(255, int(color[1] + (255 - color[1]) * core)),
                    min(255, int(color[2] + (255 - color[2]) * core)),
                    int(255 * a),
                )
    return sprite


def build(world: str, rng: random.Random) -> list[Image.Image]:
    particles = []
    for layer in WORLDS[world]:
        for _ in range(layer["n"]):
            particles.append(
                dict(
                    layer=layer,
                    x=rng.random(),
                    y=rng.random(),
                    phase=rng.random(),
                    dx=rng.uniform(*layer["dx"]),
                    dy=rng.uniform(*layer["dy"]),
                    size=rng.uniform(*layer["size"]),
                    tw=rng.random() * math.tau,
                )
            )
    sprites: dict[tuple, Image.Image] = {}
    frames = []
    for f in range(FRAMES):
        t = f / FRAMES
        frame = Image.new("RGBA", (W, H))
        for p in particles:
            layer = p["layer"]
            u = (t + p["phase"]) % 1  # where this particle is in its own cycle
            x = ((p["x"] + p["dx"] * u) % 1) * W
            y = ((p["y"] + p["dy"] * u) % 1) * H
            fade = math.sin(math.pi * u)  # born and gone at the cycle seam, so the loop never pops
            twinkle = 0.65 + 0.35 * math.sin(p["tw"] + math.tau * layer["twinkle"] * t) if layer["twinkle"] else 1
            alpha = fade * twinkle
            if alpha <= 0.02:
                continue
            if layer["kind"] == "mote":
                key = (round(p["size"] * 2) / 2, layer["color"])
                sprite = sprites.get(key) or sprites.setdefault(key, glow_sprite(key[0], layer["color"]))
                s = sprite.copy()
                s.putalpha(s.getchannel("A").point(lambda v: int(v * alpha)))
                frame.alpha_composite(s, (int(x - s.width / 2), int(y - s.height / 2)))
            else:
                length = layer.get("length", 20)
                norm = math.hypot(p["dx"] * W, p["dy"] * H) or 1
                ux, uy = p["dx"] * W / norm, p["dy"] * H / norm
                key = (round(p["size"] * 2) / 2, layer["color"])
                sprite = sprites.get(key) or sprites.setdefault(key, glow_sprite(key[0], layer["color"]))
                steps = max(4, length // 2)
                for i in range(steps):
                    k = i / steps
                    s = sprite.copy()
                    s.putalpha(s.getchannel("A").point(lambda v: int(v * alpha * (1 - k) * 0.8)))
                    frame.alpha_composite(s, (int(x - ux * length * k - s.width / 2), int(y - uy * length * k - s.height / 2)))
        frames.append(frame)
    return frames


def main(worlds: list[str]) -> None:
    for world in worlds:
        rng = random.Random(world)
        frames = build(world, rng)
        path = OUT / f"{world}_particles.webp"
        frames[0].save(path, save_all=True, append_images=frames[1:], duration=FRAME_MS, loop=0, quality=80, method=4)
        print(f"wrote {path.name} ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main(sys.argv[1:] or list(WORLDS))

#!/usr/bin/env python3
"""Item art for everything the catalog adds on top of the hand-made masters.

* One procedural badge per upgrade and per skill circuit (public/clicker/upgrade, skill-node):
  the symbol comes from the item's effect, colour from its category / branch, and a seeded
  layout (rotation, orbit dots, rays, tier pips) from its id — so no two items share an image.
* New producers / potions / active skills: an existing master re-graded (hue, mirror, zoom)
  with a stamped emblem so each reads as its own object.
* Core Heart stage background: the chamber plate in a molten gold grade.

    node --experimental-strip-types /tmp/items.ts > items.json   # see README step
    python3 scripts/clicker-item-art.py items.json
"""
from __future__ import annotations

import colorsys
import hashlib
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
ROOT = Path(__file__).resolve().parent.parent / "public" / "clicker"
S = 512  # draw size; saved at 192
OUT = 192

CAT_HUE = {"CLICK": 190, "PRODUCTION": 150, "FEVER": 20, "UTILITY": 265,
           "FOCUS": 188, "AUTOMATION": 155, "RESONANCE": 262, "TRANSCENDENCE": 45}


def seed_of(key: str) -> int:
    return int(hashlib.sha1(key.encode()).hexdigest()[:8], 16)


def rgb(h: float, s: float, v: float, a: int = 255):
    r, g, b = colorsys.hsv_to_rgb((h % 360) / 360, s, v)
    return (int(r * 255), int(g * 255), int(b * 255), a)


def poly(d, pts, fill):
    d.polygon([(float(x), float(y)) for x, y in pts], fill=fill)


def rot(pts, ang, cx=S / 2, cy=S / 2):
    c, s = math.cos(ang), math.sin(ang)
    return [(cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c) for x, y in pts]


def symbol(d: ImageDraw.ImageDraw, kind: str, col, rnd: np.random.Generator):
    cx = cy = S / 2
    w = int(S * 0.035)
    a = rnd.uniform(-0.35, 0.35)
    if kind == "pick":
        poly(d, rot([(150, 190), (256, 130), (362, 190), (330, 205), (256, 170), (182, 205)], a), col)
        poly(d, rot([(244, 170), (268, 170), (280, 380), (232, 380)], a), col)
    elif kind == "gear":
        teeth = 6 + int(rnd.integers(0, 5))
        for i in range(teeth):
            t = a + i * 2 * math.pi / teeth
            poly(d, rot([(cx - 22, cy - 150), (cx + 22, cy - 150), (cx + 30, cy - 100), (cx - 30, cy - 100)], t), col)
        d.ellipse([cx - 110, cy - 110, cx + 110, cy + 110], fill=col)
        d.ellipse([cx - 45, cy - 45, cx + 45, cy + 45], fill=(0, 0, 0, 0))
    elif kind == "factory":
        base = 330
        d.rectangle([140, 230, 372, base], fill=col)
        n = 2 + int(rnd.integers(0, 3))
        for i in range(n):
            x = 150 + i * (200 / n)
            h = rnd.uniform(60, 130)
            d.rectangle([x, 230 - h, x + 34, 232], fill=col)
            d.ellipse([x - 6, 200 - h - 40, x + 40, 230 - h - 6], fill=col[:3] + (120,))
        for i in range(3):
            d.rectangle([170 + i * 62, 262, 200 + i * 62, 296], fill=(0, 0, 0, 0))
    elif kind == "target":
        for r, f in [(140, col), (108, (0, 0, 0, 0)), (78, col), (48, (0, 0, 0, 0)), (22, col)]:
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=f)
        for i in range(4):
            poly(d, rot([(cx - 9, cy - 175), (cx + 9, cy - 175), (cx + 9, cy - 120), (cx - 9, cy - 120)], a + i * math.pi / 2), col)
    elif kind == "chain":
        for i in range(3):
            ox = (i - 1) * 88
            box = rot([(cx + ox - 70, cy - 42), (cx + ox + 70, cy + 42)], 0)
            d.rounded_rectangle([box[0][0], box[0][1], box[1][0], box[1][1]], radius=40, outline=col, width=w + 6)
    elif kind == "flame":
        pts = []
        tips = 3 + int(rnd.integers(0, 3))
        for i in range(60):
            t = i / 59 * math.pi
            r = 120 + 40 * math.sin(t * tips) ** 2
            pts.append((cx - r * math.cos(t) * 0.75, cy + 90 - r * math.sin(t) * 1.25))
        pts += [(cx + 90, cy + 110), (cx - 90, cy + 110)]
        poly(d, rot(pts, a * 0.3), col)
        d.ellipse([cx - 45, cy + 10, cx + 45, cy + 105], fill=(255, 250, 220, 230))
    elif kind == "hazard":
        poly(d, rot([(cx, cy - 150), (cx + 150, cy + 120), (cx - 150, cy + 120)], a * 0.2), col)
        d.rectangle([cx - 14, cy - 60, cx + 14, cy + 40], fill=(20, 10, 0, 255))
        d.ellipse([cx - 16, cy + 60, cx + 16, cy + 92], fill=(20, 10, 0, 255))
    elif kind == "seed":
        d.ellipse([cx - 70, cy - 30, cx + 70, cy + 130], fill=col)
        poly(d, rot([(cx, cy - 20), (cx + 110, cy - 140), (cx + 20, cy - 60)], a), col)
        poly(d, rot([(cx, cy - 20), (cx - 100, cy - 120), (cx - 20, cy - 50)], a), col)
    elif kind == "time":
        poly(d, [(cx - 100, cy - 150), (cx + 100, cy - 150), (cx + 12, cy), (cx + 100, cy + 150), (cx - 100, cy + 150), (cx - 12, cy)], col)
        poly(d, [(cx - 55, cy + 130), (cx + 55, cy + 130), (cx, cy + 60)], (255, 240, 200, 230))
    elif kind == "drill":
        poly(d, rot([(cx - 70, cy - 150), (cx + 70, cy - 150), (cx, cy + 160)], a), col)
        for i in range(4):
            y = cy - 110 + i * 60
            poly(d, rot([(cx - 60 + i * 13, y), (cx + 60 - i * 13, y + 22), (cx + 60 - i * 13, y + 34), (cx - 60 + i * 13, y + 12)], a), (0, 0, 0, 0))
    elif kind == "drone":
        d.rounded_rectangle([cx - 55, cy - 40, cx + 55, cy + 40], radius=24, fill=col)
        for sx in (-1, 1):
            for sy in (-1, 1):
                x, y = cx + sx * 115, cy + sy * 95
                d.line([cx + sx * 40, cy + sy * 25, x, y], fill=col, width=w)
                d.ellipse([x - 55, y - 14, x + 55, y + 14], fill=col[:3] + (190,))
        d.ellipse([cx - 16, cy - 16, cx + 16, cy + 16], fill=(255, 60, 60, 255))
    elif kind == "echo":
        for i, r in enumerate([60, 105, 150]):
            d.arc([cx - r, cy - r, cx + r, cy + r], 200 + i * 10, 340 - i * 10, fill=col, width=w)
            d.arc([cx - r, cy - r, cx + r, cy + r], 20 + i * 10, 160 - i * 10, fill=col, width=w)
        d.ellipse([cx - 30, cy - 30, cx + 30, cy + 30], fill=col)
    elif kind == "quake":
        for i in range(3):
            y = cy - 80 + i * 80
            pts = [(80 + k * 12, y + 26 * math.sin(k * 0.9 + i)) for k in range(30)]
            d.line(pts, fill=col, width=w + 4, joint="curve")
    elif kind == "bolt":
        poly(d, rot([(cx + 30, cy - 170), (cx - 90, cy + 20), (cx - 5, cy + 20), (cx - 40, cy + 170), (cx + 95, cy - 30), (cx + 10, cy - 30)], a * 0.4), col)


def badge(key: str, kind: str, group: str, tier: int, dst: Path):
    rnd = np.random.default_rng(seed_of(key))
    hue = CAT_HUE.get(group, 200) + rnd.uniform(-22, 22)
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    # Disk with radial gradient.
    yy, xx = np.mgrid[0:S, 0:S]
    r = np.hypot(xx - S / 2, yy - S / 2) / (S * 0.46)
    base = np.array(rgb(hue, 0.75, 0.32)[:3], float)
    rim = np.array(rgb(hue + 25, 0.55, 0.85)[:3], float)
    mix = np.clip(r, 0, 1)[..., None] ** 2.2
    col = base * (1 - mix) + rim * mix
    alpha = np.clip((1 - r) * 60, 0, 1) * 255
    disk = Image.fromarray(np.dstack([col, alpha]).astype(np.uint8), "RGBA")
    im.alpha_composite(disk)
    d = ImageDraw.Draw(im)
    # Rays / sparkle ring unique per item.
    rays = 6 + int(rnd.integers(0, 10))
    off = rnd.uniform(0, math.pi)
    for i in range(rays):
        t = off + i * 2 * math.pi / rays
        r0, r1 = S * 0.33, S * (0.40 + rnd.uniform(0, 0.04))
        d.line([S / 2 + r0 * math.cos(t), S / 2 + r0 * math.sin(t), S / 2 + r1 * math.cos(t), S / 2 + r1 * math.sin(t)],
               fill=rgb(hue + 40, 0.3, 1, 110), width=6)
    dots = 1 + int(rnd.integers(0, 5))
    for i in range(dots):
        t = rnd.uniform(0, 2 * math.pi)
        rr = S * 0.28
        x, y = S / 2 + rr * math.cos(t), S / 2 + rr * math.sin(t)
        d.ellipse([x - 9, y - 9, x + 9, y + 9], fill=rgb(hue + 180, 0.5, 1, 200))
    # Seeded backdrop pattern: stripes, grid, rings or scatter.
    pat = int(rnd.integers(0, 4))
    pc = rgb(hue + rnd.uniform(-60, 60), 0.5, 0.9, 38)
    if pat == 0:
        ang = rnd.uniform(0, math.pi)
        for k in range(-8, 9):
            o = k * 34
            x0, y0 = S / 2 + o * math.cos(ang + math.pi / 2), S / 2 + o * math.sin(ang + math.pi / 2)
            d.line([x0 - 400 * math.cos(ang), y0 - 400 * math.sin(ang), x0 + 400 * math.cos(ang), y0 + 400 * math.sin(ang)], fill=pc, width=10)
    elif pat == 1:
        for k in range(40, S, 48):
            d.line([k, 0, k, S], fill=pc, width=4)
            d.line([0, k, S, k], fill=pc, width=4)
    elif pat == 2:
        for rr in range(40, 240, 36):
            d.ellipse([S / 2 - rr, S / 2 - rr, S / 2 + rr, S / 2 + rr], outline=pc, width=6)
    else:
        for _ in range(26):
            x, y = rnd.uniform(60, S - 60), rnd.uniform(60, S - 60)
            rr = rnd.uniform(5, 14)
            d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=pc)
    # Re-mask pattern to the disk.
    mask = Image.fromarray((np.clip((1 - r) * 60, 0, 1) * 255).astype(np.uint8))
    im.putalpha(Image.fromarray(np.minimum(np.asarray(im.getchannel("A")), np.asarray(mask))))
    d = ImageDraw.Draw(im)
    # Accent glyph in a seeded corner.
    acc = int(rnd.integers(0, 6))
    t = rnd.uniform(0, 2 * math.pi)
    ax, ay = S / 2 + S * 0.25 * math.cos(t), S / 2 + S * 0.25 * math.sin(t)
    ac = rgb(hue + 150 + rnd.uniform(-40, 40), 0.65, 1, 235)
    q = 26
    if acc == 0:
        poly(d, [(ax, ay - q), (ax + q * 0.35, ay - q * 0.35), (ax + q, ay), (ax + q * 0.35, ay + q * 0.35), (ax, ay + q), (ax - q * 0.35, ay + q * 0.35), (ax - q, ay), (ax - q * 0.35, ay - q * 0.35)], ac)
    elif acc == 1:
        poly(d, [(ax, ay - q), (ax + q, ay), (ax, ay + q), (ax - q, ay)], ac)
    elif acc == 2:
        poly(d, [(ax, ay - q), (ax + q, ay + q * 0.8), (ax - q, ay + q * 0.8)], ac)
    elif acc == 3:
        d.rectangle([ax - q, ay - 7, ax + q, ay + 7], fill=ac)
        d.rectangle([ax - 7, ay - q, ax + 7, ay + q], fill=ac)
    elif acc == 4:
        poly(d, [(ax + q * math.cos(k * math.pi / 3), ay + q * math.sin(k * math.pi / 3)) for k in range(6)], ac)
    else:
        d.ellipse([ax - q, ay - q, ax + q, ay + q], fill=ac)
        d.ellipse([ax - q + 12, ay - q - 4, ax + q + 8, ay + q - 10], fill=(0, 0, 0, 0))
    # Symbol with glow.
    sym = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    fg = rgb(hue + rnd.uniform(-10, 10), 0.18, 1.0)
    symbol(ImageDraw.Draw(sym), kind, fg, rnd)
    scale = rnd.uniform(0.78, 1.0)
    if scale < 0.99:
        small = sym.resize((int(S * scale), int(S * scale)), Image.LANCZOS)
        sym = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        sym.alpha_composite(small, (int((S - small.size[0]) / 2 + rnd.uniform(-18, 18)), int((S - small.size[1]) / 2 + rnd.uniform(-14, 10))))
    glow = sym.filter(ImageFilter.GaussianBlur(14))
    glow = Image.fromarray((np.asarray(glow).astype(float) * [0.4, 0.9, 1, 0.9]).clip(0, 255).astype(np.uint8), "RGBA")
    im.alpha_composite(glow)
    im.alpha_composite(sym)
    # Tier pips.
    for i in range(max(0, min(5, tier))):
        x = S / 2 + (i - (tier - 1) / 2) * 30
        d.ellipse([x - 9, S * 0.86 - 9, x + 9, S * 0.86 + 9], fill=(255, 225, 120, 255))
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.resize((OUT, OUT), Image.LANCZOS).save(dst, "WEBP", quality=84, method=6)


def regrade(src: Path, dst: Path, hue: float, mirror: bool, zoom: float, emblem: str, size: int = 256):
    from importlib import import_module

    icons = import_module("clicker-icons")
    im = Image.open(src).convert("RGB")
    w, h = im.size
    cw, ch = w / zoom, h / zoom
    im = im.crop(((w - cw) / 2, (h - ch) / 2, (w + cw) / 2, (h + ch) / 2)).resize((size, size), Image.LANCZOS)
    if mirror:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    arr = icons.hue_rotate(np.asarray(im, float) / 255, hue)
    alpha = icons.matte(arr)
    out = Image.fromarray((np.dstack([arr, alpha]) * 255).round().astype(np.uint8), "RGBA")
    stamp = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    symbol(ImageDraw.Draw(stamp), emblem, (255, 255, 255, 235), np.random.default_rng(seed_of(dst.name)))
    stamp = stamp.resize((size // 3, size // 3), Image.LANCZOS)
    ring = Image.new("RGBA", stamp.size, (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse([0, 0, stamp.size[0] - 1, stamp.size[1] - 1], fill=rgb(hue + 200, 0.7, 0.45, 230))
    ring.alpha_composite(stamp)
    out.alpha_composite(ring, (size - ring.size[0] - 6, size - ring.size[1] - 6))
    out.save(dst, "WEBP", quality=86, method=6)


DERIVED = [
    ("producer/producer_spark_coil", "producer/producer_pulse_relay", 140, True, 1.15, "bolt"),
    ("producer/producer_ion_pump", "producer/producer_core_extractor", 200, True, 1.1, "echo"),
    ("producer/producer_prism_loom", "producer/producer_flux_generator", 280, False, 1.2, "target"),
    ("producer/producer_gravity_well", "producer/producer_void_condenser", 100, True, 1.1, "quake"),
    ("producer/producer_nova_forge", "producer/producer_quantum_foundry", 320, True, 1.15, "flame"),
    ("producer/producer_aurora_reactor", "producer/producer_horizon_engine", 60, False, 1.1, "seed"),
    ("potion/potion_spark", "potion/potion_timebreak", 150, True, 1.0, "bolt"),
    ("potion/potion_keen", "potion/potion_blue", 250, False, 1.05, "target"),
    ("potion/potion_golden", "potion/potion_industrial", 40, True, 1.0, "gear"),
    ("skill/skill_laser_focus", "skill/skill_core_pulse", 120, True, 1.05, "target"),
    ("skill/skill_time_warp", "skill/skill_stabilizer", 200, False, 1.1, "time"),
    ("skill/skill_grid_boost", "skill/skill_overclock", 90, True, 1.0, "gear"),
]


def heart_background():
    src = ROOT / "bg" / "region_core_chamber.png"
    im = Image.open(src).convert("RGB")
    arr = np.asarray(im, float) / 255
    lum = arr.mean(axis=2, keepdims=True)
    gold = np.array([1.25, 0.62, 0.22])
    graded = np.clip(lum * gold * 1.25 + arr * 0.25, 0, 1)
    h, w, _ = graded.shape
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.hypot((xx - w / 2) / w, (yy - h * 0.45) / h)
    graded *= np.clip(1.25 - r * 1.6, 0.25, 1)[..., None]
    graded[..., 0] = np.clip(graded[..., 0] + np.clip(0.18 - r, 0, 1) * 1.5, 0, 1)
    out = Image.fromarray((graded * 255).astype(np.uint8))
    out = ImageEnhance.Contrast(out).enhance(1.15)
    out.save(ROOT / "bg" / "region_core_heart.jpg", "JPEG", quality=84)


def main():
    data = json.load(open(sys.argv[1]))
    for u in data["upgrades"]:
        tier = min(5, 1 + int(math.log10(max(u["cost"], 1e-3) * 1000 + 1) // 3))
        badge("u:" + u["id"], u["kind"], u["cat"], tier, ROOT / "upgrade" / f"{u['id']}.webp")
    for n in data["nodes"]:
        badge("n:" + n["id"], n["kind"], n["branch"], n["tier"], ROOT / "skill-node" / f"{n['id']}.webp")
    for dst, src, hue, mirror, zoom, emblem in DERIVED:
        regrade(ROOT / f"{src}.png", ROOT / f"{dst}.webp", hue, mirror, zoom, emblem)
    heart_background()
    print(f"{len(data['upgrades'])} upgrades · {len(data['nodes'])} circuits · {len(DERIVED)} derived")


if __name__ == "__main__":
    main()

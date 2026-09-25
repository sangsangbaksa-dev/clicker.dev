#!/usr/bin/env python3
"""Build the in-game item icons (WebP) from the square PNG masters.

The masters are 1024px RGB renders on flat black. Shown at ~56px on dark
cards, that black square reads as a pasted tile. This keys the black out
(luminance matte, kept solid near the center so dark metal survives), feathers
the edge, and writes 256px WebP next to the master.

Producers that share a master get a mirrored, hue-rotated variant so every
tier reads as its own machine.

    python3 scripts/clicker-icons.py
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / "public" / "clicker"
SIZE = 256

# (output name, master, mirror, hue degrees)
VARIANTS = {
    "producer": [
        ("producer_solar_node", "producer_solar_node", False, 0),
        ("producer_pulse_relay", "producer_core_extractor", True, 38),
        ("producer_core_extractor", "producer_core_extractor", False, 0),
        ("producer_coil_harvester", "producer_flux_generator", True, -28),
        ("producer_flux_generator", "producer_flux_generator", False, 0),
        ("producer_phase_regulator", "producer_quantum_foundry", True, 42),
        ("producer_quantum_foundry", "producer_quantum_foundry", False, 0),
        ("producer_echo_lattice", "producer_resonance_array", True, 55),
        ("producer_resonance_array", "producer_resonance_array", False, 0),
        ("producer_void_condenser", "producer_singularity_plant", True, -40),
        ("producer_singularity_plant", "producer_singularity_plant", False, 0),
        ("producer_horizon_engine", "producer_singularity_plant", False, 150),
    ],
}
PLAIN = ["potion", "skill", "buff"]


def hue_rotate(rgb: np.ndarray, degrees: float) -> np.ndarray:
    if not degrees:
        return rgb
    # Rotation about the grey axis in RGB space (keeps luminance roughly intact).
    a = np.deg2rad(degrees)
    c, s = np.cos(a), np.sin(a)
    k = 1 / 3
    sq = np.sqrt(k)
    m = np.array(
        [
            [c + (1 - c) * k, k * (1 - c) - sq * s, k * (1 - c) + sq * s],
            [k * (1 - c) + sq * s, c + k * (1 - c), k * (1 - c) - sq * s],
            [k * (1 - c) - sq * s, k * (1 - c) + sq * s, c + k * (1 - c)],
        ]
    )
    return np.clip(rgb @ m.T, 0, 1)


def matte(rgb: np.ndarray) -> np.ndarray:
    h, w, _ = rgb.shape
    lum = rgb.max(axis=2)
    # Background floor: sample the corners (renders are near-black, not pure black).
    corners = np.concatenate([lum[:24, :24].ravel(), lum[:24, -24:].ravel(), lum[-24:, :24].ravel(), lum[-24:, -24:].ravel()])
    floor = float(np.percentile(corners, 90))
    lum_a = np.clip((lum - floor - 0.008) / 0.07, 0, 1)
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.hypot((xx - w / 2) / (w / 2), (yy - h / 2) / (h / 2))
    # Solid core disc so dark metal isn't eaten; the edge fade keeps the tile corners clear.
    core = np.clip((0.34 - r) / 0.20, 0, 1)
    edge = np.clip((0.86 - r) / 0.30, 0, 1)
    return np.minimum(np.maximum(lum_a, core), edge)


def build(src: Path, dst: Path, mirror: bool, hue: float) -> None:
    im = Image.open(src).convert("RGB").resize((SIZE, SIZE), Image.LANCZOS)
    if mirror:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    rgb = np.asarray(im, dtype=np.float64) / 255
    rgb = hue_rotate(rgb, hue)
    alpha = matte(rgb)
    out = np.dstack([rgb, alpha]) * 255
    Image.fromarray(out.round().astype(np.uint8), "RGBA").save(dst, "WEBP", quality=86, method=6)


def main() -> None:
    for folder, rows in VARIANTS.items():
        for name, master, mirror, hue in rows:
            build(ROOT / folder / f"{master}.png", ROOT / folder / f"{name}.webp", mirror, hue)
    for folder in PLAIN:
        for src in sorted((ROOT / folder).glob("*.png")):
            build(src, src.with_suffix(".webp"), False, 0)
    print("icons written")


if __name__ == "__main__":
    main()

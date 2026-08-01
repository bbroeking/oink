#!/usr/bin/env python3
"""Normalize individually authored pig masters onto the game sprite canvas."""

from __future__ import annotations

from pathlib import Path
import shutil

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MASTER_DIR = ROOT / "assets" / "images" / "pigs" / "masters"
OUTPUT_DIR = ROOT / "assets" / "images" / "pigs" / "normalized"

CANVAS = 384
TARGET_HEIGHT = 354
MAX_WIDTH = 370
BASELINE = 377

SOURCES = {
    "copper": "copper.png",
    "pepper": "pepper.png",
    "pickles": "pickles.png",
}


def normalize(source_path: Path, output_path: Path) -> tuple[int, int, int]:
    image = Image.open(source_path).convert("RGBA")
    alpha = np.asarray(image)[:, :, 3]
    ys, xs = np.where(alpha > 12)
    if not len(xs):
        raise ValueError(f"{source_path} has no visible character pixels")

    crop = image.crop(
        (
            int(xs.min()),
            int(ys.min()),
            int(xs.max()) + 1,
            int(ys.max()) + 1,
        )
    )
    scale = min(TARGET_HEIGHT / crop.height, MAX_WIDTH / crop.width)
    resized = crop.resize(
        (round(crop.width * scale), round(crop.height * scale)),
        Image.Resampling.LANCZOS,
    )
    x = round((CANVAS - resized.width) / 2)
    y = BASELINE - resized.height
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.alpha_composite(resized, (x, y))
    canvas.save(output_path, optimize=True)
    return resized.width, resized.height, CANVAS - BASELINE


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    # Rosie is the immutable layout reference for the whole game. Do not crop,
    # scale, center, or regenerate her here; accessory anchors were authored
    # against this exact shipping sprite and its original non-square canvas.
    shutil.copyfile(
        ROOT / "assets" / "images" / "sprites" / "rosie" / "idle_1.png",
        OUTPUT_DIR / "rosie.png",
    )
    print("rosie: copied shipping sprite pixel-for-pixel")
    # Standalone Bandit and Biscuit concepts drifted into different body
    # shapes. Their live portraits come from the common Rosie animation rig so
    # identity is carried by coat details, not geometry.
    for pig in ("bandit", "biscuit"):
        shutil.copyfile(
            ROOT / "assets" / "images" / "sprites" / pig / "idle_1.png",
            OUTPUT_DIR / f"{pig}.png",
        )
        print(f"{pig}: copied common-rig idle portrait")
    for pig, filename in SOURCES.items():
        width, height, bottom_pad = normalize(
            MASTER_DIR / filename,
            OUTPUT_DIR / f"{pig}.png",
        )
        print(
            f"{pig}: {width}x{height} visible box, "
            f"{bottom_pad}px baseline padding"
        )


if __name__ == "__main__":
    main()

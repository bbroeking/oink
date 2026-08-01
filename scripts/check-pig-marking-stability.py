#!/usr/bin/env python3
"""Fail when identity markings are attached to interchangeable moving limbs.

Spots should follow the pig's anatomy, but a mark on a generic hand/leg anchor
can appear to jump to a different visible limb as the pose changes. Keep
identity-defining marks on the head or torso and also make sure some marking
ink remains visible in every authored frame.
"""

from __future__ import annotations

from pathlib import Path
import runpy

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SPRITES = ROOT / "assets" / "images" / "sprites"
SPOTTED_PIGS = ("pickles", "biscuit")
ANIMATIONS = ("happy", "idle", "jump", "sad", "surprise", "tired", "walk", "wave")
STABLE_ANCHORS = {"head", "body"}
MIN_VISIBLE_PIXELS = 20
MIN_ALIGNMENT_COVERAGE = 0.10


def render_contain(path: Path) -> np.ndarray:
    """Render a source frame exactly as SpritePig does in its 300px square."""
    image = Image.open(path).convert("RGBA")
    scale = min(300 / image.width, 300 / image.height)
    size = (round(image.width * scale), round(image.height * scale))
    fitted = image.resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (300, 300), (0, 0, 0, 0))
    canvas.alpha_composite(fitted, ((300 - size[0]) // 2, (300 - size[1]) // 2))
    return np.asarray(canvas)


def rendered_marking_mask(pig: str, animation: str, frame: int) -> np.ndarray:
    spotted = render_contain(SPRITES / pig / f"{animation}_{frame}.png")
    reference = render_contain(SPRITES / "copper" / f"{animation}_{frame}.png")
    spotted_luma = spotted[:, :, :3].mean(axis=2)
    reference_luma = reference[:, :, :3].mean(axis=2)
    return (
        (spotted[:, :, 3] > 128)
        & (reference[:, :, 3] > 128)
        & (spotted_luma < 105)
        & (reference_luma > 75)
        & ((reference[:, :, :3].astype(int) - spotted[:, :, :3]).mean(axis=2) > 5)
    )


def marking_pixels(pig: str, animation: str, frame: int) -> int:
    spotted = np.asarray(
        Image.open(SPRITES / pig / f"{animation}_{frame}.png").convert("RGBA")
    )
    reference = np.asarray(
        Image.open(SPRITES / "copper" / f"{animation}_{frame}.png").convert("RGBA")
    )
    spotted_luma = spotted[:, :, :3].mean(axis=2)
    reference_luma = reference[:, :, :3].mean(axis=2)
    mask = (
        (spotted[:, :, 3] > 128)
        & (reference[:, :, 3] > 128)
        & (spotted_luma < 105)
        & (reference_luma > 105)
    )
    return int(mask.sum())


def main() -> None:
    failures: list[str] = []
    generator = runpy.run_path(str(ROOT / "scripts" / "generate-pig-sprites.py"))
    layouts = generator["MAIN_SPOT_LAYOUTS"]
    coats = generator["COATS"]
    anchors = generator["MAIN_POSE_ANCHORS"]
    yy, xx = np.indices((300, 300))

    for pig in SPOTTED_PIGS:
        layout = layouts[coats[pig].marking]
        unstable = sorted({spot.anchor for spot in layout} - STABLE_ANCHORS)
        if unstable:
            failures.append(
                f"{pig}: identity markings use moving limb anchors "
                f"{', '.join(unstable)}"
            )

        for animation in ANIMATIONS:
            areas = [marking_pixels(pig, animation, frame) for frame in range(1, 5)]
            if min(areas) < MIN_VISIBLE_PIXELS:
                failures.append(
                    f"{pig}/{animation}: marking ink disappears in {areas} "
                    f"(minimum {MIN_VISIBLE_PIXELS} pixels)"
                )
            for frame_index in range(4):
                mask = rendered_marking_mask(pig, animation, frame_index + 1)
                for spot_index, spot in enumerate(layout, start=1):
                    anchor_x, anchor_y = anchors[animation][frame_index][spot.anchor]
                    center_x = anchor_x + spot.dx
                    center_y = anchor_y + spot.dy
                    expected_region = (
                        ((xx - center_x) / (spot.rx * 1.5)) ** 2
                        + ((yy - center_y) / (spot.ry * 1.5)) ** 2
                        <= 1
                    )
                    coverage = mask[expected_region].sum() / max(
                        1, expected_region.sum()
                    )
                    if coverage < MIN_ALIGNMENT_COVERAGE:
                        failures.append(
                            f"{pig}/{animation}_{frame_index + 1} spot "
                            f"{spot_index}: only {coverage:.0%} of expected "
                            "anatomical region contains marking ink"
                        )

    if failures:
        raise SystemExit("\n".join(failures))
    print("verified anatomically stable coat markings for Pickles and Biscuit")


if __name__ == "__main__":
    main()

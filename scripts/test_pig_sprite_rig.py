#!/usr/bin/env python3
"""Regression checks for the individually authored pig animation packs."""

from __future__ import annotations

from pathlib import Path
import unittest

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SPRITES = ROOT / "assets" / "images" / "sprites"
PIGS = ("copper", "pepper", "bandit", "pickles", "biscuit")


def visible_bbox(path: Path) -> tuple[int, int, int, int]:
    alpha = np.asarray(Image.open(path).convert("RGBA"))[:, :, 3]
    ys, xs = np.where(alpha > 12)
    if not len(xs):
        raise AssertionError(f"{path} has no visible pixels")
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


class PigSpriteRigTests(unittest.TestCase):
    def test_each_recruit_has_rosies_complete_frame_inventory(self) -> None:
        rosie_frames = {
            path.relative_to(SPRITES / "rosie")
            for path in (SPRITES / "rosie").rglob("*.png")
        }
        self.assertEqual(len(rosie_frames), 54)
        for pig in PIGS:
            pig_frames = {
                path.relative_to(SPRITES / pig)
                for path in (SPRITES / pig).rglob("*.png")
            }
            self.assertEqual(pig_frames, rosie_frames, pig)

    def test_every_authored_frame_uses_its_rosie_canvas(self) -> None:
        for pig in PIGS:
            for path in (SPRITES / pig).rglob("*.png"):
                relative = path.relative_to(SPRITES / pig)
                with Image.open(path) as pig_image, Image.open(
                    SPRITES / "rosie" / relative
                ) as rosie_image:
                    self.assertEqual(pig_image.size, rosie_image.size, f"{pig}/{relative}")
                    self.assertEqual(pig_image.mode, "RGBA", f"{pig}/{relative}")

    def test_authored_frames_have_clean_transparent_corners(self) -> None:
        for pig in PIGS:
            for path in (SPRITES / pig).rglob("*.png"):
                alpha = np.asarray(Image.open(path).convert("RGBA"))[:, :, 3]
                corners = (
                    alpha[0, 0],
                    alpha[0, -1],
                    alpha[-1, 0],
                    alpha[-1, -1],
                )
                self.assertFalse(any(corners), path)
                self.assertGreaterEqual(len(np.unique(alpha)), 8, path)

    def test_bandit_is_slightly_larger_than_rosie_at_rest(self) -> None:
        rosie = visible_bbox(SPRITES / "rosie" / "idle_1.png")
        bandit = visible_bbox(SPRITES / "bandit" / "idle_1.png")
        rosie_height = rosie[3] - rosie[1]
        bandit_height = bandit[3] - bandit[1]
        self.assertGreater(bandit_height, rosie_height)
        self.assertLessEqual(bandit_height / rosie_height, 1.03)


if __name__ == "__main__":
    unittest.main()

#!/usr/bin/env python3
"""Regression checks for the authored pig master canvas contract."""

from __future__ import annotations

from pathlib import Path
import unittest

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
NORMALIZED = ROOT / "assets" / "images" / "pigs" / "normalized"
ROSIE_CANONICAL = ROOT / "assets" / "images" / "sprites" / "rosie" / "idle_1.png"


class PigMasterCanvasTests(unittest.TestCase):
    def test_rosie_layout_is_pixel_identical_to_the_shipping_sprite(self) -> None:
        expected = np.asarray(Image.open(ROSIE_CANONICAL).convert("RGBA"))
        actual = np.asarray(Image.open(NORMALIZED / "rosie.png").convert("RGBA"))
        np.testing.assert_array_equal(actual, expected)

    def test_approved_recruit_masters_use_rosies_preview_canvas(self) -> None:
        with Image.open(NORMALIZED / "rosie.png") as rosie_image:
            rosie_size = rosie_image.size
        for pig_id in ("copper", "pepper", "bandit", "pickles", "biscuit"):
            path = NORMALIZED / f"{pig_id}-v2.png"
            image = Image.open(path).convert("RGBA")
            self.assertEqual(image.size, rosie_size, path.name)
            alpha = np.asarray(image)[:, :, 3]
            self.assertFalse(alpha[0, :].all(), path.name)
            self.assertFalse(alpha[-1, :].all(), path.name)

    def test_live_authored_idle_frames_use_rosies_common_canvas(self) -> None:
        rosie = np.asarray(Image.open(NORMALIZED / "rosie.png").convert("RGBA"))
        for pig_id in ("copper", "pepper", "bandit", "pickles", "biscuit"):
            pig = np.asarray(
                Image.open(
                    ROOT / "assets" / "images" / "sprites" / pig_id / "idle_1.png"
                ).convert("RGBA")
            )
            self.assertEqual(pig.shape, rosie.shape, pig_id)


if __name__ == "__main__":
    unittest.main()

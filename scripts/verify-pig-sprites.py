#!/usr/bin/env python3
"""Fast regression audit for the generated pig sprite contract."""

from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SPRITES = ROOT / "assets" / "images" / "sprites"
PIGS = ("rosie", "copper", "pepper", "bandit", "pickles", "biscuit")


def component_sizes(mask: np.ndarray) -> list[int]:
    height, width = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    sizes: list[int] = []
    for y, x in zip(*np.where(mask), strict=False):
        if seen[y, x]:
            continue
        seen[y, x] = True
        queue = deque([(int(y), int(x))])
        size = 0
        while queue:
            cy, cx = queue.popleft()
            size += 1
            for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                if (
                    0 <= ny < height
                    and 0 <= nx < width
                    and mask[ny, nx]
                    and not seen[ny, nx]
                ):
                    seen[ny, nx] = True
                    queue.append((ny, nx))
        sizes.append(size)
    return sorted(sizes, reverse=True)


def main() -> None:
    failures: list[str] = []
    checked = 0
    rosie_files = sorted((SPRITES / "rosie").rglob("*.png"))
    rosie_frames: dict[Path, tuple[int, int]] = {}
    rosie_detached_pixels: dict[Path, int] = {}
    for path in rosie_files:
        relative_path = path.relative_to(SPRITES / "rosie")
        with Image.open(path) as image:
            rosie_frames[relative_path] = image.size
            alpha = np.asarray(image.convert("RGBA"))[:, :, 3]
        sizes = component_sizes(alpha > 12)
        rosie_detached_pixels[relative_path] = sum(sizes[1:])
    for pig in PIGS:
        files = sorted((SPRITES / pig).rglob("*.png"))
        relative_files = {path.relative_to(SPRITES / pig) for path in files}
        if relative_files != set(rosie_frames):
            failures.append(
                f"{pig}: frame set differs from Rosie's canonical {len(rosie_frames)} frames"
            )
        for path in files:
            relative_path = path.relative_to(SPRITES / pig)
            with Image.open(path) as image:
                expected_size = rosie_frames.get(relative_path)
                if expected_size is not None and image.size != expected_size:
                    failures.append(
                        f"{path}: expected Rosie's {expected_size}, found {image.size}"
                    )
                if image.mode != "RGBA":
                    failures.append(f"{path}: expected RGBA export, found {image.mode}")
                alpha = np.asarray(image.convert("RGBA"))[:, :, 3]

            last_y, last_x = alpha.shape[0] - 1, alpha.shape[1] - 1
            if any(
                alpha[y, x]
                for y, x in ((0, 0), (0, last_x), (last_y, 0), (last_y, last_x))
            ):
                failures.append(f"{path}: opaque canvas corner")
            if len(np.unique(alpha)) < 8:
                failures.append(f"{path}: alpha edge is one-bit/jagged")

            sizes = component_sizes(alpha > 12)
            detached = sum(sizes[1:])
            canonical_detached = rosie_detached_pixels.get(relative_path, 0)
            if (
                pig != "rosie"
                and "surprise_" not in path.name
                and detached > canonical_detached + 12
            ):
                failures.append(
                    f"{path}: {detached} detached opaque pixels "
                    f"(Rosie has {canonical_detached})"
                )
            checked += 1

    if failures:
        raise SystemExit("\n".join(failures[:40]))
    print(f"verified {checked} clean RGBA sprites")


if __name__ == "__main__":
    main()

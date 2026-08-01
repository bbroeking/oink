#!/usr/bin/env python3
"""Extract authored 4x4 pig sheets onto Rosie's registered frame canvases."""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SHEETS = ROOT / "assets" / "concepts" / "pig-friends-v2" / "animation-sheets"
ROSIE = ROOT / "assets" / "images" / "sprites" / "rosie"
ROSIE_LOUNGE = ROSIE / "lounge"
PREVIEW_OUTPUT = ROOT / "assets" / "images" / "sprites-authored"
LIVE_OUTPUT = ROOT / "assets" / "images" / "sprites"

PIGS = ("copper", "pepper", "bandit", "pickles", "biscuit")
SHEET_ROWS = {
    "a": ("walk", "happy", "sad", "surprise"),
    "b": ("tired", "jump", "idle", "wave"),
}
SHEET_SIZE = 1256
CELL_SIZE = SHEET_SIZE // 4


def visible_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = np.asarray(image.convert("RGBA"))[:, :, 3]
    ys, xs = np.where(alpha > 12)
    if not len(xs):
        raise ValueError("frame has no visible pixels")
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def remove_detached_debris(
    image: Image.Image,
    *,
    preserve_effects: bool,
) -> Image.Image:
    rgba = np.asarray(image.convert("RGBA")).copy()
    mask = rgba[:, :, 3] > 12
    height, width = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    components: list[list[tuple[int, int]]] = []

    for start_y, start_x in zip(*np.where(mask), strict=False):
        if seen[start_y, start_x]:
            continue
        seen[start_y, start_x] = True
        queue = deque([(int(start_y), int(start_x))])
        pixels: list[tuple[int, int]] = []
        while queue:
            y, x = queue.popleft()
            pixels.append((y, x))
            for next_y, next_x in (
                (y - 1, x),
                (y + 1, x),
                (y, x - 1),
                (y, x + 1),
            ):
                if (
                    0 <= next_y < height
                    and 0 <= next_x < width
                    and mask[next_y, next_x]
                    and not seen[next_y, next_x]
                ):
                    seen[next_y, next_x] = True
                    queue.append((next_y, next_x))
        components.append(pixels)

    components.sort(key=len, reverse=True)
    keep = np.zeros_like(mask)
    for index, pixels in enumerate(components):
        if index == 0 or (preserve_effects and len(pixels) >= 20):
            ys, xs = zip(*pixels, strict=False)
            keep[np.asarray(ys), np.asarray(xs)] = True

    rgba[~keep] = 0
    return Image.fromarray(rgba, "RGBA")


def register_frame(
    generated: Image.Image,
    rosie_frame: Image.Image,
    scale_multiplier: float,
) -> Image.Image:
    generated = generated.convert("RGBA")
    generated_crop = generated.crop(visible_bbox(generated))
    left, top, right, bottom = visible_bbox(rosie_frame)

    target_width = max(1, round((right - left) * scale_multiplier))
    target_height = max(1, round((bottom - top) * scale_multiplier))
    scale = min(
        target_width / generated_crop.width,
        target_height / generated_crop.height,
    )
    resized = generated_crop.resize(
        (
            max(1, round(generated_crop.width * scale)),
            max(1, round(generated_crop.height * scale)),
        ),
        Image.Resampling.LANCZOS,
    )

    center_x = (left + right) / 2
    center_y = (top + bottom) / 2
    x = round(center_x - resized.width / 2)
    y = round(center_y - resized.height / 2)
    x = min(max(0, x), rosie_frame.width - resized.width)
    y = min(max(0, y), rosie_frame.height - resized.height)

    canvas = Image.new("RGBA", rosie_frame.size, (0, 0, 0, 0))
    canvas.alpha_composite(resized, (x, y))
    return canvas


def extract_pig(pig: str, output_root: Path) -> int:
    output = output_root / pig
    output.mkdir(parents=True, exist_ok=True)
    exported = 0
    scale_multiplier = 1.022 if pig == "bandit" else 1.0

    for half, animations in SHEET_ROWS.items():
        sheet_path = SHEETS / f"{pig}-{half}.png"
        sheet = Image.open(sheet_path).convert("RGBA").resize(
            (SHEET_SIZE, SHEET_SIZE),
            Image.Resampling.LANCZOS,
        )
        for row, animation in enumerate(animations):
            for column in range(4):
                cell = sheet.crop(
                    (
                        column * CELL_SIZE,
                        row * CELL_SIZE,
                        (column + 1) * CELL_SIZE,
                        (row + 1) * CELL_SIZE,
                    )
                )
                cell = remove_detached_debris(
                    cell,
                    preserve_effects=animation == "surprise",
                )
                frame_name = f"{animation}_{column + 1}.png"
                rosie_frame = Image.open(ROSIE / frame_name).convert("RGBA")
                registered = register_frame(cell, rosie_frame, scale_multiplier)
                registered.save(output / frame_name, optimize=True)
                exported += 1

    lounge_output = output / "lounge"
    lounge_output.mkdir(parents=True, exist_ok=True)
    walks = Image.open(SHEETS / f"{pig}-lounge-walks.png").convert("RGBA").resize(
        (SHEET_SIZE, SHEET_SIZE),
        Image.Resampling.LANCZOS,
    )
    for row, direction in enumerate(("n", "e", "s", "w")):
        for column in range(4):
            cell = walks.crop(
                (
                    column * CELL_SIZE,
                    row * CELL_SIZE,
                    (column + 1) * CELL_SIZE,
                    (row + 1) * CELL_SIZE,
                )
            )
            cell = remove_detached_debris(cell, preserve_effects=False)
            frame_name = f"walk_{direction}_{column + 1}.png"
            rosie_frame = Image.open(ROSIE_LOUNGE / frame_name).convert("RGBA")
            registered = register_frame(cell, rosie_frame, scale_multiplier)
            registered.save(lounge_output / frame_name, optimize=True)
            exported += 1

    rest = Image.open(SHEETS / f"{pig}-lounge-rest.png").convert("RGBA").resize(
        (SHEET_SIZE, SHEET_SIZE),
        Image.Resampling.LANCZOS,
    )
    for column in range(4):
        cell = rest.crop(
            (
                column * CELL_SIZE,
                0,
                (column + 1) * CELL_SIZE,
                CELL_SIZE,
            )
        )
        cell = remove_detached_debris(cell, preserve_effects=False)
        frame_name = f"idle_s_{column + 1}.png"
        rosie_frame = Image.open(ROSIE_LOUNGE / frame_name).convert("RGBA")
        registered = register_frame(cell, rosie_frame, scale_multiplier)
        registered.save(lounge_output / frame_name, optimize=True)
        exported += 1

    for column, frame_name in enumerate(("sit_e.png", "sit_w.png")):
        cell = rest.crop(
            (
                column * CELL_SIZE,
                CELL_SIZE,
                (column + 1) * CELL_SIZE,
                2 * CELL_SIZE,
            )
        )
        cell = remove_detached_debris(cell, preserve_effects=False)
        rosie_frame = Image.open(ROSIE_LOUNGE / frame_name).convert("RGBA")
        registered = register_frame(cell, rosie_frame, scale_multiplier)
        registered.save(lounge_output / frame_name, optimize=True)
        exported += 1
    return exported


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--live",
        action="store_true",
        help="replace the live recruitable-pig frame packs",
    )
    args = parser.parse_args()

    output_root = LIVE_OUTPUT if args.live else PREVIEW_OUTPUT
    total = sum(extract_pig(pig, output_root) for pig in PIGS)
    destination = "live sprites" if args.live else "preview sprites"
    print(f"exported {total} authored frames to {destination}")


if __name__ == "__main__":
    main()

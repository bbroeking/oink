#!/usr/bin/env python3
"""Release the individually authored recruitable-pig animation packs.

The approved character sheets are extracted and registered onto Rosie's exact
per-frame canvases by ``extract-authored-pig-sheets.py``. This entry point owns
the live release workflow and manifest refresh so nobody can accidentally
restore the discarded coat-filter pipeline by running the historical command.
Rosie's shipping art remains untouched.

Run from anywhere:
    python3 scripts/generate-pig-sprites.py
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
import re
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SPRITES = ROOT / "assets" / "images" / "sprites"
SOURCE = SPRITES / "_source" / "rosie"
NEUTRAL = SPRITES / "_neutral"
CONTACT_SHEET = ROOT / "output" / "pig-sprite-contact-sheet.png"
CANVAS_SIZE = 384
CANVAS_BASELINE = 376
HOME_SCALE = 0.96
LOUNGE_SCALE = 1.45
PIG_CANVAS = 300


@dataclass(frozen=True)
class Coat:
    rgb: tuple[int, int, int]
    marking: str | None = None
    blush: bool = False


@dataclass(frozen=True)
class AnchoredSpot:
    """One coat marking attached to a named point in the animation rig.

    Offsets and radii use the same 300×300 coordinate space as
    constants/hats.ts. The baked PNG is 384×384, so the complete marking moves
    with its body part before it is clipped to the pig silhouette.
    """

    anchor: str
    dx: float
    dy: float
    rx: float
    ry: float


@dataclass(frozen=True)
class LoungeSpot:
    """A small head/flank mark for views that do not yet have a limb rig."""

    anchor: str
    x: float
    y: float
    rx: float
    ry: float


COATS = {
    "rosie": Coat((247, 205, 211), blush=True),
    "copper": Coat((183, 91, 55)),
    "pepper": Coat((55, 58, 64), "points"),
    # Soft charcoal instead of near-black: dark enough to read as a black pig,
    # but light enough to retain Rosie's face and body volume on a phone.
    "bandit": Coat((58, 55, 59), "blaze"),
    "pickles": Coat((242, 190, 198), "spots_pickles"),
    # Warm baked-cookie brown: richer than the old muted tan, but still
    # distinctly golden beside Copper's rusty red.
    "biscuit": Coat((205, 151, 91), "spots_biscuit"),
}

MAIN_SPOT_LAYOUTS: dict[str, tuple[AnchoredSpot, ...]] = {
    "spots_pickles": (
        AnchoredSpot("head", 0, 10, 11, 8),
        AnchoredSpot("head", -82, 82, 11, 10),
        AnchoredSpot("body", -35, -10, 12, 10),
        AnchoredSpot("body", 35, -15, 10, 9),
    ),
    "spots_biscuit": (
        AnchoredSpot("head", -17, 11, 11, 8),
        AnchoredSpot("body", 35, -15, 12, 10),
        AnchoredSpot("body", -35, -10, 10, 9),
    ),
}

LOUNGE_SPOT_LAYOUTS: dict[str, dict[str, tuple[LoungeSpot, ...]]] = {
    "spots_pickles": {
        "south": (
            LoungeSpot("head", 0.52, 0.10, 0.035, 0.026),
            LoungeSpot("head", 0.10, 0.31, 0.040, 0.038),
            LoungeSpot("body", 0.25, 0.67, 0.044, 0.038),
        ),
        "east": (
            LoungeSpot("head", 0.76, 0.19, 0.034, 0.034),
            LoungeSpot("body", 0.55, 0.59, 0.042, 0.036),
            LoungeSpot("body", 0.34, 0.72, 0.038, 0.032),
        ),
        "west": (
            LoungeSpot("head", 0.24, 0.22, 0.034, 0.036),
            LoungeSpot("body", 0.61, 0.61, 0.042, 0.036),
            LoungeSpot("body", 0.76, 0.73, 0.038, 0.032),
        ),
        "north": (
            LoungeSpot("head", 0.50, 0.12, 0.036, 0.028),
            LoungeSpot("body", 0.34, 0.61, 0.042, 0.036),
            LoungeSpot("body", 0.69, 0.68, 0.038, 0.032),
        ),
    },
    "spots_biscuit": {
        "south": (
            LoungeSpot("head", 0.42, 0.10, 0.035, 0.026),
            LoungeSpot("body", 0.73, 0.64, 0.043, 0.037),
            LoungeSpot("body", 0.23, 0.70, 0.038, 0.032),
        ),
        "east": (
            LoungeSpot("head", 0.82, 0.35, 0.034, 0.034),
            LoungeSpot("body", 0.62, 0.54, 0.042, 0.036),
            LoungeSpot("body", 0.30, 0.69, 0.038, 0.032),
        ),
        "west": (
            LoungeSpot("head", 0.18, 0.18, 0.034, 0.034),
            LoungeSpot("body", 0.39, 0.58, 0.042, 0.036),
            LoungeSpot("body", 0.69, 0.69, 0.038, 0.032),
        ),
        "north": (
            LoungeSpot("head", 0.42, 0.13, 0.035, 0.027),
            LoungeSpot("body", 0.37, 0.61, 0.042, 0.036),
            LoungeSpot("body", 0.71, 0.60, 0.038, 0.032),
        ),
    },
}


def load_main_pose_anchors() -> dict[str, list[dict[str, tuple[float, float]]]]:
    """Read the app's canonical animation rig without duplicating its data."""
    source = (ROOT / "constants" / "hats.ts").read_text()
    start = source.index("export const PIG_FRAME_ANCHORS:")
    end = source.index("// ANCHOR_EDITOR_END", start)
    block = source[start:end]
    animation_pattern = re.compile(r"^\s*([a-z_]+): \[$")
    anchor_pattern = re.compile(
        r"([a-z_]+): \{ x: (-?\d+(?:\.\d+)?), y: (-?\d+(?:\.\d+)?) \}"
    )
    anchors: dict[str, list[dict[str, tuple[float, float]]]] = {}
    current: str | None = None
    frame: dict[str, tuple[float, float]] | None = None
    for line in block.splitlines():
        animation_match = animation_pattern.match(line)
        if animation_match:
            current = animation_match.group(1)
            anchors[current] = []
            frame = None
            continue
        if current is None:
            continue

        stripped = line.strip()
        if stripped == "],":
            current = None
            frame = None
            continue
        if stripped == "{":
            frame = {}
            continue
        if frame is None:
            continue

        frame.update(
            {
                name: (float(x), float(y))
                for name, x, y in anchor_pattern.findall(line)
            }
        )
        if stripped in {"}", "},"}:
            anchors[current].append(frame)
            frame = None
    expected = {"idle", "walk", "jump", "happy", "sad", "tired", "surprise", "wave"}
    if set(anchors) != expected or any(len(frames) != 4 for frames in anchors.values()):
        raise ValueError("Could not read the complete four-frame pig anatomy rig")
    return anchors


MAIN_POSE_ANCHORS = load_main_pose_anchors()


@lru_cache(maxsize=None)
def main_pose_projection(filename: str) -> tuple[float, float, float]:
    """Map PigStage's 300px contain coordinates into the working canvas.

    PIG_FRAME_ANCHORS are measured after React Native contains each variably
    cropped source PNG in a 300×300 square. Coat rendering temporarily moves
    that PNG onto a different 384×384 canvas, so markings must cross both
    transforms before they are painted.
    """
    source = Image.open(SOURCE / filename).convert("RGBA")
    pixels = np.asarray(source)
    body = components(pixels[:, :, 3] > 12, largest_only=True)
    ys, xs = np.where(body)
    body_center_x = (float(xs.min()) + float(xs.max()) + 1) / 2
    body_bottom = float(ys.max()) + 1

    contain_scale = min(PIG_CANVAS / source.width, PIG_CANVAS / source.height)
    contain_left = (PIG_CANVAS - source.width * contain_scale) / 2
    contain_top = (PIG_CANVAS - source.height * contain_scale) / 2
    work_left = round(CANVAS_SIZE / 2 - body_center_x * HOME_SCALE)
    work_top = round(CANVAS_BASELINE - body_bottom * HOME_SCALE)
    work_scale = HOME_SCALE / contain_scale
    return (
        work_scale,
        work_left - contain_left * work_scale,
        work_top - contain_top * work_scale,
    )


def anchored_spot_center(
    animation: str,
    frame_index: int,
    spot: AnchoredSpot,
    filename: str,
) -> tuple[float, float]:
    anchor = MAIN_POSE_ANCHORS[animation][frame_index][spot.anchor]
    scale, offset_x, offset_y = main_pose_projection(filename)
    return (
        (anchor[0] + spot.dx) * scale + offset_x,
        (anchor[1] + spot.dy) * scale + offset_y,
    )


def anchored_spots_mask(
    kind: str,
    size: tuple[int, int],
    filename: str,
) -> np.ndarray:
    stem = Path(filename).stem
    animation, frame_text = stem.rsplit("_", 1)
    frame_index = int(frame_text) - 1
    layer = Image.new("L", size, 0)
    draw = ImageDraw.Draw(layer)
    scale, _, _ = main_pose_projection(filename)
    for spot in MAIN_SPOT_LAYOUTS[kind]:
        cx, cy = anchored_spot_center(animation, frame_index, spot, filename)
        rx = spot.rx * scale
        ry = spot.ry * scale
        draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255)
    return np.asarray(layer) > 0


def main_pose_anchor(filename: str, anchor: str) -> tuple[float, float]:
    stem = Path(filename).stem
    animation, frame_text = stem.rsplit("_", 1)
    return MAIN_POSE_ANCHORS[animation][int(frame_text) - 1][anchor]


def main_mouth_region_mask(
    size: tuple[int, int],
    filename: str,
) -> np.ndarray:
    """Locate the authored mouth area from its per-frame anatomy anchor."""
    anchor_x, anchor_y = main_pose_anchor(filename, "mouth")
    scale_x = size[0] / PIG_CANVAS
    scale_y = size[1] / PIG_CANVAS
    center_x = anchor_x * scale_x
    # The rig's mouth anchor sits at the upper lip. The cavity hangs below it.
    center_y = (anchor_y + 13) * scale_y
    radius_x = 27 * scale_x
    radius_y = 19 * scale_y
    layer = Image.new("L", size, 0)
    ImageDraw.Draw(layer).ellipse(
        (
            center_x - radius_x,
            center_y - radius_y,
            center_x + radius_x,
            center_y + radius_y,
        ),
        fill=255,
    )
    return np.asarray(layer) > 0


def dark_coat_mouth_ink_mask(
    rgb: np.ndarray,
    filename: str,
) -> np.ndarray:
    """Select only the original mouth linework for a contrast recolor."""
    region = main_mouth_region_mask((rgb.shape[1], rgb.shape[0]), filename)
    return (rgb.max(axis=2) < 172) & region


def source_iris_mask(
    rgb: np.ndarray,
    filename: str,
) -> np.ndarray:
    """Select the source iris rings while preserving pupils and eye glints."""
    height, width = rgb.shape[:2]
    yy, xx = np.indices((height, width))
    scale_x = width / PIG_CANVAS
    scale_y = height / PIG_CANVAS
    region = np.zeros((height, width), dtype=bool)
    for anchor_name in ("eye_l", "eye_r"):
        anchor_x, anchor_y = main_pose_anchor(filename, anchor_name)
        dx = (xx - anchor_x * scale_x) / (19 * scale_x)
        dy = (yy - anchor_y * scale_y) / (23 * scale_y)
        distance = np.sqrt(dx * dx + dy * dy)
        # Leave the dark center intact as the pupil. The outer cutoff avoids
        # recoloring eyebrows or coat pixels beside a squinting eye.
        region |= (distance >= 0.34) & (distance <= 0.94)
    red, green, blue = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    source_iris = (
        (red > 28)
        & (red < 125)
        & (red > green * 1.10)
        & (red > blue * 1.04)
    )
    return region & source_iris


def lounge_direction(filename: str) -> str:
    stem = Path(filename).stem
    for direction, suffix in (
        ("east", "_e"),
        ("west", "_w"),
        ("north", "_n"),
        ("south", "_s"),
    ):
        if suffix in stem:
            return direction
    raise ValueError(f"Unknown Lounge pose direction: {filename}")


def lounge_spots_mask(
    kind: str,
    size: tuple[int, int],
    bounds: tuple[int, int, int, int],
    filename: str,
) -> np.ndarray:
    left, top, right, bottom = bounds
    width = right - left
    height = bottom - top
    layer = Image.new("L", size, 0)
    draw = ImageDraw.Draw(layer)
    for spot in LOUNGE_SPOT_LAYOUTS[kind][lounge_direction(filename)]:
        cx = left + spot.x * width
        cy = top + spot.y * height
        rx = spot.rx * width
        ry = spot.ry * height
        draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255)
    return np.asarray(layer) > 0


def components(
    mask: np.ndarray,
    *,
    largest_only: bool = False,
    min_area: int = 1,
    max_area: int | None = None,
    min_width: int = 1,
    min_height: int = 1,
    max_width: int | None = None,
    max_height: int | None = None,
    bounds: tuple[int, int, int, int] | None = None,
    normalized_center: tuple[float, float, float, float] | None = None,
) -> np.ndarray:
    """Select connected shapes by geometry rather than painted pixel color."""
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    accepted: list[list[tuple[int, int]]] = []
    for y in range(h):
        for x in range(w):
            if not mask[y, x] or seen[y, x]:
                continue
            seen[y, x] = True
            queue = deque([(y, x)])
            component: list[tuple[int, int]] = []
            while queue:
                cy, cx = queue.popleft()
                component.append((cy, cx))
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        queue.append((ny, nx))
            ys = [point[0] for point in component]
            xs = [point[1] for point in component]
            width = max(xs) - min(xs) + 1
            height = max(ys) - min(ys) + 1
            area = len(component)
            if area < min_area or (max_area is not None and area > max_area):
                continue
            if width < min_width or height < min_height:
                continue
            if max_width is not None and width > max_width:
                continue
            if max_height is not None and height > max_height:
                continue
            if bounds is not None and normalized_center is not None:
                left, top, right, bottom = bounds
                center_x = sum(xs) / area
                center_y = sum(ys) / area
                xn = (center_x - left) / max(1, right - left)
                yn = (center_y - top) / max(1, bottom - top)
                min_x, min_y, max_x, max_y = normalized_center
                if not (min_x <= xn <= max_x and min_y <= yn <= max_y):
                    continue
            accepted.append(component)
    if largest_only and accepted:
        accepted = [max(accepted, key=len)]
    out = np.zeros_like(mask, dtype=bool)
    for component in accepted:
        for y, x in component:
            out[y, x] = True
    return out


def morph(mask: np.ndarray, size: int, close: bool) -> np.ndarray:
    image = Image.fromarray((mask * 255).astype("uint8"))
    filters = (
        (ImageFilter.MaxFilter(size), ImageFilter.MinFilter(size))
        if close
        else (ImageFilter.MinFilter(size), ImageFilter.MaxFilter(size))
    )
    for operation in filters:
        image = image.filter(operation)
    return np.asarray(image) > 0


def fill_internal_holes(mask: np.ndarray) -> np.ndarray:
    """Fill transparent paint scratches without changing the outer silhouette."""
    h, w = mask.shape
    outside = np.zeros_like(mask, dtype=bool)
    queue: deque[tuple[int, int]] = deque()
    for x in range(w):
        if not mask[0, x]:
            outside[0, x] = True
            queue.append((0, x))
        if not mask[h - 1, x]:
            outside[h - 1, x] = True
            queue.append((h - 1, x))
    for y in range(h):
        if not mask[y, 0] and not outside[y, 0]:
            outside[y, 0] = True
            queue.append((y, 0))
        if not mask[y, w - 1] and not outside[y, w - 1]:
            outside[y, w - 1] = True
            queue.append((y, w - 1))
    while queue:
        y, x = queue.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and not mask[ny, nx] and not outside[ny, nx]:
                outside[ny, nx] = True
                queue.append((ny, nx))
    return mask | (~mask & ~outside)


def normalize_source(image: Image.Image, *, is_lounge: bool) -> Image.Image:
    """Place every pose on one canvas without changing its animation motion.

    Scale is fixed per animation family, never calculated per frame. The pig's
    largest connected silhouette is centered and grounded; pose compression
    and jump height therefore remain authored instead of being normalized away.
    """
    rgba = image.convert("RGBA")
    source = np.asarray(rgba)
    body = components(source[:, :, 3] > 12, largest_only=True)
    ys, xs = np.where(body)
    scale = LOUNGE_SCALE if is_lounge else HOME_SCALE
    body_center_x = (float(xs.min()) + float(xs.max()) + 1) / 2
    body_bottom = float(ys.max()) + 1

    resized = rgba.resize(
        (round(rgba.width * scale), round(rgba.height * scale)),
        Image.Resampling.LANCZOS,
    )
    offset_x = round(CANVAS_SIZE / 2 - body_center_x * scale)
    offset_y = round(CANVAS_BASELINE - body_bottom * scale)
    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    canvas.alpha_composite(resized, (offset_x, offset_y))
    return canvas


def restore_source_canvas(
    rendered: Image.Image,
    source: Image.Image,
    *,
    is_lounge: bool,
) -> Image.Image:
    """Undo normalize_source so a recruit matches Rosie's exact frame canvas."""
    rgba = source.convert("RGBA")
    pixels = np.asarray(rgba)
    body = components(pixels[:, :, 3] > 12, largest_only=True)
    ys, xs = np.where(body)
    scale = LOUNGE_SCALE if is_lounge else HOME_SCALE
    body_center_x = (float(xs.min()) + float(xs.max()) + 1) / 2
    body_bottom = float(ys.max()) + 1
    offset_x = round(CANVAS_SIZE / 2 - body_center_x * scale)
    offset_y = round(CANVAS_BASELINE - body_bottom * scale)
    return rendered.transform(
        rgba.size,
        Image.Transform.AFFINE,
        (scale, 0, offset_x, 0, scale, offset_y),
        resample=Image.Resampling.BICUBIC,
    )


def mapped_box(
    bounds: tuple[int, int, int, int],
    box: tuple[float, float, float, float],
) -> tuple[int, int, int, int]:
    left, top, right, bottom = bounds
    width = right - left
    height = bottom - top
    return (
        round(left + box[0] * width),
        round(top + box[1] * height),
        round(left + box[2] * width),
        round(top + box[3] * height),
    )


def ellipse_mask(
    size: tuple[int, int],
    bounds: tuple[int, int, int, int],
    box: tuple[float, float, float, float],
) -> np.ndarray:
    w, h = size
    layer = Image.new("L", (w, h), 0)
    ImageDraw.Draw(layer).ellipse(mapped_box(bounds, box), fill=255)
    return np.asarray(layer) > 0


def rectangle_mask(
    size: tuple[int, int],
    bounds: tuple[int, int, int, int],
    box: tuple[float, float, float, float],
) -> np.ndarray:
    w, h = size
    layer = Image.new("L", (w, h), 0)
    ImageDraw.Draw(layer).rounded_rectangle(
        mapped_box(bounds, box),
        radius=max(2, int(w * 0.04)),
        fill=255,
    )
    return np.asarray(layer) > 0


def polygon_mask(
    size: tuple[int, int],
    bounds: tuple[int, int, int, int],
    points: tuple[tuple[float, float], ...],
) -> np.ndarray:
    w, h = size
    left, top, right, bottom = bounds
    width = right - left
    height = bottom - top
    layer = Image.new("L", (w, h), 0)
    ImageDraw.Draw(layer).polygon(
        [
            (round(left + x * width), round(top + y * height))
            for x, y in points
        ],
        fill=255,
    )
    return np.asarray(layer) > 0


def composite_color(out: np.ndarray, color: tuple[int, int, int], alpha: np.ndarray) -> None:
    color_arr = np.asarray(color, dtype=float)
    a = np.clip(alpha, 0, 1)[:, :, None]
    out[:, :, :3] = out[:, :, :3] * (1 - a) + color_arr * a
    out[:, :, 3] = np.maximum(out[:, :, 3], alpha * 255)


def marking_mask(
    kind: str,
    size: tuple[int, int],
    bounds: tuple[int, int, int, int],
    filename: str,
    *,
    is_lounge: bool,
) -> np.ndarray:
    if kind in {"spots_pickles", "spots_biscuit"}:
        # Home sprites use the same per-frame anatomy rig as hats and held
        # items. Identity markings stay on the head and torso: limb anchors
        # can exchange which hoof is visually exposed between poses, making a
        # fixed coat pattern appear to jump from one leg to another.
        if not is_lounge:
            return anchored_spots_mask(kind, size, filename)
        # The Lounge has separate directional art and no limb rig yet. Keep its
        # baked markings on head/flank areas only; do not pretend a fixed box
        # location is attached to a walking leg.
        return lounge_spots_mask(kind, size, bounds, filename)
    if kind == "blaze":
        # Bandit's cream blaze follows the center line of his forehead and
        # tapers into the muzzle. Side views reveal only a small sliver on the
        # brow, avoiding the white-faced "mime" effect of the earlier design.
        stem = Path(filename).stem
        if stem == "sit_e":
            # Seated profiles tuck both hooves beneath the chest. Reusing the
            # standing mask here painted a cream circle onto the rump.
            socks = ellipse_mask(size, bounds, (0.50, 0.67, 0.65, 0.90))
        elif stem == "sit_w":
            socks = ellipse_mask(size, bounds, (0.35, 0.67, 0.50, 0.90))
        else:
            socks = (
                ellipse_mask(size, bounds, (0.04, 0.77, 0.38, 1.02))
                | ellipse_mask(size, bounds, (0.62, 0.77, 0.97, 1.02))
            )
        if not is_lounge or "_s" in stem:
            blaze = polygon_mask(
                size,
                bounds,
                (
                    (0.45, 0.06),
                    (0.55, 0.06),
                    (0.57, 0.15),
                    (0.54, 0.23),
                    (0.55, 0.32),
                    (0.53, 0.43),
                    (0.47, 0.43),
                    (0.46, 0.33),
                    (0.48, 0.25),
                    (0.45, 0.16),
                ),
            )
        elif "_e" in stem:
            blaze = (
                ellipse_mask(size, bounds, (0.70, 0.09, 0.79, 0.27))
                | ellipse_mask(size, bounds, (0.73, 0.20, 0.80, 0.33))
            )
        elif "_w" in stem:
            blaze = (
                ellipse_mask(size, bounds, (0.21, 0.09, 0.30, 0.27))
                | ellipse_mask(size, bounds, (0.20, 0.20, 0.27, 0.33))
            )
        elif "_n" in stem:
            blaze = np.zeros((size[1], size[0]), dtype=bool)
        else:
            blaze = np.zeros((size[1], size[0]), dtype=bool)
        return blaze | socks
    if kind == "belt":
        socks = (
            ellipse_mask(size, bounds, (0.04, 0.77, 0.38, 1.02))
            | ellipse_mask(size, bounds, (0.62, 0.77, 0.97, 1.02))
        )
        if is_lounge and ("_e" in filename or "_w" in filename):
            belt = rectangle_mask(size, bounds, (0.44, 0.43, 0.51, 0.82))
        else:
            belt = rectangle_mask(size, bounds, (0.44, 0.57, 0.56, 0.93))
        return belt | socks
    if kind == "points":
        # Pepper's ears stay black. White is limited to socks and the tail tip.
        socks = (
            ellipse_mask(size, bounds, (0.04, 0.77, 0.38, 1.02))
            | ellipse_mask(size, bounds, (0.62, 0.77, 0.97, 1.02))
        )
        if not is_lounge:
            tail = ellipse_mask(size, bounds, (-0.03, 0.56, 0.17, 0.72))
        elif "_e" in filename:
            tail = ellipse_mask(size, bounds, (-0.03, 0.28, 0.18, 0.52))
        elif "_w" in filename:
            tail = ellipse_mask(size, bounds, (0.82, 0.28, 1.03, 0.52))
        else:
            tail = np.zeros((size[1], size[0]), dtype=bool)
        return socks | tail
    raise ValueError(f"Unknown marking: {kind} ({filename})")


def convert(source_path: Path, output_path: Path, coat: Coat) -> None:
    is_lounge = source_path.parent.name == "lounge"
    image = normalize_source(Image.open(source_path), is_lounge=is_lounge)
    source = np.asarray(image).astype(float)
    rgb = source[:, :, :3]
    alpha = source[:, :, 3] / 255.0
    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    sat = (mx - mn) / np.maximum(mx, 1)

    # The largest alpha island is the pig. Closing rebuilds one uninterrupted
    # silhouette and leaves detached reaction marks out of the coat.
    body = components(alpha > 0.05, largest_only=True)
    body = fill_internal_holes(body)
    if not is_lounge:
        body = morph(body, 9, close=True)
    else:
        # Lounge art has a few narrow scratches that touch the silhouette edge,
        # so flood-filling alone cannot classify them as internal holes.
        body = morph(body, 11, close=True)
    ys, xs = np.where(body)
    bounds = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    left, top, right, bottom = bounds
    yy, xx = np.indices(body.shape)
    xn = (xx - left) / max(1, right - left)
    yn = (yy - top) / max(1, bottom - top)

    # Broad, deliberately smooth lighting replaces Rosie's chalk texture.
    radial = np.clip(
        1 - np.sqrt(((xn - 0.46) / 0.9) ** 2 + ((yn - 0.34) / 1.0) ** 2),
        0,
        1,
    )
    light = np.clip(0.82 + 0.18 * (1 - yn) + 0.08 * radial, 0.78, 1.08)
    rendered_coat = np.clip(
        np.asarray(coat.rgb)[None, None, :] * light[:, :, None],
        0,
        255,
    )
    out = np.zeros_like(source)
    out[:, :, :3] = rendered_coat
    body_alpha = np.asarray(
        Image.fromarray((body * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(0.7))
    ) / 255.0
    out[:, :, 3] = body_alpha * 255

    if coat.marking:
        mark = marking_mask(
            coat.marking,
            image.size,
            bounds,
            source_path.name,
            is_lounge=is_lounge,
        ) & body
        if coat.marking == "blaze":
            # Bandit's old near-white markings glowed against the black coat.
            # Oatmeal cream preserves the black-and-white identity with a
            # gentler value step.
            marking_rgb = (224, 210, 197)
        elif coat.marking in {"belt", "points"}:
            marking_rgb = (241, 233, 225)
        else:
            marking_rgb = (57, 51, 53)
        marking_blur = (
            1.2
            if coat.marking.startswith("spots_")
            else 1.15 if coat.marking == "blaze" else 0.7
        )
        mark_alpha = np.asarray(
            Image.fromarray((mark * 255).astype("uint8")).filter(
                ImageFilter.GaussianBlur(marking_blur)
            )
        ) / 255.0
        composite_color(out, marking_rgb, mark_alpha * body_alpha)

    # Retain only substantial pink facial anatomy. Geometry excludes Rosie's
    # belly strokes, paw highlights, and other paint texture.
    warm = (rgb[:, :, 0] > rgb[:, :, 1] + 5) & (rgb[:, :, 0] > 110) & (alpha > 0.05)
    detail_filter = 7
    raw_pink_seed = warm & (sat > 0.22)
    pink_seed = raw_pink_seed.copy()
    if is_lounge:
        # The lounge source has a tall pink rim-light down the left cheek.
        # Keep the ear above it, while facial pink begins farther inward.
        lounge_anatomy = (yn < 0.27) | ((xn > 0.23) & (yn < 0.54))
        pink_seed &= lounge_anatomy
    pink = morph(pink_seed, detail_filter, close=False)
    pink = components(
        pink,
        min_area=45 if not is_lounge else 100,
        min_width=9 if not is_lounge else 14,
        min_height=9 if not is_lounge else 14,
        max_width=round((right - left) * 0.29),
        max_height=round((bottom - top) * 0.24),
        bounds=bounds,
        normalized_center=(0.02, 0.02, 0.98, 0.52),
    )

    # Ink, eyes, mouth, and hooves are lifted intact over the clean coat.
    ink = (mx < 172) & (alpha > 0.05)
    # Reconstruct the snout/cheeks as complete authored shapes rather than
    # independently thresholding their pink fill and dark outline. The latter
    # produced a doubled, broken-filter edge around the nose.
    facial_pink = components(
        pink,
        min_area=30 if not is_lounge else 40,
        bounds=bounds,
        normalized_center=(0.18, 0.27, 0.99, 0.60),
    )
    snout = components(facial_pink, largest_only=True)
    if is_lounge and "_e" in source_path.stem:
        pose_snout = raw_pink_seed & (xn > 0.86) & (yn > 0.25) & (yn < 0.66)
    elif is_lounge and "_w" in source_path.stem:
        pose_snout = raw_pink_seed & (xn < 0.14) & (yn > 0.25) & (yn < 0.66)
    elif is_lounge and "_n" in source_path.stem:
        pose_snout = np.zeros_like(body)
    else:
        pose_snout = snout

    # Blush belongs to Rosie's coat, not to the neutral anatomy master.
    # Alternate pigs retain inner ears and muzzle anatomy but clean coat cheeks.
    preserved_pink = pink
    facial_detail_source = facial_pink
    if not coat.blush:
        ear_pink = pink & (yn < 0.27)
        preserved_pink = ear_pink | pose_snout
        facial_detail_source = pose_snout
    facial_near = np.asarray(
        Image.fromarray((facial_detail_source * 255).astype("uint8")).filter(
            ImageFilter.MaxFilter(5)
        )
    ) > 0
    complete_facial_shapes = facial_near & (
        (sat > 0.16) | (mx < 210)
    ) & (alpha > 0.05)
    details = (preserved_pink | complete_facial_shapes | ink) & (alpha > 0.05) & body

    # Preserve compact eye glints but reject broad pale pixels near outlines.
    dark_near = np.asarray(
        Image.fromarray((ink * 255).astype("uint8")).filter(
            ImageFilter.MaxFilter(13)
        )
    ) > 0
    white_seed = (mx > 220) & (sat < 0.13) & body & dark_near
    eye_glints = (
        components(
            white_seed,
            min_area=30,
            max_area=190,
            max_width=19,
            max_height=19,
            bounds=bounds,
            normalized_center=(0.16, 0.10, 0.92, 0.58),
        )
        if not is_lounge
        else np.zeros_like(body)
    )
    details |= eye_glints
    detail_alpha = alpha * details
    detail_a = detail_alpha[:, :, None]
    out[:, :, :3] = out[:, :, :3] * (1 - detail_a) + rgb * detail_a
    out[:, :, 3] = np.maximum(out[:, :, 3], detail_alpha * 255)
    # Pepper and Bandit's black mouth ink otherwise disappears into their
    # coats. Recolor only the authored linework—no new oval or halo—after the
    # general ink pass. A soft Rosie pink keeps it anatomical rather than
    # reading like the skeletal gray treatment we rejected.
    if not is_lounge and max(coat.rgb) < 80:
        mouth_ink = dark_coat_mouth_ink_mask(rgb, source_path.name) & body
        composite_color(
            out,
            (239, 154, 174),
            mouth_ink.astype(float) * alpha,
        )
    # Bandit's source-brown irises disappear against his near-black coat.
    # Lift only the existing iris rings with a translucent chestnut wash; eye
    # geometry, pupils, outlines, and highlights remain the source anatomy.
    if not is_lounge and coat.marking == "blaze":
        iris = source_iris_mask(rgb, source_path.name) & body
        composite_color(
            out,
            (128, 72, 42),
            iris.astype(float) * alpha * 0.45,
        )
    cream_muzzle = coat.marking in {"points", "blaze", "belt"}
    if is_lounge and cream_muzzle:
        pose_snout &= body
        composite_color(out, (247, 232, 218), pose_snout.astype(float) * alpha)
    if not is_lounge and snout.any():
        # Redraw the muzzle as one coherent shape. Reconstructing fill and
        # outline independently was what made the nose resemble a broken filter.
        source_snout_ys, source_snout_xs = np.where(snout)
        source_snout_box = (
            int(source_snout_xs.min()),
            int(source_snout_ys.min()),
            int(source_snout_xs.max()) + 1,
            int(source_snout_ys.max()) + 1,
        )
        clean_snout_layer = Image.new("L", image.size, 0)
        snout_box_height = source_snout_box[3] - source_snout_box[1]
        ImageDraw.Draw(clean_snout_layer).rounded_rectangle(
            source_snout_box,
            radius=max(4, round(snout_box_height * 0.44)),
            fill=255,
        )
        snout_shape = np.asarray(clean_snout_layer) > 0
        snout_outer = np.asarray(
            Image.fromarray((snout_shape * 255).astype("uint8")).filter(
                ImageFilter.MaxFilter(7)
            )
        ) / 255.0
        snout_fill = np.asarray(
            Image.fromarray((snout_shape * 255).astype("uint8")).filter(
                ImageFilter.GaussianBlur(0.45)
            )
        ) / 255.0
        outline_color = (76, 39, 48)
        muzzle_color = (
            (226, 207, 193)
            if coat.marking == "blaze"
            else (247, 232, 218)
            if cream_muzzle
            else (246, 158, 176)
        )
        composite_color(out, outline_color, snout_outer * body)
        composite_color(out, muzzle_color, snout_fill * body)
        snout_ys, snout_xs = np.where(snout_shape)
        snout_left, snout_right = int(snout_xs.min()), int(snout_xs.max()) + 1
        snout_top, snout_bottom = int(snout_ys.min()), int(snout_ys.max()) + 1
        snout_width = snout_right - snout_left
        snout_height = snout_bottom - snout_top
        nostril_layer = Image.new("L", image.size, 0)
        nostril_draw = ImageDraw.Draw(nostril_layer)
        for center_x in (0.34, 0.70):
            cx = snout_left + center_x * snout_width
            cy = snout_top + 0.48 * snout_height
            rx = 0.075 * snout_width
            ry = 0.18 * snout_height
            nostril_draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255)
        nostril_alpha = np.asarray(
            nostril_layer.filter(ImageFilter.GaussianBlur(0.4))
        ) / 255.0
        composite_color(out, (66, 40, 47), nostril_alpha * snout_shape)

    # Only surprise poses intentionally contain detached marks. All other
    # disconnected source fragments are paint debris and must not be exported.
    raw_effects = (alpha > 0.05) & ~body
    effects = (
        components(raw_effects, min_area=20)
        if source_path.name.startswith("surprise_")
        else np.zeros_like(body)
    )
    effect_alpha = alpha * effects
    effect_a = effect_alpha[:, :, None]
    out[:, :, :3] = out[:, :, :3] * (1 - effect_a) + rgb * effect_a
    out[:, :, 3] = np.maximum(out[:, :, 3], effect_alpha * 255)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    # Keep true 8-bit alpha. Palette quantization reduced transparency to one
    # bit, which created bitten edges and detached pale pixels in-app.
    baked = np.clip(out, 0, 255).astype("uint8")
    baked[baked[:, :, 3] == 0, :3] = 0
    rendered = Image.fromarray(baked, "RGBA")
    registered = restore_source_canvas(
        rendered,
        Image.open(source_path),
        is_lounge=is_lounge,
    )
    registered.save(output_path, optimize=True)


def write_manifest(files: list[Path]) -> None:
    rosie_root = SPRITES / "rosie"
    main = [p for p in files if p.parent == rosie_root]
    lounge = [p for p in files if p.parent == rosie_root / "lounge"]
    pig_ids = list(COATS)
    lines = [
        "/* eslint-disable @typescript-eslint/no-require-imports */",
        "// Generated by scripts/generate-pig-sprites.py. Do not edit by hand.",
        'import type { PigId } from "@/utils/pigs";',
        "",
        "export const PIG_FRAMES: Record<PigId, Record<string, number>> = {",
    ]
    for pig in pig_ids:
        lines.append(f"\t{pig}: {{")
        for path in main:
            lines.append(
                f'\t\t{path.stem}: require("../assets/images/sprites/{pig}/{path.name}"),'
            )
        lines.append("\t},")
    lines += ["};", "", "export const PIG_LOUNGE_FRAMES: Record<PigId, Record<string, number>> = {"]
    for pig in pig_ids:
        lines.append(f"\t{pig}: {{")
        for path in lounge:
            lines.append(
                f'\t\t{path.stem}: require("../assets/images/sprites/{pig}/lounge/{path.name}"),'
            )
        lines.append("\t},")
    lines += ["};", ""]
    (ROOT / "constants" / "pigFrames.generated.ts").write_text("\n".join(lines))


def make_contact_sheet() -> None:
    pigs = list(COATS)
    frames = ["idle_1.png", "happy_2.png", "walk_3.png", "surprise_2.png"]
    cell = 220
    sheet = Image.new("RGB", (cell * len(pigs), cell * len(frames) + 46), "#F6EFE4")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=18)
    for col, pig in enumerate(pigs):
        draw.text((col * cell + 12, 12), pig.title(), fill="#33231F", font=font)
        for row, frame in enumerate(frames):
            image = Image.open(SPRITES / pig / frame).convert("RGBA")
            image.thumbnail((cell - 24, cell - 24), Image.Resampling.LANCZOS)
            x = col * cell + (cell - image.width) // 2
            y = 46 + row * cell + (cell - image.height) // 2
            sheet.paste(image, (x, y), image)
    CONTACT_SHEET.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(CONTACT_SHEET, optimize=True)


def main() -> None:
    rosie_root = SPRITES / "rosie"
    files = sorted(rosie_root.rglob("*.png"))
    if len(files) != 54:
        raise SystemExit(f"Expected 54 Rosie frames, found {len(files)}")

    subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts" / "extract-authored-pig-sheets.py"),
            "--live",
        ],
        check=True,
    )
    write_manifest(files)
    subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "verify-pig-sprites.py")],
        check=True,
    )
    print(
        f"Released {len(files) * (len(COATS) - 1)} individually authored "
        "recruit sprites and refreshed the static Expo manifest; "
        "Rosie was left untouched"
    )


if __name__ == "__main__":
    main()

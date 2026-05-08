#!/usr/bin/env python3
"""
Slice the new ttp_anim ChatGPT/MJ outputs into individual PNGs the
app expects.

Each input image is a horizontal strip (5 items for accessories,
4 frames for animations) on a near-white or solid-color background.
This script:

  1. Splits the strip into N equal-width cells.
  2. For accessories (transparent target): replaces near-white
     background with alpha=0, then trims the cell to the visible
     bounding box.
  3. For animation frames (transparent target): same — trim to
     opaque bbox so the per-frame anchor logic gets clean PNGs.
  4. For backgrounds: keeps full cell, no transparency, no trim.
  5. Writes each output to the right destination filename.

Usage: python3 scripts/slice_ttp_anim.py
"""
import os
from PIL import Image
import numpy as np

DOWNLOADS = "/Users/bbroeking/Downloads/ttp_anim"
SPRITE_DIR = "/Users/bbroeking/projects/oink/assets/images/sprites/rosie"
HAT_DIR = "/Users/bbroeking/projects/oink/assets/images/hats"
BG_DIR = "/Users/bbroeking/projects/oink/assets/images"

# Source filename → (cells, mode, [out paths])
# mode: "transparent" trims + alpha-keys near-white, "background" keeps full cell
JOBS = [
    # ── Animation strips ────────────────────────────────────────
    ("ChatGPT Image May 8, 2026, 03_09_04 PM.png", 4, "transparent",
     [f"{SPRITE_DIR}/idle_{i}.png" for i in range(1, 5)]),
    ("ChatGPT Image May 8, 2026, 04_12_01 PM.png", 4, "transparent",
     [f"{SPRITE_DIR}/walk_{i}.png" for i in range(1, 5)]),
    ("ChatGPT Image May 8, 2026, 04_12_15 PM.png", 4, "transparent",
     [f"{SPRITE_DIR}/jump_{i}.png" for i in range(1, 5)]),
    ("ChatGPT Image May 8, 2026, 04_27_44 PM.png", 4, "transparent_dark",
     [f"{SPRITE_DIR}/sad_{i}.png" for i in range(1, 5)]),
    # New 7:31 PM batch — arms_up cheer, surprise, sad-v2 (better tears)
    ("ChatGPT Image May 8, 2026, 07_31_17 PM.png", 4, "transparent",
     [f"{SPRITE_DIR}/arms_up_{i}.png" for i in range(1, 5)]),
    ("ChatGPT Image May 8, 2026, 07_31_22 PM.png", 4, "transparent",
     [f"{SPRITE_DIR}/surprise_{i}.png" for i in range(1, 5)]),
    ("ChatGPT Image May 8, 2026, 07_31_29 PM.png", 4, "transparent",
     [f"{SPRITE_DIR}/sad_{i}.png" for i in range(1, 5)]),

    # ── Accessory strips (5 items each) ─────────────────────────
    # Hats batch 1: wizard, cowboy, tophat, party, beanie
    ("ChatGPT Image May 8, 2026, 04_12_51 PM.png", 5, "transparent",
     [f"{HAT_DIR}/{n}.png" for n in
      ["wizard", "cowboy", "tophat", "party", "beanie"]]),
    # Hats batch 2: crown, halo, pirate_tricorn, chef_toque, viking_helmet
    ("ChatGPT Image May 8, 2026, 04_13_31 PM.png", 5, "transparent",
     [f"{HAT_DIR}/{n}.png" for n in
      ["crown", "halo", "pirate_tricorn", "chef_toque", "viking_helmet"]]),
    # Glasses batch 1: round, aviator, monocle, swim, nerd
    ("ChatGPT Image May 8, 2026, 04_17_00 PM.png", 5, "transparent",
     [f"{HAT_DIR}/{n}.png" for n in
      ["round_glasses", "aviator_sunglasses", "monocle",
       "swim_goggles", "nerd_glasses"]]),
    # Glasses batch 2: 3d, heart, pixel, safety, vr
    ("ChatGPT Image May 8, 2026, 04_23_25 PM.png", 5, "transparent",
     [f"{HAT_DIR}/{n}.png" for n in
      ["three_d_glasses", "heart_sunglasses", "pixel_glasses",
       "safety_goggles", "vr_headset"]]),
    # Bows batch 1: pink, black tie, ribbon, hair, gift
    ("ChatGPT Image May 8, 2026, 04_23_21 PM.png", 5, "transparent",
     [f"{HAT_DIR}/{n}.png" for n in
      ["pink_bow", "black_bow_tie", "ribbon_bow", "hair_bow", "gift_bow"]]),
    # Bows batch 2: archery, silk, polka, velvet, rainbow
    ("ChatGPT Image May 8, 2026, 04_23_36 PM.png", 5, "transparent",
     [f"{HAT_DIR}/{n}.png" for n in
      ["archery_bow", "silk_bow", "polka_bow", "velvet_bow", "rainbow_bow"]]),
    # Scarves batch 1: knit, silk, bandana_red, cape_scarf, striped
    ("ChatGPT Image May 8, 2026, 04_23_32 PM.png", 5, "transparent",
     [f"{HAT_DIR}/{n}.png" for n in
      ["knit_scarf", "silk_scarf", "bandana_red", "cape_scarf",
       "striped_scarf"]]),
    # Auras batch 1: pink_glow, gold, rainbow, fire, ice
    ("ChatGPT Image May 8, 2026, 04_23_40 PM.png", 5, "transparent",
     [f"{HAT_DIR}/{n}.png" for n in
      ["pink_glow", "gold_aura", "rainbow_aura", "fire_aura", "ice_aura"]]),
    # Auras batch 2: electric, shadow, holy, sparkle, petal
    ("ChatGPT Image May 8, 2026, 04_23_44 PM.png", 5, "transparent",
     [f"{HAT_DIR}/{n}.png" for n in
      ["electric_aura", "shadow_aura", "holy_aura", "sparkle_aura",
       "petal_aura"]]),
    # Masks batch 2: carnival, venice, cat, skull, hero
    ("ChatGPT Image May 8, 2026, 04_23_49 PM.png", 5, "transparent",
     [f"{HAT_DIR}/{n}.png" for n in
      ["carnival_mask", "venice_mask", "cat_mask", "skull_mask",
       "hero_mask"]]),
    # Capes batch 1: royal, vampire, hero, magician, fur
    ("ChatGPT Image May 8, 2026, 04_23_54 PM.png", 5, "transparent",
     [f"{HAT_DIR}/{n}.png" for n in
      ["royal_cape", "vampire_cape", "hero_cape", "magician_cape",
       "fur_cape"]]),
    # Necklaces batch 1: pearl, gold_chain, locket, bone, charm
    ("ChatGPT Image May 8, 2026, 04_24_19 PM.png", 5, "transparent",
     [f"{HAT_DIR}/{n}.png" for n in
      ["pearl_necklace", "gold_chain", "locket", "bone_necklace",
       "charm_necklace"]]),
    # Capes batch 2 (only 4 items — missing star_cape!): silk, leather, short, ermine
    ("ChatGPT Image May 8, 2026, 04_24_35 PM.png", 4, "transparent",
     [f"{HAT_DIR}/{n}.png" for n in
      ["silk_cape", "leather_cape", "short_cape", "ermine_cape"]]),

    # ── Backgrounds (5 cells, full-cell, no transparency) ───────
    ("1fc1fa9c-7c61-4c1d-9632-7141a1c0fba3.png", 5, "background",
     [f"{HAT_DIR}/{n}.png" for n in
      ["sunset_farm", "snowy_farm", "beach_island", "space_station",
       "candyland"]]),
    ("2f1f3af3-1b91-4d97-ad7c-7ea5f17e77d6.png", 5, "background",
     [f"{HAT_DIR}/{n}.png" for n in
      ["forest_grove", "jungle", "underwater", "desert_dunes",
       "mountain_top"]]),
]


def _flood_from_edges(mask: np.ndarray) -> np.ndarray:
    """Returns the subset of `mask` that's reachable from the image edges
    via 4-neighbor flood fill. Used to keep internal "near-white" pixels
    (eye highlights, shine) opaque while removing only the surrounding
    background."""
    h, w = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    # Seed with all edge pixels that match the mask
    stack = []
    for x in range(w):
        if mask[0, x]: stack.append((0, x))
        if mask[h - 1, x]: stack.append((h - 1, x))
    for y in range(h):
        if mask[y, 0]: stack.append((y, 0))
        if mask[y, w - 1]: stack.append((y, w - 1))
    while stack:
        y, x = stack.pop()
        if visited[y, x] or not mask[y, x]:
            continue
        visited[y, x] = True
        if y > 0: stack.append((y - 1, x))
        if y < h - 1: stack.append((y + 1, x))
        if x > 0: stack.append((y, x - 1))
        if x < w - 1: stack.append((y, x + 1))
    return visited


def near_white_to_alpha(arr: np.ndarray, threshold: int = 240) -> np.ndarray:
    """Replace ONLY edge-connected near-white pixels with alpha=0. Internal
    near-white highlights (eye sparkles, snout shine) stay opaque."""
    rgba = arr.copy()
    if rgba.shape[2] == 3:
        rgba = np.dstack([rgba, np.full(rgba.shape[:2], 255, dtype=np.uint8)])
    r, g, b, a = rgba[:, :, 0], rgba[:, :, 1], rgba[:, :, 2], rgba[:, :, 3]
    near_white = (r >= threshold) & (g >= threshold) & (b >= threshold)
    bg = _flood_from_edges(near_white)
    rgba[..., 3] = np.where(bg, 0, a)
    return rgba


def near_dark_to_alpha(arr: np.ndarray, threshold: int = 30) -> np.ndarray:
    """Replace ONLY edge-connected near-black pixels with alpha=0. Used for
    the SAD strip whose background is solid dark."""
    rgba = arr.copy()
    if rgba.shape[2] == 3:
        rgba = np.dstack([rgba, np.full(rgba.shape[:2], 255, dtype=np.uint8)])
    r, g, b, a = rgba[:, :, 0], rgba[:, :, 1], rgba[:, :, 2], rgba[:, :, 3]
    near_dark = (r <= threshold) & (g <= threshold) & (b <= threshold)
    bg = _flood_from_edges(near_dark)
    rgba[..., 3] = np.where(bg, 0, a)
    return rgba


def trim_to_bbox(arr: np.ndarray, alpha_threshold: int = 16) -> np.ndarray:
    """Crop to the bounding box of opaque pixels."""
    if arr.shape[2] < 4:
        return arr
    alpha = arr[:, :, 3]
    mask = alpha > alpha_threshold
    if not mask.any():
        return arr
    ys, xs = np.where(mask)
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    return arr[y0:y1, x0:x1]


def find_content_columns(arr: np.ndarray, alpha_threshold: int = 16,
                         min_run: int = 3) -> list[tuple[int, int]]:
    """Find runs of columns that contain visible content.

    Returns a list of (x0, x1) ranges where each range is a contiguous
    band of columns that has at least one opaque pixel. `min_run` filters
    out single-column noise. Used to locate per-item cells in a strip
    when items aren't on an equal-spacing grid.
    """
    alpha = arr[:, :, 3]
    col_has_content = (alpha > alpha_threshold).any(axis=0)
    runs = []
    in_run = False
    start = 0
    for i, has in enumerate(col_has_content):
        if has and not in_run:
            start = i
            in_run = True
        elif not has and in_run:
            if i - start >= min_run:
                runs.append((start, i))
            in_run = False
    if in_run and len(col_has_content) - start >= min_run:
        runs.append((start, len(col_has_content)))
    return runs


def slice_strip(input_path: str, n_cells: int, mode: str,
                out_paths: list[str]):
    im = Image.open(input_path).convert("RGBA")
    arr = np.array(im)
    h, w = arr.shape[:2]

    # For backgrounds we always use equal-width slices because there are
    # no transparent gaps — each cell IS a full landscape.
    if mode == "background":
        cell_w = w // n_cells
        cells = [arr[:, i * cell_w:(i + 1) * cell_w].copy() for i in range(n_cells)]
    else:
        # Alpha-key first so the gap detector can find transparent columns.
        keyed = (
            near_dark_to_alpha(arr) if mode == "transparent_dark"
            else near_white_to_alpha(arr)
        )
        runs = find_content_columns(keyed)
        if len(runs) == n_cells:
            cells = [keyed[:, x0:x1].copy() for x0, x1 in runs]
        else:
            # Fallback: detection produced wrong cell count (items merged or
            # split). Fall back to equal-width and warn so it's visible.
            print(f"  ⚠ detected {len(runs)} cells but expected {n_cells}; "
                  f"falling back to equal-width slicing")
            cell_w = w // n_cells
            cells = [keyed[:, i * cell_w:(i + 1) * cell_w].copy() for i in range(n_cells)]

    for i, (out_path, cell) in enumerate(zip(out_paths, cells)):
        if i >= n_cells:
            break

        if mode == "transparent" or mode == "transparent_dark":
            cell = trim_to_bbox(cell)

        out_im = Image.fromarray(cell, mode="RGBA")
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        out_im.save(out_path, "PNG")
        print(f"  → {os.path.basename(out_path):30}  {cell.shape[1]}×{cell.shape[0]}")


def main():
    for fname, cells, mode, outs in JOBS:
        path = os.path.join(DOWNLOADS, fname)
        if not os.path.exists(path):
            print(f"SKIP (missing): {fname}")
            continue
        print(f"\n{fname}  →  {cells} cells, mode={mode}")
        slice_strip(path, cells, mode, outs)


if __name__ == "__main__":
    main()

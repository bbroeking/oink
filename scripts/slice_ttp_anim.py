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
# Backgrounds split out of the hats folder — they're a different
# kind of asset (fullscreen page art, not pig accessories) so they
# get their own directory. Future regen JOBS for the background
# category should target BG_DIR.
BG_DIR = "/Users/bbroeking/projects/oink/assets/images/backgrounds"

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
    ("ChatGPT Image May 8, 2026, 07_56_37 PM.png", 4, "transparent",
     [f"{SPRITE_DIR}/happy_{i}.png" for i in range(1, 5)]),
    ("ChatGPT Image May 8, 2026, 08_08_33 PM.png", 4, "transparent",
     [f"{SPRITE_DIR}/wave_{i}.png" for i in range(1, 5)]),

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

    # ── May 12 2026 regen: hats, bows, masks ────────────────────
    # Absolute paths so we can pull from a different download folder
    # without touching DOWNLOADS. `None` entries skip that cell —
    # used when ChatGPT misplaced one item per strip.
    #
    # Hats batch 1 — 11:44:19 AM
    ("/Users/bbroeking/Downloads/updated/ChatGPT Image May 12, 2026, 11_44_19 AM.png", 5, "transparent",
     [f"{HAT_DIR}/{n}.png" for n in
      ["wizard", "cowboy", "tophat", "party", "beanie"]]),
    # Hats batch 2 — 11:44:23 AM
    ("/Users/bbroeking/Downloads/updated/ChatGPT Image May 12, 2026, 11_44_23 AM.png", 5, "transparent",
     [f"{HAT_DIR}/{n}.png" for n in
      ["chef_toque", "crown", "halo", "viking_helmet", "pirate_tricorn"]]),
    # Bows batch 1 — 11:44:30 AM (black tie, gift, hair gingham, pink, polka)
    ("/Users/bbroeking/Downloads/updated/ChatGPT Image May 12, 2026, 11_44_30 AM.png", 5, "transparent",
     [f"{HAT_DIR}/{n}.png" for n in
      ["black_bow_tie", "gift_bow", "hair_bow", "pink_bow", "polka_bow"]]),
    # Bows batch 2 — 11:44:26 AM (rainbow, ribbon, silk, velvet, gingham)
    # Cell 5 (yellow gingham) doesn't match archery_bow in the catalog
    # (which is bow-and-arrow themed). Skip until either the prompt or
    # the catalog entry is reconciled.
    ("/Users/bbroeking/Downloads/updated/ChatGPT Image May 12, 2026, 11_44_26 AM.png", 5, "transparent",
     [f"{HAT_DIR}/rainbow_bow.png",
      f"{HAT_DIR}/ribbon_bow.png",
      f"{HAT_DIR}/silk_bow.png",
      f"{HAT_DIR}/velvet_bow.png",
      None]),
    # Masks batch 2 — 12:03:43 PM (masquerade, robber, skull, sleep, venice)
    ("/Users/bbroeking/Downloads/updated/ChatGPT Image May 12, 2026, 12_03_43 PM.png", 5, "transparent",
     [f"{HAT_DIR}/{n}.png" for n in
      ["masquerade", "robber_mask", "skull_mask", "sleep_mask", "venice_mask"]]),
    # ── Pig sprite re-roll, May 12 4-5 PM ───────────────────────
    # New character variant (cute round body, front hands instead of
    # hooves). 5 animations from 6 downloaded files (one duplicate).
    # IDLE, SAD, HAPPY, SURPRISE, WAVE — still need WALK + JUMP.
    ("/Users/bbroeking/Downloads/anim_ttp2/ChatGPT Image May 12, 2026, 04_13_39 PM.png",
     4, "transparent",
     [f"{SPRITE_DIR}/idle_{i}.png" for i in range(1, 5)]),
    ("/Users/bbroeking/Downloads/anim_ttp2/ChatGPT Image May 12, 2026, 04_34_57 PM.png",
     4, "transparent",
     [f"{SPRITE_DIR}/sad_{i}.png" for i in range(1, 5)]),
    ("/Users/bbroeking/Downloads/anim_ttp2/ChatGPT Image May 12, 2026, 04_35_02 PM.png",
     4, "transparent",
     [f"{SPRITE_DIR}/happy_{i}.png" for i in range(1, 5)]),
    ("/Users/bbroeking/Downloads/anim_ttp2/ChatGPT Image May 12, 2026, 04_36_14 PM.png",
     4, "transparent",
     [f"{SPRITE_DIR}/surprise_{i}.png" for i in range(1, 5)]),
    ("/Users/bbroeking/Downloads/anim_ttp2/ChatGPT Image May 12, 2026, 04_59_44 PM.png",
     4, "transparent",
     [f"{SPRITE_DIR}/wave_{i}.png" for i in range(1, 5)]),
    # Jump + walk arrived in a later batch — May 12 5:03/5:04 PM
    ("/Users/bbroeking/Downloads/ChatGPT Image May 12, 2026, 05_03_56 PM.png",
     4, "transparent",
     [f"{SPRITE_DIR}/jump_{i}.png" for i in range(1, 5)]),
    ("/Users/bbroeking/Downloads/ChatGPT Image May 12, 2026, 05_04_09 PM.png",
     4, "transparent",
     [f"{SPRITE_DIR}/walk_{i}.png" for i in range(1, 5)]),

    # Necklaces — May 12 2:15 PM regen (4 cols × 3 rows = 12 cells; ChatGPT
    # ignored the requested 2×5 layout and duplicated 3 items; missing locket).
    # Dark gradient background, items have thick black outlines → outline mode.
    # Mapping (row-major, 4 across):
    #   [0,0] bell_collar   [0,1] bone_necklace [0,2] charm_necklace [0,3] diamond_pendant
    #   [1,0] emerald_pendant [1,1] choker     [1,2] gold_chain      [1,3] pearl_necklace
    #   [2,0] (dup, skip)    [2,1] (dup, skip)  [2,2] (dup, skip)    [2,3] ribbon_choker
    # locket NOT in this strip — needs a single-cell regen.
    ("/Users/bbroeking/Downloads/necklaces_gen1.png",
     (3, 4), "transparent_outline",
     [f"{HAT_DIR}/bell_collar.png",
      f"{HAT_DIR}/bone_necklace.png",
      f"{HAT_DIR}/charm_necklace.png",
      f"{HAT_DIR}/diamond_pendant.png",
      f"{HAT_DIR}/emerald_pendant.png",
      f"{HAT_DIR}/choker.png",
      f"{HAT_DIR}/gold_chain.png",
      f"{HAT_DIR}/pearl_necklace.png",
      None, None, None,
      f"{HAT_DIR}/ribbon_choker.png"]),

    # Scarves all 10 — 1:04 PM (2 rows × 5 cols, olive bg, key by outline)
    ("/Users/bbroeking/Downloads/ChatGPT Image May 12, 2026, 01_04_36 PM.png",
     (2, 5), "transparent_outline",
     [f"{HAT_DIR}/{n}.png" for n in [
       "ascot", "bandana_red", "cape_scarf", "knit_scarf", "neckwarmer",
       "rainbow_scarf", "silk_scarf", "striped_scarf", "summer_kerchief",
       "winter_scarf",
     ]]),

    # Masks batch 1 — 12:03:52 PM (carnival, cat, domino, ???, hero)
    # Cell 4 is a yellow polka-dot bandana, not the gas_mask (military-style
    # with twin filters) the catalog calls for. Skip until regenerated.
    ("/Users/bbroeking/Downloads/updated/ChatGPT Image May 12, 2026, 12_03_52 PM.png", 5, "transparent",
     [f"{HAT_DIR}/carnival_mask.png",
      f"{HAT_DIR}/cat_mask.png",
      f"{HAT_DIR}/domino.png",
      None,
      f"{HAT_DIR}/hero_mask.png"]),

    # ── Backgrounds (5 cells, full-cell, no transparency) ───────
    # Backgrounds write to BG_DIR (separate from accessories).
    ("1fc1fa9c-7c61-4c1d-9632-7141a1c0fba3.png", 5, "background",
     [f"{BG_DIR}/{n}.png" for n in
      ["sunset_farm", "snowy_farm", "beach_island", "space_station",
       "candyland"]]),
    ("2f1f3af3-1b91-4d97-ad7c-7ea5f17e77d6.png", 5, "background",
     [f"{BG_DIR}/{n}.png" for n in
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


def black_outline_to_alpha(arr: np.ndarray,
                           dark_threshold: int = 90,
                           dilate_iters: int = 2) -> np.ndarray:
    """Items are bounded by thick black outlines on a colored (often
    olive/brown) background. Sample the dark outline pixels, dilate
    to seal any single-pixel gaps, then fill enclosed regions — that
    becomes the item mask. Everything outside it goes to alpha=0.

    Robust against backgrounds that aren't near-white or near-dark
    (which the corner-color flood-fill can't reliably handle when
    the bg has gradients or glow halos around items)."""
    rgba = arr.copy()
    if rgba.shape[2] == 3:
        rgba = np.dstack([rgba, np.full(rgba.shape[:2], 255, dtype=np.uint8)])
    lum = (
        0.299 * rgba[:, :, 0].astype(np.float32)
        + 0.587 * rgba[:, :, 1].astype(np.float32)
        + 0.114 * rgba[:, :, 2].astype(np.float32)
    )
    dark = lum < dark_threshold
    try:
        from scipy import ndimage
        # Close hairline gaps in outline before flood-filling
        dark = ndimage.binary_dilation(dark, iterations=dilate_iters)
        item_mask = ndimage.binary_fill_holes(dark)
    except ImportError:
        item_mask = dark
    rgba[..., 3] = np.where(item_mask, rgba[..., 3], 0)
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
    """Crop to the bounding box of opaque pixels, filtering out small
    outlier components.

    ChatGPT-generated items often include incidental decorative artifacts
    (sparkles, dust motes, faint shadow bits) outside the main silhouette.
    A naive bbox grabs all of them, throwing off downstream positioning
    math by a few pixels per item. Filter to the LARGEST connected
    component (plus anything ≥10% of its area) so the bbox tracks the
    actual item silhouette, not the outliers.
    """
    if arr.shape[2] < 4:
        return arr
    alpha = arr[:, :, 3]
    mask = alpha > alpha_threshold
    if not mask.any():
        return arr

    # Connected-components: 4-neighbor labels.
    try:
        from scipy import ndimage
        labeled, n_components = ndimage.label(mask)
        if n_components > 1:
            sizes = ndimage.sum(mask, labeled, range(1, n_components + 1))
            largest_size = int(sizes.max())
            # Keep components ≥10% of largest. Solo decorative elements
            # (a single sparkle off to the side) get dropped.
            keep_labels = [
                i + 1 for i, sz in enumerate(sizes)
                if sz >= largest_size * 0.10
            ]
            mask = np.isin(labeled, keep_labels)
    except ImportError:
        pass  # scipy missing — fall back to naive bbox.

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

    # Animation sprite frames must share identical dimensions across the
    # set so the renderer's resizeMode=contain places the pig's content at
    # the same screen position every frame. Without this the pig wiggles
    # between frames and the per-frame anchor system can't compensate.
    #
    # Routing decision is based on canonical destination prefix — checking
    # against SPRITE_DIR exactly avoids the false-positive risk of a
    # substring search (e.g., a future "sprites/prebaked/<item>/" path
    # would still get correctly classified by the explicit prefix).
    is_sprite = all(p.startswith(SPRITE_DIR + "/") for p in out_paths)

    # For backgrounds we always use equal-width slices because there are
    # no transparent gaps — each cell IS a full landscape.
    if mode == "background":
        cell_w = w // n_cells
        cells = [arr[:, i * cell_w:(i + 1) * cell_w].copy() for i in range(n_cells)]
    elif is_sprite:
        # Sprite frames need to share dimensions AND have the pig centered
        # at the same position in each frame, otherwise the renderer's
        # resizeMode=contain places the pig at different screen positions
        # per frame and items appear to "slip" relative to head/eyes.
        #
        # ChatGPT-generated strips don't reliably center the pig in each
        # cell, so we (a) find each cell's own bbox, (b) center the
        # bbox content inside a uniform output canvas large enough to
        # hold the largest frame's content with a safety pad.
        keyed = (
            near_dark_to_alpha(arr) if mode == "transparent_dark"
            else near_white_to_alpha(arr)
        )
        cell_w = w // n_cells
        raw_cells = [keyed[:, i * cell_w:(i + 1) * cell_w].copy() for i in range(n_cells)]

        bboxes: list[tuple[int, int, int, int] | None] = []
        for cell in raw_cells:
            alpha = cell[:, :, 3]
            mask = alpha > 16
            if not mask.any():
                bboxes.append(None)
                continue
            ys, xs = np.where(mask)
            bboxes.append((int(ys.min()), int(ys.max()) + 1,
                           int(xs.min()), int(xs.max()) + 1))

        valid = [b for b in bboxes if b]
        if not valid:
            cells = raw_cells
        else:
            max_h = max(y1 - y0 for y0, y1, _, _ in valid)
            max_w = max(x1 - x0 for _, _, x0, x1 in valid)
            pad = 6
            canvas_h = max_h + 2 * pad
            canvas_w = max_w + 2 * pad
            cells = []
            for cell, bb in zip(raw_cells, bboxes):
                if not bb:
                    cells.append(np.zeros((canvas_h, canvas_w, 4), dtype=np.uint8))
                    continue
                y0, y1, x0, x1 = bb
                content = cell[y0:y1, x0:x1]
                ch, cw = content.shape[:2]
                canvas = np.zeros((canvas_h, canvas_w, 4), dtype=np.uint8)
                # Center content in canvas. Anchor the FEET to the bottom
                # rather than vertical center — pigs jump up, not centered
                # vertically in the bbox, so anchoring feet keeps the
                # standing/contact point stable across frames.
                ox = (canvas_w - cw) // 2
                oy = canvas_h - ch - pad
                canvas[oy:oy + ch, ox:ox + cw] = content
                cells.append(canvas)
    elif mode == "transparent_outline" or isinstance(n_cells, tuple):
        # Grid mode: (rows, cols) tuple OR colored-background mode that
        # keys off black outlines instead of background color.
        if isinstance(n_cells, tuple):
            rows, cols = n_cells
        else:
            rows, cols = 1, n_cells
        keyed = (
            black_outline_to_alpha(arr) if mode == "transparent_outline"
            else near_white_to_alpha(arr)
        )
        cell_h = h // rows
        cell_w = w // cols
        cells = []
        for r in range(rows):
            for c in range(cols):
                cells.append(
                    keyed[r * cell_h:(r + 1) * cell_h,
                          c * cell_w:(c + 1) * cell_w].copy()
                )
        n_cells = rows * cols  # so the downstream loop iterates the right count
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
        # None means "ChatGPT generated this cell wrong; don't write it" —
        # see e.g. the May 12 bow/mask jobs where one cell of an otherwise
        # good strip is mismatched.
        if out_path is None:
            print(f"  → (cell {i + 1} skipped — None out_path)")
            continue

        # Trim accessories to bbox so positioning math uses real bounds;
        # leave sprite frames at their full cell size so all frames in
        # an animation share dimensions exactly.
        if mode in ("transparent", "transparent_dark", "transparent_outline") and not is_sprite:
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

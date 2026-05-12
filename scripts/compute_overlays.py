#!/usr/bin/env python3
"""
Auto-compute per-item overlay coordinates for the SwipeElement overlay system.

Reads every PNG in assets/images/hats/, looks up its category from the
shop_catalog migration, and computes a {bottom, left, width, height} overlay
that places the item naturally on the pig's body — using the item's actual
aspect ratio so its bottom edge anchors at the right anatomy point.

Usage:
    python3 scripts/compute_overlays.py

Writes:
    constants/hat_overlays.generated.ts  (drop-in TS dict)
    tests/OVERLAY_REPORT.md              (flags items needing manual review)
"""
import os
import re
import sys
from PIL import Image
import numpy as np

REPO = "/Users/bbroeking/projects/oink"
ASSET_DIR = f"{REPO}/assets/images/hats"
CATALOG_SQL = f"{REPO}/supabase/migrations/20260502030000_shop_catalog.sql"
OUTPUT_TS = f"{REPO}/constants/hat_overlays.generated.ts"
OUTPUT_REPORT = f"{REPO}/tests/OVERLAY_REPORT.md"

# 300x300 card coordinates. `bottom` is distance from the card's bottom edge.
# Pig anatomy reference (idle_1 sprite, scaled to 300x300):
#   feet:   ~0
#   chest:  ~100
#   neck:   ~130
#   snout:  ~170
#   eyes:   ~200
#   crown:  ~230
#   ear top:~260
#
# Per category: anchor_y = where the item's BOTTOM edge sits;
# target_width = base width to scale the item to;
# left = horizontal offset (None = centered).
# Per-category placement. `anchor_y` is the y-from-bottom on the 300×300
# card where the item's PIVOT POINT should land — i.e., the contact point
# on the pig (head crown ≈ 265, eye line ≈ 195, neck ≈ 90, etc.). `pivot`
# is the fraction of the item's bbox that contacts the anchor: (0.5, 1.0)
# = bottom-center (default for hats); (0.5, 0.5) = center (glasses);
# (0.5, 0.0) = top-center (scarves hanging down).
#
# !!! SOURCE OF TRUTH: this table mirrors CATEGORY_PIVOTS + the
# REST_ANCHORS positions in constants/hats.ts. Diverging here will
# misposition every item the script regenerates. If you change pivots
# or anchor positions in the TS code, update both halves in lockstep
# (or add a JSON intermediary that both consume).
CATEGORY = {
    # Hats sit on the head crown (y_from_top≈35 → y_from_bottom=265).
    "hat":        {"anchor_y": 265, "width": 160, "left": None, "max_h": 200, "pivot": (0.5, 1.0)},
    # Glasses straddle the eye line (y_from_top≈105 → y_from_bottom=195).
    # max_h capped so tall novelty glasses don't cover the snout.
    # Width=216 so the bbox stretches across both pupils (~106 and ~232
    # in card coords) with comfortable margin. Monocle is hand-overridden
    # separately since it's a single-eye accessory.
    "glasses":    {"anchor_y": 195, "width": 216, "left": None, "max_h": 108, "pivot": (0.5, 0.5)},
    # Bows on top of the head, same as hats.
    # Bows sit lower + slightly right of the head crown (post-spotting
    # adjustment): +6 right, -16 down on top of the global nudge.
    "bow":        {"anchor_y": 265, "width": 80,  "left": None, "max_h": 80,  "pivot": (0.5, 1.0), "dx_extra": 6, "dy_extra": -16},
    # Scarves wrap around the neck (y_from_top≈210 → y_from_bottom=90) and
    # drape down. Top-pivot, but max_h capped so the drape doesn't escape
    # the card. Empirically scarf art is ~80px tall once trimmed.
    "scarf":      {"anchor_y": 190, "width": 180, "left": None, "max_h": 80,  "pivot": (0.5, 0.0)},
    # Masks center on the eye/snout area.
    "mask":       {"anchor_y": 195, "width": 160, "left": None, "max_h": 120, "pivot": (0.5, 0.5)},
    # Necklaces hang from the neck.
    "necklace":   {"anchor_y": 180, "width": 140, "left": None, "max_h": 90,  "pivot": (0.5, 0.0)},
    # Capes start at the shoulder (y_from_top≈110 → y_from_bottom=190) and
    # billow down behind the body.
    "cape":       {"anchor_y": 220, "width": 240, "left": None, "max_h": 220, "pivot": (0.5, 0.0)},
    # Held items center on the right hand (y_from_top≈215, x≈200 → y=85).
    "held":       {"anchor_y": 85,  "width": 80,  "left": 200,  "max_h": 180, "pivot": (0.5, 0.5)},
    # Auras + backgrounds fill the canvas.
    "aura":       {"anchor_y": 0,   "width": 300, "left": 0,    "max_h": 300, "pivot": (0.5, 1.0)},
    "background": {"anchor_y": 0,   "width": 300, "left": 0,    "max_h": 300, "pivot": (0.5, 1.0)},
}
CARD_W = 300

# Default nudge applied to every auto-generated item. The pig sprite art
# trends slightly down-left from where bbox math expects, so every item
# needed roughly the same offset to look right. Baking it in here saves
# hand-tuning ~95 items in the align screen.
#
# Units: pure pixels in 300×300 card space. Reduced from 20/30 to 14/24
# (a uniform 6px shift left + down) after a global re-spotting pass
# decided everything was sitting a touch too high and too far right.
# Items with a manual override in HAT_OVERLAYS (constants/hats.ts) are
# unaffected since those entries spread AFTER HAT_OVERLAYS_GENERATED.
DEFAULT_LEFT_NUDGE_PX = 14
DEFAULT_BOTTOM_NUDGE_PX = 24


def parse_catalog():
    """Build {item_id: category} from the shop_catalog migration."""
    items = {}
    with open(CATALOG_SQL) as f:
        for line in f:
            # Match rows like: ('beanie', 'Beanie', '🧢', 60, 11, 'hat', 'common', '...')
            m = re.match(
                r"^\('([^']+)',\s*'[^']+',\s*'[^']+',\s*\d+,\s*\d+,\s*'([^']+)',",
                line,
            )
            if m:
                items[m.group(1)] = m.group(2)
    # Originals not in catalog migration:
    for orig_id in ["wizard", "cowboy", "tophat", "party"]:
        items.setdefault(orig_id, "hat")
    items.setdefault("monocle", "glasses")
    return items


def get_aspect(png_path):
    """Trimmed-bbox aspect ratio of opaque pixels, or None if empty.

    Filters out small outlier components (decorative sparkles etc.) so
    the bbox tracks the main item silhouette. Diverging items end up
    a few px off otherwise — this is the auto-correct that means we
    rarely have to tune individual items by hand.
    """
    im = Image.open(png_path).convert("RGBA")
    arr = np.array(im)
    alpha = arr[:, :, 3]
    mask = alpha > 50
    if not mask.any():
        return None, None

    try:
        from scipy import ndimage
        labeled, n_components = ndimage.label(mask)
        if n_components > 1:
            sizes = ndimage.sum(mask, labeled, range(1, n_components + 1))
            largest = int(sizes.max())
            keep = [
                i + 1 for i, sz in enumerate(sizes)
                if sz >= largest * 0.10
            ]
            mask = np.isin(labeled, keep)
    except ImportError:
        pass

    if not mask.any():
        return None, None
    ys, xs = np.where(mask)
    w = int(xs.max() - xs.min() + 1)
    h = int(ys.max() - ys.min() + 1)
    return w / h, (w, h)


def compute_overlay(category, aspect):
    cfg = CATEGORY.get(category, CATEGORY["hat"])
    width = cfg["width"]
    height = max(20, round(width / aspect)) if aspect and aspect > 0.05 else width
    height = min(height, cfg.get("max_h", 300))  # cap so tall items don't cover face
    pivot_x, pivot_y = cfg.get("pivot", (0.5, 1.0))
    anchor_y = cfg["anchor_y"]
    # bottom + (1-pivot_y) * height = anchor_y, so the pivot point on the
    # bbox lands on the category anchor. Solve for bottom:
    bottom = round(anchor_y - (1 - pivot_y) * height)
    if cfg["left"] is not None:
        left = cfg["left"]
    else:
        # Center the bbox around the card's horizontal center adjusted for pivot_x.
        anchor_x = CARD_W // 2
        left = round(anchor_x - pivot_x * width)
    # Apply the default nudge so items don't all need hand-tuning.
    # Full-canvas items (auras + backgrounds) keep their zeroed origin —
    # nudging them would push them off-card.
    if category not in ("aura", "background"):
        left += DEFAULT_LEFT_NUDGE_PX + cfg.get("dx_extra", 0)
        bottom += DEFAULT_BOTTOM_NUDGE_PX + cfg.get("dy_extra", 0)
    return {"bottom": bottom, "left": left, "width": width, "height": height}


def main():
    catalog = parse_catalog()
    overlays = {}
    flags = []
    skipped = []

    for fname in sorted(os.listdir(ASSET_DIR)):
        if not fname.endswith(".png"):
            continue
        item_id = fname[:-4]
        category = catalog.get(item_id)
        if not category:
            skipped.append(f"{item_id}: not in catalog")
            continue
        path = os.path.join(ASSET_DIR, fname)
        aspect, dims = get_aspect(path)
        if aspect is None:
            flags.append(f"{item_id}: no opaque pixels")
            continue
        overlays[item_id] = compute_overlay(category, aspect)

        # Flags for unusual aspect ratios (probably need manual nudge)
        if aspect < 0.45:
            flags.append(
                f"{item_id} ({category}): tall/narrow aspect {aspect:.2f} "
                f"({dims[0]}×{dims[1]}) — likely needs vertical nudge"
            )
        elif aspect > 2.5:
            flags.append(
                f"{item_id} ({category}): wide/short aspect {aspect:.2f} "
                f"({dims[0]}×{dims[1]}) — may overflow horizontally"
            )

    # Write generated TS
    with open(OUTPUT_TS, "w") as f:
        f.write(
            "// AUTO-GENERATED by scripts/compute_overlays.py\n"
            "// Re-run after adding new item PNGs.\n"
            "// Spot-check via the dev Align screen and override anything that looks off.\n\n"
            "import { HatOverlay } from \"./hat_overlay_types\";\n\n"
            "export const HAT_OVERLAYS_GENERATED: Record<string, HatOverlay> = {\n"
        )
        for item_id in sorted(overlays.keys()):
            o = overlays[item_id]
            key = (
                item_id
                if re.match(r"^[a-zA-Z_$][a-zA-Z0-9_$]*$", item_id)
                else f"'{item_id}'"
            )
            f.write(
                f"\t{key}: {{ bottom: {o['bottom']}, left: {o['left']}, "
                f"width: {o['width']}, height: {o['height']} }},\n"
            )
        f.write("};\n")

    # Write report
    with open(OUTPUT_REPORT, "w") as f:
        f.write("# Overlay auto-placement report\n\n")
        f.write(f"Generated {len(overlays)} overlays for items in {ASSET_DIR}.\n\n")
        f.write(f"Output: `{OUTPUT_TS.replace(REPO + '/', '')}`\n\n")
        if flags:
            f.write(f"## {len(flags)} items flagged for manual review\n\n")
            f.write(
                "These have unusual aspect ratios — auto-placement got them in the right "
                "ballpark but you'll likely want to nudge in the dev Align screen.\n\n"
            )
            for line in flags:
                f.write(f"- {line}\n")
        else:
            f.write("## No flags — all items are well within expected aspect ratios.\n\n")
        if skipped:
            f.write(f"\n## {len(skipped)} items skipped (not in catalog)\n\n")
            for line in skipped:
                f.write(f"- {line}\n")
        f.write("\n## Wire it in\n\n")
        f.write(
            "```ts\n"
            "// constants/hats.ts\n"
            'import { HAT_OVERLAYS_GENERATED } from "./hat_overlays.generated";\n'
            "\n"
            "export const HAT_OVERLAYS = {\n"
            "  ...HAT_OVERLAYS_GENERATED,\n"
            "  // override here for any item that needs manual tuning:\n"
            "  // wizard: { bottom: 215, left: 70, width: 160, height: 160 },\n"
            "};\n"
            "```\n"
        )

    print(f"✓ Generated {len(overlays)} overlays → {OUTPUT_TS}")
    if flags:
        print(f"⚠ {len(flags)} items flagged — see {OUTPUT_REPORT}")
    if skipped:
        print(f"  skipped {len(skipped)} (not in catalog)")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""One-off: slice the regenerated Mud War batches (magenta-bg) into the 13
wearable PNGs. Magenta-key -> alpha column-segment -> tight bbox + PAD, mirroring
scripts/slice_mudwar.py's slice_items but with a magenta chroma key + the regen
batch->id mapping (auras/backgrounds were NOT regenerated, so they're untouched)."""
import os
from PIL import Image

OUT = "/Users/bbroeking/projects/oink/assets/images/hats"
PAD = 12

BATCHES = [
    ("assets/images/hats/_mudwar_raw/regen-batch1-hats.png", ["muddy_cap", "slop_bucket_hat", "reed_hat", "bog_helmet", "swamp_crown"]),
    ("assets/images/hats/_mudwar_raw/regen-batch2-held.png", ["slop_bucket", "mud_shovel", "mud_pie", "golden_truffle", "crew_pennant"]),
    ("assets/images/hats/_mudwar_raw/regen-batch3-festival.png", ["rosette_cap", "prize_sash", "festival_pennant"]),
]


def key_magenta(im):
    """RGBA: magenta bg (R,B both >> G) -> alpha 0. Mud items (brown/gold/gray/
    green) all have low (r-g)/(b-g), so they survive; AA halos against magenta
    get caught too."""
    rgba = im.convert("RGBA"); W, H = rgba.size; px = rgba.load()
    for y in range(H):
        for x in range(W):
            r, g, b, _ = px[x, y]
            if (r - g) > 60 and (b - g) > 60:
                px[x, y] = (r, g, b, 0)
    return rgba


def runs(mask):
    out, start = [], None
    for x, v in enumerate(mask):
        if v and start is None:
            start = x
        elif not v and start is not None:
            out.append((start, x - 1)); start = None
    if start is not None:
        out.append((start, len(mask) - 1))
    return out


def subdivide(rns, n):
    total = sum(b - a + 1 for a, b in rns); unit = total / n; cells = []
    for a, b in rns:
        w = b - a + 1; k = max(1, round(w / unit)); step = w / k
        for i in range(k):
            cells.append((int(a + i * step), int(a + (i + 1) * step) - 1))
    return cells


def slice_batch(path, ids):
    im = key_magenta(Image.open(path)); W, H = im.size
    prof = list(im.getchannel("A").resize((W, 1)).getdata())
    mask = [v > 8 for v in prof]
    rns = runs(mask)
    # Clean runs (one per item) → use them; otherwise the row has stray islands
    # (e.g. golden_truffle's sparkles) → fall back to EQUAL columns, which keeps
    # each item's sparkles inside its own cell.
    n = len(ids)
    cells = rns if len(rns) == n else [(round(i * W / n), round((i + 1) * W / n) - 1) for i in range(n)]
    saved = []
    for (x0, x1), iid in zip(cells, ids):
        band = im.crop((x0, 0, x1 + 1, H))
        bbox = band.getchannel("A").point(lambda a: 255 if a > 40 else 0).getbbox()
        if not bbox:
            continue
        l, t, r, b = bbox
        l = max(0, l - PAD); t = max(0, t - PAD)
        r = min(band.width, r + PAD); b = min(band.height, b + PAD)
        crop = band.crop((l, t, r, b))
        crop.save(os.path.join(OUT, f"{iid}.png")); saved.append((iid, crop.size))
    return len(rns), saved


for path, ids in BATCHES:
    nr, saved = slice_batch(path, ids)
    print(f"{os.path.basename(path)}: {len(saved)}/{len(ids)} (alpha runs={nr}) -> {saved}")

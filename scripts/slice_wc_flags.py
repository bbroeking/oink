#!/usr/bin/env python3
"""Slice the World Cup flag-sticker STRIPS into 47 individually-named PNGs.

Each strip is a horizontal row of N transparent-background flag stickers on a
1536x1024 canvas. We segment by finding runs of non-transparent columns
separated by empty gaps; if the detected count != expected we fall back to
splitting the overall content bbox into N equal cells. Each flag is then
tight-cropped to its alpha bbox (+ small padding) and saved.
"""
import os
import sys
from PIL import Image
import numpy as np
from scipy import ndimage

SRC = os.path.expanduser("~/Desktop/ttp-refs/world-cup-flags/generated")
OUT = os.path.expanduser("~/Desktop/ttp-refs/world-cup-flags/flags")

# strip filename -> ordered country slugs (left to right)
STRIPS = {
    "batch1-flat.png": ["brazil", "argentina", "france", "japan", "mexico", "usa"],
    "batch2-uefa.png": ["spain", "england", "portugal", "germany", "netherlands",
                          "belgium", "croatia", "norway"],
    "batch3-uefa2.png": ["switzerland", "austria", "scotland", "sweden", "turkiye",
                          "czechia", "bosnia-and-herzegovina", "colombia"],
    "batch4-conmebol-concacaf.png": ["ecuador", "uruguay", "paraguay", "canada",
                          "panama", "haiti", "curacao", "morocco"],
    "batch5-caf.png": ["senegal", "egypt", "tunisia", "algeria", "south-africa",
                          "cote-divoire", "ghana", "cape-verde"],
    "batch6-afc-ofc.png": ["dr-congo", "south-korea", "australia", "uzbekistan",
                          "jordan", "qatar", "saudi-arabia", "new-zealand"],
    "iraq.png": ["iraq"],
}

ALPHA_T = 190      # only SOLID pixels count (excludes soft drop-shadow so
                   # adjacent flags don't merge across their shadows)
MIN_COL = 6        # a column is "ink" if it has at least this many solid px
PAD = 14           # padding around each tight crop (re-includes the shadow)


def content_cols(alpha):
    return (alpha > ALPHA_T).sum(axis=0) >= MIN_COL


def runs(mask):
    """Return [(x0, x1)] inclusive runs of True in a 1-D bool array."""
    out, start = [], None
    for x, v in enumerate(mask):
        if v and start is None:
            start = x
        elif not v and start is not None:
            out.append((start, x - 1)); start = None
    if start is not None:
        out.append((start, len(mask) - 1))
    return out


def crop_cell(im, x0, x1):
    """Within column band [x0,x1], keep the LARGEST solid connected component
    (the flag sticker — its white die-cut border unifies cloth+pole), drop any
    neighbor sliver, then crop the original (with shadow) to that bbox + pad."""
    sub = im.crop((x0, 0, x1 + 1, im.height))
    solid = np.asarray(sub)[:, :, 3] > ALPHA_T
    if not solid.any():
        return None
    lbl, n = ndimage.label(solid)
    if n == 0:
        return None
    # largest component by pixel count (ignore background label 0)
    sizes = ndimage.sum(np.ones_like(lbl), lbl, index=range(1, n + 1))
    keep = int(np.argmax(sizes)) + 1
    ys, xs = np.where(lbl == keep)
    l, r, t, b = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    l = max(0, l - PAD); t = max(0, t - PAD)
    r = min(sub.width, r + 1 + PAD); b = min(sub.height, b + 1 + PAD)
    return sub.crop((l, t, r, b))


def cells_for(seg_runs, n):
    """Equal-width flags merged into fewer runs (flags touching) -> subdivide
    wide runs by the estimated unit width so the total comes back to n."""
    total = sum(x1 - x0 + 1 for x0, x1 in seg_runs)
    unit = total / n
    cells = []
    for x0, x1 in seg_runs:
        w = x1 - x0 + 1
        k = max(1, round(w / unit))
        step = w / k
        for i in range(k):
            cells.append((int(x0 + i * step), int(x0 + (i + 1) * step) - 1))
    return cells


def slice_strip(path, slugs):
    im = Image.open(path).convert("RGBA")
    alpha = np.asarray(im)[:, :, 3]
    n = len(slugs)
    seg_runs = runs(content_cols(alpha))
    cells = seg_runs if len(seg_runs) == n else cells_for(seg_runs, n)
    mode = "gap" if len(seg_runs) == n else f"subdivided ({len(seg_runs)}->{len(cells)})"

    saved = []
    for (x0, x1), slug in zip(cells, slugs):
        crop = crop_cell(im, x0, x1)
        if crop is None:
            continue
        crop.save(os.path.join(OUT, f"flag_{slug}.png"))
        saved.append((slug, crop.size))
    return mode, saved


def main():
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for fname, slugs in STRIPS.items():
        path = os.path.join(SRC, fname)
        if not os.path.exists(path):
            print(f"MISSING {fname}"); continue
        mode, saved = slice_strip(path, slugs)
        total += len(saved)
        print(f"{fname}: {len(saved)}/{len(slugs)} via {mode}")
        if len(saved) != len(slugs):
            print(f"  !! count mismatch — got {[s for s,_ in saved]}")
    print(f"\nTOTAL: {total} flags -> {OUT}")


if __name__ == "__main__":
    main()

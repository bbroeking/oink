#!/usr/bin/env python3
"""Slice a ChatGPT "sticker sheet" (N items in one horizontal row on white)
into N individual transparent stickers — the 5-at-a-time pipeline.

Usage: slice_sheet.py <sheet.png> <id1> <id2> ... <idN>

Flood-fills the white background (thresh 55, from edges), then finds the N-1
widest vertical white gutters between content columns and splits into N cells
left-to-right. Each cell is cropped to its opaque bbox, recentered with a 6%
margin, resized to 256, saved to assets/images/hats/<id>.png. Warns if the
detected content doesn't cleanly yield N cells.
"""
import sys, os
import numpy as np
from PIL import Image, ImageDraw


def remove_white(src):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    SENT = (255, 0, 255)
    seeds = [(2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3),
             (w // 2, 2), (w // 2, h - 3), (2, h // 2), (w - 3, h // 2)]
    for s in seeds:
        ImageDraw.floodfill(im, s, SENT, thresh=55)
    rgba = im.convert("RGBA")
    px = list(rgba.getdata())
    rgba.putdata([(0, 0, 0, 0) if p[:3] == SENT else p for p in px])
    return rgba


def column_gutters(alpha, min_run=8):
    """Return list of (start,end) empty-column runs (gutters)."""
    col_has = (alpha > 16).any(axis=0)  # True where column has content
    gutters = []
    run_start = None
    for x, has in enumerate(col_has):
        if not has and run_start is None:
            run_start = x
        elif has and run_start is not None:
            if x - run_start >= min_run:
                gutters.append((run_start, x))
            run_start = None
    # trailing run ignored (edge). leading edge run ignored too (handled by bbox)
    return col_has, gutters


def save_cell(cell_rgba, out_id, margin=0.06):
    bbox = cell_rgba.getbbox()
    if not bbox:
        print(f"  !! {out_id}: empty cell")
        return False
    glyph = cell_rgba.crop(bbox)
    gw, gh = glyph.size
    side = round(max(gw, gh) * (1 + 2 * margin))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(glyph, ((side - gw) // 2, (side - gh) // 2), glyph)
    canvas = canvas.resize((256, 256), Image.LANCZOS)
    os.makedirs("assets/images/hats", exist_ok=True)
    out = f"assets/images/hats/{out_id}.png"
    canvas.save(out)
    a = np.array(canvas)[:, :, 3]
    print(f"  {out_id}: saved {out} ({int((a == 0).mean()*100)}% transparent)")
    return True


def main():
    src = sys.argv[1]
    ids = sys.argv[2:]
    n = len(ids)
    rgba = remove_white(src)
    arr = np.array(rgba)
    alpha = arr[:, :, 3]
    col_has, gutters = column_gutters(alpha)
    # interior gutters only (between first and last content column)
    cols = np.where(col_has)[0]
    if len(cols) == 0:
        print("no content found"); sys.exit(1)
    lo, hi = cols[0], cols[-1]
    interior = [g for g in gutters if g[0] > lo and g[1] < hi]
    # pick the n-1 widest gutters as split points (their centers)
    interior.sort(key=lambda g: g[1] - g[0], reverse=True)
    splits = sorted([(g[0] + g[1]) // 2 for g in interior[: n - 1]])
    print(f"detected {len(interior)} interior gutters; using {len(splits)} splits for {n} cells")
    bounds = [lo] + splits + [hi + 1]
    if len(bounds) != n + 1:
        print(f"  !! expected {n} cells, got {len(bounds)-1} — check the sheet")
    ok = 0
    for i, out_id in enumerate(ids):
        if i + 1 >= len(bounds):
            print(f"  !! {out_id}: no cell"); continue
        x0, x1 = bounds[i], bounds[i + 1]
        cell = rgba.crop((x0, 0, x1, rgba.height))
        if save_cell(cell, out_id):
            ok += 1
    print(f"sliced {ok}/{n}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit("usage: slice_sheet.py <sheet.png> <id1> ... <idN>")
    main()

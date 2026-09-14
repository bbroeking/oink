#!/usr/bin/env python3
"""Slice a magenta-keyed ImageGen animation sheet onto Rosie's frame canvas.

    slice_sheet.py <sheet.png> <outdir> <prefix> [cols=4] [rows=3]

Keys #FF00FF with a soft edge + despill, splits cells by the empty gutters
(alpha projections), then fits every frame onto the 370x383 sprite canvas at
ONE shared scale (frame 1's height -> Rosie's idle_1 height) with the hooves on
her baseline, so pose changes read as motion and never as resizing.
"""
import sys, numpy as np
from PIL import Image
sheet, out, prefix = sys.argv[1], sys.argv[2], sys.argv[3]
COLS = int(sys.argv[4]) if len(sys.argv) > 4 else 4
ROWS = int(sys.argv[5]) if len(sys.argv) > 5 else 3
CANVAS = (370, 383); REF_H = 367; BASELINE = 375; CX = 186.0   # Rosie idle_1 bbox
import os; os.makedirs(out, exist_ok=True)

im = np.array(Image.open(sheet).convert("RGB")).astype(np.float32)
mag = np.array([255, 0, 255], np.float32)
d = np.linalg.norm(im - mag, axis=2)
alpha = np.clip((d - 60) / 80, 0, 1)                      # soft key
a3 = alpha[..., None]
rgb = np.where(a3 > 0.02, (im - (1 - a3) * mag) / np.maximum(a3, 0.02), 0)   # despill (un-blend)
rgb = np.clip(rgb, 0, 255)
rgba = np.concatenate([rgb, alpha[..., None] * 255], axis=2).astype(np.uint8)

def runs(mask):
    """[(start, end)] of True runs along a 1-D mask."""
    r, on, s = [], False, 0
    for i, v in enumerate(mask):
        if v and not on: on, s = True, i
        if not v and on: on = False; r.append((s, i))
    if on: r.append((s, len(mask)))
    return r
occ = alpha > 0.5
row_runs = [r for r in runs(occ.any(axis=1)) if r[1] - r[0] > 40]
col_runs_by_row = []
cells = []
for (y0, y1) in row_runs:
    band = occ[y0:y1]
    cols = [c for c in runs(band.any(axis=0)) if c[1] - c[0] > 40]
    for (x0, x1) in cols:
        sub = occ[y0:y1, x0:x1]; ys, xs = np.where(sub)
        cells.append((y0 + ys.min(), x0 + xs.min(), y0 + ys.max() + 1, x0 + xs.max() + 1))
assert len(cells) == COLS * ROWS, f"found {len(cells)} cells, expected {COLS*ROWS}: rows={len(row_runs)}"
cells.sort(key=lambda c: (c[0] // 50, c[1]))  # reading order (rows bucketed)

frames = [Image.fromarray(rgba[t:b, l:r], "RGBA") for (t, l, b, r) in cells]
scale = REF_H / frames[0].height
for i, f in enumerate(frames, 1):
    rs = f.resize((round(f.width * scale), round(f.height * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    canvas.alpha_composite(rs, (round(CX - rs.width / 2), BASELINE - rs.height))
    canvas.save(f"{out}/{prefix}_{i}.png")
    print(f"{prefix}_{i}: cell {f.size} -> {rs.size}")
# preview gif at 7.5 fps + strip
seq = []
for i in range(1, len(frames) + 1):
    fr = Image.open(f"{out}/{prefix}_{i}.png").convert("RGBA"); bg = Image.new("RGBA", fr.size, (252, 246, 238, 255)); bg.alpha_composite(fr); seq.append(bg.convert("P", palette=Image.ADAPTIVE))
seq[0].save(f"{out}/preview.gif", save_all=True, append_images=seq[1:], duration=int(1000 / (len(frames) / 1.6)), loop=0)
w, h = seq[0].size; strip = Image.new("RGB", (w * len(seq), h), (252, 246, 238))
for i, s in enumerate(seq): strip.paste(s.convert("RGB"), (i * w, 0))
strip.resize((strip.width // 2, strip.height // 2)).save(f"{out}/strip_small.png")

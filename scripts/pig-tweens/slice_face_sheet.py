#!/usr/bin/env python3
"""Slice a magenta-keyed 4x2 "facing a friend" ImageGen sheet onto the sprite canvas.

    slice_face_sheet.py <sheet.png> <outdir>

Row 1 is the standing three-quarter idle (-> face_1..4), row 2 the seated one
(-> face_sit_1..4). Same key + despill as slice_sheet.py, but ONE scale for
both rows — the standing frame 1's height maps to Rosie's idle_1 height, and
the seated frames keep that scale so sitting down reads as a pose, never as a
shrink. Every frame is centred on the canvas with its hooves on the baseline.
"""
import os, sys, numpy as np
from PIL import Image
sheet, out = sys.argv[1], sys.argv[2]
COLS, ROWS = 4, 2
CANVAS = (370, 383); REF_H = 367; BASELINE = 375; CX = 186.0   # Rosie idle_1 bbox
os.makedirs(out, exist_ok=True)

im = np.array(Image.open(sheet).convert("RGB")).astype(np.float32)
mag = np.array([255, 0, 255], np.float32)
d = np.linalg.norm(im - mag, axis=2)
alpha = np.clip((d - 60) / 80, 0, 1)
a3 = alpha[..., None]
rgb = np.where(a3 > 0.02, (im - (1 - a3) * mag) / np.maximum(a3, 0.02), 0)
rgb = np.clip(rgb, 0, 255)
rgba = np.concatenate([rgb, alpha[..., None] * 255], axis=2).astype(np.uint8)

def runs(mask):
    r, on, s = [], False, 0
    for i, v in enumerate(mask):
        if v and not on: on, s = True, i
        if not v and on: on = False; r.append((s, i))
    if on: r.append((s, len(mask)))
    return r
occ = alpha > 0.5
row_runs = [r for r in runs(occ.any(axis=1)) if r[1] - r[0] > 40]
cells = []
for row, (y0, y1) in enumerate(row_runs):
    band = occ[y0:y1]
    cols = [c for c in runs(band.any(axis=0)) if c[1] - c[0] > 40]
    for (x0, x1) in cols:
        sub = occ[y0:y1, x0:x1]; ys, xs = np.where(sub)
        cells.append((row, y0 + ys.min(), x0 + xs.min(), y0 + ys.max() + 1, x0 + xs.max() + 1))
assert len(cells) == COLS * ROWS, f"found {len(cells)} cells, expected {COLS*ROWS}: rows={len(row_runs)}"
# Reading order by the gutter-split row, not a bucketed top edge: a lifted ear
# must not reorder a frame.
cells.sort(key=lambda c: (c[0], c[2]))
cells = [c[1:] for c in cells]

frames = [Image.fromarray(rgba[t:b, l:r], "RGBA") for (t, l, b, r) in cells]
scale = REF_H / frames[0].height
names = [f"face_{i}" for i in range(1, 5)] + [f"face_sit_{i}" for i in range(1, 5)]
for name, f in zip(names, frames):
    rs = f.resize((round(f.width * scale), round(f.height * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    canvas.alpha_composite(rs, (round(CX - rs.width / 2), BASELINE - rs.height))
    canvas.save(f"{out}/{name}.png")
    print(f"{name}: cell {f.size} -> {rs.size}")
for prefix in ("face", "face_sit"):
    seq = []
    for i in range(1, 5):
        fr = Image.open(f"{out}/{prefix}_{i}.png").convert("RGBA"); bg = Image.new("RGBA", fr.size, (252, 246, 238, 255)); bg.alpha_composite(fr); seq.append(bg.convert("P", palette=Image.ADAPTIVE))
    seq[0].save(f"{out}/{prefix}_preview.gif", save_all=True, append_images=seq[1:], duration=400, loop=0)
w, h = CANVAS
strip = Image.new("RGB", (w * 4, h * 2), (252, 246, 238))
for i, name in enumerate(names):
    fr = Image.open(f"{out}/{name}.png").convert("RGBA"); bg = Image.new("RGBA", fr.size, (252, 246, 238, 255)); bg.alpha_composite(fr)
    strip.paste(bg.convert("RGB"), ((i % 4) * w, (i // 4) * h))
strip.resize((strip.width // 2, strip.height // 2)).save(f"{out}/contact.png")

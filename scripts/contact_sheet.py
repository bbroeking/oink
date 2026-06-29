#!/usr/bin/env python3
"""Compose a checkerboard contact sheet of sliced sticker PNGs for review.
Usage: contact_sheet.py <out.png> <id1> <id2> ...  (reads assets/images/hats/<id>.png)"""
import sys
from PIL import Image

out = sys.argv[1]
ids = sys.argv[2:]
pad, cell = 12, 256

def checker(size, sq=16):
    im = Image.new("RGB", (size, size), (255, 255, 255))
    px = im.load()
    for y in range(size):
        for x in range(size):
            if (x // sq + y // sq) % 2:
                px[x, y] = (210, 210, 215)
    return im.convert("RGBA")

sheet = Image.new("RGB", (cell * len(ids) + pad * (len(ids) + 1), cell + pad * 2), (235, 235, 238))
for i, id_ in enumerate(ids):
    g = Image.open(f"assets/images/hats/{id_}.png").convert("RGBA")
    bg = checker(cell)
    bg.alpha_composite(g)
    sheet.paste(bg.convert("RGB"), (pad + i * (cell + pad), pad))
sheet.save(out)
print(f"saved {out}")

#!/usr/bin/env python3
"""Process a ChatGPT cosmetic image for Tickle the Pig.

Usage:
  process_cosmetic.py <source.png> <out_id>          # sticker (default)
  process_cosmetic.py <source.png> <out_id> bg       # full-scene background

Sticker mode: flood-fills the plain-white background from the edges (thresh 55
keeps the sticker's white outline highlights), crops to the glyph, recenters
with a small margin, downsizes to 256 -> assets/images/hats/<out_id>.png.

Background mode: NO bg-removal (scenes are opaque + full-bleed). Center-crops
to square + resizes to 512 -> assets/images/backgrounds/<out_id>.png.
"""
import sys, os
from PIL import Image, ImageDraw


def process_bg(src, out_id, size=512):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
    im = im.resize((size, size), Image.LANCZOS)
    os.makedirs("assets/images/backgrounds", exist_ok=True)
    out = f"assets/images/backgrounds/{out_id}.png"
    im.save(out)
    print(f"{out_id}: saved {out} (background {size}x{size})")
    return out

def process(src, out_id, margin=0.06, thresh=55):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    SENT = (255, 0, 255)
    seeds = [(2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3),
             (w // 2, 2), (w // 2, h - 3), (2, h // 2), (w - 3, h // 2)]
    for s in seeds:
        ImageDraw.floodfill(im, s, SENT, thresh=thresh)
    rgba = im.convert("RGBA")
    rgba.putdata([(0, 0, 0, 0) if p[:3] == SENT else p for p in rgba.getdata()])
    bbox = rgba.getbbox()
    if not bbox:
        raise SystemExit(f"{out_id}: empty after bg-removal (thresh too low?)")
    glyph = rgba.crop(bbox)
    gw, gh = glyph.size
    side = round(max(gw, gh) * (1 + 2 * margin))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(glyph, ((side - gw) // 2, (side - gh) // 2), glyph)
    canvas = canvas.resize((256, 256), Image.LANCZOS)
    os.makedirs("assets/images/hats", exist_ok=True)
    out = f"assets/images/hats/{out_id}.png"
    canvas.save(out)
    a = canvas.split()[3]
    transp = sum(1 for v in a.getdata() if v == 0) * 100 // (256 * 256)
    print(f"{out_id}: saved {out} ({transp}% transparent)")
    return out

if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit("usage: process_cosmetic.py <source.png> <out_id> [bg]")
    if len(sys.argv) > 3 and sys.argv[3] == "bg":
        process_bg(sys.argv[1], sys.argv[2])
    else:
        process(sys.argv[1], sys.argv[2])

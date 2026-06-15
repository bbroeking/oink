#!/usr/bin/env python3
"""Slice the Mud War sprite STRIPS into individually-named PNGs. PIL-only (no
numpy/scipy — the env is PEP-668 locked). Transparent-item strips are segmented
by alpha column-gaps then tight-cropped to their alpha bbox; filled background
strips are white-trimmed then grid-sliced into equal cells."""
import os
from PIL import Image, ImageDraw

RAW = "assets/images/hats/_mudwar_raw"
OUT = "assets/images/hats"          # items, held, auras
BG_OUT = "assets/images/backgrounds"  # backgrounds load from here in HAT_IMAGES
PAD = 12

ITEM_STRIPS = {
    "strip1-mud-hats.png": ["muddy_cap", "slop_bucket_hat", "reed_hat", "bog_helmet", "swamp_crown"],
    "strip2-held.png": ["slop_bucket", "mud_shovel", "mud_pie", "golden_truffle", "crew_pennant"],
    "strip3-auras.png": ["mud_splatter_aura", "swamp_bubble_aura", "firefly_aura", "golden_bog_aura", "heirloom_mire_aura"],
}
BG_STRIPS = {
    "strip4-backgrounds.png": ["mud_pit_bg", "reed_marsh_bg", "mud_derby_bg", "bog_dusk_bg", "golden_mire_bg"],
}


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


def slice_items(path, ids):
    im = Image.open(path).convert("RGBA"); W, H = im.size
    # average alpha per column (resize to W x 1) -> content mask
    prof = list(im.getchannel("A").resize((W, 1)).getdata())
    mask = [v > 8 for v in prof]
    rns = runs(mask)
    cells = rns if len(rns) == len(ids) else subdivide(rns, len(ids))
    saved = []
    for (x0, x1), iid in zip(cells, ids):
        band = im.crop((x0, 0, x1 + 1, H))
        # tight bbox from SOLID alpha only (faint sub-threshold px would expand
        # the bbox to full canvas height otherwise)
        bbox = band.getchannel("A").point(lambda a: 255 if a > 40 else 0).getbbox()
        if not bbox:
            continue
        l, t, r, b = bbox
        l = max(0, l - PAD); t = max(0, t - PAD)
        r = min(band.width, r + PAD); b = min(band.height, b + PAD)
        crop = band.crop((l, t, r, b))
        crop.save(os.path.join(OUT, f"{iid}.png")); saved.append((iid, crop.size))
    return len(rns), saved


def trim_white(im):
    g = im.convert("L").point(lambda p: 0 if p > 245 else 255)
    bb = g.getbbox()
    return im.crop(bb) if bb else im


def slice_bgs(path, ids):
    im = trim_white(Image.open(path).convert("RGB")); W, H = im.size
    cw = W / len(ids); saved = []
    for i, iid in enumerate(ids):
        cell = im.crop((round(i * cw), 0, round((i + 1) * cw), H))
        cell.save(os.path.join(BG_OUT, f"{iid}.png")); saved.append((iid, cell.size))
    return saved


def key_white(cell):
    """RGB cell -> RGBA. Strip 5 baked a subtle white+light-gray transparency
    checkerboard (both luminance>240, near-zero saturation). A connected
    flood-fill broke on the checker's AA seams, so we GLOBAL-key any
    high-luminance + low-saturation pixel to alpha 0 — the items are
    dark-outlined and saturated, so they survive; only the light gray/white
    background (and any tiny light item highlights) are removed."""
    rgba = cell.convert("RGBA"); W, H = cell.size
    px = rgba.load()
    for y in range(H):
        for x in range(W):
            r, g, b, _ = px[x, y]
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            sat = max(r, g, b) - min(r, g, b)
            if lum > 196 and sat < 30:
                px[x, y] = (r, g, b, 0)
    return rgba


def night_cut(im, x0, x1, H):
    """The confetti cell (i==3) abuts the FILLED night-bg scene (i==4) with no
    gutter, so a fixed-fraction trim either clips the ring or leaks a dark
    sliver of the scene. Instead detect the boundary: scan columns L->R and
    return the first column past the cell midpoint whose mean luminance drops
    into night-scene territory (the confetti sits on bright white ~240; the
    night scene is dark ~120). Cut a few px before it for safety."""
    px = im.load()
    ys = range(0, H, 4)
    for x in range(x0, x1):
        lum = sum(0.299 * px[x, y][0] + 0.587 * px[x, y][1] + 0.114 * px[x, y][2]
                  for y in ys) / len(ys)
        if lum < 160 and x > x0 + (x1 - x0) * 0.5:
            return x - 4
    return round(x1 - (x1 - x0) * 0.12)  # fallback: old fixed trim


def slice_festival(ids):
    """Strip 5 (RGB): cells 0-3 are items on white (key it out); cell 4 is the
    festival-night background scene."""
    im = Image.open(os.path.join(RAW, "strip5-festival.png")).convert("RGB")
    W, H = im.size; cw = W / 5; saved = []
    for i, iid in enumerate(ids):
        x0, x1 = round(i * cw), round((i + 1) * cw)
        if i == 3:  # confetti cell abuts the filled night-bg scene
            x1 = night_cut(im, x0, x1, H)
        cell = im.crop((x0, 0, x1, H))
        if i < 4:
            keyed = key_white(cell)
            bbox = keyed.getchannel("A").point(lambda a: 255 if a > 40 else 0).getbbox()
            if bbox:
                l, t, r, b = bbox
                l = max(0, l - PAD); t = max(0, t - PAD)
                r = min(keyed.width, r + PAD); b = min(keyed.height, b + PAD)
                keyed = keyed.crop((l, t, r, b))
            keyed.save(os.path.join(OUT, f"{iid}.png")); saved.append((iid, keyed.size))
        else:
            bg = trim_white(cell)
            bg.save(os.path.join(BG_OUT, f"{iid}.png")); saved.append((iid, bg.size))
    return saved


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(BG_OUT, exist_ok=True)
    for fn, ids in ITEM_STRIPS.items():
        nr, saved = slice_items(os.path.join(RAW, fn), ids)
        print(f"{fn}: {len(saved)}/{len(ids)} (alpha runs={nr}) -> {[ (i,s) for i,s in saved]}")
    for fn, ids in BG_STRIPS.items():
        saved = slice_bgs(os.path.join(RAW, fn), ids)
        print(f"{fn}: {len(saved)}/{len(ids)} (grid) -> {[ (i,s) for i,s in saved]}")
    fest = slice_festival(["rosette_cap", "prize_sash", "festival_pennant", "confetti_aura", "festival_night_bg"])
    print(f"strip5-festival.png: {len(fest)}/5 (key+grid) -> {fest}")


if __name__ == "__main__":
    main()

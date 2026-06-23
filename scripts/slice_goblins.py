#!/usr/bin/env python3
"""Slice the Slop Toss goblin/splat STRIPS into individually-named PNGs.

These three strips each hold a row of evenly-spaced subjects on a magenta key
that's already been removed to alpha. Unlike the hat strips, the goblins can
TOUCH (a scout leaning into a brute, a shovel bridging a gutter), so a plain
alpha column-gap segmentation merges them. Instead we cut at the alpha VALLEY
nearest each evenly-spaced boundary, then tight-crop+pad each subject. PIL-only
(the env is PEP-668 locked)."""
import os
from PIL import Image

RAW = "assets/images/hats/_mudwar_raw"
OUT = "assets/images/hats"
PAD = 14

STRIPS = {
    "strip6-goblins-run.png": ["goblin_grunt", "goblin_scout", "goblin_brute", "goblin_warboss"],
    "strip7-goblins-hit.png": ["goblin_grunt_hit", "goblin_scout_hit", "goblin_brute_hit", "goblin_warboss_hit"],
    "strip8-splat.png": ["mud_splat", "mud_splat_gold"],
}


def col_alpha(im):
    """Per-column alpha mass (rows subsampled for speed)."""
    a = im.getchannel("A")
    W, H = im.size
    px = a.load()
    step = max(1, H // 320)
    return [sum(px[x, y] for y in range(0, H, step)) for x in range(W)]


def content_bounds(cs, thr):
    xs = [x for x, v in enumerate(cs) if v > thr]
    return (xs[0], xs[-1]) if xs else (0, len(cs) - 1)


def valley_cuts(cs, n, lo, hi):
    """n cells across [lo,hi]; each interior cut snapped to the lowest-alpha
    column within +-30% of a cell of the evenly-spaced ideal boundary."""
    cuts = [lo]
    cell = (hi - lo) / n
    for i in range(1, n):
        ideal = lo + i * cell
        win = int(cell * 0.30)
        a = max(lo, int(ideal - win))
        b = min(hi, int(ideal + win))
        cut = min(range(a, b + 1), key=lambda x: cs[x])
        cuts.append(cut)
    cuts.append(hi)
    return cuts


def slice_strip(path, ids):
    im = Image.open(path).convert("RGBA")
    cs = col_alpha(im)
    thr = 255 * 2
    lo, hi = content_bounds(cs, thr)
    cuts = valley_cuts(cs, len(ids), lo, hi)
    saved = []
    for i, iid in enumerate(ids):
        x0, x1 = cuts[i], cuts[i + 1]
        band = im.crop((x0, 0, x1 + 1, im.height))
        bbox = band.getchannel("A").point(lambda a: 255 if a > 40 else 0).getbbox()
        if not bbox:
            continue
        l, t, r, b = bbox
        l = max(0, l - PAD); t = max(0, t - PAD)
        r = min(band.width, r + PAD); b = min(band.height, b + PAD)
        crop = band.crop((l, t, r, b))
        crop.save(os.path.join(OUT, f"{iid}.png"))
        saved.append((iid, crop.size))
    return cuts, saved


def main():
    for fn, ids in STRIPS.items():
        cuts, saved = slice_strip(os.path.join(RAW, fn), ids)
        print(f"{fn}: cuts={cuts} -> {saved}")


if __name__ == "__main__":
    main()

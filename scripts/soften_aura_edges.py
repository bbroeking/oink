#!/usr/bin/env python3
"""Soften every aura's hard outer border. The aura art is opaque out to ~85% of
its radius, so when PigStage clips the (widened) aura to the 300 card it cuts
straight through solid pixels → a hard rectangular border at the card edge. This
bakes a RADIAL alpha FALLOFF into each aura PNG (full in the centre where the
glow sits behind Rosie, smoothly fading to transparent toward the edge) so the
halo dissolves instead of getting a visible cut line.

One-shot + reversible: originals are copied to tmp/aura-orig/ first. NOT part of
any pipeline (re-running would double-fade), so run it deliberately.

Usage: soften_aura_edges.py [start=0.5] [end=0.95]
"""
import json, os, re, shutil, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKUP = os.path.join(ROOT, "tmp", "aura-orig")
START = float(sys.argv[1]) if len(sys.argv) > 1 else 0.5   # full inside this radius
END = float(sys.argv[2]) if len(sys.argv) > 2 else 0.95    # transparent beyond this


def aura_ids():
    ids = set()
    cat = os.path.join(ROOT, "docs", "members-catalog.json")
    if os.path.isfile(cat):
        for it in json.load(open(cat)):
            if it["category"] == "aura":
                ids.add(it["id"])
    for sql in ["supabase/migrations/20260502030000_shop_catalog.sql",
                "supabase/migrations/20260650000000_mud_war_cosmetics.sql"]:
        p = os.path.join(ROOT, sql)
        if os.path.isfile(p):
            for line in open(p):
                m = re.match(r"^\s*\('([^']+)',\s*'[^']*',\s*(?:'[^']*'|NULL),\s*\d+,\s*\d+,\s*'aura'", line)
                if m:
                    ids.add(m.group(1))
    return sorted(ids)


def falloff_mask(h, w):
    cy, cx = h / 2, w / 2
    r = min(h, w) / 2
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt((yy - cy) ** 2 + (xx - cx) ** 2) / r
    m = np.clip((END - d) / (END - START), 0, 1)
    return m * m * (3 - 2 * m)   # smoothstep — no banding at the seams


def main():
    os.makedirs(BACKUP, exist_ok=True)
    done = 0
    for aid in aura_ids():
        src = os.path.join(ROOT, "assets", "images", "hats", f"{aid}.png")
        if not os.path.isfile(src):
            continue
        bak = os.path.join(BACKUP, f"{aid}.png")
        if not os.path.exists(bak):
            shutil.copy2(src, bak)               # back up the original once
        im = Image.open(bak).convert("RGBA")     # always fade from the ORIGINAL
        arr = np.array(im).astype(float)
        arr[:, :, 3] *= falloff_mask(*arr.shape[:2])
        Image.fromarray(arr.astype("uint8")).save(src)
        done += 1
    print(f"softened {done} auras (falloff {START}-{END}); originals in tmp/aura-orig/")


if __name__ == "__main__":
    main()

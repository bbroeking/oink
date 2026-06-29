#!/usr/bin/env python3
"""One-shot: convert the remaining legacy HAT_OVERLAYS items to RelSpec.

For each legacy item it reads the effective overlay box {bottom,left,width,height}
(the 300-card REST placement), measures the PNG, and computes the RelSpec
(pivot/widthFrac/anchor) that renders the glyph at the SAME on-screen position +
size — accounting for resizeMode=contain letterboxing inside the legacy box. The
category anchor matches the legacy frameDelta anchor, so animation tracking is
preserved too. Merges into constants/hat_rel.generated.ts via the studio writer.

Dry run:  migrate_legacy_to_rel.py            (prints, writes nothing)
Apply:    migrate_legacy_to_rel.py --apply
"""
import sys, os, re, importlib.util
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("ps", os.path.join(ROOT, "tools/placement_studio.py"))
ps = importlib.util.module_from_spec(spec); spec.loader.exec_module(ps)

CARD = 300
CATEGORY_ANCHOR = {"hat": "head", "bow": "head", "glasses": "eyes", "mask": "eyes",
                   "scarf": "neck", "necklace": "neck", "neck": "neck", "cape": "body",
                   "held": "hand_r", "aura": "body", "background": "body"}
# tophat's live placement is the manual override in hats.ts (wins over generated)
MANUAL = {"tophat": {"bottom": 209, "left": 74, "width": 140, "height": 153}}

rest = ps.parse_rest_anchors()


def parse_overlays():
    src = open(os.path.join(ROOT, "constants/hat_overlays.generated.ts")).read()
    out = {}
    for m in re.finditer(r"^\t(\w+): \{ bottom: (-?\d+), left: (-?\d+), width: (\d+), height: (\d+) \}", src, re.M):
        i, b, l, w, h = m.groups()
        out[i] = {"bottom": int(b), "left": int(l), "width": int(w), "height": int(h)}
    out.update(MANUAL)
    return out


def category_of(item_id):
    cat = {}
    for sql in ["supabase/migrations/20260502030000_shop_catalog.sql",
                "supabase/migrations/20260650000000_mud_war_cosmetics.sql",
                "supabase/migrations/20260690000000_seed_members_catalog.sql"]:
        p = os.path.join(ROOT, sql)
        if not os.path.isfile(p):
            continue
        for line in open(p):
            m = re.match(r"^\s*\('([^']+)',\s*'[^']*',\s*(?:'[^']*'|NULL),\s*\d+,\s*\d+,\s*'([^']+)',", line)
            if m:
                cat[m.group(1)] = m.group(2)
    cat.setdefault("tophat", "hat")
    return cat.get(item_id)


def convert(item_id, ov):
    """Overlay box -> RelSpec that renders the contained glyph identically."""
    png = os.path.join(ROOT, f"assets/images/hats/{item_id}.png")
    iw, ih = Image.open(png).size
    cat = category_of(item_id)
    anchor = CATEGORY_ANCHOR.get(cat, "head")
    a = rest.get(anchor, rest["head"])
    W, H = ov["width"], ov["height"]
    top = CARD - ov["bottom"] - H
    scale = min(W / iw, H / ih)              # resizeMode=contain
    dw, dh = iw * scale, ih * scale          # drawn glyph size
    gl = ov["left"] + (W - dw) / 2           # glyph top-left within the box
    gt = top + (H - dh) / 2
    px = (a["x"] - gl) / dw
    py = (a["y"] - gt) / dh
    return {"pivot": {"x": round(px, 4), "y": round(py, 4)},
            "widthFrac": round(dw / CARD, 4), "anchor": anchor, "behind": False}, cat


def main():
    apply = "--apply" in sys.argv
    overlays = parse_overlays()
    legacy = sorted(overlays.keys())
    rel = ps.parse_rel(ps.HAT_REL)           # current 78
    print(f"{len(legacy)} legacy items -> RelSpec:\n")
    for i in legacy:
        s, cat = convert(i, overlays[i])
        rel[i] = s
        print(f"  {i:20s} [{cat:5s} -> {s['anchor']:7s}] "
              f"pivot=({s['pivot']['x']:.3f},{s['pivot']['y']:.3f}) wf={s['widthFrac']:.3f}")
    if apply:
        ps.write_hat_rel(rel)
        print(f"\n✅ wrote {len(rel)} RelSpecs to constants/hat_rel.generated.ts")
    else:
        print(f"\n(dry run — {len(rel)} total after merge; pass --apply to write)")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Render an item composited ON the pig, matching the app's PigStage.resolveSlot.

Replicates the anchor-relative placement: an item is sized to widthFrac*300, its
pivot point lands on the pig anchor, z-ordered behind/in-front. Outputs 300x300
PNGs to tmp/factory/previews/<id>.png for the review gallery.

Usage:
  pig_preview.py <id> [<id> ...]     # specific ids
  pig_preview.py --all               # every members-catalog item

Sources of truth (kept in sync with constants/hats.ts):
  PIG_CANVAS=300; pig sprite idle_1 rendered resizeMode=contain into 300x300.
  REST_ANCHORS = idle frame-0 anatomy. CATEGORY_REL = members category defaults.
  Hand-tuned specs in hat_rel.generated.ts / membersRel.generated.ts override.
"""
import sys, os, re, json
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CANVAS = 300
PIG_SPRITE = os.path.join(ROOT, "assets/images/sprites/rosie/idle_1.png")
OUT_DIR = os.path.join(ROOT, "tmp/factory/previews")
CARD_BG = (243, 236, 224, 255)  # soft warm neutral so the white pig reads

# idle frame-0 anatomy, 300x300 card space, y from top (constants/hats.ts REST_ANCHORS)
REST_ANCHORS = {
    "head": (162, 34), "eye_l": (131, 108), "eye_r": (222, 108), "eyes": (176, 108),
    "snout": (185, 136), "mouth": (181, 170), "neck": (170, 220), "body": (157, 235),
    "hand_l": (133, 280), "hand_r": (235, 266), "leg_l": (27, 266), "leg_r": (75, 235),
    "feet": (51, 250),
}
# members category-default rel specs (gen_members_catalog.js CATEGORY_REL)
CATEGORY_REL = {
    "hat":     {"pivot": (0.5, 0.86), "widthFrac": 0.42, "anchor": "head"},
    "bow":     {"pivot": (0.46, 0.5), "widthFrac": 0.42, "anchor": "head"},
    "glasses": {"pivot": (0.49, 0.52), "widthFrac": 0.62, "anchor": "eyes"},
    "mask":    {"pivot": (0.49, 0.66), "widthFrac": 0.62, "anchor": "eyes"},
    "held":    {"pivot": (0.45, 0.72), "widthFrac": 0.42, "anchor": "hand_r"},
}
FULL_CANVAS = {"aura", "background"}

REL_RE = re.compile(
    r'(\w+):\s*\{\s*pivot:\s*\{\s*x:\s*([\d.]+),\s*y:\s*([\d.]+)\s*\},'
    r'\s*widthFrac:\s*([\d.]+),\s*anchor:\s*"(\w+)"(?:,\s*behind:\s*(true|false))?'
)


def parse_rel(path):
    """Parse a *Rel.generated.ts file into {id: spec}."""
    out = {}
    if not os.path.isfile(path):
        return out
    for m in REL_RE.finditer(open(path).read()):
        i, px, py, wf, anch, behind = m.groups()
        out[i] = {"pivot": (float(px), float(py)), "widthFrac": float(wf),
                  "anchor": anch, "behind": behind == "true"}
    return out


# hat_rel (hand-tuned) overrides membersRel (category default) — same merge as hats.ts
REL = {}
REL.update(parse_rel(os.path.join(ROOT, "constants/membersRel.generated.ts")))
REL.update(parse_rel(os.path.join(ROOT, "constants/hat_rel.generated.ts")))


def contain(im, box):
    w, h = im.size
    s = min(box / w, box / h)
    return im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS), s


def pig_layer():
    pig = Image.open(PIG_SPRITE).convert("RGBA")
    rp, _ = contain(pig, CANVAS)
    layer = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    ox = (CANVAS - rp.width) // 2
    oy = (CANVAS - rp.height) // 2
    layer.alpha_composite(rp, (ox, oy))
    return layer


def place_item(canvas, item, spec):
    """Composite an item per the rel spec onto a 300x300 RGBA canvas (in place)."""
    iw, ih = item.size
    aspect = ih / iw if iw else 1
    w = spec["widthFrac"] * CANVAS
    h = w * aspect
    ax, ay = REST_ANCHORS.get(spec["anchor"], REST_ANCHORS["head"])
    left = ax - spec["pivot"][0] * w
    top = ay - spec["pivot"][1] * h
    ri = item.resize((max(1, round(w)), max(1, round(h))), Image.LANCZOS)
    canvas.alpha_composite(ri, (round(left), round(top)))


def render(item_id, category, img_path):
    full = os.path.join(ROOT, img_path)
    if not os.path.isfile(full):
        return None
    item = Image.open(full).convert("RGBA")
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))

    if category == "background":
        bg, _ = contain(item, CANVAS) if False else (item.resize((CANVAS, CANVAS), Image.LANCZOS), 1)
        canvas.alpha_composite(bg.convert("RGBA"))
        canvas.alpha_composite(pig_layer())
        return finish(canvas, opaque=True)

    # base card
    base = Image.new("RGBA", (CANVAS, CANVAS), CARD_BG)

    if category == "aura":
        ri = item.resize((CANVAS, CANVAS), Image.LANCZOS)
        base.alpha_composite(ri)         # aura behind pig
        base.alpha_composite(pig_layer())
        return finish(base)

    if category == "tickle_particle":
        base.alpha_composite(pig_layer())
        # representative burst: one particle near the snout, modest size
        w = round(0.26 * CANVAS); ih = round(w * item.size[1] / item.size[0])
        ri = item.resize((w, ih), Image.LANCZOS)
        base.alpha_composite(ri, (round(CANVAS * 0.55), round(CANVAS * 0.12)))
        return finish(base)

    spec = REL.get(item_id) or CATEGORY_REL.get(category)
    if not spec:
        base.alpha_composite(pig_layer())
        return finish(base)

    behind = spec.get("behind", False)
    if behind:
        place_item(base, item, spec)
        base.alpha_composite(pig_layer())
    else:
        base.alpha_composite(pig_layer())
        place_item(base, item, spec)
    return finish(base)


def finish(canvas, opaque=False):
    if opaque:
        return canvas.convert("RGB")
    flat = Image.new("RGB", (CANVAS, CANVAS), CARD_BG[:3])
    flat.paste(canvas, (0, 0), canvas)
    return flat


def sql_categories():
    """Categories for non-members items, parsed from the catalog migrations."""
    out = {}
    for sql in ["supabase/migrations/20260502030000_shop_catalog.sql",
                "supabase/migrations/20260650000000_mud_war_cosmetics.sql"]:
        p = os.path.join(ROOT, sql)
        if not os.path.isfile(p):
            continue
        for line in open(p):
            m = re.match(r"^\s*\('([^']+)',\s*'[^']*',\s*(?:'[^']*'|NULL),\s*\d+,\s*\d+,\s*'([^']+)',", line)
            if m:
                out[m.group(1)] = {"id": m.group(1), "category": m.group(2)}
    out.setdefault("tophat", {"id": "tophat", "category": "hat"})
    return out


def main():
    cat = json.load(open(os.path.join(ROOT, "docs/members-catalog.json")))
    by_id = sql_categories()                 # base/mud-war items first…
    by_id.update({it["id"]: it for it in cat})  # …members override/extend
    if len(sys.argv) >= 2 and sys.argv[1] == "--all":
        ids = list(by_id.keys())
    else:
        ids = sys.argv[1:]
    if not ids:
        raise SystemExit("usage: pig_preview.py <id> ... | --all")
    os.makedirs(OUT_DIR, exist_ok=True)
    ok = 0
    for i in ids:
        it = by_id.get(i)
        if not it:
            print(f"  !! {i}: not in catalog"); continue
        bg = it["category"] == "background"
        if bg:
            img = f"assets/images/backgrounds/{i}.png"
            if not os.path.isfile(os.path.join(ROOT, img)):
                img = f"assets/images/backgrounds/{i}_1.png"  # animated bg → frame 1
        else:
            img = f"assets/images/hats/{i}.png"
        out = render(i, it["category"], img)
        if out is None:
            print(f"  !! {i}: no source image"); continue
        out.save(os.path.join(OUT_DIR, f"{i}.png"))
        ok += 1
    print(f"rendered {ok}/{len(ids)} previews -> tmp/factory/previews/")


if __name__ == "__main__":
    main()

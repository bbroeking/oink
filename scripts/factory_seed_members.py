#!/usr/bin/env python3
"""Seed the factory manifest from the members-only catalog.

Writes tmp/factory/manifest.json with one entry per catalog item, pointing at
its real asset path. Re-runnable; preserves tmp/factory/verdicts.json.
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cat = json.load(open(os.path.join(ROOT, "docs/members-catalog.json")))
items = []
for it in cat:
    bg = it["category"] == "background"
    img = (f"assets/images/backgrounds/{it['id']}.png" if bg
           else f"assets/images/hats/{it['id']}.png")
    items.append({
        "id": it["id"],
        "name": it["name"],
        "group": it["theme"],
        "tags": [it["category"], it["rarity"], str(it["cost"])],
        "prompt": it["chatgpt_prompt"],
        "image": img,
        "preview": f"tmp/factory/previews/{it['id']}.png",
        "kind": "background" if bg else "sticker",
    })
out_dir = os.path.join(ROOT, "tmp", "factory")
os.makedirs(out_dir, exist_ok=True)
manifest = {"title": "Slop Club — Members Cosmetics (76)", "items": items}
with open(os.path.join(out_dir, "manifest.json"), "w") as f:
    json.dump(manifest, f, indent=1)
print(f"seeded {len(items)} items -> tmp/factory/manifest.json")

#!/usr/bin/env python3
"""Build ChatGPT "sticker sheet" strip prompts for the members-only art pass.

Reads docs/members-catalog.json, computes which items still LACK art (PNG not on
disk), groups the missing NON-background items into horizontal-row strips of N
(default 5, in catalog order so strips stay theme-coherent), and prints for each
strip: the ordered ids (for slice_sheet.py) + a composed ChatGPT prompt asking
for a single evenly-spaced row. Backgrounds are listed separately (generated one
at a time, full-scene).

Usage: build_strip_prompts.py [per_strip=5]
"""
import json, os, re, sys

PER = int(sys.argv[1]) if len(sys.argv) > 1 else 5
cat = json.load(open("docs/members-catalog.json"))

def has_art(it):
    i, c = it["id"], it["category"]
    if c == "background":
        return os.path.exists(f"assets/images/backgrounds/{i}.png") or \
               os.path.exists(f"assets/images/backgrounds/{i}_1.png")
    return os.path.exists(f"assets/images/hats/{i}.png")

def core(prompt):
    """Strip the shared boilerplate, keep the item-specific description."""
    s = prompt.strip()
    s = re.sub(r"^Generate a square image:\s*", "", s, flags=re.I)
    # drop leading "A cute hand-drawn cozy mobile-game icon of "
    s = re.sub(r"^A cute hand-drawn cozy mobile-game icon of\s+", "", s, flags=re.I)
    # cut everything from the style footer onward
    s = re.split(r"[.,]?\s*[Tt]hick dark brown outline", s)[0]
    return s.strip().rstrip(",.")

missing = [it for it in cat if not has_art(it)]
stickers = [it for it in missing if it["category"] != "background"]
backgrounds = [it for it in missing if it["category"] == "background"]

STYLE = ("thick dark brown outline, soft warm pastel colors, flat cel shading, "
         "storybook sticker look, gentle highlights, no text, no ground shadow")

print(f"# {len(missing)} missing  ({len(stickers)} stickers -> "
      f"{-(-len(stickers)//PER)} strips, {len(backgrounds)} backgrounds)\n")

strips = [stickers[i:i+PER] for i in range(0, len(stickers), PER)]
for n, strip in enumerate(strips, 1):
    ids = " ".join(it["id"] for it in strip)
    themes = sorted({it["theme"] for it in strip})
    items = "; ".join(f"({j}) {core(it['chatgpt_prompt'])}" for j, it in enumerate(strip, 1))
    prompt = (
        f"A set of cute hand-drawn cozy mobile-game icons arranged in a SINGLE "
        f"horizontal row on a plain pure-white background, evenly spaced with a "
        f"clear wide white gap between each item, no overlap, every item the same "
        f"height and centered in its own cell. Shared style for all items: {STYLE}. "
        f"The {len(strip)} items, left to right: {items}. Keep each item fully "
        f"separated with white space so they can be cut out individually."
    )
    print(f"## STRIP {n}  [{', '.join(themes)}]")
    print(f"IDS: {ids}")
    print(f"PROMPT:\n{prompt}\n")

print("## BACKGROUNDS (one at a time, full-scene)")
for it in backgrounds:
    print(f"- {it['id']:28s} [{it['theme']}]  {it['rarity']}")

# Rejected art (recorded in docs/art-rejections.json via the Placement Studio).
# These already have art but were flagged for regeneration — fold the reason
# into the prompt so the next generation fixes what was wrong.
try:
    rej = json.load(open("docs/art-rejections.json"))
except (FileNotFoundError, json.JSONDecodeError):
    rej = {}
if rej:
    by_id = {it["id"]: it for it in cat}
    print(f"\n## REJECTED — REGENERATE WITH FEEDBACK ({len(rej)})")
    for rid, info in sorted(rej.items()):
        reason = (info or {}).get("reason", "") or "(no reason given)"
        it = by_id.get(rid)
        print(f"\n### {rid}" + (f"  [{it['category']} · {it['theme']}]" if it else ""))
        print(f"REASON: {reason}")
        if it:
            base = core(it["chatgpt_prompt"])
            print(f"PROMPT: A cute hand-drawn cozy mobile-game icon of {base}. {STYLE}. "
                  f"Fix from last attempt: {reason}. Centered, isolated on plain white, no text.")

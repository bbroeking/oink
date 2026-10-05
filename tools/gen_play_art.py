#!/usr/bin/env python3
"""Matchmade play art: the five games' icons and board pieces.

Twenty-five painted 256² stickers in the fan's family (taste-standard log,
2026-09-17: thick warm ink outline, soft cel shade, one highlight patch,
exactly two small gold sparkles, the subject filling ~88% of its box, drawn
`contain`), generated through the Codex ImageGen lane that regen_studio and
gen_side_items use (`codex exec --enable image_generation`, the prompt on
stdin because `-i` is variadic and eats positional prompts), keyed off a flat
magenta ground and written IN PLACE over the placeholders that
`components/play/playArt.ts` already requires. No code path changes: a file
here is either the real art or a byte copy of `glyphs/dig/bag.png`.

    python3 tools/gen_play_art.py                         # all 25
    python3 tools/gen_play_art.py --only die_2,rail       # some keys
    python3 tools/gen_play_art.py --only rootle           # a whole group
    python3 tools/gen_play_art.py --only river --note "fewer stones"
    python3 tools/gen_play_art.py --dry-run --only icons  # print the prompts
    python3 tools/gen_play_art.py --rekey die_3           # re-key the saved raw
    python3 tools/gen_play_art.py --check                 # QA what is on disk
    python3 tools/gen_play_art.py --contact               # contact sheet + strips

Every prompt opens with its subject and closes with the house suffix; anything
between them is reference roles and the asset's own constraints (`--note`
adds a tightening line there for a retry). Each attempt's prompt is appended
to `assets/images/play/PROMPTS.md`, and its untouched 1024² raw is kept under
`artifacts/play-art-2026-10-04/raw/` (latest as `<key>.png`, every attempt in
`history/`) so an earlier attempt can be put back with `--rekey`.

The Rootle die is one family: `die_2` is generated first and its raw rides
along as a sibling reference for the other five faces, every face is framed on
its die BODY (not its bounding box, which the sparkles stretch), and every
face wears `die_2`'s two sparkles, so the die keeps one size, one centre and
one pair of sparkles when a roll swaps faces. Regenerating `die_2` means a
`--rekey --only dice` afterwards, so the siblings pick up its new sparkles.

Board pieces drawn many times on one board are BARE (lead, 2026-10-04): rail,
post, pen_truffle and lane_post carry `sparkles=False`. Their prompt swaps the
suffix's sparkle clause for "no sparkles, stars or glints", and
`strip_sparkles` removes any the lane paints anyway (a sparkle beside the
subject goes whole; one painted on it is cut to its star shape and filled from
the surface round it). The first four were cut that way from their sparkled
raws: `--rekey --only rail,post,pen_truffle,lane_post`.

A generation takes ~1–3 min; `--lanes` run in parallel (default 3).
"""
import argparse
import datetime as dt
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLAY = "assets/images/play"
STYLE_REF = "assets/images/glyphs/dig/bag.png"
PROMPTS_MD = os.path.join(ROOT, PLAY, "PROMPTS.md")
ARTIFACTS = os.path.join(ROOT, "artifacts/play-art-2026-10-04")
CODEX_IMAGES = os.path.expanduser("~/.codex/generated_images")

HOUSE_SUFFIX = (
    "Painted storybook sticker icon in the same hand as the reference image: "
    "thick warm brown ink outline, soft cel shading, one highlight patch, "
    "exactly two small gold sparkles near the subject, the subject filling "
    "about 88% of a square frame, centred, no text, no letters, no numbers, "
    "no border, no shadow on the ground, on a flat solid magenta #FF00FF "
    "background."
)

# Board pieces that repeat many times on one board are BARE (lead,
# 2026-10-04): two sparkles on each of 40 rails, 25 posts, 16 claimed pens or
# 3 lane posts in a row is glitter, not a garnish. A `sparkles=False` asset
# swaps the suffix's sparkle clause, and `strip_sparkles` takes off any the
# lane paints anyway (it is also how the first four were cut from raws that
# had them).
HOUSE_SUFFIX_BARE = HOUSE_SUFFIX.replace(
    "exactly two small gold sparkles near the subject",
    "no sparkles, stars or glints anywhere on or around the subject",
)
assert HOUSE_SUFFIX_BARE != HOUSE_SUFFIX

# The style anchor's role, said every time: the lane otherwise paints a bag.
STYLE_ROLE = (
    "The first attached image is the style reference only: match its hand "
    "exactly (outline weight, cel shading, the highlight, the little gold "
    "sparkles) but do not draw a bag or anything from it."
)
STYLE_ROLE_BARE = (
    "The first attached image is the style reference only: match its hand "
    "exactly (outline weight, cel shading, the highlight) but leave out its "
    "little gold sparkles, and do not draw a bag or anything from it."
)
NO_MAGENTA = (
    "Never use magenta or hot pink anywhere on the subject: the magenta "
    "ground is keyed out afterwards."
)

# Shared phrasing for the families, so siblings are described in one voice.
DIE_FACE = (
    "One face of a chunky cream wooden die, seen perfectly straight on as a "
    "flat rounded square tile with slightly rounded corners and a soft "
    "visible wood grain"
)
DIE_SPARKLES = (
    "The two gold sparkles sit just outside the die, one off its top-right "
    "corner and one off its bottom-left corner, never over the face."
)
DIE_SIBLING = (
    "The second attached image is this die's sibling face: match it exactly, "
    "the same cream wood, the same size in the frame, the same straight-on "
    "angle, the same outline, the same rounded corners and the same truffle "
    "pips; only the face's mark changes."
)
PIPS = "small dark chocolate-brown truffles, each a lumpy knobbly round truffle, as its pips"
PALE_WOOD = (
    "pale, neutral, weathered grey-beige wood with visible grain (no strong "
    "colour, so it can sit on any coloured underlay)"
)
SCENE = (
    "drawn as a small self-contained scenic sticker vignette, the scene "
    "sitting on a soft rounded patch of ground with a clean edge"
)


@dataclass
class Asset:
    key: str
    group: str  # rootle · fence_the_pen · mud_volley · snout_says · out_looking
    path: str  # repo-relative output (the placeholder it overwrites)
    subject: str  # the prompt's opening: what the picture is of
    refs: list = field(default_factory=list)  # subject refs after the style anchor
    roles: str = ""  # what each extra ref is for (sentences)
    extra: str = ""  # the asset's own constraints
    sibling: str | None = None  # key whose raw rides along as a reference
    frame: str = "bbox"  # "bbox" (crop + recentre) or "body" (die family)
    sparkles: bool = True  # False: a repeated board piece, drawn bare


A = Asset
MANIFEST: list[Asset] = [
    # ── Game icons: each game's emblem at a glance ──
    A("icon_rootle", "rootle", f"{PLAY}/icons/rootle.png",
      "A chunky cream-coloured wooden die caught mid-tumble, tilted at a "
      "jaunty angle so its top face and two side faces show, with softly "
      "rounded edges and a soft wood grain; its top face carries small dark "
      "chocolate-brown truffle pips, and a tiny crooked gold crown with red "
      "gems sits askew on its top corner.",
      refs=["assets/images/glyphs/receipt/truffle.png"],
      roles="The second attached image is the game's truffle: give the pips "
            "its lumpy, knobbly truffle shape, but in dark chocolate brown so "
            "they read on the cream wood.",
      extra="The side faces show truffle pips too, foreshortened."),
    A("icon_fence_the_pen", "fence_the_pen", f"{PLAY}/icons/fence_the_pen.png",
      "A small square pen of weathered wooden fence rails and stubby posts, "
      "seen from a three-quarter top view, enclosing a patch of brown mud "
      "with one plump dark truffle sitting in the middle of it."),
    A("icon_mud_volley", "mud_volley", f"{PLAY}/icons/mud_volley.png",
      "A round ball of dark brown mud mid-flight, a little arc of mud drips "
      "trailing above it, coming down toward a dented grey tin pail that "
      "waits below to catch it.",
      extra="The ball is in the upper part of the picture and the pail in "
            "the lower part; both are fully in frame."),
    A("icon_snout_says", "snout_says", f"{PLAY}/icons/snout_says.png",
      "A pink pig snout seen in profile, round and soft with one nostril "
      "showing, poking in from the left beside a small cream paper speech "
      "bubble that holds a tiny brown acorn.",
      refs=["assets/images/glyphs/pigface.png"],
      roles="The second attached image is Rosie's face: paint the snout in "
            "exactly its warm soft pink and draw only a snout, not a whole "
            "pig.",
      # retry 1 (2026-10-04): the first snout had one nostril and no outline
      # on its left edge, so it read as a pink cone cut out of a face.
      extra="Make it unmistakably a pig's snout: turned slightly toward the "
            "viewer so its flat round snout disc shows both nostrils, the "
            "short pink muzzle behind it ending in a clean rounded edge on the "
            "left, with the same thick dark-brown ink outline all the way "
            "round; no head, no eyes, no ears. The speech bubble holds the "
            "acorn and nothing else."),
    A("icon_out_looking", "out_looking", f"{PLAY}/icons/out_looking.png",
      "A weathered wooden signpost with four little arrow-shaped boards "
      "pointing different ways, a pair of muddy pig trotter prints in the "
      "dirt at its foot.",
      extra="The arrow boards are plain wood with nothing written or painted "
            "on them. Each trotter print is a small cloven two-toed hoofprint."),

    # ── Rootle: one die family (die_2 first, then the rest off its raw) ──
    A("die_2", "rootle", f"{PLAY}/rootle/die_2.png",
      f"{DIE_FACE}, carrying exactly two {PIPS}, placed diagonally in the "
      "top-left and bottom-right corners like the two on a standard die.",
      extra=DIE_SPARKLES, frame="body"),
    A("die_1", "rootle", f"{PLAY}/rootle/die_1.png",
      f"{DIE_FACE}, showing the Great Hungerer's grumpy round face in the "
      "middle in place of a single pip: a round pink pig face with a "
      "scowling brow, a snout and a tiny gold crown on top.",
      refs=["assets/images/hunger/great_hungerer_hero.png"],
      roles="The second attached image is this die's sibling face: match it "
            "exactly, the same cream wood, the same size in the frame, the "
            "same straight-on angle, the same outline and the same rounded "
            "corners; only the face's mark changes. The third attached image "
            "is the Great Hungerer: draw only his face (his scowl, his snout, "
            "his crown), not his body, sized like one big pip in the centre "
            "of the face.",
      extra=DIE_SPARKLES, sibling="die_2", frame="body"),
    A("die_3", "rootle", f"{PLAY}/rootle/die_3.png",
      f"{DIE_FACE}, carrying exactly three {PIPS}, in a diagonal line from "
      "the top-left corner through the centre to the bottom-right corner "
      "like the three on a standard die.",
      # retry 1 (2026-10-04): the first three came back a size smaller than
      # the sibling's two.
      roles=DIE_SIBLING + " Each of the three pips is exactly as big and "
            "plump as one of the sibling face's two pips.",
      extra=DIE_SPARKLES, sibling="die_2", frame="body"),
    A("die_4", "rootle", f"{PLAY}/rootle/die_4.png",
      f"{DIE_FACE}, carrying exactly four {PIPS}, one in each corner like "
      "the four on a standard die.",
      roles=DIE_SIBLING, extra=DIE_SPARKLES, sibling="die_2", frame="body"),
    A("die_5", "rootle", f"{PLAY}/rootle/die_5.png",
      f"{DIE_FACE}, carrying exactly five {PIPS}, one in each corner and one "
      "in the centre like the five on a standard die.",
      roles=DIE_SIBLING, extra=DIE_SPARKLES, sibling="die_2", frame="body"),
    A("die_6", "rootle", f"{PLAY}/rootle/die_6.png",
      f"{DIE_FACE}, carrying exactly six {PIPS}, in two vertical columns of "
      "three like the six on a standard die.",
      roles=DIE_SIBLING, extra=DIE_SPARKLES, sibling="die_2", frame="body"),

    # ── Fence the Pen ──
    A("rail", "fence_the_pen", f"{PLAY}/fence_the_pen/rail.png",
      "One short horizontal weathered fence rail seen straight on from the "
      f"side: two long planks laid one above the other, {PALE_WOOD}, with "
      "one knot in the wood.",
      extra="The rail is long and thin, about five times wider than it is "
            "tall, lying level across the middle of the picture; no posts, "
            "no nails sticking out, nothing else.",
      sparkles=False),  # up to 40 on a board
    A("post", "fence_the_pen", f"{PLAY}/fence_the_pen/post.png",
      f"A stubby round-topped wooden fence post seen head-on, {PALE_WOOD}.",
      extra="Just the post standing upright: no rails, no grass, nothing else.",
      sparkles=False),  # 25 on a board
    A("pen_truffle", "fence_the_pen", f"{PLAY}/fence_the_pen/pen_truffle.png",
      "A square patch of dark wet mud seen from directly above, with one "
      "plump dark truffle sitting in the middle and a few small green grass "
      "tufts at its edges.",
      extra="The patch is a soft-cornered square that fills the frame; no "
            "fence around it.",
      sparkles=False),  # up to 16 claimed pens on a board

    # ── Mud Volley ──
    A("mudball", "mud_volley", f"{PLAY}/mud_volley/mudball.png",
      "A round ball of dark brown mud with one glossy highlight, mid-flight, "
      "a few drips flicking off behind it."),
    A("bucket", "mud_volley", f"{PLAY}/mud_volley/bucket.png",
      "A dented grey tin pail standing upright with its wire handle raised "
      "straight up, a little brown mud slopped over the rim.",
      extra="Seen from the front at eye level, a little from above so the "
            "rim's opening shows."),
    A("splat_big", "mud_volley", f"{PLAY}/mud_volley/splat_big.png",
      "A wide brown mud splat seen from directly above, a big irregular "
      "splash with four fat drops flying off around it.",
      # retries 1 and 2 (2026-10-04): both earlier tries flew three drops
      # (the small splat's count) and turned the fourth into an arm.
      extra="Count the drops: there are FOUR loose drops, one near each corner "
            "of the picture (top-left, top-right, bottom-left, bottom-right), "
            "and every one of the four floats free with clear empty space "
            "between it and the splat; the bottom-right drop is a loose drop "
            "too, never an arm of the splat. The splat's own arms stay short "
            "and stubby."),
    A("splat_small", "mud_volley", f"{PLAY}/mud_volley/splat_small.png",
      "A tidy small brown mud splat seen from directly above, compact and "
      "roundish, with three little drops beside it."),
    A("windup_arc", "mud_volley", f"{PLAY}/mud_volley/windup_arc.png",
      "A chunky curved motion arc ending in a bold arrowhead, a cartoon "
      "swoosh showing a throw winding up, drawn as one thick tapered stroke "
      "of warm brown ink.",
      # retry 1 (2026-10-04): the first was a pale tan ribbon inside an
      # outline, a filled shape rather than ink.
      extra="Ink only: the whole swoosh is solid warm dark-brown ink, the "
            "same brown as an outline, like one bold brushstroke, with no "
            "lighter or tan fill inside it (at most one thin lighter streak "
            "as its highlight); no object being thrown, no hand, nothing "
            "else."),
    A("lane_post", "mud_volley", f"{PLAY}/mud_volley/lane_post.png",
      "A short weathered wooden fence post with a blank painted plaque "
      "nailed to its front, the plaque a plain cream rectangle.",
      extra="The plaque is completely blank: nothing written or painted on "
            "it.",
      sparkles=False),  # 3 side by side

    # ── Out Looking: the four places the Finds come from, plus the mud ──
    A("river", "out_looking", f"{PLAY}/out_looking/river.png",
      f"A bend of blue river water curling over smooth grey stones, one "
      f"green reed standing at its bank, {SCENE}.",
      refs=["assets/images/glyphs/finds/river_pebble.png"],
      roles="The second attached image is a river pebble from this place: "
            "paint the stones like it."),
    A("hedge", "out_looking", f"{PLAY}/out_looking/hedge.png",
      "A gap in a green leafy hedge, a few red berries showing among the "
      f"leaves and one blue feather caught in the twigs, {SCENE}.",
      refs=["assets/images/glyphs/finds/blue_feather.png"],
      roles="The second attached image is the blue feather caught in it: "
            "paint the feather like it, small."),
    A("meadow", "out_looking", f"{PLAY}/out_looking/meadow.png",
      "A tuft of clover and tall meadow grass with one honeycomb-yellow "
      f"flower and a wisp of white wool caught on a stem, {SCENE}.",
      refs=["assets/images/glyphs/finds/clover.png"],
      roles="The second attached image is a clover from this meadow: paint "
            "the clover leaves like it."),
    A("farmhouse", "out_looking", f"{PLAY}/out_looking/farmhouse.png",
      "A cream farmhouse door standing slightly ajar with a brass knob, an "
      "old iron key hanging on a nail on the wall beside it, "
      f"{SCENE}.",
      refs=["assets/images/glyphs/finds/old_key.png"],
      roles="The second attached image is the old key: paint the hanging "
            "key like it."),
    A("muddy_trotters", "out_looking", f"{PLAY}/out_looking/muddy_trotters.png",
      "Two pig trotter prints pressed into wet brown mud, slightly crossed, "
      "nothing else.",
      extra="Each print is a cloven two-toed hoofprint; the mud is a small "
            "irregular wet patch around them."),
]
BY_KEY = {a.key: a for a in MANIFEST}
GROUPS = ["rootle", "fence_the_pen", "mud_volley", "snout_says", "out_looking"]
GROUP_TITLES = {
    "rootle": "Rootle", "fence_the_pen": "Fence the Pen", "mud_volley": "Mud Volley",
    "snout_says": "Snout Says", "out_looking": "Out Looking",
}


def build_prompt(a: Asset, note: str = "") -> str:
    """Subject first, house suffix last; roles and constraints in between."""
    middle = [STYLE_ROLE if a.sparkles else STYLE_ROLE_BARE]
    if a.roles:
        middle.append(a.roles)
    if a.extra:
        middle.append(a.extra)
    if note:
        middle.append(note)
    middle.append(NO_MAGENTA)
    return " ".join([a.subject, *middle, HOUSE_SUFFIX if a.sparkles else HOUSE_SUFFIX_BARE])


def lane_message(a: Asset, image_prompt: str) -> str:
    """What codex reads on stdin: a save instruction, then the image prompt."""
    return "\n".join([
        "Generate ONE image with the image generation tool and save it in this "
        f"directory as {a.key}.png. Give the image tool the prompt below as "
        "written, with the attached images as its references (they are "
        "attached in the order the prompt names them). Save the image exactly "
        "as the tool returns it: no editing, cropping, resizing or background "
        "removal. Square image.",
        "",
        "PROMPT:",
        image_prompt,
    ])


def raw_dir() -> str:
    return os.path.join(ARTIFACTS, "raw")


def ref_paths(a: Asset) -> list[str]:
    refs = [os.path.join(ROOT, STYLE_REF)]
    if a.sibling:
        refs.append(sibling_ref(a.sibling))
    refs += [os.path.join(ROOT, r) for r in a.refs]
    return refs


def sibling_ref(key: str) -> str:
    """The sibling's raw (full size, on its magenta ground) if this batch made
    one, else its finished sticker flattened back onto magenta."""
    raw = os.path.join(raw_dir(), key + ".png")
    if os.path.isfile(raw):
        return raw
    from PIL import Image

    done = os.path.join(ROOT, BY_KEY[key].path)
    if is_placeholder(done):
        raise RuntimeError(f"{key} has no art yet; generate it first")
    im = Image.open(done).convert("RGBA").resize((1024, 1024), Image.LANCZOS)
    flat = Image.new("RGBA", im.size, (255, 0, 255, 255))
    flat.alpha_composite(im)
    out = os.path.join(raw_dir(), f"{key}.flat-ref.png")
    os.makedirs(raw_dir(), exist_ok=True)
    flat.convert("RGB").save(out)
    return out


def is_placeholder(path: str) -> bool:
    try:
        with open(path, "rb") as f, open(os.path.join(ROOT, STYLE_REF), "rb") as g:
            return f.read() == g.read()
    except OSError:
        return False


# ── Keying ────────────────────────────────────────────────────────────────
# `key_ground` is the ground-clearing half of `key_and_recentre` in
# tools/gen_side_items.py, copied rather than imported because that function
# fuses keying with the bbox crop + 256 save, and the die family has to be
# framed on its body from the full-size keyed image. Keep the two in step.
def key_ground(raw_path: str):
    """Flood-fill the ground from the corners (magenta when asked; the lane has
    also returned an opaque fake checkerboard), then clear enclosed holes that
    are unmistakably ground (magenta, or two checker greys with real area), so
    a glossy white highlight inside the ink outline survives."""
    from PIL import Image

    im = Image.open(raw_path).convert("RGBA")
    w, h = im.size
    px = im.load()
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    if all(px[x, y][3] < 16 for x, y in seeds):
        # Not in gen_side_items: the image tool now cuts the ground out itself
        # (2026-10-04 it returned alpha PNGs though the prompt asked for
        # magenta). Its alpha is the truth; keying its transparent black
        # corners would read near-black ink and dark mud as ground. Only clear
        # any magenta it left behind, and the alpha 1–7 haze it scatters over
        # the whole canvas (it stretches the crop box to the full image).
        im.putalpha(im.getchannel("A").point(lambda v: 0 if v < 8 else v))
        return clear_magenta(im)
    probes = seeds + [(16, 16), (w - 17, 16), (16, h - 17), (w - 17, h - 17), (w // 2, 2), (2, h // 2)]
    keys = {px[x, y][:3] for x, y in probes}
    tol = 34

    def is_ground(c):
        r, g, b = c[:3]
        return any(abs(r - kr) <= tol and abs(g - kg) <= tol and abs(b - kb) <= tol for kr, kg, kb in keys)

    seen = bytearray(w * h)
    q = deque(seeds)
    for x, y in seeds:
        seen[y * w + x] = 1
    while q:
        x, y = q.popleft()
        if not is_ground(px[x, y]):
            continue
        r, g, b, _ = px[x, y]
        px[x, y] = (r, g, b, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                seen[ny * w + nx] = 1
                q.append((nx, ny))

    def magenta(c):
        r, g, b = c[:3]
        return r > 180 and b > 180 and g < 100

    for y0 in range(h):
        for x0 in range(w):
            i0 = y0 * w + x0
            if seen[i0] or not is_ground(px[x0, y0]):
                continue
            region, colours = [], {}
            stack = [(x0, y0)]
            seen[i0] = 1
            while stack:
                x, y = stack.pop()
                c = px[x, y][:3]
                if not is_ground(c):
                    continue
                region.append((x, y))
                for k in keys:
                    if abs(c[0] - k[0]) <= tol and abs(c[1] - k[1]) <= tol and abs(c[2] - k[2]) <= tol:
                        colours[k] = colours.get(k, 0) + 1
                        break
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    j = ny * w + nx
                    if 0 <= nx < w and 0 <= ny < h and not seen[j]:
                        seen[j] = 1
                        stack.append((nx, ny))
            big = [k for k, n in colours.items() if n >= 40]
            checker = len(big) >= 2
            if checker or any(magenta(k) for k in big):
                for x, y in region:
                    r, g, b, _ = px[x, y]
                    px[x, y] = (r, g, b, 0)
    return im


def clear_magenta(im, min_area: int = 40):
    """Clear every connected run of opaque magenta with real area (a hole the
    image tool left filled with the ground colour); specks are defringe's job."""
    w, h = im.size
    px = im.load()

    def magenta(c):
        return c[3] > 0 and c[0] > 180 and c[2] > 180 and c[1] < 100

    seen = bytearray(w * h)
    for y0 in range(h):
        for x0 in range(w):
            if seen[y0 * w + x0] or not magenta(px[x0, y0]):
                continue
            region, stack = [], [(x0, y0)]
            seen[y0 * w + x0] = 1
            while stack:
                x, y = stack.pop()
                region.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    j = ny * w + nx
                    if 0 <= nx < w and 0 <= ny < h and not seen[j] and magenta(px[nx, ny]):
                        seen[j] = 1
                        stack.append((nx, ny))
            if len(region) >= min_area:
                for x, y in region:
                    r, g, b, _ = px[x, y]
                    px[x, y] = (r, g, b, 0)
    return im


def defringe(im, passes: int = 2):
    """Drop the magenta-tinted anti-alias ring the flood fill leaves on the
    ink's outer edge (a blend of brown ink and #FF00FF: red and blue both well
    above green). Only pixels touching transparency are tested, so a pink
    snout behind its own outline is never reached."""
    w, h = im.size
    px = im.load()
    for _ in range(passes):
        drop = []
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 0 or r - g <= 40 or b - g <= 40:
                    continue
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if not (0 <= nx < w and 0 <= ny < h) or px[nx, ny][3] == 0:
                        drop.append((x, y))
                        break
        if not drop:
            break
        for x, y in drop:
            r, g, b, _ = px[x, y]
            px[x, y] = (r, g, b, 0)
    return im


def frame_bbox(im, out_path: str, margin: float = 0.06) -> None:
    """The house framing (gen_side_items / regen_studio): crop to the glyph,
    recentre on a square with a margin, LANCZOS down to 256."""
    from PIL import Image

    bbox = im.getbbox()
    if not bbox:
        raise RuntimeError("empty image after keying")
    glyph = im.crop(bbox)
    gw, gh = glyph.size
    side = round(max(gw, gh) * (1 + 2 * margin))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(glyph, ((side - gw) // 2, (side - gh) // 2), glyph)
    canvas.resize((256, 256), Image.LANCZOS).save(out_path)


DIE_BODY_FRAC = 0.76  # the die body's long side in the 256 box; sparkles live in the rest


def body_bbox(im):
    """Bounding box of the largest connected opaque blob (the die), found on a
    quarter-size alpha mask; sparkles are separate small blobs."""
    from PIL import Image

    w, h = im.size
    s = 4
    mask = im.getchannel("A").resize((w // s, h // s), Image.BILINEAR)
    mw, mh = mask.size
    m = mask.load()
    seen = bytearray(mw * mh)
    best, best_n = None, 0
    for y0 in range(mh):
        for x0 in range(mw):
            if seen[y0 * mw + x0] or m[x0, y0] < 128:
                continue
            stack = [(x0, y0)]
            seen[y0 * mw + x0] = 1
            n, x1, y1, x2, y2 = 0, x0, y0, x0, y0
            while stack:
                x, y = stack.pop()
                n += 1
                x1, y1, x2, y2 = min(x1, x), min(y1, y), max(x2, x), max(y2, y)
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < mw and 0 <= ny < mh and not seen[ny * mw + nx] and m[nx, ny] >= 128:
                        seen[ny * mw + nx] = 1
                        stack.append((nx, ny))
            if n > best_n:
                best, best_n = (x1 * s, y1 * s, (x2 + 1) * s, (y2 + 1) * s), n
    if not best:
        raise RuntimeError("no die body found")
    return best


def frame_body(im, out_path: str) -> str | None:
    """Scale so the die body's long side is DIE_BODY_FRAC of 256 and centre the
    body, carrying the sparkles along. Returns a warning if a sparkle would be
    clipped by the box (regenerate it with the sparkles tucked closer)."""
    from PIL import Image

    bx1, by1, bx2, by2 = body_bbox(im)
    bw, bh = bx2 - bx1, by2 - by1
    target = 256 * DIE_BODY_FRAC
    scale = target / max(bw, bh)
    cx, cy = (bx1 + bx2) / 2, (by1 + by2) / 2
    # Work at 4x and downsample once, so the paste offset is sub-pixel exact.
    big = 1024
    k = scale * big / 256
    scaled = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    ox, oy = round(big / 2 - cx * k), round(big / 2 - cy * k)
    canvas = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    canvas.paste(scaled, (ox, oy), scaled)
    warn = None
    gx1, gy1, gx2, gy2 = im.getbbox()
    if ox + gx1 * k < 0 or oy + gy1 * k < 0 or ox + gx2 * k > big or oy + gy2 * k > big:
        warn = "a sparkle runs past the box edge after body framing"
    canvas.resize((256, 256), Image.LANCZOS).save(out_path)
    return warn


def body_mask(im, solid: int = 32, grow: int = 2):
    """Mask (L) of the largest 8-connected run of pixels at alpha >= `solid`,
    grown by `grow` px to take back its soft edge. The threshold matters: at
    alpha >= 1 the resize's faint halo bridges a corner sparkle to the body."""
    from PIL import Image, ImageFilter

    w, h = im.size
    a = im.getchannel("A").load()
    seen = bytearray(w * h)
    best: list[tuple[int, int]] = []
    for y0 in range(h):
        for x0 in range(w):
            if seen[y0 * w + x0] or a[x0, y0] < solid:
                continue
            blob, stack = [], [(x0, y0)]
            seen[y0 * w + x0] = 1
            while stack:
                x, y = stack.pop()
                blob.append((x, y))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and a[nx, ny] >= solid:
                            seen[ny * w + nx] = 1
                            stack.append((nx, ny))
            if len(blob) > len(best):
                best = blob
    mask = Image.new("L", im.size, 0)
    mpx = mask.load()
    for x, y in best:
        mpx[x, y] = 255
    return mask.filter(ImageFilter.MaxFilter(2 * grow + 1)) if grow else mask


def stamp_family_sparkles(out_path: str, anchor_path: str) -> None:
    """The die family wears ONE pair of sparkles: the anchor face's, stamped
    onto every sibling. Every face is framed on the same body box, so a roll
    swaps only the face and the sparkles never jump; each generation's own
    sparkles drift in size and ink (die_1 and die_3 came back thin and
    outline-less, 2026-10-04). Blobs, not a rectangle: a corner sparkle pokes
    inside the body's bounding square where the rounded corner leaves room."""
    from PIL import Image, ImageChops

    face = Image.open(out_path).convert("RGBA")
    anchor = Image.open(anchor_path).convert("RGBA")
    # the face keeps only its body ...
    face.putalpha(ImageChops.multiply(face.getchannel("A"), body_mask(face)))
    # ... and takes everything of the anchor that is not the anchor's body
    outside = ImageChops.invert(body_mask(anchor))
    anchor.putalpha(ImageChops.multiply(anchor.getchannel("A"), outside))
    face.alpha_composite(anchor)
    face.save(out_path)


def _blobs(mask, min_size: int = 1):
    """8-connected runs of True in a small boolean mask, as (ys, xs) arrays."""
    import numpy as np

    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    out = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
            continue
        seen[y0, x0] = True
        stack, ys, xs = [(y0, x0)], [], []
        while stack:
            y, x = stack.pop()
            ys.append(y)
            xs.append(x)
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
        if len(ys) >= min_size:
            out.append((np.array(ys), np.array(xs)))
    return out


def gold_mask(arr):
    """Saturated gold, loosely (sparkle cores, but also grass and wood highlights)."""
    r, g, b, a = (arr[..., i].astype(int) for i in range(4))
    return (a > 128) & (r > 200) & (g > 140) & (b < 150) & (r - b > 80)


def find_sparkles(arr) -> list:
    """The house sparkle: a four-point star of saturated gold inside a dark ink
    outline. Measured on the 2026-10-04 raws: mean ~(249, 208, 80), aspect
    ~0.9, a fifth of its own box, dark ink just past its tips (at 256 px a
    thin tip can outrun the gold, so two of the four probes are enough).
    Grass highlights (green over red) and warm wood (paler, no outline round
    it) fail on colour. Returns one (ys, xs) gold core per sparkle."""
    h, w = arr.shape[:2]
    lum = arr[..., :3].mean(axis=2)
    step = max(2, round(0.005 * w))  # just past a tip: on its outline
    stars = []
    for ys, xs in _blobs(gold_mask(arr), min_size=max(8, round(2e-4 * w * h))):
        x1, x2, y1, y2 = xs.min(), xs.max(), ys.min(), ys.max()
        bw, bh = x2 - x1 + 1, y2 - y1 + 1
        mean = arr[ys, xs, :3].mean(axis=0)
        if not (mean[0] >= 235 and mean[2] <= 110 and mean[0] - mean[1] >= 20):
            continue
        if not (0.7 <= bw / bh <= 1.4 and 0.12 <= len(ys) / (bw * bh) <= 0.40):
            continue
        if not (0.03 * w <= max(bw, bh) <= 0.15 * w):
            continue
        cy, cx = (y1 + y2) // 2, (x1 + x2) // 2
        tips = [(y1 - step, cx), (y2 + step, cx), (cy, x1 - step), (cy, x2 + step)]
        dark = sum(not (0 <= ty < h and 0 <= tx < w) or arr[ty, tx, 3] < 32 or lum[ty, tx] <= 60
                   for ty, tx in tips)
        if dark >= 2:
            stars.append((ys, xs))
    return stars


def _grow(mask, px: int):
    """Dilate a boolean mask by `px` (square), via PIL's max filter."""
    import numpy as np
    from PIL import Image, ImageFilter

    m = Image.fromarray(mask.astype(np.uint8) * 255)
    for _ in range(px // 3):
        m = m.filter(ImageFilter.MaxFilter(7))
    if px % 3:
        m = m.filter(ImageFilter.MaxFilter(2 * (px % 3) + 1))
    return np.array(m) > 0


def _disk_grow(mask, r: int):
    """Dilate a small boolean mask by a disk of radius `r` (round, so a hole
    never turns into a rectangle the eye can find)."""
    import numpy as np

    h, w = mask.shape
    out = mask.copy()
    pad = np.pad(mask, r)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dy * dy + dx * dx <= r * r:
                out |= pad[r + dy:r + dy + h, r + dx:r + dx + w]
    return out


def _star_hole(arr, ys, xs):
    """The whole painted sparkle as a mask: its gold core with the highlight
    hole closed, the dark ink outline connected to it (no farther out than the
    outline's own width), and an anti-alias margin. Returns (mask, window)."""
    import numpy as np

    h, w = arr.shape[:2]
    reach = max(3, round(0.02 * w))  # the outline sits ~15 px past the gold at 1254 px
    y1, y2 = max(0, ys.min() - reach - 8), min(h, ys.max() + reach + 9)
    x1, x2 = max(0, xs.min() - reach - 8), min(w, xs.max() + reach + 9)
    core = np.zeros((y2 - y1, x2 - x1), dtype=bool)
    core[ys - y1, xs - x1] = True
    # close the core's pale highlight: everything not reachable from the window edge
    grown = _disk_grow(core, 2)
    outside = np.zeros_like(grown)
    stack = [(0, x) for x in range(grown.shape[1])] + [(grown.shape[0] - 1, x) for x in range(grown.shape[1])]
    stack += [(y, 0) for y in range(grown.shape[0])] + [(y, grown.shape[1] - 1) for y in range(grown.shape[0])]
    while stack:
        y, x = stack.pop()
        if outside[y, x] or grown[y, x]:
            continue
        outside[y, x] = True
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < grown.shape[0] and 0 <= nx < grown.shape[1] and not outside[ny, nx]:
                stack.append((ny, nx))
    star = ~outside
    # the ink round it: dark pixels joined to the star, within the outline's width
    dark = arr[y1:y2, x1:x2, :3].mean(axis=2) < 45
    limit = _disk_grow(star, reach)
    ring = star.copy()
    for _ in range(reach):
        ring |= _disk_grow(ring, 1) & dark & limit
    return _disk_grow(ring, 3), (y1, y2, x1, x2)


def _fill_hole(arr, hole, window) -> None:
    """Fill `hole` (in `window`) from its border inward: peel it ring by ring
    with the mean of the known neighbours, then relax it (Laplace) so the
    surface's shading runs straight through where the sparkle was."""
    import numpy as np

    y1, y2, x1, x2 = window
    img = arr[y1:y2, x1:x2, :3].astype(float)
    known = ~hole
    todo = hole.copy()
    while todo.any():  # onion peel: a first guess that already matches the edge
        acc = np.zeros_like(img)
        cnt = np.zeros(hole.shape)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            k = np.roll(known, (dy, dx), axis=(0, 1))
            acc += np.roll(img, (dy, dx), axis=(0, 1)) * k[..., None]
            cnt += k
        edge = todo & (cnt > 0)
        if not edge.any():
            break
        img[edge] = acc[edge] / cnt[edge][:, None]
        known |= edge
        todo &= ~edge
    for _ in range(400):  # relax
        avg = (np.roll(img, 1, 0) + np.roll(img, -1, 0) + np.roll(img, 1, 1) + np.roll(img, -1, 1)) / 4
        img[hole] = avg[hole]
    arr[y1:y2, x1:x2, :3] = np.clip(img, 0, 255).astype(np.uint8)


def strip_sparkles(im):
    """Take the gold sparkles off a keyed image (a bare board piece). One
    beside the subject is its own blob and goes whole, soft edge and all; one
    painted ON the subject (pen_truffle's mud) is cut out to its own star shape
    and filled from the surface round it. Returns (image, sparkles removed)."""
    import numpy as np
    from PIL import Image

    arr = np.array(im.convert("RGBA"))
    subject = np.array(body_mask(im, grow=0)) > 0
    stars = find_sparkles(arr)
    for ys, xs in stars:
        core = np.zeros(subject.shape, dtype=bool)
        core[ys, xs] = True
        if subject[ys, xs].any():
            hole, window = _star_hole(arr, ys, xs)
            _fill_hole(arr, hole, window)
        else:
            # its own blob: everything visible connected to the core
            blob = np.zeros_like(core)
            for bys, bxs in _blobs(arr[..., 3] >= 32):
                if core[bys, bxs].any():
                    blob[bys, bxs] = True
            gone = _grow(blob, 4) & ~_grow(subject, 2)
            arr[..., 3][gone] = 0
    return Image.fromarray(arr), len(stars)


def process(a: Asset, raw: str) -> list[str]:
    im = defringe(key_ground(raw))
    out = os.path.join(ROOT, a.path)
    warns = []
    if not a.sparkles:
        import numpy as np

        im, _ = strip_sparkles(im)
        if find_sparkles(np.array(im)):
            warns.append("a sparkle survived stripping")
    if a.frame == "body":
        w = frame_body(im, out)
        if w:
            warns.append(w)
        anchor = os.path.join(ROOT, BY_KEY[a.sibling].path) if a.sibling else None
        if anchor and not is_placeholder(anchor):
            stamp_family_sparkles(out, anchor)
    else:
        frame_bbox(im, out)
    return warns + qa(out, bare=not a.sparkles)


def qa(path: str, bare: bool = False) -> list[str]:
    """Cheap automatic checks; the eye is still the judge."""
    import numpy as np
    from PIL import Image

    im = Image.open(path)
    warns = []
    if bare and find_sparkles(np.array(im.convert("RGBA"))):
        warns.append("a sparkle is left on a bare board piece")
    if im.size != (256, 256) or im.mode != "RGBA":
        warns.append(f"not 256² RGBA ({im.size} {im.mode})")
        im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    if any(px[x, y][3] for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))):
        warns.append("opaque corner")
    edge = sum(1 for i in range(w) for x, y in ((i, 0), (i, h - 1), (0, i), (w - 1, i)) if px[x, y][3] > 40)
    if edge:
        warns.append(f"{edge} opaque px on the box edge (cropped?)")
    mag = sum(1 for y in range(h) for x in range(w)
              if px[x, y][3] > 60 and px[x, y][0] > 170 and px[x, y][2] > 150 and px[x, y][1] < 110)
    if mag > 40:
        warns.append(f"{mag} magenta-ish px left")
    opaque = sum(1 for y in range(h) for x in range(w) if px[x, y][3] > 128)
    if opaque < 0.08 * w * h:
        warns.append(f"only {opaque / (w * h):.0%} opaque (keying ate the subject?)")
    if is_placeholder(path):
        warns.append("still the placeholder")
    return warns


# ── The lane ─────────────────────────────────────────────────────────────
def find_raw(stage: str, key: str, out: str) -> str | None:
    raw = os.path.join(stage, key + ".png")
    if os.path.isfile(raw):
        return raw
    pngs = [f for f in os.listdir(stage) if f.lower().endswith(".png")]
    if len(pngs) == 1:  # the lane sometimes names the file itself
        return os.path.join(stage, pngs[0])
    m = re.search(r"session id:\s*([0-9a-f-]{20,})", out)
    if m:  # last resort: the image tool's own copy for this session
        d = os.path.join(CODEX_IMAGES, m.group(1))
        if os.path.isdir(d):
            imgs = sorted((os.path.join(d, f) for f in os.listdir(d) if f.lower().endswith(".png")),
                          key=os.path.getmtime)
            if imgs:
                return imgs[-1]
    return None


LOG_LOCK = threading.Lock()  # three lanes append to one file


def append_prompt_log(a: Asset, image_prompt: str, refs: list[str], note: str) -> None:
    with LOG_LOCK:
        _append_prompt_log(a, image_prompt, refs, note)


def _append_prompt_log(a: Asset, image_prompt: str, refs: list[str], note: str) -> None:
    fresh = not os.path.isfile(PROMPTS_MD)
    with open(PROMPTS_MD, "a") as f:
        if fresh:
            f.write(
                "# Matchmade play art prompts\n\n"
                "Appended by `tools/gen_play_art.py`, one entry per generation attempt "
                "(newest last). Each prompt went to the Codex ImageGen lane "
                "(`codex exec --enable image_generation`, prompt on stdin) under a fixed "
                "save instruction (`lane_message` in the tool), with the listed "
                "reference images attached in order. The raw output was keyed (on the "
                "image tool's own alpha when it cut the ground out itself, else off "
                "the magenta ground) and framed to 256² RGBA.\n"
            )
        stamp = dt.datetime.now().strftime("%Y-%m-%d %H:%M")
        f.write(f"\n## {a.key} · {stamp}\n\n")
        f.write(f"- out: `{a.path}`\n")
        f.write("- refs: " + ", ".join(f"`{os.path.relpath(r, ROOT)}`" for r in refs) + "\n")
        if note:
            f.write(f"- retry note: {note}\n")
        f.write(f"\n> {image_prompt}\n")


def generate(a: Asset, note: str, model: str | None, effort: str | None) -> tuple[str, str | None, list[str]]:
    try:
        refs = ref_paths(a)
    except RuntimeError as e:
        return a.key, str(e), []
    image_prompt = build_prompt(a, note)
    append_prompt_log(a, image_prompt, refs, note)
    stage = tempfile.mkdtemp(prefix=f"play-{a.key}-")
    # `-i` is variadic: the prompt goes in on stdin, never as a positional.
    cmd = ["codex", "exec", "--skip-git-repo-check", "--enable", "image_generation",
           "--sandbox", "workspace-write", "-C", stage]
    if model:
        cmd += ["-m", model]
    if effort:
        cmd += ["-c", f'model_reasoning_effort="{effort}"']
    cmd += ["-i", *refs, "-"]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=900,
                           input=lane_message(a, image_prompt))
        out = (r.stdout or "") + (r.stderr or "")
    except subprocess.TimeoutExpired:
        return a.key, "codex timed out", []
    raw = find_raw(stage, a.key, out)
    if not raw:
        return a.key, out[-400:] or "no image produced", []
    os.makedirs(os.path.join(raw_dir(), "history"), exist_ok=True)
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    shutil.copyfile(raw, os.path.join(raw_dir(), "history", f"{a.key}-{stamp}.png"))
    shutil.copyfile(raw, os.path.join(raw_dir(), a.key + ".png"))
    try:
        warns = process(a, os.path.join(raw_dir(), a.key + ".png"))
    except Exception as e:  # noqa: BLE001: report it and keep the other lanes going
        return a.key, f"keying failed: {e}", []
    return a.key, None, warns


def select(only: str | None) -> list[Asset]:
    if not only:
        return list(MANIFEST)
    picked: list[Asset] = []
    for tok in (t.strip() for t in only.split(",") if t.strip()):
        if tok in BY_KEY:
            hits = [BY_KEY[tok]]
        elif tok == "icons":
            hits = [a for a in MANIFEST if a.key.startswith("icon_")]
        elif tok == "dice":
            hits = [a for a in MANIFEST if a.key.startswith("die_")]
        elif tok in GROUPS:
            hits = [a for a in MANIFEST if a.group == tok]
        else:
            sys.exit(f"unknown key or group: {tok} (keys: {', '.join(BY_KEY)})")
        picked += [h for h in hits if h not in picked]
    return picked


# ── Review sheets ────────────────────────────────────────────────────────
def font(size: int):
    from PIL import ImageFont

    for p in ("/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf",
              "/System/Library/Fonts/Supplemental/Arial.ttf"):
        if os.path.isfile(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default(size=size)


def strip(assets: list[Asset], title: str | None, cols: int):
    from PIL import Image, ImageDraw

    tile, gap, label_h, pad = 256, 24, 30, 28
    head = 46 if title else 0
    rows = (len(assets) + cols - 1) // cols
    width = pad * 2 + cols * tile + (cols - 1) * gap
    height = pad * 2 + head + rows * (tile + label_h) + (rows - 1) * gap
    sheet = Image.new("RGBA", (width, height), (0xFF, 0xFA, 0xF0, 255))
    d = ImageDraw.Draw(sheet)
    if title:
        d.text((pad, pad), title, fill=(0x4A, 0x32, 0x20, 255), font=font(30))
    small = font(17)
    for i, a in enumerate(assets):
        r, c = divmod(i, cols)
        x = pad + c * (tile + gap)
        y = pad + head + r * (tile + label_h + gap)
        im = Image.open(os.path.join(ROOT, a.path)).convert("RGBA").resize((tile, tile), Image.LANCZOS)
        sheet.alpha_composite(im, (x, y))
        name = os.path.relpath(os.path.join(ROOT, a.path), os.path.join(ROOT, PLAY))
        tw = d.textlength(name, font=small)
        d.text((x + (tile - tw) / 2, y + tile + 6), name, fill=(0x6B, 0x55, 0x40, 255), font=small)
    return sheet


def order_for(group: str) -> list[Asset]:
    icon = [a for a in MANIFEST if a.group == group and a.key.startswith("icon_")]
    rest = [a for a in MANIFEST if a.group == group and not a.key.startswith("icon_")]
    if group == "rootle":
        rest.sort(key=lambda a: a.key)
    return icon + rest


def contact() -> None:
    from PIL import Image

    os.makedirs(ARTIFACTS, exist_ok=True)
    cols = max(len(order_for(g)) for g in GROUPS)
    parts = []
    for g in GROUPS:
        s = strip(order_for(g), GROUP_TITLES[g], cols)
        parts.append(s)
        strip(order_for(g), GROUP_TITLES[g], len(order_for(g))).convert("RGB").save(
            os.path.join(ARTIFACTS, f"{g}.png"))
    total = Image.new("RGBA", (parts[0].width, sum(p.height for p in parts)), (0xFF, 0xFA, 0xF0, 255))
    y = 0
    for p in parts:
        total.alpha_composite(p, (0, y))
        y += p.height
    total.convert("RGB").save(os.path.join(ARTIFACTS, "contact.png"))
    print(f"contact sheet → {os.path.relpath(os.path.join(ARTIFACTS, 'contact.png'), ROOT)}")
    print("strips → " + ", ".join(f"{g}.png" for g in GROUPS))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", help="comma-separated keys or groups (icons, dice, rootle, fence_the_pen, ...)")
    ap.add_argument("--lanes", type=int, default=3, help="parallel codex calls (default 3)")
    ap.add_argument("--dry-run", action="store_true", help="print each prompt and its refs; generate nothing")
    ap.add_argument("--note", default="", help="a tightening line for a retry, placed before the house suffix")
    # The repo's codex config names a model the CLI's ChatGPT sign-in refuses
    # ("not supported when using Codex with a ChatGPT account", 2026-10-04), so
    # the lane names one it accepts; "" falls back to the config's default.
    ap.add_argument("--model", default="gpt-6-astra", help="codex model (default gpt-6-astra)")
    ap.add_argument("--effort", default="medium",
                    help="codex model_reasoning_effort (default medium; the call only drives the image tool)")
    ap.add_argument("--rekey", action="store_true", help="re-key and re-frame the saved raws; no generation")
    ap.add_argument("--check", action="store_true", help="QA the files on disk")
    ap.add_argument("--contact", action="store_true", help="build the contact sheet and per-game strips")
    a = ap.parse_args()

    todo = select(a.only)
    if a.contact:
        contact()
        return 0
    if a.check:
        bad = 0
        for x in todo:
            warns = qa(os.path.join(ROOT, x.path), bare=not x.sparkles)
            bad += bool(warns)
            print(f"  {'!' if warns else '✓'} {x.key:<20} {'; '.join(warns)}")
        return 1 if bad else 0
    if a.rekey:
        # anchors first, so a sibling stamps the anchor's fresh sparkles
        todo.sort(key=lambda x: not any(y.sibling == x.key for y in MANIFEST))
        for x in todo:
            raw = os.path.join(raw_dir(), x.key + ".png")
            if not os.path.isfile(raw):
                print(f"  ✗ {x.key}: no raw at {os.path.relpath(raw, ROOT)}")
                continue
            try:
                warns = process(x, raw)
            except Exception as e:  # noqa: BLE001: report it and re-key the rest
                print(f"  ✗ {x.key}: {e}")
                continue
            print(f"  {'!' if warns else '✓'} {x.key} → {x.path}  {'; '.join(warns)}")
        return 0
    if a.dry_run:
        for x in todo:
            try:
                refs = ref_paths(x)
            except RuntimeError as e:
                refs = [os.path.join(ROOT, STYLE_REF), f"<{e}>"]
            print(f"── {x.key} → {x.path}")
            print("   refs: " + ", ".join(os.path.relpath(r, ROOT) if os.path.isabs(r) else r for r in refs))
            print("   " + build_prompt(x, a.note) + "\n")
        return 0

    # die_2 is the family's reference: make it before any face that leans on it.
    first = [x for x in todo if any(y.sibling == x.key for y in todo)]
    rest = [x for x in todo if x not in first]
    failures = 0
    print(f"generating {len(todo)} sticker(s) via codex image_generation, {a.lanes} lanes …")
    for batch in (first, rest):
        if not batch:
            continue
        with ThreadPoolExecutor(max_workers=a.lanes) as pool:
            for key, err, warns in pool.map(lambda x: generate(x, a.note, a.model or None, a.effort or None), batch):
                if err:
                    failures += 1
                    print(f"  ✗ {key}: {err}")
                else:
                    print(f"  {'!' if warns else '✓'} {key} → {BY_KEY[key].path}  {'; '.join(warns)}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Side-view item art — the three-quarter variant a worn item takes when the
pig turns (the `face` / `face_sit` families, drawn looking right).

A worn item's front sprite on a turned pig reads as a cut-out pasted on a
photo: the cowboy hat's brim faces the camera while the head under it faces
the friend. This tool asks the Codex ImageGen lane (the same
`codex exec --enable image_generation` lane regen_studio uses) to REPAINT the
item's own front sprite at the pig's three-quarter camera, attaching the
front art as the fidelity reference and Rosie's `face_1` frame as the camera
reference. Output lands in `assets/images/hats/side/<id>.png` (256px, keyed and
recentred exactly like the front sprites) and `constants/hat_side.generated.ts`
is rebuilt from the directory — rebuild-all, sorted, never hand-edited.

    python3 tools/gen_side_items.py cowboy wizard tophat         # three items
    python3 tools/gen_side_items.py --redo cowboy                # overwrite
    python3 tools/gen_side_items.py --registry                   # regen the .ts only
    python3 tools/gen_side_items.py --list                       # what has side art

Placement: a side sprite reuses the item's front RelSpec (pivot / widthFrac /
anchor) against the `face` families' own anchors — the studio's placement for
the turned pig. If a side sprite needs its own pivot, tune it in the
placement studio's Items mode with the pig set to `face` (todo: a Side toggle).
Like regen_studio, a generation takes ~60–120 s; three run in parallel.
"""
import argparse
import os
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONT_DIR = os.path.join(ROOT, "assets/images/hats")
SIDE_DIR = os.path.join(ROOT, "assets/images/hats/side")
REGISTRY = os.path.join(ROOT, "constants/hat_side.generated.ts")
FACE_REF = os.path.join(ROOT, "assets/images/sprites/rosie/face_1.png")

STYLE = (
    "REPAINT IT AS FAITHFULLY AS POSSIBLE: the same object, same design, same "
    "colors, same materials, same bold outline, same glossy candy highlights, "
    "same soft volumetric shading, same chunky toy-like volume, same charm. "
    "Someone comparing the two should believe it is the same object."
)


# The camera, stated from the pig's geometry rather than guessed: on `face_1`
# the pig looks to the viewer's RIGHT, so the side of the face nearer the
# camera is the viewer's LEFT — the left eye is full and large, the right eye
# is farther, smaller and tucked against the snout. The first six side sprites
# were prompted the other way round; a brim survived it, a pair of lenses did
# not (the aviator's big lens landed on the far eye — angle audit, 2026-09-15).
CAMERA = (
    "THE ONLY CHANGE IS THE CAMERA. The SECOND attached image is the pig "
    "wearing nothing, drawn at a three-quarter view looking to the RIGHT of "
    "the picture. Repaint the item at EXACTLY that camera: the same yaw as "
    "the pig's head, so the item would sit naturally on this pig. Read the "
    "pig: the side of its face NEARER the camera is the viewer's LEFT (its "
    "left eye is full and large); the FAR side is the viewer's RIGHT, where "
    "the head turns away toward the snout (its right eye is smaller and "
    "tucked against the snout). So the item's near side is on the LEFT of the "
    "picture — larger and closer — and its far side is on the RIGHT, "
    "foreshortened and partly hidden behind the near side. The item's FRONT "
    "faces the way the pig looks: to the right. Keep the item's silhouette "
    "open where it meets the head; never draw the pig, a head, hair, or any "
    "body part. This is a camera instruction, NOT a style instruction — keep "
    "the full dimensional, glossy, juicy cartoon rendering of the original "
    "intact."
)

# Eye-line items are the unforgiving case: two lenses read wrong the moment
# the near/far sides swap or the bridge floats.
LENSES = (
    "THIS ITEM SITS ON THE EYES. Draw it as a pair of lenses seen at that "
    "three-quarter angle: the NEAR lens on the LEFT of the picture at full "
    "size and full shape, over where the near eye would be; the FAR lens on "
    "the RIGHT foreshortened to about sixty percent of its width, sitting a "
    "little lower and tighter to the bridge, its outer edge cut off where the "
    "snout would hide it. A short bridge between them angled with the snout. "
    "The near temple arm shows as a short stub trailing back to the LEFT "
    "toward the near ear; the far arm is hidden. Keep the lens tint, frame "
    "colour, shape and decoration exactly as in the front sprite."
)


# A mask wraps the face instead of sitting on it: eyeholes rather than lenses,
# no bridge, no temple arms, and the far side curves away around the snout.
MASKS = (
    "THIS ITEM IS A MASK WORN OVER THE EYES. Draw it wrapping the face at that "
    "three-quarter angle: the NEAR eyehole on the LEFT of the picture at full "
    "size, the FAR eyehole on the RIGHT foreshortened to about sixty percent "
    "and tighter to the middle, the mask's far edge curving away and cut off "
    "where the snout would hide it. Any nose piece, brow, crest, feathers or "
    "trim turn with it — the front of the decoration faces the way the pig "
    "looks (right). Keep every colour, gem, pattern and trim of the front "
    "sprite."
)
MASK_IDS = frozenset({
    "carnival_mask", "cat_mask", "domino", "hero_mask", "masquerade",
    "midnight_eye_mask", "robber_mask", "skull_mask", "sleep_mask",
    "venice_mask", "vr_headset",
})

# One lens over the near eye (the RelSpec anchors these on `eye_l`, which on
# the turned families is the near, full-size eye).
ONE_EYE = (
    "THIS ITEM SITS OVER ONE EYE — the NEAR eye, on the LEFT of the picture. "
    "Draw the single lens seen at that three-quarter angle: a little narrower "
    "than the front view, its rim turned with the head, any chain, ribbon or "
    "handle trailing down and to the LEFT. Keep the metal, the glass and the "
    "decoration exactly as in the front sprite."
)
ONE_EYE_IDS = frozenset({"monocle", "slop_club_monocle_crest", "opera_lorgnette"})

REL_FILES = ("constants/hat_rel.generated.ts", "constants/membersRel.generated.ts")


def is_eye_item(item_id: str) -> bool:
    """RelSpec anchor eyes / eye_l / eye_r — read straight off the registries."""
    for rel in REL_FILES:
        try:
            for line in open(os.path.join(ROOT, rel)):
                if line.strip().startswith(item_id + ":"):
                    return 'anchor: "eye' in line
        except OSError:
            pass
    return False


def addendum(item_id: str) -> str | None:
    if item_id in MASK_IDS:
        return MASKS
    if item_id in ONE_EYE_IDS:
        return ONE_EYE
    if is_eye_item(item_id):
        return LENSES
    return None


def prompt(item_id: str) -> str:
    name = item_id.replace("_", " ")
    return "\n".join([
        "Generate ONE image with the image generation tool and save it in "
        f"this directory as {item_id}.png.",
        "",
        f"The FIRST attached image is the current front-view sprite of \"{name}\", "
        "a cosmetic worn by a cartoon pig in our game. " + STYLE,
        "",
        CAMERA,
        *(["", addendum(item_id)] if addendum(item_id) else []),
        "",
        "Technical: single item centered on a SOLID, FLAT MAGENTA (#FF00FF) "
        "background — one uniform colour edge to edge, no checkerboard, no "
        "gradient, no shadow on the ground — small margin, square 1024x1024. "
        "The magenta is keyed out afterwards, so never use magenta on the item.",
    ])


def key_and_recentre(raw_path: str, out_path: str, margin: float = 0.06) -> None:
    """Match the front sprites: clear the ground, crop to the glyph, recentre
    with a margin, downscale to 256.

    The ground is cleared by FLOOD FILL from the four corners, not by colour
    over the whole image: the lane paints a magenta ground when asked, but has
    also returned a fake checkerboard (two greys, opaque) — either way the
    ground is whatever the corners are, and only pixels CONNECTED to the
    corners go, so a glossy white highlight inside the ink outline survives."""
    from collections import deque

    from PIL import Image

    im = Image.open(raw_path).convert("RGBA")
    w, h = im.size
    px = im.load()
    # The ground's colours: the four corners plus one checker step in from each
    # (a checkerboard shows its second grey there). Anything within `tol` of any
    # of these is ground when reached from the outside.
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
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
    # Enclosed holes (a bow's loops, a visor) never touch a corner. Region-grow
    # every remaining ground-coloured pixel; clear a region only when it is
    # unmistakably ground — a checkerboard (two of the key greys, both with
    # real area) or magenta — so a single-colour white highlight is kept.
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
    bbox = im.getbbox()
    if not bbox:
        raise RuntimeError("empty image after keying")
    glyph = im.crop(bbox)
    gw, gh = glyph.size
    side = round(max(gw, gh) * (1 + 2 * margin))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(glyph, ((side - gw) // 2, (side - gh) // 2), glyph)
    canvas.resize((256, 256), Image.LANCZOS).save(out_path)


def generate(item_id: str) -> tuple[str, str | None]:
    front = os.path.join(FRONT_DIR, item_id + ".png")
    if not os.path.isfile(front):
        return item_id, f"no front sprite at {os.path.relpath(front, ROOT)}"
    stage = tempfile.mkdtemp(prefix=f"side-{item_id}-")
    # `-i` is variadic: the prompt goes in on stdin, never as a positional.
    cmd = [
        "codex", "exec", "--skip-git-repo-check",
        "--enable", "image_generation",
        "--sandbox", "workspace-write", "-C", stage,
        "-i", front, FACE_REF, "-",
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=600, input=prompt(item_id))
    raw = os.path.join(stage, item_id + ".png")
    if not os.path.isfile(raw):
        # the lane sometimes names the file itself — take the only png it wrote
        pngs = [f for f in os.listdir(stage) if f.lower().endswith(".png")]
        if len(pngs) == 1:
            raw = os.path.join(stage, pngs[0])
        else:
            return item_id, (r.stdout or r.stderr or "no image produced")[-400:]
    os.makedirs(SIDE_DIR, exist_ok=True)
    key_and_recentre(raw, os.path.join(SIDE_DIR, item_id + ".png"))
    return item_id, None


def side_ids() -> list[str]:
    if not os.path.isdir(SIDE_DIR):
        return []
    return sorted(f[:-4] for f in os.listdir(SIDE_DIR) if f.endswith(".png"))


def write_registry() -> None:
    ids = side_ids()
    lines = [
        "// AUTO-GENERATED by tools/gen_side_items.py — do not edit by hand.",
        "// Rebuilt from assets/images/hats/side/ on every run: every item with a",
        "// three-quarter sprite for the turned (`face` / `face_sit`) pig. An item",
        "// missing here keeps its front sprite when the pig turns.",
        "",
        "export const HAT_SIDE_IMAGES: Record<string, number> = {",
    ]
    lines += [f'\t{i}: require("../assets/images/hats/side/{i}.png"),' for i in ids]
    lines += ["};", ""]
    with open(REGISTRY, "w") as f:
        f.write("\n".join(lines))
    print(f"registry → constants/hat_side.generated.ts ({len(ids)} items)")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("items", nargs="*", help="item ids (as in HAT_IMAGES)")
    ap.add_argument("--redo", action="store_true", help="regenerate even if side art exists")
    ap.add_argument("--registry", action="store_true", help="only rebuild the .ts registry")
    ap.add_argument("--list", action="store_true", help="list items with side art")
    ap.add_argument("--lanes", type=int, default=3, help="parallel codex calls (default 3)")
    a = ap.parse_args()
    if a.list:
        print("\n".join(side_ids()) or "(none)")
        return 0
    if a.registry:
        write_registry()
        return 0
    if not a.items:
        ap.error("give item ids, or --registry / --list")
    todo = [i for i in a.items if a.redo or not os.path.isfile(os.path.join(SIDE_DIR, i + ".png"))]
    skipped = [i for i in a.items if i not in todo]
    if skipped:
        print("already have side art (use --redo):", ", ".join(skipped))
    failures = 0
    if todo:
        print(f"generating {len(todo)} side sprite(s) via codex image_generation, {a.lanes} lanes …")
        with ThreadPoolExecutor(max_workers=a.lanes) as pool:
            for item_id, err in pool.map(generate, todo):
                if err:
                    failures += 1
                    print(f"  ✗ {item_id}: {err}")
                else:
                    print(f"  ✓ {item_id} → assets/images/hats/side/{item_id}.png")
    write_registry()
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())

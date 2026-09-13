"""Turn the ChatGPT barn (on a magenta key) into the three aligned layers
BarnStructure draws: body (doorway hollowed to a dark interior), left leaf,
right leaf. Emits barn_layers.json with the door rect as fractions of the
body so the component can position the leaves without magic numbers.

usage: python3 scripts/habitat/slice_barn.py <source.png>
"""
import json, sys
from PIL import Image, ImageFilter

src = Image.open(sys.argv[1]).convert("RGBA")
W, H = src.size
px = src.load()

# 1. key out magenta (with tolerance) and despill the fringe
def is_key(r, g, b):
    return r > 170 and b > 170 and g < 110 and abs(r - b) < 80
for y in range(H):
    for x in range(W):
        r, g, b, a = px[x, y]
        if is_key(r, g, b):
            px[x, y] = (0, 0, 0, 0)
# soften the cut edge: pixels next to transparency that still carry magenta tint
alpha = src.split()[3]
edge = alpha.filter(ImageFilter.MinFilter(3))
for y in range(H):
    for x in range(W):
        if alpha.getpixel((x, y)) and not edge.getpixel((x, y)):
            r, g, b, a = px[x, y]
            if r > g + 40 and b > g + 40:   # magenta-tinted fringe
                m = (r + b) // 2
                px[x, y] = (min(255, g + (m - g) // 3), g, min(255, g + (m - g) // 3), a)

bbox = src.split()[3].getbbox()
barn = src.crop(bbox)
BW, BH = barn.size
bp = barn.load()

# 2. find the door frame: mask the cream (frame + X braces), take connected
# components on a downscaled copy, and keep the two large ones in the lower
# half — the leaves. Their union is the door rect; the gap between them is the
# seam. (A row/column scan fails: the corner posts and the loft window share
# the cream, and the rails are broken by ink joints.)
from collections import deque
S = 4
small = barn.resize((BW // S, BH // S), Image.BILINEAR)
sw, sh = small.size
sp = small.load()
def cream_s(x, y):
    r, g, b, a = sp[x, y]
    return a > 200 and r > 195 and g > 175 and b > 120 and (r - b) < 95 and (r - g) < 45
seen = [[False] * sh for _ in range(sw)]
comps = []
for yy in range(sh // 3, sh):
    for xx in range(sw):
        if seen[xx][yy] or not cream_s(xx, yy): continue
        q = deque([(xx, yy)]); seen[xx][yy] = True; n = 0
        bx0 = bx1 = xx; by0 = by1 = yy
        while q:
            x, y = q.popleft(); n += 1
            bx0, bx1, by0, by1 = min(bx0, x), max(bx1, x), min(by0, y), max(by1, y)
            for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < sw and sh // 3 <= ny < sh and not seen[nx][ny] and cream_s(nx, ny):
                    seen[nx][ny] = True; q.append((nx, ny))
        comps.append((n, bx0, by0, bx1, by1))
big = [c for c in comps if (c[3]-c[1]) > sw * 0.15 and (c[4]-c[2]) > sh * 0.25]
big.sort(key=lambda c: c[1])
assert len(big) >= 2, f"expected two leaf frames, got {big}"
L, R = big[0], big[-1]
left, right = L[1] * S, (R[3] + 1) * S
top, bottom = min(L[2], R[2]) * S, (max(L[4], R[4]) + 1) * S
seam = ((L[3] + R[1] + 1) * S) // 2
cx = BW // 2
# widen by the ink outline so each leaf keeps its own outline
INK = max(4, BW // 120)
x0, y0, x1, y1 = max(0, left - INK), max(0, top - INK), min(BW, right + INK), min(BH, bottom + INK)

# 3. layers
leaf_l = barn.crop((x0, y0, seam, y1))
leaf_r = barn.crop((seam, y0, x1, y1))
body = barn.copy()
bpx = body.load()
# hollow the doorway: keep the outer INK ring, fill inside with the dark interior
interior = (58, 36, 24, 255)
for y in range(y0 + INK, y1 - INK):
    for x in range(x0 + INK, x1 - INK):
        bpx[x, y] = interior

# 4. export at 3x of the sprite box (width 354pt*... the body's own aspect decides height)
TARGET_W = 354
scale = TARGET_W / BW
def out(im, name):
    w, h = im.size
    im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    im.save(f"assets/images/barn/exterior/{name}.png")
    return im.size
sizes = {"body": out(body, "barn_body"), "leafLeft": out(leaf_l, "door_leaf_left"), "leafRight": out(leaf_r, "door_leaf_right")}
meta = {
    "source": "ChatGPT ImageGen 2026-09-12, docs/openai-barn-structure.md",
    "bodyPx": sizes["body"],
    "door": {"x": x0 / BW, "y": y0 / BH, "w": (x1 - x0) / BW, "h": (y1 - y0) / BH, "seam": (seam - x0) / (x1 - x0)},
}
json.dump(meta, open("assets/images/barn/exterior/barn_layers.json", "w"), indent=2)
print(json.dumps(meta), "crop", bbox, "door", (x0, y0, x1, y1), "seam", seam)

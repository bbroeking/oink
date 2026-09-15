"""Strip the baked pale ground disc under a sprite's hooves.

Border flood-fill confined to the foot band: transparent and low-alpha pixels
carry connectivity (the disc is ringed by a semi-transparent ink fringe), but
only disc-coloured pixels — pale, barely pink — are cleared, plus anything
strictly below the lowest hoof row. The ink outline and body pink block the
fill, so enclosed highlights are untouched.
"""
import sys
from collections import deque
import numpy as np
from PIL import Image

def strip(path, band_up=40):
    im = Image.open(path).convert("RGBA")
    arr = np.asarray(im).astype(int).copy()
    a = arr[:, :, 3]; rgb = arr[:, :, :3]; r, g = rgb[:, :, 0], rgb[:, :, 1]
    mx = rgb.max(2); mn = rgb.min(2); sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    H, W = a.shape
    hoof = np.where(((a > 128) & (mx < 120)).any(1))[0].max()
    top = max(0, hoof - band_up)
    disc = (mx > 150) & ((r - g) <= 40) & (sat < 0.3)
    passable = (a < 100) | disc
    passable[:top] = False
    seen = np.zeros_like(passable, bool); q = deque()
    for y in range(top, H):
        for x in (0, W - 1):
            if passable[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    for x in range(W):
        if passable[H - 1, x] and not seen[H - 1, x]: seen[H - 1, x] = True; q.append((H - 1, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if top <= ny < H and 0 <= nx < W and passable[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    clear = seen & disc & (a > 0)
    clear[hoof + 1:, :] |= a[hoof + 1:, :] > 0
    # The old ellipse's own low-alpha ink fringe: reachable, faint, and not
    # hugging the body. Solid non-disc pixels dilated by 2 px are the body.
    body = (a >= 200) & ~disc
    grown = body.copy()
    for dy in (-2, -1, 0, 1, 2):
        for dx in (-2, -1, 0, 1, 2):
            grown |= np.roll(np.roll(body, dy, 0), dx, 1)
    clear |= seen & (a > 0) & (a < 100) & ~grown
    n = int(clear.sum()); n_op = int((clear & (a > 40)).sum())
    arr[:, :, 3][clear] = 0
    Image.fromarray(arr.astype(np.uint8), "RGBA").save(path)
    return n, n_op, int(hoof)

if __name__ == "__main__":
    for p in sys.argv[1:]:
        n, n_op, hoof = strip(p)
        print(f"{p.split('/')[-1]:16} cleared {n:5d} px ({n_op} opaque)  hoof row {hoof}")

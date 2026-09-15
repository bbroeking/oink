"""Clear stray specks around a sprite's hooves.

Two kinds survive a ground-disc strip: tiny detached ink islands along the
old ellipse's arc, and pale (near-white) pixels hugging the hoof edge that
read as white dots on a dark ground. Both are removed only inside the foot
band (50 px above the lowest hoof row to the canvas bottom) so intended
detached marks higher up — sweat drops, motion strokes — are never touched.
"""
import sys
from collections import deque
import numpy as np
from PIL import Image

BAND_UP = 50
MAX_ISLAND = 30  # px; larger detached shapes are authored marks

def label(mask):
    H, W = mask.shape; lab = np.zeros((H, W), int); n = 0
    for y0, x0 in zip(*np.where(mask)):
        if lab[y0, x0]: continue
        n += 1; lab[y0, x0] = n; q = deque([(y0, x0)])
        while q:
            y, x = q.popleft()
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not lab[ny, nx]:
                        lab[ny, nx] = n; q.append((ny, nx))
    return lab, n

def dilate(m, r):
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out |= np.roll(np.roll(m, dy, 0), dx, 1)
    return out

def strip(path):
    arr = np.asarray(Image.open(path).convert("RGBA")).astype(int).copy()
    a = arr[:, :, 3]; rgb = arr[:, :, :3]
    mx = rgb.max(2); mn = rgb.min(2); sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    hoof = np.where(((a > 128) & (mx < 120)).any(1))[0].max()
    top = max(0, hoof - BAND_UP)
    clear = np.zeros_like(a, bool)
    # 1. small detached islands in the band
    vis = a > 8; lab, n = label(vis); sizes = np.bincount(lab.ravel())[1:]; main = int(np.argmax(sizes)) + 1
    for k in range(1, n + 1):
        if k == main or sizes[k - 1] >= MAX_ISLAND: continue
        ys, xs = np.where(lab == k)
        if ys.mean() >= top: clear[ys, xs] = True
    # 2. pale pixels outside the solid body, in the band
    solid = a >= 200; lab2, n2 = label(solid); s2 = np.bincount(lab2.ravel())[1:]
    body = lab2 == (int(np.argmax(s2)) + 1)
    pale = (mx > 190) & (sat < 0.22) & (a > 0) & ~dilate(body, 1)
    pale[:top] = False
    clear |= pale
    n_clear = int(clear.sum())
    if n_clear:
        arr[:, :, 3][clear] = 0
        Image.fromarray(arr.astype(np.uint8), "RGBA").save(path)
    return n_clear, int(hoof)

if __name__ == "__main__":
    for p in sys.argv[1:]:
        n, hoof = strip(p)
        if n: print(f"{p.split('/')[-1]:16} cleared {n:3d} px  (hoof row {hoof})")

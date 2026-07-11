#!/usr/bin/env python3
"""Slice + white->transparent the missing-items art into game assets."""
import os, sys
import numpy as np
from PIL import Image, ImageDraw

SRC = "/Users/bbroeking/projects/oink/assets/concepts/missing-items"
HATS = "/Users/bbroeking/projects/oink/assets/images/hats"
BG   = "/Users/bbroeking/projects/oink/assets/images/backgrounds"
PART = "/Users/bbroeking/projects/oink/assets/images/tickle-particles"
OUT_PREVIEW = SRC + "/preview"
os.makedirs(OUT_PREVIEW, exist_ok=True)

def flood_bg_alpha(rgb, thresh=42):
    """Return alpha (uint8) where border-connected near-white bg -> 0."""
    im = rgb.convert("RGB").copy()
    w, h = im.size
    SENT = (255, 0, 255)
    seeds = [(0,0),(w-1,0),(0,h-1),(w-1,h-1),(w//2,0),(w//2,h-1),(0,h//2),(w-1,h//2),
             (2,2),(w-3,2),(2,h-3),(w-3,h-3)]
    for s in seeds:
        px = im.getpixel(s)
        if px == SENT: continue
        # only flood from near-white seeds
        if px[0]>235 and px[1]>235 and px[2]>235:
            ImageDraw.floodfill(im, s, SENT, thresh=thresh)
    arr = np.array(im)
    bg = (arr[:,:,0]==255)&(arr[:,:,1]==0)&(arr[:,:,2]==255)
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    # despill: near-white pixels adjacent to transparent -> fade (1px halo trim)
    rgba0 = np.array(rgb.convert("RGB"))
    nearwhite = (rgba0[:,:,0]>244)&(rgba0[:,:,1]>244)&(rgba0[:,:,2]>244)
    trans = alpha==0
    adj = np.zeros_like(trans)
    adj[1:,:]  |= trans[:-1,:]
    adj[:-1,:] |= trans[1:,:]
    adj[:,1:]  |= trans[:,:-1]
    adj[:,:-1] |= trans[:,1:]
    halo = nearwhite & adj & (alpha>0)
    alpha[halo] = 0
    return alpha

def make_sticker(rgb):
    a = flood_bg_alpha(rgb)
    arr = np.dstack([np.array(rgb.convert("RGB")), a])
    return Image.fromarray(arr, "RGBA")

def trim(im):
    a = np.array(im)[:,:,3]
    ys, xs = np.where(a>8)
    if len(xs)==0: return im
    x0,x1,y0,y1 = xs.min(), xs.max()+1, ys.min(), ys.max()+1
    pad=6
    x0=max(0,x0-pad); y0=max(0,y0-pad)
    x1=min(im.width,x1+pad); y1=min(im.height,y1+pad)
    return im.crop((x0,y0,x1,y1))

def resize_max(im, m):
    w,h=im.size
    s=m/max(w,h)
    if s<1: im=im.resize((round(w*s),round(h*s)), Image.LANCZOS)
    return im

def split_two(rgba):
    """Split a 2-item strip into (left, right) by the transparent column gap."""
    a=np.array(rgba)[:,:,3]
    col=(a>8).any(axis=0)
    # runs of foreground columns
    runs=[]; s=None
    for i,v in enumerate(col):
        if v and s is None: s=i
        if not v and s is not None: runs.append((s,i)); s=None
    if s is not None: runs.append((s,len(col)))
    runs.sort(key=lambda r:r[1]-r[0], reverse=True)
    two=sorted(runs[:2], key=lambda r:r[0])
    pad=8
    out=[]
    for (a0,a1) in two:
        a0=max(0,a0-pad); a1=min(rgba.width,a1+pad)
        out.append(rgba.crop((a0,0,a1,rgba.height)))
    return out

def save_png(im, path, maxkb=300):
    im.save(path)
    # quantize with pngquant to shrink, keep alpha
    os.system(f'pngquant --force --skip-if-larger --quality=70-95 --output "{path}" "{path}" 2>/dev/null')
    kb=os.path.getsize(path)/1024
    print(f"  saved {os.path.basename(path)} {im.size} {kb:.0f}KB")

# ---- 2-item sticker strips ----
STRIPS = {
    "mushroom_boat_raw.png":   [("mushroom_cap", HATS, 500), ("paper_boat", HATS, 500)],
    "jamjar_acorn_raw.png":    [("jam_jar_lenses", HATS, 500), ("acorn_bow", HATS, 500)],
    "bumblebee_firefly_raw.png":[("bumblebee_bow", HATS, 500), ("firefly_lantern", HATS, 500)],
    "umbrella_bubble_raw.png": [("tiny_umbrella", HATS, 500), ("bubble", PART, 256)],
}
for fn, items in STRIPS.items():
    print(fn)
    rgba = make_sticker(Image.open(os.path.join(SRC,fn)))
    halves = split_two(rgba)
    if len(halves)!=2:
        print("  !! expected 2 items, got", len(halves)); continue
    for (name,dst,mx),half in zip(items,halves):
        it=resize_max(trim(half),mx)
        save_png(it, os.path.join(dst, name+".png"))
        it.save(os.path.join(OUT_PREVIEW, name+".png"))

# ---- moth_waltz aura (luminance key on dark bg) ----
print("moth_waltz_raw.png")
m=Image.open(os.path.join(SRC,"moth_waltz_raw.png")).convert("RGB")
arr=np.array(m).astype(np.float32)
L=0.299*arr[:,:,0]+0.587*arr[:,:,1]+0.114*arr[:,:,2]
alpha=np.clip((L-24)*1.9,0,255).astype(np.uint8)
mrgba=Image.fromarray(np.dstack([np.array(m),alpha]),"RGBA")
mrgba=resize_max(trim(mrgba),512)
save_png(mrgba, os.path.join(HATS,"moth_waltz.png"), maxkb=400)
mrgba.save(os.path.join(OUT_PREVIEW,"moth_waltz.png"))

# ---- pumpkin_patch background (portrait crop for cover-fit) ----
print("pumpkin_patch_raw.png")
p=Image.open(os.path.join(SRC,"pumpkin_patch_raw.png")).convert("RGB")
w,h=p.size  # 1536x1024
ratio=354/887  # existing bg portrait ratio ~0.399
cw=int(h*ratio)
cx=int(w*0.44)  # bias left to keep the pig-shaped pumpkin
x0=max(0,cx-cw//2); x1=min(w,x0+cw); x0=x1-cw
crop=p.crop((x0,0,x1,h))
crop=resize_max(crop,1024) if crop.height>1024 else crop
crop.save(os.path.join(BG,"pumpkin_patch.png"))
os.system(f'pngquant --force --skip-if-larger --quality=75-95 --output "{os.path.join(BG,"pumpkin_patch.png")}" "{os.path.join(BG,"pumpkin_patch.png")}" 2>/dev/null')
print(f"  saved pumpkin_patch.png {crop.size} {os.path.getsize(os.path.join(BG,'pumpkin_patch.png'))/1024:.0f}KB")
crop.save(os.path.join(OUT_PREVIEW,"pumpkin_patch.png"))
print("DONE")

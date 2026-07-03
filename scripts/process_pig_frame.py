#!/usr/bin/env python3
"""Normalize a Midjourney pig render into a Rosie sprite frame.

Takes a MJ pig on a plain white background, removes the white, and rescales +
baseline-aligns the pig so its silhouette matches idle_1's pig bbox EXACTLY —
same height, horizontal centre, and bottom. That's what makes a regenerated
pose render the same size as idle (no size-jump) when SpritePig contain-fits it
into the 300 card.

Usage:
  process_pig_frame.py <src.png> <out_id> [outdir]
    <out_id>  e.g. surprise_1
    outdir    default tmp/surprise-gen (review there; copy into
              assets/images/sprites/rosie/ once approved)
"""
import sys, os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDLE = os.path.join(ROOT, "assets/images/sprites/rosie/idle_1.png")


def alpha_bbox(im, thr=20):
    return im.getchannel("A").point(lambda v: 255 if v > thr else 0).getbbox()


def pig_body_metrics(im, thr=20):
    """Find the PIG BODY (largest contiguous block of dense rows), ignoring
    sparse stuff above it like '!' marks / sparkles. Returns (top, bottom,
    left, right) of the body in image coords — used so every frame scales by
    the pig itself, not by a bbox that the effect marks inflate."""
    a = im.getchannel("A"); w, h = im.size; px = a.load()
    rows = []  # (count, lo, hi) per row
    for y in range(h):
        c = 0; lo = w; hi = -1
        for x in range(w):
            if px[x, y] > thr:
                c += 1
                if x < lo: lo = x
                if x > hi: hi = x
        rows.append((c, lo, hi))
    dense = 0.15 * w  # a row that's >15% covered is body, not a thin mark
    best = (0, 0, 0); start = None
    for y in range(h):
        if rows[y][0] > dense:
            if start is None: start = y
        elif start is not None:
            if y - start > best[0]: best = (y - start, start, y)
            start = None
    if start is not None and h - start > best[0]:
        best = (h - start, start, h)
    top, bot = best[1], best[2]
    if bot <= top:  # no dense block (shouldn't happen) → fall back to full bbox
        b = alpha_bbox(im); return b[1], b[3], b[0], b[2]
    lo = min(rows[y][1] for y in range(top, bot))
    hi = max(rows[y][2] for y in range(top, bot))
    return top, bot, lo, hi


def clean_pig(im, dilate=5):
    """Remove the baked ground shadow/platter + any background WITHOUT touching
    the pig's smooth outline. The originals are lovely — a clean solid dark
    outline + transparent bg + a soft grey shadow oval under the feet. We keep
    the pig (saturated pink OR dark outline) at its ORIGINAL alpha (so the
    anti-aliased outline survives intact), grow that silhouette ~2px to recover
    the outline's AA ring, hole-fill it (so enclosed white highlights/belly
    stay), and drop everything outside — which is exactly the grey shadow and
    any background. The old deshadow() binarized + ate the outline's grey AA
    pixels, leaving a jagged line; this does not."""
    import numpy as np
    from PIL import ImageFilter
    im = im.convert("RGBA")
    arr = np.array(im); a = arr[:, :, 3]; rgb = arr[:, :, :3].astype(int)
    pink = rgb[:, :, 0] > rgb[:, :, 2] + 10        # pig pink: R notably > B
    dark = rgb.max(2) < 90                          # outline / hooves / eyes
    pigcol = (a >= 180) & (pink | dark)
    pm = Image.fromarray((pigcol * 255).astype("uint8")).filter(ImageFilter.MaxFilter(dilate))
    flood = Image.fromarray((np.array(pm) == 0).astype("uint8") * 255)
    for s in [(0, 0), (flood.width - 1, 0), (0, flood.height - 1), (flood.width - 1, flood.height - 1)]:
        try: ImageDraw.floodfill(flood, s, 128)     # flood the OUTSIDE from the corners
        except Exception: pass
    silhouette = np.array(flood) != 128             # pig + enclosed holes (not the outside)
    arr[:, :, 3] = np.where(silhouette, a, 0).astype("uint8")
    return Image.fromarray(arr)


def deshadow(im, T=200):
    """Remove the baked ground shadow + give the frame hard binary alpha to
    match the cleaned idle/walk/... frames. strip_white can't reach the grey
    ground shadow (it floods WHITE, the shadow is grey), so it survives as
    semi-transparent / opaque grey pixels under the feet. The pig is saturated
    pink + dark-brown outline + white highlights; the shadow is NEUTRAL grey
    midtone — so we drop pixels that are (a) semi-transparent or (b) grey &
    midtone, and harden the rest to alpha 255. Near-black outline (saturated/
    dark) and white highlights (bright) are kept."""
    import numpy as np
    arr = np.array(im.convert("RGBA"))
    a = arr[:, :, 3]
    rgb = arr[:, :, :3].astype(int)
    mx = rgb.max(2); sat = mx - rgb.min(2)
    grey_mid = (sat < 30) & (mx > 90) & (mx < 225)   # the neutral shadow tone
    drop = (a < T) | grey_mid
    arr[:, :, 3] = np.where(drop, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


def antialias_edges(im, scale=4, rad=1.5, edge=(50, 38, 35)):
    """Re-introduce anti-aliasing on a hard binary-alpha frame. The shipped
    frames were all hard-thresholded (semi-alpha == 0), so every silhouette is a
    jagged stair-step that reads as rough/noisy at display scale. Supersample the
    ALPHA (4x), gaussian-blur, downsample -> a smooth feathered edge.

    The feather grows the silhouette ~1px into the transparent region, so the
    revealed pixels' COLOR matters: hard-thresholded frames leave LIGHT-grey RGB
    in transparent areas, which would show as a light halo on non-cream
    backgrounds. So first fill the transparent RGB with a neutral dark — the pig
    is fully dark-outlined, so the soft edge then reads as the outline on ANY
    background. No morphological ops, so thin/detached features (surprise '!'
    marks, tail) are preserved."""
    from PIL import ImageFilter
    im = im.convert("RGBA")
    r, g, b, a = im.split()
    W, H = im.size
    solid = a.point(lambda v: 255 if v > 0 else 0)
    rgb = Image.composite(Image.merge("RGB", (r, g, b)),
                          Image.new("RGB", (W, H), edge), solid)
    af = (a.resize((W * scale, H * scale), Image.LANCZOS)
           .filter(ImageFilter.GaussianBlur(rad))
           .resize((W, H), Image.LANCZOS))
    r2, g2, b2 = rgb.split()
    return Image.merge("RGBA", (r2, g2, b2, af))


def thicken_lines(im, grow=1, dark_thresh=110):
    """Thicken the dark linework (outer outline + internal lines) by `grow` px for
    a bolder storybook look. Dilates the dark-pixel mask and paints the growth
    with the median outline colour: the outer outline grows outward (a bolder
    border, silhouette +grow px), internal lines grow into the fill. Follow with
    antialias_edges to smooth the thickened edge."""
    import numpy as np
    from PIL import ImageFilter
    im = im.convert("RGBA")
    arr = np.array(im); a = arr[:, :, 3]; rgb = arr[:, :, :3]
    dark = (a >= 128) & (rgb.max(2) < dark_thresh)
    if not dark.any():
        return im
    dcol = np.median(rgb[dark], axis=0).astype(np.uint8)
    grown = np.array(Image.fromarray((dark * 255).astype("uint8"))
                     .filter(ImageFilter.MaxFilter(2 * grow + 1))) > 0
    paint = grown & ~dark
    for c in range(3):
        arr[:, :, c][paint] = dcol[c]
    arr[:, :, 3][grown] = 255
    return Image.fromarray(arr)


def strip_white(im, thresh=55):
    """Flood-fill the white background from the edges -> transparent."""
    rgb = im.convert("RGB")
    w, h = rgb.size
    SENT = (255, 0, 255)
    seeds = [(2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3),
             (w // 2, 2), (w // 2, h - 3), (2, h // 2), (w - 3, h // 2)]
    for s in seeds:
        ImageDraw.floodfill(rgb, s, SENT, thresh=thresh)
    out = im.convert("RGBA")
    out.putdata([(0, 0, 0, 0) if p[:3] == SENT else p for p in out.getdata()])
    return out


def main():
    src, out_id = sys.argv[1], sys.argv[2]
    outdir = sys.argv[3] if len(sys.argv) > 3 else os.path.join(ROOT, "tmp/surprise-gen")
    os.makedirs(outdir, exist_ok=True)

    # idle reference: canvas size + PIG BODY (height, centre-x, bottom). Body,
    # not bbox, so effect marks ('!', sparkles) never change the pig's scale.
    idle = Image.open(IDLE).convert("RGBA")
    CW, CH = idle.size
    it, ibot, il, ir = pig_body_metrics(idle)
    target_h = ibot - it
    target_cx = (il + ir) / 2
    target_bottom = ibot

    # incoming frame: white-strip if needed (keep full content incl. marks),
    # then clean_pig to drop the ground shadow/platter + any bg while KEEPING the
    # pig's smooth original outline. Done on the source (full res) before scaling.
    src_im = Image.open(src).convert("RGBA")
    if alpha_bbox(src_im) and alpha_bbox(src_im) != (0, 0, src_im.width, src_im.height):
        pig = src_im
    else:
        pig = strip_white(src_im)
    pig = clean_pig(pig)
    if not alpha_bbox(pig):
        raise SystemExit(f"{out_id}: no pig found (white-strip failed?)")

    # measure the PIG BODY of this frame, scale so it matches idle's body height
    bt, bb, bl, br = pig_body_metrics(pig)
    body_h = bb - bt
    body_cx = (bl + br) / 2
    body_bottom = bb
    s = target_h / body_h
    np = pig.resize((max(1, round(pig.width * s)), max(1, round(pig.height * s))), Image.LANCZOS)

    # place on the idle-sized canvas aligning the scaled PIG BODY to idle's body
    # centre-x + bottom. Marks above ride along and clip at the top if they
    # exceed the canvas — the pig itself stays idle-sized in every frame.
    canvas = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    x = round(target_cx - body_cx * s)
    y = round(target_bottom - body_bottom * s)
    canvas.alpha_composite(np, (x, y))
    # Shadow is already gone (clean_pig on the source, outline preserved). A light
    # antialias polishes the edge to match the other frames (safe: alpha is intact,
    # NOT binarized like the old deshadow path that wrecked the outline).
    # (thicken_lines is available but intentionally NOT applied — reverted per
    # user: the bolder outline looked worse.)
    canvas = antialias_edges(canvas)

    out = os.path.join(outdir, f"{out_id}.png")
    canvas.save(out)
    print(f"{out_id}: body {body_h}px -> x{s:.3f} -> idle body h={target_h} "
          f"({os.path.relpath(out, ROOT)})")


if __name__ == "__main__":
    main()

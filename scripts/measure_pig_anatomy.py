#!/usr/bin/env python3
"""
Measure the position of named anatomy points (head, eyes, snout, neck,
feet) in every animation frame of the Rosie sprite and emit values
that drop into PIG_FRAME_ANCHORS in constants/hats.ts.

Run after re-slicing sprite frames to sync anchor data with the new
art. Without this step, items on the pig drift out of place during
motion-heavy animations (jump apex, wave, etc.) because the per-frame
anchor data lags the actual sprite content.

Usage:
    python3 scripts/measure_pig_anatomy.py

Outputs:
    - Prints a TypeScript snippet ready to paste into PIG_FRAME_ANCHORS
    - Prints diagnostics per frame (drift from rest)
"""
import os
import sys
from PIL import Image
import numpy as np

ROSIE = "/Users/bbroeking/projects/oink/assets/images/sprites/rosie"
CARD = 300  # SwipeElement renders the pig into a 300×300 card via contain.

ANIMATIONS = {
    "idle": 4,
    "walk": 4,
    "jump": 4,
    "happy": 4,
    "sad": 4,
    "surprise": 4,
    "wave": 4,
    "arms_up": 4,
}


def load(anim: str, frame: int):
    """Returns (rgba np array, w, h, scale, margin_x, margin_y) — values
    needed to convert sprite-pixel coords to 300×300 card coords."""
    path = f"{ROSIE}/{anim}_{frame}.png"
    if not os.path.exists(path):
        return None
    im = Image.open(path).convert("RGBA")
    arr = np.array(im)
    h, w = arr.shape[:2]
    scale = CARD / max(w, h)
    margin_x = (CARD - w * scale) / 2
    margin_y = (CARD - h * scale) / 2
    return arr, w, h, scale, margin_x, margin_y


def to_card(px, py, scale, margin_x, margin_y):
    return round(px * scale + margin_x), round(py * scale + margin_y)


def measure(arr, w, h, scale, mx, my):
    """Returns a dict of {anchor_name: (x, y)} in card coords."""
    a = arr[:, :, 3]
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    opaque = a > 50

    # Silhouette extents
    rows = opaque.any(axis=1)
    cols = opaque.any(axis=0)
    if not rows.any() or not cols.any():
        return None
    y_top = int(np.where(rows)[0][0])
    y_bot = int(np.where(rows)[0][-1])

    # Head crown: ears stick up above the head, so the topmost row is
    # an ear tip. Walk down until the row is wide enough that we're
    # past the ear gap into the actual head silhouette. "Wide enough"
    # = at least 60% of the silhouette's max width at any point.
    max_w_so_far = 0
    head_y = y_top
    for y in range(y_top, min(y_top + h // 3, h)):
        row_xs = np.where(opaque[y])[0]
        if len(row_xs) == 0:
            continue
        row_w = row_xs.max() - row_xs.min()
        max_w_so_far = max(max_w_so_far, row_w)
        if max_w_so_far > 0 and row_w >= max_w_so_far * 0.85:
            # Found the head's "fat" row near the crown
            head_y = y
            break
    head_xs = np.where(opaque[head_y])[0]
    head_x = (head_xs.min() + head_xs.max()) / 2

    # Eye line: very dark pixels in the upper-mid horizontal band.
    eye_mask = opaque & (r < 60) & (g < 60) & (b < 60)
    y0, y1 = int(h * 0.30), int(h * 0.50)
    eye_mask[:y0] = False
    eye_mask[y1:] = False
    if eye_mask.any():
        ys, xs = np.where(eye_mask)
        eyes_x = xs.mean()
        eyes_y = ys.mean()
    else:
        # Fallback to estimated eye line
        eyes_x = head_x
        eyes_y = y_top + (y_bot - y_top) * 0.4

    # Snout: pink saturated pixels in mid-band
    sn_mask = opaque & (r > 220) & (r <= 255) & (g > 130) & (g < 190) & (b > 140) & (b < 200)
    yy0, yy1 = int(h * 0.45), int(h * 0.70)
    sn_mask[:yy0] = False
    sn_mask[yy1:] = False
    if sn_mask.any():
        ys, xs = np.where(sn_mask)
        snout_x = xs.mean()
        snout_y = ys.mean()
    else:
        snout_x = head_x
        snout_y = (eyes_y + y_bot) / 2

    # Neck: estimated as 70% of the way from eyes to feet
    neck_x = head_x
    neck_y = eyes_y + (y_bot - eyes_y) * 0.65

    # Body center
    body_x = head_x
    body_y = (eyes_y + y_bot) / 2

    # Feet: bottom of silhouette, x at silhouette horizontal center
    feet_xs = np.where(opaque[y_bot])[0]
    feet_x = (feet_xs.min() + feet_xs.max()) / 2 if len(feet_xs) else head_x
    feet_y = y_bot

    # Hand_l / hand_r: rough estimates at body width edges, neck height
    bbox_left = int(np.where(cols)[0][0])
    bbox_right = int(np.where(cols)[0][-1])
    pig_width = bbox_right - bbox_left
    hand_l_x = bbox_left + pig_width * 0.25
    hand_r_x = bbox_left + pig_width * 0.75
    hand_y = neck_y

    return {
        "head": to_card(head_x, head_y, scale, mx, my),
        "eyes": to_card(eyes_x, eyes_y, scale, mx, my),
        "snout": to_card(snout_x, snout_y, scale, mx, my),
        "mouth": to_card(snout_x, snout_y + (h * 0.08), scale, mx, my),
        "neck": to_card(neck_x, neck_y, scale, mx, my),
        "body": to_card(body_x, body_y, scale, mx, my),
        "hand_l": to_card(hand_l_x, hand_y, scale, mx, my),
        "hand_r": to_card(hand_r_x, hand_y, scale, mx, my),
        "feet": to_card(feet_x, feet_y, scale, mx, my),
    }


def fmt_anchor(p):
    return f"{{ x: {p[0]}, y: {p[1]} }}"


def main():
    print("// === Auto-measured anatomy points per animation frame ===")
    print("// Generated by scripts/measure_pig_anatomy.py")
    print("// Drop into constants/hats.ts → PIG_FRAME_ANCHORS")
    print()

    # Compute idle frame 0 first — that's REST_ANCHORS.
    idle1 = load("idle", 1)
    if idle1 is None:
        print("ERROR: idle_1.png not found", file=sys.stderr)
        return
    rest = measure(*idle1)

    print("// Suggested REST_ANCHORS (from idle_1):")
    for k, v in rest.items():
        print(f"//   {k:8} : {fmt_anchor(v)}")
    print()

    print("// Per-frame deltas from rest (only points that drift > 1px shown):")
    for anim, n_frames in ANIMATIONS.items():
        out_lines = []
        for f in range(1, n_frames + 1):
            data = load(anim, f)
            if data is None:
                continue
            anchors = measure(*data)
            if anchors is None:
                continue
            shifted = {
                k: v
                for k, v in anchors.items()
                if abs(v[0] - rest[k][0]) > 1 or abs(v[1] - rest[k][1]) > 1
            }
            if not shifted:
                out_lines.append("\t\t{},")
            else:
                parts = ", ".join(
                    f"{k}: {fmt_anchor(v)}" for k, v in shifted.items()
                )
                out_lines.append(f"\t\t{{ {parts} }},")
        print(f"\t{anim}: [")
        for line in out_lines:
            print(line)
        print("\t],")


if __name__ == "__main__":
    main()

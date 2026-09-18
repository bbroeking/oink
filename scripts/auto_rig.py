#!/usr/bin/env python3
"""Auto-rigger for the Rosie sprite — a CANDIDATE rig, never a write to hats.ts.

Detects the eleven anatomy anchors on every frame of every animation family
(idle's twelve included, and the three-quarter `face` / `face_sit` turn) and
writes them to docs/rig-candidate.json. The Placement Studio (Pig anatomy mode)
draws that candidate next to the hand-tuned rig and lets you accept it per
anchor, per frame, per animation or wholesale — the file on its own changes
nothing in the app.

    .venv-tools/bin/python scripts/auto_rig.py            # every family
    .venv-tools/bin/python scripts/auto_rig.py idle face  # just these
    .venv-tools/bin/python scripts/auto_rig.py --sheet    # + compare PNG

Coordinates are CARD space (300×300, y from the top): the sprite is fitted
into the card the way React Native's resizeMode=contain does it.

How each anchor is found (all in sprite pixels, then converted):
  eye_l / eye_r  the two largest BLOBS of near-black after an erosion that
                 kills the outline strokes (eyes are ~30 px discs with a white
                 highlight; the outline is 3–5 px). A closed eye is a thin arc
                 and dies with the outline — then the eyes are carried from the
                 nearest frame of the same family that had them, shifted by the
                 snout's move ("prior").
  snout          the largest blob of the deeper snout pink (the blush discs are
                 the same hue but smaller).
  mouth          the largest dark blob in a window below the snout; a closed
                 mouth is a thin stroke and falls back to a fixed drop below
                 the snout ("derived").
  head           the crown: the dip of the top silhouette between the two ear
                 tips (the ears are the two highest peaks of the top profile).
  hooves         blobs of hoof brown in the lower half, sorted left→right and
                 matched to leg_l / leg_r / hand_l / hand_r by nearest-x to the
                 hand-tuned rig's frame (the prior); a hoof the pose hides keeps
                 the prior.
  neck / body    derived: on the line from the eye midpoint down to the hooves.

Confidence per anchor is written alongside: "detected", "derived", "prior".
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys

import numpy as np
from PIL import Image, ImageDraw

try:
    from scipy import ndimage
except ImportError:  # pragma: no cover
    raise SystemExit("scipy is required — run with .venv-tools/bin/python")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SPRITE_DIR = os.path.join(ROOT, "assets", "images", "sprites", "rosie")
HATS_TS = os.path.join(ROOT, "constants", "hats.ts")
TYPES_TS = os.path.join(ROOT, "constants", "hat_overlay_types.ts")
OUT_JSON = os.path.join(ROOT, "docs", "rig-candidate.json")
SHEET_DIR = os.path.join(ROOT, "docs", "reviews", "auto-rig-2026-09-17")
CARD = 300
ANCHORS = ["head", "eye_l", "eye_r", "snout", "mouth", "neck", "body",
           "hand_l", "hand_r", "leg_l", "leg_r"]
HOOVES = ["leg_l", "leg_r", "hand_l", "hand_r"]
TURNED = {"face", "face_sit"}


# ── Source of truth for the family list + the hand-tuned prior ───────────
def parse_anims() -> list[str]:
    src = open(TYPES_TS).read()
    m = re.search(r'export type PigAnimationKey\s*=(.*?"\s*;)', src, re.S)
    names = re.findall(r'\|\s*"(\w+)"', m.group(1)) if m else []
    return names or ["idle", "walk", "jump", "happy", "sad", "tired",
                     "surprise", "wave", "face", "face_sit"]


ANCHOR_RE = re.compile(r'(\w+):\s*\{\s*x:\s*(-?[\d.]+),\s*y:\s*(-?[\d.]+)\s*\}')


def parse_current_rig() -> dict[str, list[dict]]:
    """PIG_FRAME_ANCHORS from hats.ts — the hand-tuned rig, used as the prior."""
    src = open(HATS_TS).read()
    block = re.search(r"ANCHOR_EDITOR_START(.*?)ANCHOR_EDITOR_END", src, re.S)
    out: dict[str, list[dict]] = {}
    if not block:
        return out
    for am in re.finditer(r"(\w+):\s*\[(.*?)\],\n", block.group(1), re.S):
        frames = []
        for fr in re.finditer(r"\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}", am.group(2)):
            f = {}
            for a in ANCHOR_RE.finditer(fr.group(1)):
                f[a.group(1)] = (float(a.group(2)), float(a.group(3)))
            if f:
                frames.append(f)
        if frames:
            out[am.group(1)] = frames
    return out


def sprite_frames(anim: str) -> list[str]:
    n = 0
    while os.path.isfile(os.path.join(SPRITE_DIR, f"{anim}_{n + 1}.png")):
        n += 1
    return [os.path.join(SPRITE_DIR, f"{anim}_{i + 1}.png") for i in range(n)]


# ── Card conversion (resizeMode=contain) ─────────────────────────────────
def contain(sw: int, sh: int):
    s = min(CARD / sw, CARD / sh)
    return s, (CARD - sw * s) / 2, (CARD - sh * s) / 2


def to_card(yx, shape):
    sh, sw = shape[:2]
    s, ox, oy = contain(sw, sh)
    return {"x": round(ox + yx[1] * s), "y": round(oy + yx[0] * s)}


def to_px(card_xy, shape):
    sh, sw = shape[:2]
    s, ox, oy = contain(sw, sh)
    return ((card_xy[1] - oy) / s, (card_xy[0] - ox) / s)  # (y, x)


# ── Pixel masks ──────────────────────────────────────────────────────────
def load(path):
    return np.array(Image.open(path).convert("RGBA")).astype(np.int16)


def masks(arr):
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    opaque = a > 128
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    black = opaque & (lum < 48)                         # eyes, pupils, outline
    dark = opaque & (lum < 90)                          # + mouth interior
    hoof = opaque & (r >= 55) & (r <= 150) & (g <= 95) & (b <= 95) & (r > g + 18)
    snout = opaque & (r > 215) & (g >= 120) & (g <= 178) & (b >= 135) & (b <= 195) & (r - g > 50)
    return opaque, black, dark, hoof, snout


def blobs(mask, min_area=1, erode=0):
    """(cy, cx, area, (y0,y1,x0,x1)) for every component, largest first."""
    m = ndimage.binary_erosion(mask, iterations=erode) if erode else mask
    lab, n = ndimage.label(m)
    if n == 0:
        return []
    idx = np.arange(1, n + 1)
    areas = ndimage.sum(m, lab, idx)
    coms = ndimage.center_of_mass(m, lab, idx)
    sl = ndimage.find_objects(lab)
    out = []
    for i, (area, com) in enumerate(zip(areas, coms)):
        if area >= min_area:
            s = sl[i]
            out.append((com[0], com[1], float(area),
                        (s[0].start, s[0].stop, s[1].start, s[1].stop)))
    out.sort(key=lambda t: -t[2])
    return out


def bbox(mask):
    ys, xs = np.where(mask)
    return (ys.min(), ys.max(), xs.min(), xs.max()) if len(ys) else None


# ── Detectors ────────────────────────────────────────────────────────────
def detect_snout(sn_mask, opaque, eyes=None):
    bb = bbox(opaque)
    cands = blobs(sn_mask, min_area=150, erode=1)
    if not cands or bb is None:
        return None
    # The snout is the biggest deep-pink blob BELOW the eye line — the inner
    # ears are the same pink and, on the turn, the near ear is bigger than the
    # snout. Blush discs are smaller and lower. Ignore the bottom third.
    top_limit = bb[0] + 0.7 * (bb[1] - bb[0])
    eye_y = max(eyes[0][0], eyes[1][0]) - 5 if eyes else bb[0] + 0.2 * (bb[1] - bb[0])
    # Between the eyes (a blush disc sits OUTSIDE them); on the turn the snout
    # leads the near eye, so allow half a spread past it on either side.
    if eyes:
        spread = max(20.0, eyes[1][1] - eyes[0][1])
        x_lo, x_hi = eyes[0][1] - 0.5 * spread, eyes[1][1] + 0.6 * spread
    else:
        x_lo, x_hi = bb[2], bb[3]
    ok = [c for c in cands if eye_y < c[0] < top_limit and x_lo <= c[1] <= x_hi]
    if not ok:
        return None
    # Among the sizable blobs, the snout is the one nearest the midline of
    # the eyes (a blush disc can be bigger when the head is bowed).
    biggest = ok[0][2]
    ok = [c for c in ok if c[2] >= 0.35 * biggest]
    mid = (eyes[0][1] + eyes[1][1]) / 2 + (0.25 * spread if eyes else 0) if eyes else (bb[2] + bb[3]) / 2
    cy, cx, _, _ = min(ok, key=lambda c: abs(c[1] - mid))
    return (cy, cx)


def detect_eyes(black, opaque, snout_yx, turned: bool):
    bb = bbox(opaque)
    if bb is None:
        return None
    h = bb[1] - bb[0]
    band_lo = bb[0]
    band_hi = (snout_yx[0] + 25) if snout_yx else bb[0] + 0.6 * h
    # Erode the outline away; the far eye on the turn is small, so erode less.
    cands = blobs(black, min_area=60, erode=2 if turned else 3)
    cands = [c for c in cands if band_lo <= c[0] <= band_hi]
    if snout_yx:
        # Not the snout's nostrils / mouth: eyes sit above the snout centre.
        cands = [c for c in cands if c[0] < snout_yx[0] + 8]
    if len(cands) < 2:
        return None
    best, best_score = None, 1e9
    for i in range(len(cands)):
        for j in range(i + 1, len(cands)):
            a, b = cands[i], cands[j]
            dy, dx = abs(a[0] - b[0]), abs(a[1] - b[1])
            if dx < 35 or dy > 45:
                continue
            # Two eyes: a similar height, a plausible spread, both sizable.
            score = dy * 1.5 + abs(dx - (75 if turned else 120)) * 0.6
            score -= min(a[2], b[2]) ** 0.5 * 0.5
            if score < best_score:
                best, best_score = (a, b), score
    if not best:
        return None
    a, b = sorted(best, key=lambda c: c[1])
    return (a[0], a[1]), (b[0], b[1])


def detect_mouth(dark, snout_yx, opaque):
    if snout_yx is None:
        return None
    sy, sx = snout_yx
    win = np.zeros_like(dark)
    y0, y1 = int(sy + 12), int(sy + 58)
    x0, x1 = int(sx - 60), int(sx + 60)
    win[max(y0, 0):y1, max(x0, 0):x1] = True
    cands = blobs(dark & win, min_area=40, erode=1)
    # An open mouth is a squat dark blob right under the snout; the chin
    # outline is a long thin stroke. Take the squat blob nearest the snout.
    best, best_d = None, 1e9
    for cy, cx, area, (by0, by1, bx0, bx1) in cands:
        w, hgt = bx1 - bx0, by1 - by0
        if w > 95 or hgt > 60 or area < 60 or w > 4.5 * max(hgt, 1):
            continue
        d = abs(cx - sx) + 0.5 * (cy - sy)
        if d < best_d:
            best, best_d = (cy, cx), d
    return best


def detect_crown(opaque):
    """Dip of the top silhouette between the two ear peaks."""
    h, w = opaque.shape
    cols = np.where(opaque.any(axis=0))[0]
    if len(cols) < 20:
        return None
    top = np.full(w, h, dtype=float)
    for x in cols:
        top[x] = np.argmax(opaque[:, x])
    x0, x1 = cols.min(), cols.max()
    prof = top[x0:x1 + 1]
    # Smooth a little so anti-aliased ear tips don't split into two peaks.
    k = 7
    sm = np.convolve(np.pad(prof, k // 2, mode="edge"), np.ones(k) / k, mode="valid")
    # Peaks = local minima of y (highest points). Take the two most prominent
    # that are at least 60 px apart.
    order = np.argsort(sm)
    peaks = []
    for i in order:
        if all(abs(i - p) > 60 for p in peaks):
            peaks.append(int(i))
        if len(peaks) == 2:
            break
    if len(peaks) < 2:
        return None
    a, b = sorted(peaks)
    seg = sm[a:b + 1]
    if len(seg) < 10:
        return None
    dip = seg.max()
    # The crown is the middle of the valley floor (within 6 px of the dip).
    # A tilted head (tired) has its valley floor hugging one ear — the skull
    # top is then the midpoint between the ears, not the floor.
    floor = np.where(seg >= dip - 6)[0]
    n = len(seg)
    if floor.min() <= 0.12 * n or floor.max() >= 0.88 * n:
        cx_local = n / 2
    else:
        cx_local = (floor.min() + floor.max()) / 2
    cy = sm[a + int(cx_local)]
    return (cy, x0 + a + cx_local)


def detect_hooves(hoof, opaque, snout_yx=None):
    bb = bbox(opaque)
    if bb is None:
        return []
    h = bb[1] - bb[0]
    cands = blobs(hoof, min_area=120, erode=1)
    cands = [c for c in cands if c[0] > bb[0] + 0.45 * h]
    if snout_yx:
        # The inside of an open mouth is the same dark red as a hoof: drop
        # anything in the mouth window under the snout (a raised hoof on the
        # wave is far to the side and survives).
        sy, sx = snout_yx
        cands = [c for c in cands if not (abs(c[1] - sx) < 60 and sy < c[0] < sy + 80)]
    # Hooves are the dark-brown caps; keep the up-to-5 largest, left→right.
    cands = sorted(cands[:5], key=lambda c: c[1])
    return [(c[0], c[1], c[2]) for c in cands]


# ── Assembly ─────────────────────────────────────────────────────────────
def rig_frame(path, prior: dict | None, turned: bool, carry: dict | None):
    """prior: the hand-tuned frame (card space) used to name hooves and fill
    what the pose hides. carry: the last frame of this family with detected
    eyes, for closed-eye frames."""
    arr = load(path)
    shape = arr.shape
    opaque, black, dark, hoof, sn = masks(arr)
    out, conf = {}, {}

    # Eyes first (from the upper band alone), then the snout below them, then
    # the eyes again with the snout as a ceiling — the pair that survives both
    # passes is the one we keep.
    eyes = detect_eyes(black, opaque, None, turned)
    snout = detect_snout(sn, opaque, eyes)
    if snout:
        out["snout"] = to_card(snout, shape); conf["snout"] = "detected"
        eyes = detect_eyes(black, opaque, snout, turned) or eyes
    if eyes:
        out["eye_l"] = to_card(eyes[0], shape); out["eye_r"] = to_card(eyes[1], shape)
        conf["eye_l"] = conf["eye_r"] = "detected"
    elif carry and "eye_l" in carry and snout and "snout" in carry:
        # Closed eyes: carry the last open pair, moved with the snout.
        dx = out["snout"]["x"] - carry["snout"]["x"]
        dy = out["snout"]["y"] - carry["snout"]["y"]
        for k in ("eye_l", "eye_r"):
            out[k] = {"x": carry[k]["x"] + dx, "y": carry[k]["y"] + dy}
            conf[k] = "prior"

    mouth = detect_mouth(dark, snout, opaque)
    if mouth:
        out["mouth"] = to_card(mouth, shape); conf["mouth"] = "detected"
    elif "snout" in out:
        out["mouth"] = {"x": out["snout"]["x"] - (12 if turned else 0),
                        "y": out["snout"]["y"] + 30}
        conf["mouth"] = "derived"

    crown = detect_crown(opaque)
    if crown:
        out["head"] = to_card(crown, shape); conf["head"] = "detected"

    # Hooves → names by nearest x to the prior's hooves.
    found = detect_hooves(hoof, opaque, snout)
    found_card = [to_card((y, x), shape) for y, x, _ in found]
    if prior and all(k in prior for k in HOOVES):
        taken = set()
        # Greedy: closest (hoof, name) pairs first.
        pairs = sorted(((abs(fc["x"] - prior[k][0]) + 0.5 * abs(fc["y"] - prior[k][1]), i, k)
                        for i, fc in enumerate(found_card) for k in HOOVES))
        used_names = set()
        for d, i, k in pairs:
            if i in taken or k in used_names or d > 90:
                continue
            out[k] = found_card[i]; conf[k] = "detected"
            taken.add(i); used_names.add(k)
        for k in HOOVES:
            if k not in out:
                out[k] = {"x": prior[k][0], "y": prior[k][1]}; conf[k] = "prior"
    else:
        # No prior: assign left→right when we have four, else leave unset.
        if len(found_card) == 4:
            for k, fc in zip(HOOVES, found_card):
                out[k] = fc; conf[k] = "detected"

    # Neck / body: derived from the eye midpoint, the snout and the hoof line.
    bb = bbox(opaque)
    if bb is not None and "snout" in out:
        centre_x = to_card((0, (bb[2] + bb[3]) / 2), shape)["x"]
        hoof_y = (np.mean([out[k]["y"] for k in HOOVES if k in out])
                  if any(k in out for k in HOOVES) else to_card((bb[1], 0), shape)["y"])
        eyes_x = ((out["eye_l"]["x"] + out["eye_r"]["x"]) / 2
                  if "eye_l" in out and "eye_r" in out else out["snout"]["x"])
        sy = out["snout"]["y"]
        out["neck"] = {"x": round((eyes_x + centre_x) / 2), "y": round(sy + 0.55 * (hoof_y - sy))}
        out["body"] = {"x": round(centre_x), "y": round(sy + 0.78 * (hoof_y - sy))}
        conf["neck"] = conf["body"] = "derived"

    # Anything still missing takes the prior so every frame is complete.
    for k in ANCHORS:
        if k not in out:
            if prior and k in prior:
                out[k] = {"x": prior[k][0], "y": prior[k][1]}; conf[k] = "prior"
            else:
                out[k] = {"x": 150, "y": 150}; conf[k] = "prior"
    for k in out:
        out[k] = {"x": int(round(out[k]["x"])), "y": int(round(out[k]["y"]))}
    return {k: out[k] for k in ANCHORS}, {k: conf[k] for k in ANCHORS}


def rig_family(anim: str, current: dict[str, list[dict]]):
    frames, confs = [], []
    prior_frames = current.get(anim) or []
    carry = None
    for i, path in enumerate(sprite_frames(anim)):
        prior = prior_frames[min(i, len(prior_frames) - 1)] if prior_frames else None
        fr, cf = rig_frame(path, prior, anim in TURNED, carry)
        if cf.get("eye_l") == "detected":
            carry = fr
        frames.append(fr); confs.append(cf)
    # A closed-eye frame BEFORE the first open one (e.g. tired_1) takes the
    # first open pair, moved with the snout.
    first_open = next((f for f, c in zip(frames, confs) if c["eye_l"] == "detected"), None)
    if first_open:
        for fr, cf in zip(frames, confs):
            if cf["eye_l"] == "detected":
                break
            if cf["eye_l"] == "prior" and "snout" in fr:
                dx = fr["snout"]["x"] - first_open["snout"]["x"]
                dy = fr["snout"]["y"] - first_open["snout"]["y"]
                for k in ("eye_l", "eye_r"):
                    fr[k] = {"x": first_open[k]["x"] + dx, "y": first_open[k]["y"] + dy}
    return frames, confs


# ── Compare sheet ────────────────────────────────────────────────────────
def compare_sheet(candidate, current, anims, path, per_row=4):
    """One row per family, wrapped every `per_row` frames (idle is twelve)."""
    cell = 200
    slots = []  # (row, col, anim, frame index)
    row = 0
    for a in anims:
        n = len(candidate["frames"][a])
        for i in range(n):
            slots.append((row + i // per_row, i % per_row, a, i))
        row += -(-n // per_row)
    sheet = Image.new("RGBA", (per_row * cell, row * cell + 18), (253, 246, 236, 255))
    dr = ImageDraw.Draw(sheet)
    for r, cidx, a, i in slots:
        cur = current.get(a) or []
        fr = candidate["frames"][a][i]
        if True:
            im = Image.open(os.path.join(SPRITE_DIR, f"{a}_{i + 1}.png")).convert("RGBA")
            s, ox, oy = contain(im.width, im.height)
            card = Image.new("RGBA", (CARD, CARD), (0, 0, 0, 0))
            card.alpha_composite(im.resize((round(im.width * s), round(im.height * s))),
                                 (round(ox), round(oy)))
            cd = ImageDraw.Draw(card)
            pri = cur[min(i, len(cur) - 1)] if cur else {}
            for k, v in fr.items():
                if k in pri:
                    px, py = pri[k]
                    cd.line([px, py, v["x"], v["y"]], fill=(200, 120, 40, 200), width=1)
                    cd.ellipse([px - 3, py - 3, px + 3, py + 3], fill=(63, 157, 99, 255))
                c = candidate["confidence"][a][i][k]
                col = (230, 120, 20, 255) if c == "detected" else (150, 110, 200, 255) if c == "derived" else (160, 160, 160, 255)
                cd.ellipse([v["x"] - 3, v["y"] - 3, v["x"] + 3, v["y"] + 3], fill=col, outline=(255, 255, 255, 255))
            sheet.alpha_composite(card.resize((cell, cell)), (cidx * cell, r * cell))
            dr.text((cidx * cell + 4, r * cell + 3), f"{a}_{i + 1}", fill=(60, 40, 30, 255))
    dr.text((6, row * cell + 3), "green = current rig · orange = auto (detected) · purple = derived · grey = prior",
            fill=(60, 40, 30, 255))
    sheet.save(path)
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("anims", nargs="*", help="families to rig (default: all)")
    ap.add_argument("--sheet", action="store_true", help="also write the compare PNG")
    ap.add_argument("--out", default=OUT_JSON)
    args = ap.parse_args()
    all_anims = parse_anims()
    anims = args.anims or all_anims
    bad = [a for a in anims if a not in all_anims]
    if bad:
        raise SystemExit(f"unknown families: {bad} (known: {all_anims})")
    current = parse_current_rig()
    # Keep the other families' previous candidate when rigging a subset.
    prev = {}
    if args.anims and os.path.isfile(args.out):
        try:
            prev = json.load(open(args.out))
        except json.JSONDecodeError:
            prev = {}
    cand = {"generatedAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source": "scripts/auto_rig.py", "pig": "rosie",
            "frames": dict(prev.get("frames", {})), "confidence": dict(prev.get("confidence", {}))}
    for a in anims:
        frames, confs = rig_family(a, current)
        cand["frames"][a] = frames
        cand["confidence"][a] = confs
        tally = {}
        for cf in confs:
            for v in cf.values():
                tally[v] = tally.get(v, 0) + 1
        print(f"{a:9s} {len(frames):2d} frames  " + "  ".join(f"{k} {v}" for k, v in sorted(tally.items())))
    cand["frames"] = {a: cand["frames"][a] for a in all_anims if a in cand["frames"]}
    cand["confidence"] = {a: cand["confidence"][a] for a in all_anims if a in cand["confidence"]}
    with open(args.out, "w") as f:
        json.dump(cand, f, indent=1)
    print("wrote", os.path.relpath(args.out, ROOT))
    if args.sheet:
        os.makedirs(SHEET_DIR, exist_ok=True)
        have = [a for a in all_anims if a in cand["frames"]]
        for name, subset, per_row in (("compare-idle.png", [a for a in have if a == "idle"], 6),
                                      ("compare-families.png", [a for a in have if a != "idle"], 4)):
            if subset:
                p = compare_sheet(cand, current, subset, os.path.join(SHEET_DIR, name), per_row)
                print("wrote", os.path.relpath(p, ROOT))


if __name__ == "__main__":
    main()

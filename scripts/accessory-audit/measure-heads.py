#!/usr/bin/env python3
"""Measure hat-contact landmarks for every shipped pig animation frame.

The measurement deliberately ignores ear tips and facial expression details.
It uses the opaque head silhouette near an expression-independent, pose-local
guide point, then fits a short line to the skull/forehead contour.  The guide
table is explicit because side-facing, crouched, and airborne poses do not
share one geometric relationship between the canvas and the head.

Outputs `constants/pigAttachmentFrames.generated.ts` and diagnostic contact
sheets under `docs/reviews/accessory-attachment-2026-10-14/landmarks/`.
Coordinates use the same 300 x 300 contain stage as PigStage.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SPRITES = ROOT / "assets/images/sprites"
OUT_TS = ROOT / "constants/pigAttachmentFrames.generated.ts"
OUT_DIR = ROOT / "docs/reviews/accessory-attachment-2026-10-14/landmarks"
PIGS = ("rosie", "copper", "pepper", "bandit", "pickles", "biscuit")
FRAMES = (
    *(f"idle_{i}" for i in range(1, 13)),
    *(f"{anim}_{i}" for anim in ("walk", "jump", "happy", "sad", "tired", "surprise", "wave", "face", "face_sit") for i in range(1, 5)),
)
CARD = 300.0

# Crown contact guides in stage coordinates.  These are pose anatomy guides,
# not output values: local silhouette fitting supplies pig/frame variation.
# The first entry preserves the established Rosie idle_1 contact (154, 16).
GUIDES = {
    "idle": (154, 17, 0), "walk": (158, 18, 0), "happy": (157, 17, 0),
    "surprise": (154, 20, 0), "wave": (151, 27, -2),
    "sad": (158, 18, 0), "tired": (161, 42, -2),
    "face": (193, 28, -10), "face_sit": (194, 40, -10),
}
GUIDES.update({
    "jump_1": (160, 125, 2), "jump_2": (159, 21, 0),
    "jump_3": (160, 69, 2), "jump_4": (162, 121, 0),
})

# Pose progression offsets from the family guide. They track whole-head motion
# visible within a family while leaving the contour fitter to capture each pig.
FRAME_OFFSETS = {
    "idle": [(0,-1),(1,2),(2,2),(2,2),(3,2),(5,3),(-2,3),(-1,5),(0,0),(0,-2),(1,0),(1,0)],
    "walk": [(0,-1),(-1,3),(1,-1),(-1,6)],
    "happy": [(0,-1),(0,-1),(-1,-1),(1,-1)],
    "sad": [(0,0),(0,0),(2,3),(1,4)],
    "tired": [(0,0),(9,0),(7,36),(-2,48)],
    "surprise": [(0,3),(-3,1),(-6,-2),(-3,-7)],
    "wave": [(0,0),(-6,0),(1,-1),(-5,0)],
    "face": [(0,0),(0,-1),(-2,0),(-1,0)],
    "face_sit": [(0,0),(1,-1),(-1,0),(0,-1)],
}


def family(frame: str) -> str:
    return frame.rsplit("_", 1)[0]


def stage_geometry(image: Image.Image) -> tuple[float, float, float]:
    scale = CARD / max(image.size)
    return scale, (CARD - image.width * scale) / 2, (CARD - image.height * scale) / 2


def to_source(x: float, y: float, image: Image.Image) -> tuple[float, float]:
    scale, mx, my = stage_geometry(image)
    return (x - mx) / scale, (y - my) / scale


def to_stage(x: float, y: float, image: Image.Image) -> tuple[float, float]:
    scale, mx, my = stage_geometry(image)
    return x * scale + mx, y * scale + my


def guide_for(frame: str) -> tuple[float, float, float]:
    if frame in GUIDES:
        return GUIDES[frame]
    fam, index = frame.rsplit("_", 1)
    x, y, angle = GUIDES[fam]
    dx, dy = FRAME_OFFSETS[fam][int(index) - 1]
    return x + dx, y + dy, angle


def opaque_runs(row: np.ndarray, bridge_gap: int = 10) -> list[tuple[int, int]]:
    """Inclusive silhouette runs, bridging tiny internal alpha-art gaps."""
    xs = np.where(row)[0]
    if not len(xs):
        return []
    # Eye highlights/line-art can contain a few transparent pixels even though
    # the enclosing skull is one silhouette. Bridge those; a separate hoof or
    # effect remains much farther away.
    cuts = np.where(np.diff(xs) > bridge_gap + 1)[0]
    starts = np.r_[0, cuts + 1]
    ends = np.r_[cuts, len(xs) - 1]
    return [(int(xs[a]), int(xs[b])) for a, b in zip(starts, ends)]


def measure(path: Path, frame: str) -> dict[str, float | str]:
    image = Image.open(path).convert("RGBA")
    alpha = np.asarray(image)[:, :, 3]
    opaque = alpha > 28
    gx, gy, guide_angle = guide_for(frame)
    sx, sy = to_source(gx, gy, image)
    scale, _, _ = stage_geometry(image)

    # Sample the FIRST opaque pixel in vertical columns around the head guide.
    # The guide only selects the relevant crown window; it is never itself
    # emitted as a measurement. Reject distant tops so ear tips, raised hooves,
    # and transparent expression effects cannot become the crown.
    radius = int(48 / scale)
    points = []
    for x in range(max(0, int(sx) - radius), min(image.width, int(sx) + radius + 1)):
        ys = np.where(opaque[:, x])[0]
        if not len(ys):
            continue
        y = float(ys[0])
        if abs(y - sy) < 27 / scale:
            points.append((x, y))

    # Robust local tangent: retain the central skull boundary and fit its first
    # opaque contour. The contact y is the contour median immediately around
    # crown x, not an interior pixel or the guide y.
    near = [(x, y) for x, y in points if abs(x - sx) < 42 / scale]
    if len(near) >= 8:
        xs = np.array([p[0] for p in near])
        ys = np.array([p[1] for p in near])
        # A crown is curved. Fit the curve and take its tangent at contact;
        # straight-line fitting across an asymmetric ear gap invents tilt.
        quad, linear, _ = np.polyfit(xs - sx, ys, 2)
        slope = linear
        angle = float(np.degrees(np.arctan(slope)))
        angle = max(-16.0, min(16.0, angle))
        contact = [y for x, y in near if abs(x - sx) <= 5 / scale]
        cy = float(np.median(contact)) if contact else float(np.median(ys))
        method = "contour"
    else:
        # Honest fallback: no stable local boundary was found. Keep it visible
        # in measurements.json so this frame can be manually reviewed.
        angle, cy = guide_angle, sy
        method = "guide-fallback"

    # Eye-line fit is deliberately avoided: blinking/tears change it. Use the
    # head contour angle where stable, pose guide otherwise.
    cx, cy = to_stage(sx, cy, image)

    # Sample the skull well below the ears (70 stage px below actual contact),
    # then take the complete contiguous opaque run containing head center.
    # This avoids the former ±105px cap, while separate hooves/effect marks on
    # the same row cannot inflate the width.
    contact_sy = (cy - stage_geometry(image)[2]) / scale
    candidates = []
    # Sad ears fold down into the 65–75px skull band, so those frames use a
    # documented deeper band after the ear ends. Other families use 65–75.
    width_offsets = (85, 90, 95) if family(frame) == "sad" else (65, 70, 75)
    for offset in width_offsets:
        wy = int(contact_sy + offset / scale)
        runs = opaque_runs(opaque[max(0, min(image.height - 1, wy))])
        containing = [r for r in runs if r[0] <= sx <= r[1]]
        if containing:
            candidates.append(max(containing, key=lambda pair: pair[1] - pair[0]))
        elif runs:
            candidates.append(min(runs, key=lambda pair: min(abs(pair[0] - sx), abs(pair[1] - sx))))
    # Use the narrowest valid band: a drooping ear may still join the skull on
    # one sampled row, whereas the actual head remains present in all three.
    run = min(candidates, key=lambda pair: pair[1] - pair[0]) if candidates else None
    if run and run[1] > run[0]:
        width = (run[1] - run[0]) * scale
        if family(frame) not in ("face", "face_sit"):
            silhouette_cx = (run[0] + run[1]) / 2
            measured_cx, _ = to_stage(silhouette_cx, contact_sy, image)
            cx += max(-12.0, min(12.0, measured_cx - cx))
    else:
        width = 170.0
    return {
        "x": round(cx, 1), "y": round(cy, 1), "rotation": round(float(angle), 1),
        "rawWidth": round(float(width), 2), "scale": width,
        "method": method,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    }


def ts(data: dict[str, dict[str, dict]]) -> str:
    lines = [
        "// Generated by scripts/accessory-audit/measure-heads.py. Do not hand edit.",
        "// 300x300 contain-stage coordinates; front scale is relative to Rosie idle_1.",
        "// Turned face/face_sit scales are relative to their Rosie family baseline.",
        "export type PigAttachmentFrame = Readonly<{ x: number; y: number; rotation: number; scale: number; rawWidth: number }>;",
        "export const PIG_ATTACHMENT_FRAMES = {",
    ]
    for pig in PIGS:
        lines.append(f"\t{pig}: {{")
        for frame in FRAMES:
            v = data[pig][frame]
            lines.append(f'\t\t"{frame}": {{ x: {v["x"]}, y: {v["y"]}, rotation: {v["rotation"]}, scale: {v["scale"]}, rawWidth: {v["rawWidth"]} }},')
        lines.append("\t},")
    lines.extend(["} as const satisfies Record<string, Record<string, PigAttachmentFrame>>;", ""])
    return "\n".join(lines)


def diagnostics(data: dict[str, dict[str, dict]]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    font = ImageFont.load_default()
    for pig in PIGS:
        sheet = Image.new("RGB", (4 * 230, 12 * 230), "#f4ead7")
        draw = ImageDraw.Draw(sheet)
        for n, frame in enumerate(FRAMES):
            image = Image.open(SPRITES / pig / f"{frame}.png").convert("RGBA")
            image.thumbnail((210, 190), Image.Resampling.LANCZOS)
            ox, oy = (n % 4) * 230 + 10, (n // 4) * 230 + 24
            sheet.paste(image, (ox + (210-image.width)//2, oy), image)
            v = data[pig][frame]
            px = ox + 5 + v["x"] / 300 * 200
            py = oy + v["y"] / 300 * 200
            draw.ellipse((px-4, py-4, px+4, py+4), fill="#00d5ff", outline="#10232c", width=2)
            length = 28
            rad = np.radians(v["rotation"])
            draw.line((px-length*np.cos(rad), py-length*np.sin(rad), px+length*np.cos(rad), py+length*np.sin(rad)), fill="#00d5ff", width=2)
            draw.text((ox, (n // 4) * 230 + 5), f"{frame}  ({v['x']},{v['y']}) {v['rotation']}° ×{v['scale']}", fill="#10232c", font=font)
        sheet.save(OUT_DIR / f"{pig}-head-landmarks.png", optimize=True)

    # Focused before/after proof for the known failures. Red is the current
    # Rosie-only anchor inherited by every pig; cyan is the measured contact.
    comparisons = [
        ("rosie", "sad_1", (118, 16)), ("rosie", "tired_1", (192, 40)),
        ("rosie", "jump_1", (128, 116)), ("copper", "idle_1", (154, 16)),
        ("pepper", "idle_1", (154, 16)), ("bandit", "face_1", (191, 21)),
        ("pickles", "face_1", (191, 21)), ("biscuit", "face_sit_1", (153, 31)),
    ]
    proof = Image.new("RGB", (4 * 300, 2 * 330), "#f4ead7")
    draw = ImageDraw.Draw(proof)
    for n, (pig, frame, old) in enumerate(comparisons):
        image = Image.open(SPRITES / pig / f"{frame}.png").convert("RGBA")
        image.thumbnail((280, 280), Image.Resampling.LANCZOS)
        ox, oy = (n % 4) * 300 + 10, (n // 4) * 330 + 34
        proof.paste(image, (ox + (280-image.width)//2, oy), image)
        value = data[pig][frame]
        for (x, y), color, radius in ((old, "#e83f5b", 7), ((value["x"], value["y"]), "#00d5ff", 5)):
            px, py = ox + x / 300 * 280, oy + y / 300 * 280
            draw.ellipse((px-radius, py-radius, px+radius, py+radius), fill=color, outline="#10232c", width=2)
        draw.text((ox, (n // 4) * 330 + 8), f"{pig} {frame}: current red {old}; measured cyan ({value['x']},{value['y']})", fill="#10232c", font=font)
    proof.save(OUT_DIR / "current-vs-measured.png", optimize=True)


def main() -> None:
    data = {pig: {frame: measure(SPRITES / pig / f"{frame}.png", frame) for frame in FRAMES} for pig in PIGS}
    front_reference = float(data["rosie"]["idle_1"]["rawWidth"])
    family_reference = {
        "face": float(data["rosie"]["face_1"]["rawWidth"]),
        "face_sit": float(data["rosie"]["face_sit_1"]["rawWidth"]),
    }
    for frames in data.values():
        for frame, value in frames.items():
            # Turned art has authored perspective and existing per-animation
            # tuning. Preserve that apparent baseline at scale=1, and express
            # only within-family/pig width changes. Front poses stay relative
            # to the established Rosie idle_1 skull width.
            reference = family_reference.get(family(frame), front_reference)
            value["scale"] = round(float(value["rawWidth"]) / reference, 3)
    # Authored hidden-anatomy calibration. In face_sit the far ear overlaps the
    # true crown, so the visible first-opaque contour is ear art rather than the
    # skull seat. Claude Design review + broad/rigid-cap contact sheets place the
    # shared seat between the ear roots here; retain measured family width.
    for frames in data.values():
        for index in range(1, 5):
            frames[f"face_sit_{index}"].update({
                "x": 178.0, "y": 40.0, "rotation": 6.0,
                "method": "authored-occluded-crown",
            })
    # Product invariant: the established fit for Rosie's first idle frame is
    # the coordinate basis for every existing hat's authored pivot.
    data["rosie"]["idle_1"].update({"x": 154.0, "y": 16.0, "rotation": 0.0, "scale": 1.0})
    OUT_TS.write_text(ts(data))
    diagnostics(data)
    (OUT_DIR / "measurements.json").write_text(json.dumps(data, indent=2) + "\n")
    print(f"measured {len(PIGS) * len(FRAMES)} frames; wrote {OUT_TS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

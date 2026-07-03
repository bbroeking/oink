#!/usr/bin/env python3
"""Normalize an animation's frames onto ONE uniform canvas so the pig renders at
a stable, idle-matched size across every frame — without clipping gestures that
extend past the body (a waving arm, an effect mark).

The single-frame scripts/process_pig_frame.py forces idle's exact canvas size,
which clips wide poses (wave) and lets per-frame content size wobble the pig.
This batch:
  • scales each frame so its PIG BODY height == idle's body height,
  • keeps the body CENTERED (x) + BOTTOM-aligned (y) so the body is rock-steady
    across frames and only the gesture moves,
  • sizes ONE canvas big enough for the widest/tallest gesture among the frames
    (never smaller than idle's canvas), so all frames share it and contain-fit
    to the same pig size,
  • reports the residual animScale (idle_render / this_render) — the small
    per-anim card-transform correction, replacing the big legacy hack.

Usage: normalize_anim_uniform.py <anim> <n_frames> <src_dir> <out_dir> [margin]
  e.g. normalize_anim_uniform.py wave 4 tmp/wave-gen/orig tmp/wave-gen/norm
"""
import os, sys
from PIL import Image
import importlib.util

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_spec = importlib.util.spec_from_file_location("pf", os.path.join(ROOT, "scripts/process_pig_frame.py"))
pf = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(pf)
IDLE = os.path.join(ROOT, "assets/images/sprites/rosie/idle_1.png")


def main():
    anim, n_frames = sys.argv[1], int(sys.argv[2])
    src_dir, out_dir = sys.argv[3], sys.argv[4]
    margin = int(sys.argv[5]) if len(sys.argv) > 5 else 6
    os.makedirs(out_dir, exist_ok=True)

    idle = Image.open(IDLE).convert("RGBA")
    IDLE_W, IDLE_H = idle.size
    it, ibot, il, ir = pf.pig_body_metrics(idle)
    target_h = ibot - it                       # idle pig-body height
    idle_render = target_h * 300 / max(IDLE_W, IDLE_H)
    idle_bottom_margin = IDLE_H - ibot         # gap below the body in idle

    # pass 1 — scale each frame to idle body height, measure body + content
    frames = []
    half_w = 0          # furthest content point from the (centered) body centre
    top_rise = 0        # furthest content point above the body bottom
    for n in range(1, n_frames + 1):
        im = Image.open(os.path.join(src_dir, f"{anim}_{n}.png")).convert("RGBA")
        if not (pf.alpha_bbox(im) and pf.alpha_bbox(im) != (0, 0, im.width, im.height)):
            im = pf.strip_white(im)
        im = pf.clean_pig(im)   # drop ground shadow/platter + bg, keep smooth outline
        bt, bb, bl, br = pf.pig_body_metrics(im)
        s = target_h / (bb - bt)
        sc = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
        body_cx = (bl + br) / 2 * s
        body_bottom = bb * s
        fb = pf.alpha_bbox(sc)                 # content bbox in the scaled frame
        half_w = max(half_w, body_cx - fb[0], fb[2] - body_cx)
        top_rise = max(top_rise, body_bottom - fb[1])
        frames.append((n, sc, body_cx, body_bottom))

    # one uniform canvas: wide enough for the widest gesture (body stays centred),
    # tall enough for the highest gesture, never smaller than idle's canvas.
    CW = max(IDLE_W, int(round(2 * half_w + 2 * margin)))
    CH = max(IDLE_H, int(round(top_rise + idle_bottom_margin + margin)))
    target_cx = CW / 2
    target_bottom = CH - idle_bottom_margin
    render = target_h * 300 / max(CW, CH)

    for n, sc, body_cx, body_bottom in frames:
        canvas = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
        x = round(target_cx - body_cx)
        y = round(target_bottom - body_bottom)
        canvas.alpha_composite(sc, (x, y))
        # shadow already removed at source (clean_pig); light AA polishes the edge.
        # (thicken_lines reverted per user — bolder outline looked worse.)
        canvas = pf.antialias_edges(canvas)
        canvas.save(os.path.join(out_dir, f"{anim}_{n}.png"))

    print(f"{anim}: uniform canvas {CW}x{CH}  pig-body renders {render:.0f}px "
          f"(idle {idle_render:.0f}px)")
    print(f"  -> set ANIM_SCALE.{anim} = {idle_render / render:.3f}  "
          f"(was the big legacy hack)")


if __name__ == "__main__":
    main()

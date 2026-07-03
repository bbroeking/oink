#!/usr/bin/env python3
"""Build the Great Hunger opening as a "walking slideshow" — the 7 storyboard
shots assembled into a ~30s Ken-Burns 9:16 video with on-screen text, in the
spirit of the GreatHungerIntroModal storybook. Replaces the Higgsfield
generation path for now (2026-07-03 founder call).

Inputs : assets/concepts/great-hungerer/storyboard/shot_0{1..7}_*.png (1080x1920)
Outputs: assets/concepts/great-hungerer/great_hunger_slideshow_v1.mp4
         assets/concepts/great-hungerer/great_hunger_slideshow_preview.gif

Re-runnable + parameterized:
    python3 scripts/build_walking_slideshow.py [--shot-dur 4.4] [--last-dur 7.0]
        [--fade 0.6] [--fps 30] [--music path.mp3] [--out out.mp4] [--no-gif]

NOTE: the Homebrew ffmpeg build ships WITHOUT drawtext (no freetype), so
captions are pre-rendered to transparent PNGs with Pillow (using the game's
real Caprasimo / Patrick Hand ttfs from node_modules) and composited with
`overlay` + alpha `fade` — both always available. The arc ENDS DOWN — shot 7
holds longest, the CTA fades in beneath the line.
"""

import argparse
import glob
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parent.parent
BOARD = REPO / "assets/concepts/great-hungerer/storyboard"
OUTDIR = REPO / "assets/concepts/great-hungerer"

# ── The 7 beats (docs/wiki/outputs/memos/great-hog-storyboard-v2-2026-07.md) ──
# (file, on-screen line, move, grade) — move: "in" push-in, "driftL"/"driftR"
# lateral drift, "inDeep" the final slow push. grade: (saturation, brightness).
SHOTS = [
    ("shot_01_valley_of_tickles.png", "Once, the valley glowed gold…", "in", None),
    ("shot_02_rosie_asleep.png", "…and no one loved them\nmore than Rosie.", "driftR", None),
    ("shot_03_hunger_arrives.png", "But then… the Great Hunger.", "in", None),
    ("shot_04_the_theft.png", "He ate every last tickle.", "driftL", None),
    ("shot_05_grey_dawn.png", "Morning came. The gold was gone.", "in", (0.75, 0.0)),
    ("shot_06_empty_valley.png", "The tickles were gone.\nEvery last one.", "driftR", (0.72, -0.02)),
    ("shot_07_hunger_begins.png", "The Great Hunger has begun.", "inDeep", (0.68, -0.03)),
]
CTA = "Help win them back."

W, H = 1080, 1920
OVER_W, OVER_H = 2160, 3840  # 2x oversample so zoompan stays smooth
INK = (26, 18, 8)  # warm ink for the scrim (WHIMSY.ink-ish)


def find_font(pattern: str, fallbacks: list[str]) -> str:
    hits = glob.glob(str(REPO / "node_modules" / "**" / pattern), recursive=True)
    if hits:
        return hits[0]
    for fb in fallbacks:
        if Path(fb).exists():
            return fb
    sys.exit(f"no font found for {pattern} (and no fallback present)")


def zoompan(move: str, frames: int, fps: int) -> str:
    n = max(frames - 1, 1)
    center = "x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2'"
    if move == "in":
        z = f"z='1+0.035*on/{n}'"
        pos = center
    elif move == "inDeep":
        z = f"z='1+0.05*on/{n}'"
        pos = center
    else:  # lateral drift at constant zoom
        z = "z='1.04'"
        span = "(iw-iw/zoom)"
        if move == "driftR":
            x = f"x='{span}*(0.25+0.5*on/{n})'"
        else:
            x = f"x='{span}*(0.75-0.5*on/{n})'"
        pos = f"{x}:y='(ih-ih/zoom)/2'"
    return f"zoompan={z}:{pos}:d={frames}:s={W}x{H}:fps={fps}"


def render_caption(path: Path, text: str, fontfile: str, size: int,
                   color: tuple, box_bottom: int, box_alpha: int) -> None:
    """Full-frame transparent PNG: centered (multi-line) text on a rounded warm
    scrim, drop shadow, text block's scrim bottom edge at `box_bottom`."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(fontfile, size)
    pad, radius, spacing = 26, 18, 12
    bbox = draw.multiline_textbbox((0, 0), text, font=font, spacing=spacing, align="center")
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    bw, bh = tw + pad * 2, th + pad * 2
    bx = (W - bw) // 2
    by = box_bottom - bh
    draw.rounded_rectangle([bx, by, bx + bw, by + bh], radius=radius, fill=(*INK, box_alpha))
    tx, ty = bx + pad - bbox[0], by + pad - bbox[1]
    draw.multiline_text((tx + 2, ty + 2), text, font=font, spacing=spacing,
                        align="center", fill=(0, 0, 0, 115))
    draw.multiline_text((tx, ty), text, font=font, spacing=spacing,
                        align="center", fill=(*color, 255))
    img.save(path)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--shot-dur", type=float, default=4.4)
    ap.add_argument("--last-dur", type=float, default=7.0)
    ap.add_argument("--fade", type=float, default=0.6)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--music", type=str, default=None, help="optional audio bed")
    ap.add_argument("--out", type=str, default=str(OUTDIR / "great_hunger_slideshow_v1.mp4"))
    ap.add_argument("--no-gif", action="store_true")
    args = ap.parse_args()

    caprasimo = find_font("Caprasimo_400Regular.ttf",
                          ["/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
                           "/System/Library/Fonts/Supplemental/Georgia.ttf"])
    patrick = find_font("PatrickHand_400Regular.ttf",
                        ["/System/Library/Fonts/Supplemental/Bradley Hand Bold.ttf"])

    durs = [args.shot_dur] * (len(SHOTS) - 1) + [args.last_dur]
    # xfade offsets: O_k = timeline start of the crossfade into shot k (k ≥ 1).
    offsets = []
    o = durs[0] - args.fade
    offsets.append(round(o, 3))
    for d in durs[1:-1]:
        o += d - args.fade
        offsets.append(round(o, 3))
    total = round(offsets[-1] + durs[-1], 3)

    tmp = Path(tempfile.mkdtemp(prefix="gh_slideshow_"))

    # ── Caption PNGs + their absolute time windows ────────────────────────
    starts = [0.0] + offsets  # visual start of each shot
    captions = []  # (png, ts, te)
    for k, (_f, text, _m, _g) in enumerate(SHOTS):
        png = tmp / f"line{k}.png"
        render_caption(png, text, caprasimo, 58, (255, 246, 230), H - 300, 82)
        ts = starts[k] + (0.45 if k == 0 else args.fade + 0.25)
        te = offsets[k] if k < len(offsets) else total - 0.4
        captions.append((png, round(ts, 2), round(te, 2)))
    cta_png = tmp / "cta.png"
    render_caption(cta_png, CTA, patrick, 54, (255, 216, 122), H - 170, 102)
    captions.append((cta_png, round(starts[-1] + args.fade + 2.4, 2), round(total - 0.25, 2)))

    # ── Filtergraph ───────────────────────────────────────────────────────
    filters = []
    for k, (fname, _text, move, grade) in enumerate(SHOTS):
        frames = round(durs[k] * args.fps)
        chain = (
            f"[{k}:v]scale={OVER_W}:{OVER_H}:force_original_aspect_ratio=increase,"
            f"crop={OVER_W}:{OVER_H},setsar=1,"
            f"{zoompan(move, frames, args.fps)}"
        )
        if grade:
            sat, bri = grade
            chain += f",eq=saturation={sat}:brightness={bri}"
        filters.append(chain + f"[v{k}]")

    prev = "v0"
    for k in range(1, len(SHOTS)):
        out = f"x{k}"
        filters.append(
            f"[{prev}][v{k}]xfade=transition=fade:duration={args.fade}:offset={offsets[k-1]}[{out}]"
        )
        prev = out

    # Caption inputs are looped full-length stills; alpha fades window them,
    # so no enable expressions are needed (and no drawtext dependency).
    for j, (_png, ts, te) in enumerate(captions):
        idx = len(SHOTS) + j
        filters.append(
            f"[{idx}:v]format=rgba,fps={args.fps},"
            f"fade=t=in:st={ts}:d=0.4:alpha=1,"
            f"fade=t=out:st={round(te - 0.4, 2)}:d=0.4:alpha=1[t{j}]"
        )
    for j in range(len(captions)):
        out = f"o{j}"
        filters.append(f"[{prev}][t{j}]overlay=0:0[{out}]")
        prev = out
    filters.append(f"[{prev}]format=yuv420p[vout]")

    cmd = ["ffmpeg", "-y"]
    for fname, *_ in SHOTS:
        cmd += ["-i", str(BOARD / fname)]
    for png, _ts, _te in captions:
        cmd += ["-loop", "1", "-framerate", str(args.fps), "-t", str(total), "-i", str(png)]
    if args.music:
        cmd += ["-i", args.music]
    cmd += ["-filter_complex", ";".join(filters), "-map", "[vout]"]
    if args.music:
        cmd += ["-map", f"{len(SHOTS) + len(captions)}:a", "-c:a", "aac", "-shortest"]
    cmd += ["-r", str(args.fps), "-c:v", "libx264", "-crf", "18", "-preset", "medium", args.out]

    print(f"→ rendering {total:.1f}s to {args.out}")
    subprocess.run(cmd, check=True, capture_output=True)

    if not args.no_gif:
        gif = str(OUTDIR / "great_hunger_slideshow_preview.gif")
        speed = total / (3.0 * len(SHOTS))  # ≈3s per shot in the preview
        vf = (f"setpts=PTS/{speed:.3f},fps=10,scale=480:-1:flags=lanczos,"
              "split[a][b];[a]palettegen[p];[b][p]paletteuse")
        subprocess.run(["ffmpeg", "-y", "-i", args.out, "-filter_complex", vf,
                        "-loop", "0", gif], check=True, capture_output=True)
        print(f"→ preview gif: {gif}")


if __name__ == "__main__":
    main()

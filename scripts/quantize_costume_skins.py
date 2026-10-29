#!/usr/bin/env python3
"""Quantize Halloween costume skin frames with pngquant, behind a quality floor.

Why this exists
  Costume skins are full-body pig frames (370x383 RGBA, ~170 KB each, 24 per
  costume). Rosie's own sprites stay full RGBA because palette quantization
  dithers her smooth shading (see optimize_assets.py, which skips sprites/rosie/).
  Costume skins are the same kind of art, but there are many more of them: six
  pigs x 11 costumes x 24 frames is ~280 MB of RGBA. The 2026-10-29 test
  (docs/design/halloween-2026/costume-skins/quantize-test.png) measured ~66-69%
  savings at 256 colours, with faint dither grain only visible when zoomed.

  The quality floor is the safety valve: pngquant scores each frame (Q 0-100)
  and exits 99 without writing when it cannot reach the floor. Such a frame is
  KEPT as the original, never forced down to 256 colours. That is the
  difference from optimize_assets.py, whose 256-colour fallback shrinks every
  image no matter what it costs.

  Above the floor the output does not depend on it: pngquant always aims for
  the max (100), so --quality=80-100 and 90-100 write byte-identical files
  whenever both pass. The floor only decides which frames are left alone.

When to run it
  ONLY at freeze, after the founder has looked at the contact sheet and
  accepted the look. Art agents own assets/images/sprites/costumes/** and are
  still regenerating frames; quantizing mid-iteration would bake palette loss
  into files they later edit or use as references. Originals stay recoverable
  from git.

Behaviour (mirrors optimize_assets.py)
  * Walks <root>/<slug>/*.png (Rosie frames) and <root>/<slug>/<pig>/*.png
    (per-pig frames).
  * Idempotent: a file already in palette mode ('P') is SKIPPED. pngquant will
    happily re-quantize a palette PNG smaller still, so without this every
    rerun would compound the loss. Only RGBA/RGB source art is quantized,
    exactly once.
  * A frame is replaced only when the result is smaller. The write goes to a
    temp file in the same directory, then os.replace(), so a crash never
    leaves a half-written frame.
  * pngquant exit 99 (quality floor not met) means keep the original.

Usage
  scripts/quantize_costume_skins.py [--quality-floor 90] [--dry-run]
      [--slug moonpuff --slug hollow-jack] [--pig rosie --pig biscuit]
      [--root DIR]

  --pig rosie selects the top-level <slug>/*.png frames.
  --dry-run runs pngquant into a system temp dir and reports what WOULD
  change. Nothing under --root is written.
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_COSTUMES = os.path.join(ROOT, "assets", "images", "sprites", "costumes")
ROSIE = "rosie"  # pseudo-pig name for the top-level <slug>/*.png frames
QUALITY_NOT_MET = 99  # pngquant exit code when --quality min can't be reached


def find_pngquant():
    exe = shutil.which("pngquant") or "/opt/homebrew/bin/pngquant"
    if not os.path.exists(exe):
        sys.exit("pngquant not found (brew install pngquant)")
    return exe


def iter_frames(root, slugs=None, pigs=None):
    """Yield (slug, pig, path) for <slug>/*.png and <slug>/<pig>/*.png."""
    for slug in sorted(os.listdir(root)):
        sdir = os.path.join(root, slug)
        if not os.path.isdir(sdir) or slug.startswith((".", "_")):
            continue
        if slugs and slug not in slugs:
            continue
        for name in sorted(os.listdir(sdir)):
            p = os.path.join(sdir, name)
            if os.path.isfile(p) and name.lower().endswith(".png"):
                if not pigs or ROSIE in pigs:
                    yield slug, ROSIE, p
            elif os.path.isdir(p) and not name.startswith((".", "_")):
                if pigs and name not in pigs:
                    continue
                for f in sorted(os.listdir(p)):
                    fp = os.path.join(p, f)
                    if os.path.isfile(fp) and f.lower().endswith(".png"):
                        yield slug, name, fp


def quantize(pngquant, path, floor, dry_run):
    """Returns (status, old_bytes, new_bytes). status is one of quantized,
    skipped-palette, skipped-mode, kept-floor, kept-not-smaller, error."""
    old = os.path.getsize(path)
    try:
        with Image.open(path) as im:
            mode = im.mode
    except Exception:
        return "error", old, old
    if mode == "P":
        return "skipped-palette", old, old
    if mode not in ("RGBA", "RGB"):
        return "skipped-mode", old, old

    if dry_run:
        tmpdir = tempfile.mkdtemp(prefix="quantize-dry-")
        tmp = os.path.join(tmpdir, "q.png")
    else:
        fd, tmp = tempfile.mkstemp(prefix=".q-", suffix=".png", dir=os.path.dirname(path))
        os.close(fd)
    try:
        rc = subprocess.run(
            [pngquant, f"--quality={floor}-100", "--strip", "--force", "--output", tmp, path],
            stderr=subprocess.DEVNULL,
        ).returncode
        if rc == QUALITY_NOT_MET:
            return "kept-floor", old, old
        if rc != 0 or not os.path.exists(tmp) or os.path.getsize(tmp) == 0:
            return "error", old, old
        new = os.path.getsize(tmp)
        if new >= old:
            return "kept-not-smaller", old, old
        if not dry_run:
            os.replace(tmp, path)
        return "quantized", old, new
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)
        if dry_run:
            shutil.rmtree(os.path.dirname(tmp), ignore_errors=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--quality-floor", type=int, default=90,
                    help="pngquant min quality (0-100); frames below it are kept as-is. Default 90.")
    ap.add_argument("--dry-run", action="store_true", help="report only; write nothing under --root")
    ap.add_argument("--slug", action="append", help="only these costume slugs (repeatable)")
    ap.add_argument("--pig", action="append",
                    help="only these pigs (repeatable); 'rosie' = top-level <slug>/*.png")
    ap.add_argument("--root", default=DEFAULT_COSTUMES, help="costumes dir (default: repo costumes)")
    ap.add_argument("-v", "--verbose", action="store_true", help="print every file's outcome")
    a = ap.parse_args()
    if not 0 <= a.quality_floor <= 100:
        ap.error("--quality-floor must be 0-100")
    if not os.path.isdir(a.root):
        ap.error(f"--root not a directory: {a.root}")

    pngquant = find_pngquant()
    counts = {}
    before = after = 0
    for slug, pig, path in iter_frames(a.root, a.slug, a.pig):
        status, old, new = quantize(pngquant, path, a.quality_floor, a.dry_run)
        counts[status] = counts.get(status, 0) + 1
        before += old
        after += new
        if a.verbose or status == "error":
            print(f"  {status:17s} {old/1024:7.1f}K -> {new/1024:7.1f}K  {os.path.relpath(path, a.root)}")

    n = sum(counts.values())
    pct = (before - after) * 100 / before if before else 0
    tag = "[dry-run] " if a.dry_run else ""
    print(f"{tag}{n} PNGs under {a.root} at --quality={a.quality_floor}-100")
    print(f"  quantized {counts.get('quantized', 0)}"
          f" · kept (floor not met) {counts.get('kept-floor', 0)}"
          f" · kept (not smaller) {counts.get('kept-not-smaller', 0)}"
          f" · skipped (already palette) {counts.get('skipped-palette', 0)}"
          f" · skipped (other mode) {counts.get('skipped-mode', 0)}"
          f" · errors {counts.get('error', 0)}")
    print(f"  {before/1e6:.2f} MB -> {after/1e6:.2f} MB  (-{pct:.1f}%)")
    return 1 if counts.get("error") else 0


if __name__ == "__main__":
    sys.exit(main())

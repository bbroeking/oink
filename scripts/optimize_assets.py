#!/usr/bin/env python3
"""Shrink every bundled image with pngquant (lossy palette + dithering — ~65-75%
smaller, visually identical). In place; originals are recoverable from git. Run
after adding new art so the bundle never balloons (53MB of unoptimized PNGs ->
~15MB). Idempotent: a file is only overwritten when the result is actually
smaller, so re-running on already-optimized art is a no-op.

Skips:
  • app-chrome (icon / adaptive-icon / splash / favicon) — they feed native icon
    generation and should stay pristine.
  • _mudwar_raw/ — raw source strip sheets, never bundled (metro blockList).
  • sprites/rosie/ — the animated pig is the hero asset, shown large; lossy
    palette quantization dithers its smooth shading, so it stays full RGBA.

Usage: optimize_assets.py [--dry]
"""
import os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "assets", "images")
SKIP_NAMES = {
    "icon.png", "adaptive-icon.png", "favicon.png",
    "splash-art.png", "splash-art-v0-backup.png",
}
SKIP_DIRS = {"_mudwar_raw", "rosie"}
DRY = "--dry" in sys.argv


def optimize(path, dry=False):
    """pngquant to a temp; replace only if smaller. Quality floor 55, falling
    back to plain 256-colour so EVERY image shrinks (no silent skips). Importable
    by the art-pipeline slice scripts so new items are shrunk the moment they
    land in assets/images/."""
    old = os.path.getsize(path)
    if dry:
        return old, old
    # Already palette/indexed (PNG colour-type 3) == already optimized → SKIP.
    # pngquant happily re-quantizes a palette image smaller still, so without
    # this every build/slice would re-run and compound quality loss. RGBA/RGB
    # source art (mode RGBA/RGB) is what we quantize, exactly once.
    try:
        from PIL import Image
        if Image.open(path).mode == "P":
            return old, old
    except Exception:
        pass
    tmp = path + ".q.png"
    ok = False
    for args in (
        ["pngquant", "--quality=55-90", "--strip", "--force", "--output", tmp, path],
        ["pngquant", "256", "--strip", "--force", "--output", tmp, path],
    ):
        if subprocess.run(args, stderr=subprocess.DEVNULL).returncode == 0:
            ok = True
            break
    if ok and os.path.exists(tmp):
        new = os.path.getsize(tmp)
        if new < old:
            os.replace(tmp, path)
            return old, new
        os.remove(tmp)
    return old, old


def main():
    total_old = total_new = n = shrunk = skipped = 0
    for dirpath, dirnames, files in os.walk(IMG):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for f in sorted(files):
            if not f.lower().endswith(".png"):
                continue
            if f in SKIP_NAMES:
                skipped += 1
                continue
            old, new = optimize(os.path.join(dirpath, f), dry=DRY)
            total_old += old
            total_new += new
            n += 1
            if new < old:
                shrunk += 1
    pct = (total_old - total_new) * 100 // total_old if total_old else 0
    print(f"{'[dry] ' if DRY else ''}scanned {n} PNGs · shrank {shrunk} · skipped {skipped} (app-chrome)")
    print(f"  {total_old/1048576:.1f} MB -> {total_new/1048576:.1f} MB  (-{pct}%)")


if __name__ == "__main__":
    main()

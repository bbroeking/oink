"""Hold a pig's body pink to one canonical swatch across every family.

Each animation family is its own ImageGen sheet, and each sheet guessed "the
same pink" a little differently (the May 2026 rig, the 2026-09-14 idle, the
2026-09-15 facing sheets). This pass measures every frame's pink band — the
whole body fill, cheeks and snout included — as a CIELAB mean and applies ONE
uniform Lab shift to that band so its mean lands on the canonical: the idle
family's, the newest and most-seen art. (A mid-tone-only mask was tried first
and is unstable: for the lighter sheets it sits on its own threshold, so a
two-unit shift moves thousands of pixels in or out of the measure.) Outline, eyes, hooves and the white highlight are outside the
band and untouched; the shift is uniform, so cheeks and snout move with the
body and shading relationships hold.

    python3 scripts/pig-tweens/normalize_body_pink.py rosie          # apply
    python3 scripts/pig-tweens/normalize_body_pink.py rosie --check  # report, exit 1 on drift

Families in STRENGTH are pulled only part way (sad keeps half its pallor as a
mood read). Rosie only for now: the recruits' coats need their own band and
canonical per coat.
"""
import math
import sys
from pathlib import Path
import numpy as np
from PIL import Image

SPRITES = Path(__file__).resolve().parents[2] / "assets" / "images" / "sprites"
FAMILIES = {"idle": 12, "walk": 4, "jump": 4, "happy": 4, "sad": 4, "tired": 4,
            "surprise": 4, "wave": 4, "face": 4, "face_sit": 4}
CANONICAL_FAMILY = "idle"
STRENGTH = {"sad": 0.5}
CHECK_TOLERANCE = 2.0   # ΔE (CIE76); ~2.3 is the just-noticeable difference
CHECK_EXEMPT = {"sad": 3.5}

def _srgb_to_lin(c):
    c = c / 255.0
    return np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)

def _lin_to_srgb(c):
    c = np.where(c > 0.0031308, 1.055 * np.clip(c, 0, None) ** (1 / 2.4) - 0.055, 12.92 * c)
    return np.clip(c * 255.0, 0, 255)

def rgb_to_lab(rgb):
    r, g, b = (_srgb_to_lin(rgb[..., i]) for i in range(3))
    x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
    y = r * 0.2126 + g * 0.7152 + b * 0.0722
    z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883
    f = lambda t: np.where(t > 0.008856, np.cbrt(t), 7.787 * t + 16 / 116)
    fx, fy, fz = f(x), f(y), f(z)
    return np.stack([116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)], -1)

def lab_to_rgb(lab):
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    fy = (L + 16) / 116; fx = a / 500 + fy; fz = fy - b / 200
    g = lambda t: np.where(t > 0.2069, t ** 3, (t - 16 / 116) / 7.787)
    x, y, z = g(fx) * 0.95047, g(fy), g(fz) * 1.08883
    r = x * 3.2406 + y * -1.5372 + z * -0.4986
    gg = x * -0.9689 + y * 1.8758 + z * 0.0415
    bb = x * 0.0557 + y * -0.2040 + z * 1.0570
    return np.stack([_lin_to_srgb(r), _lin_to_srgb(gg), _lin_to_srgb(bb)], -1)

def hsv(rgb):
    mx = rgb.max(-1); mn = rgb.min(-1); d = mx - mn
    s = np.where(mx > 0, d / np.maximum(mx, 1), 0); v = mx / 255.0
    h = np.zeros_like(s)
    nz = d > 0
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.where(nz & (mx == r), ((g - b) / np.where(nz, d, 1) + 6) % 6, h)
    h = np.where(nz & (mx == g) & (mx != r), (b - r) / np.where(nz, d, 1) + 2, h)
    h = np.where(nz & (mx == b) & (mx != r) & (mx != g), (r - g) / np.where(nz, d, 1) + 4, h)
    return h / 6.0, s, v

def band_mask(rgb, a):
    h, s, v = hsv(rgb)
    return (a > 0) & (v > 0.45) & (s > 0.05) & (s < 0.8) & ((h < 0.09) | (h > 0.85))

def frame_mean_lab(rgb, a):
    return rgb_to_lab(rgb[band_mask(rgb, a)].astype(float)).mean(0)

def load(path):
    arr = np.asarray(Image.open(path).convert("RGBA")).astype(float)
    return arr[..., :3], arr[..., 3]

def frames(pig):
    for fam, n in FAMILIES.items():
        for i in range(1, n + 1):
            yield fam, SPRITES / pig / f"{fam}_{i}.png"

def canonical_for(pig):
    labs = [frame_mean_lab(*load(p)) for fam, p in frames(pig) if fam == CANONICAL_FAMILY]
    return np.mean(labs, 0)

def report(pig, canonical):
    rows = []; worst = 0.0; failed = []
    for fam in FAMILIES:
        labs = [frame_mean_lab(*load(p)) for f, p in frames(pig) if f == fam]
        fam_mean = np.mean(labs, 0)
        de = float(np.linalg.norm(fam_mean - canonical))
        step = max(float(np.linalg.norm(labs[i] - labs[(i + 1) % len(labs)])) for i in range(len(labs)))
        tol = CHECK_EXEMPT.get(fam, CHECK_TOLERANCE)
        ok = de <= tol and step <= CHECK_TOLERANCE
        if not ok: failed.append(fam)
        rows.append(f"  {fam:9} ΔE vs canonical {de:4.1f}  max in-loop ΔE {step:3.1f}  {'ok' if ok else 'DRIFT'}")
    print(f"{pig}: canonical L*a*b* = {canonical[0]:.1f} {canonical[1]:.1f} {canonical[2]:.1f}")
    print("\n".join(rows))
    return failed

def apply(pig, canonical):
    for fam, path in frames(pig):
        rgb, a = load(path)
        shift = (canonical - frame_mean_lab(rgb, a)) * STRENGTH.get(fam, 1.0)
        band = band_mask(rgb, a)
        lab = rgb_to_lab(rgb[band]) + shift
        out = rgb.copy(); out[band] = lab_to_rgb(lab)
        arr = np.dstack([np.rint(out), a]).astype(np.uint8)
        Image.fromarray(arr, "RGBA").save(path)
        print(f"  {path.name:16} shift ΔL {shift[0]:+5.1f} Δa {shift[1]:+5.1f} Δb {shift[2]:+5.1f}  band {int(band.sum())} px")

if __name__ == "__main__":
    args = [x for x in sys.argv[1:] if not x.startswith("--")]
    pig = args[0] if args else "rosie"
    canonical = canonical_for(pig)
    if "--check" in sys.argv:
        failed = report(pig, canonical)
        sys.exit(1 if failed else 0)
    apply(pig, canonical)
    print()
    report(pig, canonical)

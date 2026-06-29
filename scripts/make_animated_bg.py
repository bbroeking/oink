#!/usr/bin/env python3
"""Turn ONE generated background scene into N animation frames for the
ANIMATED_BACKGROUNDS ping-pong cross-fade (constants/animatedBackgrounds.ts).

Usage: make_animated_bg.py <scene.png> <id> [num_frames=5]

Generating N coherent frames from ChatGPT is unreliable, so instead we derive
them procedurally from one scene: a layer of twinkling stars (fixed positions,
per-frame brightness) over a very gently drifting + breathing copy of the
scene. The cross-fade between frames reads as a living, shimmering sky. Writes
assets/images/backgrounds/<id>_1.png .. _N.png (512x512, opaque).
"""
import sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SIZE = 512


def main(src, out_id, n=5):
    base = Image.open(src).convert("RGB")
    w, h = base.size
    s = min(w, h)
    base = base.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
    base = base.resize((SIZE, SIZE), Image.LANCZOS)

    rng = np.random.RandomState(7)  # deterministic star field
    n_stars = 46
    stars = [
        (int(rng.uniform(0.04, 0.96) * SIZE),
         int(rng.uniform(0.04, 0.96) * SIZE),
         rng.uniform(1.3, 3.4),          # radius
         rng.uniform(0.0, 1.0))          # twinkle phase
        for _ in range(n_stars)
    ]

    os.makedirs("assets/images/backgrounds", exist_ok=True)
    for i in range(n):
        t = i / n
        # gentle drift (a few px of parallax) + breathing zoom
        dx = int(round(3 * np.sin(2 * np.pi * t)))
        dy = int(round(2 * np.cos(2 * np.pi * t)))
        zoom = 1.0 + 0.02 * (0.5 + 0.5 * np.sin(2 * np.pi * t))
        zw = int(SIZE * zoom)
        fr = base.resize((zw, zw), Image.LANCZOS)
        ox = (zw - SIZE) // 2 - dx
        oy = (zw - SIZE) // 2 - dy
        frame = fr.crop((ox, oy, ox + SIZE, oy + SIZE)).convert("RGB")
        # subtle overall brightness breathe
        arr = np.asarray(frame).astype(np.float32) * (1.0 + 0.03 * np.sin(2 * np.pi * t))
        frame = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")

        # twinkle layer
        star = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        sd = ImageDraw.Draw(star)
        for (sx, sy, r, ph) in stars:
            tw = (0.5 + 0.5 * np.sin(2 * np.pi * (t + ph))) ** 1.5
            if tw < 0.06:
                continue
            a = int(200 * tw)
            rr = r * (0.7 + 0.6 * tw)
            sd.ellipse([sx - rr, sy - rr, sx + rr, sy + rr], fill=(255, 252, 235, a))
            # soft cross glint on the brightest
            if tw > 0.7:
                g = int(120 * (tw - 0.7) / 0.3)
                sd.line([sx - rr * 2.4, sy, sx + rr * 2.4, sy], fill=(255, 255, 245, g), width=1)
                sd.line([sx, sy - rr * 2.4, sx, sy + rr * 2.4], fill=(255, 255, 245, g), width=1)
        star = star.filter(ImageFilter.GaussianBlur(0.6))
        out = Image.alpha_composite(frame.convert("RGBA"), star).convert("RGB")
        path = f"assets/images/backgrounds/{out_id}_{i+1}.png"
        out.save(path)
        print(f"  {path}")
    print(f"wrote {n} frames for {out_id}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit("usage: make_animated_bg.py <scene.png> <id> [num_frames]")
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 5)

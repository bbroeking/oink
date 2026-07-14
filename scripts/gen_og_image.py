#!/usr/bin/env python3
"""Generate the Open Graph link-preview image for the referral landing page.

Composes a 1200x630 (the OG standard, 1.91:1) card in TTP's whimsy palette:
cream background, a white sticker card with an ink border + offset shadow,
the pig art on the right, and the headline/sub on the left.

Output: landing/og.png  (referenced by landing/index.html's og:image tag)

Run:  python3 scripts/gen_og_image.py
Re-run any time the copy or art changes; it's deterministic.
"""
import os
import math
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Rosie — the landing page's own art. NOT assets/images/pig.png: that's the
# retired pre-Rosie pig that used to headline this card (deprecated 2026-07-13).
PIG = os.path.join(ROOT, "landing/rosie.png")
OUT = os.path.join(ROOT, "landing/og.png")

# Whimsy palette (constants/theme.ts)
INK = (42, 31, 21)
PAPER = (255, 250, 240)
ROSE_DEEP = (248, 168, 179)
SUN = (255, 216, 122)

W, H = 1200, 630

HEADLINE_FONT = "/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf"
BODY_FONT = "/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf"


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def rounded_rect(draw, box, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def star(draw, cx, cy, r, fill):
    """Draw a filled 5-point star centered at (cx, cy)."""
    pts = []
    for i in range(10):
        ang = -math.pi / 2 + i * math.pi / 5
        rad = r if i % 2 == 0 else r * 0.42
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
    draw.polygon(pts, fill=fill)


def arrow(draw, x, y, size, fill):
    """Draw a small right-pointing triangle with its left edge at (x, y)."""
    draw.polygon([(x, y - size), (x, y + size), (x + size * 1.3, y)], fill=fill)


def main():
    img = Image.new("RGB", (W, H), PAPER)
    draw = ImageDraw.Draw(img)

    # Sticker card: offset ink shadow, then white card with ink border.
    pad = 44
    shadow_off = 12
    rounded_rect(draw, (pad + shadow_off, pad + shadow_off, W - pad + shadow_off, H - pad + shadow_off), 36, fill=INK)
    rounded_rect(draw, (pad, pad, W - pad, H - pad), 36, fill=(255, 255, 255), outline=INK, width=5)

    # Pig art on the right, scaled to ~430px wide, vertically centered.
    pig = Image.open(PIG).convert("RGBA")
    target_w = 430
    scale = target_w / pig.width
    pig = pig.resize((target_w, int(pig.height * scale)), Image.LANCZOS)
    px = W - pad - target_w - 36
    py = (H - pig.height) // 2
    img.paste(pig, (px, py), pig)

    # Text block on the left.
    tx = pad + 56
    # Kicker — text flanked by drawn stars (the font lacks a ★ glyph).
    kf = font(BODY_FONT, 28)
    kicker = "TICKLE THE PIG"
    ky = 164
    star(draw, tx + 11, ky, 13, ROSE_DEEP)
    draw.text((tx + 32, 150), kicker, font=kf, fill=ROSE_DEEP)
    kw = draw.textlength(kicker, font=kf)
    star(draw, tx + 32 + kw + 21, ky, 13, ROSE_DEEP)
    # Headline (two lines)
    hf = font(HEADLINE_FONT, 78)
    draw.text((tx, 196), "Come tickle", font=hf, fill=INK)
    draw.text((tx, 282), "a pig.", font=hf, fill=INK)
    # Sun underline accent beneath the headline.
    draw.rounded_rectangle((tx, 372, tx + 360, 380), radius=4, fill=SUN)
    # Sub — text with a drawn arrow (the font lacks a → glyph).
    sf = font(BODY_FONT, 34)
    sub = "A friend sent you a code"
    draw.text((tx, 392), sub, font=sf, fill=INK)
    sw = draw.textlength(sub, font=sf)
    arrow(draw, tx + sw + 18, 410, 13, ROSE_DEEP)

    img.save(OUT, "PNG")
    print(f"wrote {OUT} ({W}x{H})")


if __name__ == "__main__":
    main()

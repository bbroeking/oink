#!/usr/bin/env python3
"""Generate in-world CTA end-card examples for the Great Hunger opening."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "concepts" / "great-hungerer" / "cta_examples"
SCRIPT = ROOT / "scripts" / "build_great_hunger_animated_cut.py"

spec = importlib.util.spec_from_file_location("great_hunger_cut", SCRIPT)
cut = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = cut
spec.loader.exec_module(cut)


def base_frame() -> Image.Image:
    base = Image.open(cut.PANELS / cut.SHOTS[-1].panel_name).convert("RGB")
    frame = cut.cover_frame(base, cut.SHOTS[-1], 0.9)
    cut.add_hoard_glow(frame, 0.45)
    frame = frame.filter(ImageFilter.GaussianBlur(3.4))
    frame.alpha_composite(Image.new("RGBA", (cut.WIDTH, cut.HEIGHT), (5, 5, 6, 140)))
    cut.add_vignette(frame, 120)
    return frame


def save(frame: Image.Image, name: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    frame.convert("RGB").save(OUT / name, quality=94, optimize=True)


def button(draw: ImageDraw.ImageDraw, y: int, text: str, *, width: int = 700) -> None:
    x = round((cut.WIDTH - width) / 2)
    draw.rounded_rectangle((x, y, x + width, y + 78), radius=18, fill=(255, 207, 72, 236), outline=(255, 241, 174, 180), width=2)
    cut.draw_centered_text(draw, text, y + 20, cut.load_font(31, bold=True), (28, 18, 10, 255), stroke_width=0)


def dark_panel(draw: ImageDraw.ImageDraw, xy: tuple[int, int, int, int]) -> None:
    draw.rounded_rectangle(xy, radius=30, fill=(10, 9, 9, 168), outline=(255, 196, 50, 120), width=3)
    x0, y0, x1, y1 = xy
    draw.line((x0 + 58, y0 + 74, x1 - 58, y0 + 74), fill=(255, 196, 50, 86), width=2)
    draw.line((x0 + 58, y1 - 84, x1 - 58, y1 - 84), fill=(255, 196, 50, 86), width=2)


def app_lockup(overlay: Image.Image, draw: ImageDraw.ImageDraw, x: int, y: int, *, compact: bool = False) -> None:
    icon_size = 108 if compact else 128
    icon = cut.rounded_icon(cut.APP_ICON, icon_size, 24)
    overlay.alpha_composite(icon, (x, y))
    cut.draw_text(draw, (x + icon_size + 24, y + 10), "Tickle the Pig", cut.load_font(39 if compact else 43, bold=True), (255, 248, 235, 255), stroke_width=2)
    cut.draw_text(draw, (x + icon_size + 24, y + 60), "On the App Store", cut.load_font(28), (220, 211, 196, 235))


def variant_quest_notice() -> None:
    frame = base_frame()
    overlay = Image.new("RGBA", (cut.WIDTH, cut.HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    dark_panel(draw, (90, 612, 990, 1244))
    cut.draw_centered_text(draw, "SEASON 2: THE GREAT HUNGER", 640, cut.load_font(30, bold=True), (231, 211, 165, 245), stroke_width=1)
    cut.draw_centered_text(draw, "Play Season 2", 748, cut.load_font(76, bold=True), (255, 220, 112, 255), stroke_width=4)
    cut.draw_centered_text(draw, "Help bring back the joy.", 858, cut.load_font(42, bold=True), (255, 248, 235, 255), stroke_width=2)
    cut.draw_centered_text(draw, "The valley is waiting.", 930, cut.load_font(32), (230, 220, 204, 245), stroke_width=1)
    button(draw, 1018, "Play Season 2 on the App Store")
    app_lockup(overlay, draw, 292, 1136, compact=True)
    frame.alpha_composite(overlay)
    cut.draw_bottom_caption(frame, "Play Season 2 on the App Store. Help bring back the joy.")
    save(frame, "cta_01_quest_notice.jpg")


def variant_mud_wars() -> None:
    frame = base_frame()
    overlay = Image.new("RGBA", (cut.WIDTH, cut.HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    dark_panel(draw, (102, 650, 978, 1220))
    cut.draw_centered_text(draw, "THE MUD WARS BEGIN", 730, cut.load_font(62, bold=True), (255, 220, 112, 255), stroke_width=4)
    cut.draw_centered_text(draw, "Fight the Great Hunger together.", 830, cut.load_font(38, bold=True), (255, 248, 235, 255), stroke_width=2)
    cut.draw_centered_text(draw, "Season 2 starts July 11", 900, cut.load_font(32), (230, 220, 204, 245), stroke_width=1)
    button(draw, 988, "Play Season 2 on the App Store", width=720)
    app_lockup(overlay, draw, 318, 1108, compact=True)
    frame.alpha_composite(overlay)
    cut.draw_bottom_caption(frame, "The Mud Wars begin. Play Season 2 on the App Store.")
    save(frame, "cta_02_mud_wars.jpg")


def variant_valley_pledge() -> None:
    frame = base_frame()
    overlay = Image.new("RGBA", (cut.WIDTH, cut.HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    dark_panel(draw, (116, 570, 964, 1280))
    cut.draw_centered_text(draw, "A valley without joy", 675, cut.load_font(58, bold=True), (255, 248, 235, 255), stroke_width=3)
    cut.draw_centered_text(draw, "needs everyone.", 750, cut.load_font(58, bold=True), (255, 220, 112, 255), stroke_width=3)
    cut.draw_centered_text(draw, "Play Season 2", 890, cut.load_font(52, bold=True), (255, 248, 235, 255), stroke_width=2)
    cut.draw_centered_text(draw, "and help bring back the joy.", 958, cut.load_font(34), (230, 220, 204, 245), stroke_width=1)
    button(draw, 1062, "Open on the App Store", width=600)
    app_lockup(overlay, draw, 316, 1170, compact=True)
    frame.alpha_composite(overlay)
    cut.draw_bottom_caption(frame, "A valley without joy needs everyone. Play Season 2.")
    save(frame, "cta_03_valley_pledge.jpg")


def variant_seal() -> None:
    frame = base_frame()
    overlay = Image.new("RGBA", (cut.WIDTH, cut.HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    dark_panel(draw, (86, 606, 994, 1278))
    icon = cut.rounded_icon(cut.APP_ICON, 160, 36)
    overlay.alpha_composite(icon, (460, 678))
    cut.draw_centered_text(draw, "Tickle the Pig", 858, cut.load_font(54, bold=True), (255, 248, 235, 255), stroke_width=2)
    cut.draw_centered_text(draw, "Play Season 2", 936, cut.load_font(55, bold=True), (255, 220, 112, 255), stroke_width=3)
    cut.draw_centered_text(draw, "The Great Hunger begins July 11.", 1018, cut.load_font(33), (230, 220, 204, 245), stroke_width=1)
    button(draw, 1116, "Play on the App Store", width=580)
    frame.alpha_composite(overlay)
    cut.draw_bottom_caption(frame, "Tickle the Pig Season 2. Play on the App Store.")
    save(frame, "cta_04_seal.jpg")


def contact_sheet() -> None:
    files = sorted(OUT.glob("cta_0*.jpg"))
    thumb_w, thumb_h = 270, 480
    pad = 18
    sheet = Image.new("RGB", (2 * thumb_w + 3 * pad, 2 * thumb_h + 3 * pad + 48), (18, 20, 22))
    draw = ImageDraw.Draw(sheet)
    for i, file in enumerate(files):
        im = Image.open(file).convert("RGB")
        im.thumbnail((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        x = pad + (i % 2) * (thumb_w + pad)
        y = pad + (i // 2) * (thumb_h + pad + 24)
        tile = Image.new("RGB", (thumb_w, thumb_h), (8, 9, 11))
        tile.paste(im, ((thumb_w - im.width) // 2, (thumb_h - im.height) // 2))
        sheet.paste(tile, (x, y))
        draw.text((x + 8, y + thumb_h + 8), file.stem.replace("_", " "), fill=(247, 239, 226))
    sheet.save(OUT / "cta_examples_contact_sheet.jpg", quality=94, optimize=True)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("cta_0*.jpg"):
        old.unlink()
    variant_quest_notice()
    variant_mud_wars()
    variant_valley_pledge()
    variant_seal()
    contact_sheet()
    print(OUT)


if __name__ == "__main__":
    main()

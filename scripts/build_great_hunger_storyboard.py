#!/usr/bin/env python3
"""Build first-pass Great Hunger storyboard and sprite sheet composites."""

from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "concepts" / "great-hungerer"
STORY = OUT / "storyboard"
SPRITES = OUT / "sprites"

ROSIE_REF = Path.home() / "Desktop" / "ttp-refs" / "soccer-regen" / "idle_1.png"
HUNGER_REF = Path.home() / "Downloads" / "ChatGPT Image Jul 2, 2026, 05_23_14 PM (1).png"

W, H = 1080, 1920
GREEN = (0, 255, 0, 255)
ROSIE_STATES = ("idle", "happy", "sad", "surprise", "tired", "jump", "walk", "wave")
ROSIE_SHADOW_STATES = {"happy", "surprise"}


def open_rgba(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def cover_crop(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_w, target_h = size
    scale = max(target_w / img.width, target_h / img.height)
    resized = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    left = (resized.width - target_w) // 2
    top = (resized.height - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h)).convert("RGBA")


def fit(img: Image.Image, width: int | None = None, height: int | None = None) -> Image.Image:
    if width is None and height is None:
        return img.copy()
    if width is None:
        scale = height / img.height
    elif height is None:
        scale = width / img.width
    else:
        scale = min(width / img.width, height / img.height)
    return img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)


def paste_center(base: Image.Image, img: Image.Image, center: tuple[int, int]) -> None:
    x = round(center[0] - img.width / 2)
    y = round(center[1] - img.height / 2)
    base.alpha_composite(img, (x, y))


def tint(img: Image.Image, color: tuple[int, int, int], strength: float) -> Image.Image:
    overlay = Image.new("RGBA", img.size, (*color, 255))
    return Image.blend(img, overlay, strength)


def desaturate(img: Image.Image, amount: float = 0.8) -> Image.Image:
    grey = ImageEnhance.Color(img).enhance(1 - amount)
    return ImageEnhance.Brightness(grey).enhance(0.86)


def clean_rosie_frame(img: Image.Image, state: str) -> Image.Image:
    """Remove source-sheet floor ovals from review/animation exports only."""
    frame = img.copy()
    if state not in ROSIE_SHADOW_STATES:
        return frame
    pix = frame.load()
    start_y = round(frame.height * 0.62)
    visited: set[tuple[int, int]] = set()

    def is_shadow_pixel(x: int, y: int) -> bool:
        r, g, b, a = pix[x, y]
        if a == 0 or y < start_y:
            return False
        neutral = max(r, g, b) - min(r, g, b) < 48
        return neutral and r > 150 and g > 150 and b > 150

    for y in range(start_y, frame.height):
        for x in range(frame.width):
            if (x, y) in visited or not is_shadow_pixel(x, y):
                continue
            stack = [(x, y)]
            component: list[tuple[int, int]] = []
            visited.add((x, y))
            while stack:
                cx, cy = stack.pop()
                component.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if nx < 0 or ny < start_y or nx >= frame.width or ny >= frame.height or (nx, ny) in visited:
                        continue
                    if is_shadow_pixel(nx, ny):
                        visited.add((nx, ny))
                        stack.append((nx, ny))

            xs = [p[0] for p in component]
            ys = [p[1] for p in component]
            width = max(xs) - min(xs) + 1
            height = max(ys) - min(ys) + 1
            low = max(ys) > round(frame.height * 0.75)
            flat = height <= round(frame.height * 0.16)
            wide_enough = width >= round(frame.width * 0.12)
            if low and flat and wide_enough:
                for px, py in component:
                    pix[px, py] = (255, 255, 255, 0)
    return frame


def remove_light_checker(img: Image.Image) -> Image.Image:
    """Remove the checkerboard background from a downloaded ChatGPT sprite ref."""
    rgba = img.convert("RGBA")
    pix = rgba.load()
    w, h = rgba.size
    visited: set[tuple[int, int]] = set()
    stack: list[tuple[int, int]] = []
    for x in range(w):
        stack.append((x, 0))
        stack.append((x, h - 1))
    for y in range(h):
        stack.append((0, y))
        stack.append((w - 1, y))

    def is_bg(x: int, y: int) -> bool:
        r, g, b, a = pix[x, y]
        if a == 0:
            return True
        near_neutral = max(r, g, b) - min(r, g, b) < 12
        return near_neutral and r > 222 and g > 222 and b > 222

    while stack:
        x, y = stack.pop()
        if (x, y) in visited or x < 0 or y < 0 or x >= w or y >= h:
            continue
        if not is_bg(x, y):
            continue
        visited.add((x, y))
        pix[x, y] = (255, 255, 255, 0)
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    bbox = rgba.getbbox()
    if bbox:
        rgba = rgba.crop(bbox)
    return rgba


def load_bg(name: str, grey: bool = False) -> Image.Image:
    bg = cover_crop(open_rgba(ROOT / "assets" / "images" / "backgrounds" / name), (W, H))
    if grey:
        bg = desaturate(bg, 0.9)
        bg = tint(bg, (110, 126, 142), 0.12)
    return bg


def draw_motes(draw: ImageDraw.ImageDraw, count: int, seed: int, grey: bool = False, spread: float = 1.0) -> None:
    random.seed(seed)
    for _ in range(count):
        x = random.randint(40, W - 40)
        y = random.randint(80, round(H * spread))
        radius = random.randint(3, 12)
        if grey:
            fill = (138, 145, 150, random.randint(70, 140))
            halo = (138, 145, 150, random.randint(18, 45))
        else:
            fill = (255, 215, 76, random.randint(150, 245))
            halo = (255, 190, 37, random.randint(28, 70))
        draw.ellipse((x - radius * 3, y - radius * 3, x + radius * 3, y + radius * 3), fill=halo)
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill)


def draw_gold_stream(img: Image.Image, start: tuple[int, int], end: tuple[int, int]) -> None:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    points = []
    for i in range(42):
        t = i / 41
        x = start[0] * (1 - t) + end[0] * t
        y = start[1] * (1 - t) + end[1] * t + math.sin(t * math.pi * 5) * 36
        points.append((x, y))
    draw.line(points, fill=(255, 184, 28, 115), width=92, joint="curve")
    draw.line(points, fill=(255, 229, 96, 230), width=38, joint="curve")
    draw.line(points, fill=(255, 255, 206, 240), width=14, joint="curve")
    layer = layer.filter(ImageFilter.GaussianBlur(1.4))
    img.alpha_composite(layer)
    draw = ImageDraw.Draw(img)
    random.seed(45)
    for _ in range(90):
        t = random.random()
        x = start[0] * (1 - t) + end[0] * t + random.randint(-55, 55)
        y = start[1] * (1 - t) + end[1] * t + math.sin(t * math.pi * 5) * 36 + random.randint(-38, 38)
        r = random.randint(3, 10)
        draw.ellipse((x - r, y - r, x + r, y + r), fill=(255, 223, 75, random.randint(120, 235)))


def draw_barn(draw: ImageDraw.ImageDraw, xy: tuple[int, int], scale: float, lit: bool = True) -> None:
    x, y = xy
    body = (150, 89, 69) if lit else (88, 89, 92)
    roof = (105, 61, 55) if lit else (70, 72, 76)
    glow = (255, 206, 83, 160) if lit else (102, 108, 115, 120)
    w = round(230 * scale)
    h = round(190 * scale)
    draw.rounded_rectangle((x, y, x + w, y + h), radius=round(52 * scale), fill=body, outline=(54, 38, 35), width=max(2, round(8 * scale)))
    draw.polygon([(x - round(28 * scale), y + round(42 * scale)), (x + w // 2, y - round(74 * scale)), (x + w + round(28 * scale), y + round(42 * scale))], fill=roof, outline=(54, 38, 35))
    draw.rounded_rectangle((x + round(72 * scale), y + round(74 * scale), x + round(158 * scale), y + h), radius=round(28 * scale), fill=glow, outline=(54, 38, 35), width=max(2, round(5 * scale)))


def draw_back_rosie(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    o = (52, 35, 33, 255)
    pink = (255, 191, 199, 255)
    shade = (244, 144, 164, 255)
    # ears
    d.ellipse((size * 0.08, size * 0.08, size * 0.34, size * 0.34), fill=pink, outline=o, width=max(5, size // 28))
    d.ellipse((size * 0.66, size * 0.08, size * 0.92, size * 0.34), fill=pink, outline=o, width=max(5, size // 28))
    d.ellipse((size * 0.17, size * 0.17, size * 0.30, size * 0.30), fill=(255, 134, 172, 255))
    d.ellipse((size * 0.70, size * 0.17, size * 0.83, size * 0.30), fill=(255, 134, 172, 255))
    # body/head blob
    d.ellipse((size * 0.14, size * 0.17, size * 0.86, size * 0.83), fill=pink, outline=o, width=max(6, size // 25))
    d.arc((size * 0.23, size * 0.35, size * 0.77, size * 0.92), 15, 165, fill=shade, width=max(3, size // 45))
    # tail
    d.arc((size * 0.11, size * 0.50, size * 0.30, size * 0.70), 80, 345, fill=o, width=max(6, size // 24))
    d.arc((size * 0.13, size * 0.52, size * 0.28, size * 0.68), 80, 345, fill=(255, 170, 185, 255), width=max(3, size // 44))
    # hooves
    d.ellipse((size * 0.25, size * 0.75, size * 0.40, size * 0.91), fill=(92, 54, 58, 255), outline=o, width=max(3, size // 45))
    d.ellipse((size * 0.60, size * 0.75, size * 0.75, size * 0.91), fill=(92, 54, 58, 255), outline=o, width=max(3, size // 45))
    return img


def draw_back_hunger(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    o = (45, 32, 29, 255)
    pink = (255, 188, 197, 255)
    d.ellipse((size * 0.09, size * 0.18, size * 0.91, size * 0.92), fill=pink, outline=o, width=max(9, size // 23))
    d.polygon([(size * 0.34, size * 0.17), (size * 0.43, size * 0.02), (size * 0.50, size * 0.16), (size * 0.59, size * 0.02), (size * 0.66, size * 0.17)], fill=(246, 177, 36, 255), outline=o)
    d.arc((size * 0.06, size * 0.50, size * 0.27, size * 0.72), 70, 350, fill=o, width=max(8, size // 22))
    random.seed(9)
    for _ in range(18):
        x = random.randint(round(size * 0.20), round(size * 0.82))
        y = random.randint(round(size * 0.25), round(size * 0.78))
        r = random.randint(max(5, size // 48), max(12, size // 24))
        d.ellipse((x - r, y - r, x + r, y + r), fill=(128, 78, 43, 165))
    d.ellipse((size * 0.23, size * 0.78, size * 0.39, size * 0.95), fill=(90, 52, 58, 255), outline=o, width=max(3, size // 50))
    d.ellipse((size * 0.61, size * 0.78, size * 0.77, size * 0.95), fill=(90, 52, 58, 255), outline=o, width=max(3, size // 50))
    return img


def make_state_gif(frames: list[Image.Image], path: Path, size: tuple[int, int], duration: int) -> None:
    canvases = []
    for frame in frames:
        canvas = Image.new("RGBA", size, (0, 0, 0, 0))
        paste_center(canvas, fit(frame, height=round(size[1] * 0.74)), (size[0] // 2, round(size[1] * 0.56)))
        canvases.append(canvas)
    canvases[0].save(path, save_all=True, append_images=canvases[1:], duration=duration, loop=0, disposal=2)


def draw_label(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str) -> None:
    x, y = xy
    draw.rounded_rectangle((x, y, x + 128, y + 34), radius=12, fill=(22, 24, 28, 210))
    draw.text((x + 12, y + 9), text, fill=(245, 238, 221, 255))


def build_rosie_animation_pack() -> None:
    cell = 260
    sheet = Image.new("RGBA", (cell * 4, cell * len(ROSIE_STATES)), (0, 0, 0, 0))
    contact = Image.new("RGBA", (cell * 4, cell * len(ROSIE_STATES)), (20, 22, 26, 255))
    contact_draw = ImageDraw.Draw(contact, "RGBA")

    for row, state in enumerate(ROSIE_STATES):
        frames = []
        for col in range(4):
            raw = open_rgba(ROOT / "assets" / "images" / "sprites" / "rosie" / f"{state}_{col + 1}.png")
            frame = fit(clean_rosie_frame(raw, state), height=205)
            frames.append(frame)
            center = (cell * col + cell // 2, cell * row + 148)
            paste_center(sheet, frame, center)
            paste_center(contact, frame, center)
        draw_label(contact_draw, (14, cell * row + 14), state)
        make_state_gif(frames, SPRITES / f"rosie_{state}_preview_v1.gif", (320, 320), 125)

    sheet.save(SPRITES / "rosie_all_states_sheet_v1.png")
    contact.save(SPRITES / "rosie_all_states_contact_v1.png")


def hunger_variant(base: Image.Image, height: int, tilt: float = 0, squash: float = 1.0, mirror: bool = False) -> Image.Image:
    frame = fit(base, height=height)
    if abs(squash - 1.0) > 0.001:
        frame = frame.resize((frame.width, max(1, round(frame.height * squash))), Image.LANCZOS)
    if mirror:
        frame = frame.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    if tilt:
        frame = frame.rotate(tilt, resample=Image.BICUBIC, expand=True)
    return frame


def draw_gold_burp(size: tuple[int, int], direction: int = 1) -> Image.Image:
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer, "RGBA")
    sx = 168 if direction > 0 else size[0] - 168
    ex = size[0] - 40 if direction > 0 else 40
    sy = 136
    for i in range(22):
        t = i / 21
        x = sx * (1 - t) + ex * t
        y = sy + math.sin(t * math.pi * 3) * 18
        r = 24 - round(t * 15)
        draw.ellipse((x - r, y - r, x + r, y + r), fill=(255, 210, 48, round(180 * (1 - t * 0.45))))
    return layer.filter(ImageFilter.GaussianBlur(0.8))


def build_hunger_action_pack(hunger: Image.Image) -> None:
    cell = 340
    states = ("idle", "waddle", "gloat", "slurp")
    sheet = Image.new("RGBA", (cell * 4, cell * len(states)), (0, 0, 0, 0))
    contact = Image.new("RGBA", sheet.size, (20, 22, 26, 255))
    contact_draw = ImageDraw.Draw(contact, "RGBA")

    action_frames: dict[str, list[Image.Image]] = {}
    action_frames["idle"] = [
        hunger_variant(hunger, 282, tilt, squash)
        for tilt, squash in [(-1.5, 1.0), (1, 0.96), (-0.5, 1.03), (1.5, 0.98)]
    ]
    action_frames["waddle"] = [
        hunger_variant(hunger, height, tilt, squash)
        for height, tilt, squash in [(285, -8, 1.0), (302, 3, 0.94), (288, 7, 1.02), (300, -3, 0.95)]
    ]
    action_frames["gloat"] = []
    for idx, (height, tilt, squash) in enumerate([(292, -7, 0.98), (310, -2, 1.02), (300, 5, 0.96), (318, 8, 1.03)]):
        frame_canvas = Image.new("RGBA", (cell, cell), (0, 0, 0, 0))
        d = ImageDraw.Draw(frame_canvas, "RGBA")
        glow_alpha = [55, 90, 130, 85][idx]
        d.ellipse((56, 224, 296, 322), fill=(255, 191, 37, glow_alpha))
        for mote in range(24):
            random.seed(idx * 100 + mote)
            x = random.randint(42, 310)
            y = random.randint(170, 316)
            r = random.randint(3, 8)
            d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 215, 68, random.randint(80, 190)))
        paste_center(frame_canvas, hunger_variant(hunger, height, tilt, squash), (176, 174 + [8, -8, 2, -10][idx]))
        action_frames["gloat"].append(frame_canvas)
    slurp_frames = []
    for idx, (tilt, squash) in enumerate([(-2, 1.0), (1, 0.98), (-1, 1.02), (2, 0.99)]):
        frame_canvas = Image.new("RGBA", (cell, cell), (0, 0, 0, 0))
        stream = draw_gold_burp((cell, cell), direction=1)
        frame_canvas.alpha_composite(stream)
        frame_canvas.alpha_composite(stream.rotate([0, -10, 8, -4][idx], resample=Image.BICUBIC))
        paste_center(frame_canvas, hunger_variant(hunger, 286 + [0, 16, 6, 20][idx], tilt, squash), (178, 184 + [0, -10, 2, 8][idx]))
        slurp_frames.append(frame_canvas)
    action_frames["slurp"] = slurp_frames

    for row, state in enumerate(states):
        for col, frame in enumerate(action_frames[state]):
            if state == "slurp":
                draw_frame = frame
                center = (cell * col, cell * row)
                sheet.alpha_composite(draw_frame, center)
                contact.alpha_composite(draw_frame, center)
            else:
                center = (cell * col + cell // 2, cell * row + 180 + [0, -7, 0, 6][col])
                paste_center(sheet, frame, center)
                paste_center(contact, frame, center)
        draw_label(contact_draw, (14, cell * row + 14), state)
        make_state_gif(action_frames[state], SPRITES / f"great_hunger_{state}_preview_v2.gif", (380, 380), 145)

    sheet.save(SPRITES / "great_hunger_action_sheet_v2.png")
    contact.save(SPRITES / "great_hunger_action_contact_v2.png")


def build_sprites(rosie: Image.Image, hunger: Image.Image) -> None:
    SPRITES.mkdir(parents=True, exist_ok=True)
    build_rosie_animation_pack()
    build_hunger_action_pack(hunger)

    cell = 320
    sheet_size = (cell * 4, cell * 4)
    rosie_sheet = Image.new("RGBA", sheet_size, GREEN)
    hunger_sheet = Image.new("RGBA", sheet_size, GREEN)

    rosie_walk_paths = [ROOT / "assets" / "images" / "sprites" / "rosie" / f"walk_{i}.png" for i in range(1, 5)]
    rosie_walk = [fit(open_rgba(path), height=245) for path in rosie_walk_paths]
    rosie_back = fit(draw_back_rosie(260), height=245)

    for col, frame in enumerate(rosie_walk):
        offsets = [0, -8, 0, 8]
        paste_center(rosie_sheet, frame, (cell * col + cell // 2, cell * 0 + 172 + offsets[col]))
        paste_center(rosie_sheet, frame, (cell * col + cell // 2, cell * 1 + 172 + offsets[col]))
        paste_center(rosie_sheet, frame.transpose(Image.Transpose.FLIP_LEFT_RIGHT), (cell * col + cell // 2, cell * 2 + 172 + offsets[col]))
        back = rosie_back.rotate([-3, 2, 3, -2][col], resample=Image.BICUBIC, expand=True)
        paste_center(rosie_sheet, back, (cell * col + cell // 2, cell * 3 + 172 + offsets[col]))

    hunger_front = fit(hunger, height=285)
    hunger_back = fit(draw_back_hunger(300), height=285)
    for col in range(4):
        bob = [0, -8, 0, 8][col]
        tilt = [-2, 2, -1, 1][col]
        front = hunger_front.rotate(tilt, resample=Image.BICUBIC, expand=True)
        left = hunger_front.rotate(tilt - 2, resample=Image.BICUBIC, expand=True)
        right = left.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        back = hunger_back.rotate(-tilt, resample=Image.BICUBIC, expand=True)
        paste_center(hunger_sheet, front, (cell * col + cell // 2, cell * 0 + 170 + bob))
        paste_center(hunger_sheet, left, (cell * col + cell // 2, cell * 1 + 170 + bob))
        paste_center(hunger_sheet, right, (cell * col + cell // 2, cell * 2 + 170 + bob))
        paste_center(hunger_sheet, back, (cell * col + cell // 2, cell * 3 + 170 + bob))

    rosie_sheet.save(SPRITES / "rosie_walk_turnaround_v1_chromakey.png")
    hunger_sheet.save(SPRITES / "great_hunger_walk_turnaround_v2_chromakey.png")

    rosie_gif_frames = []
    for frame in rosie_walk:
        canvas = Image.new("RGBA", (320, 320), (0, 0, 0, 0))
        paste_center(canvas, frame, (160, 178))
        rosie_gif_frames.append(canvas)
    rosie_gif_frames[0].save(
        SPRITES / "rosie_front_walk_preview_v1.gif",
        save_all=True,
        append_images=rosie_gif_frames[1:],
        duration=130,
        loop=0,
        disposal=2,
    )

    hunger_gif_frames = []
    for col in range(4):
        canvas = Image.new("RGBA", (360, 360), (0, 0, 0, 0))
        bob = [0, -8, 0, 8][col]
        tilt = [-2, 2, -1, 1][col]
        frame = fit(hunger, height=305).rotate(tilt, resample=Image.BICUBIC, expand=True)
        paste_center(canvas, frame, (180, 185 + bob))
        hunger_gif_frames.append(canvas)
    hunger_gif_frames[0].save(
        SPRITES / "great_hunger_front_waddle_preview_v2.gif",
        save_all=True,
        append_images=hunger_gif_frames[1:],
        duration=150,
        loop=0,
        disposal=2,
    )


def build_storyboard(rosie: Image.Image, hunger: Image.Image) -> None:
    STORY.mkdir(parents=True, exist_ok=True)
    rosie_idle = fit(rosie, height=430)
    rosie_tired = fit(open_rgba(ROOT / "assets" / "images" / "sprites" / "rosie" / "tired_1.png"), height=420)
    rosie_sad = fit(open_rgba(ROOT / "assets" / "images" / "sprites" / "rosie" / "sad_1.png"), height=360)
    rosie_surprise = fit(open_rgba(ROOT / "assets" / "images" / "sprites" / "rosie" / "surprise_1.png"), height=410)
    rosie_back = fit(draw_back_rosie(340), height=285)
    hunger_large = fit(hunger, height=760)
    hunger_mid = fit(hunger, height=620)

    # 1
    img = load_bg("golden_mire_bg.png")
    d = ImageDraw.Draw(img, "RGBA")
    draw_motes(d, 340, 1, spread=0.88)
    img.save(STORY / "shot_01_valley_of_tickles.png")

    # 2
    img = load_bg("golden_mire_bg.png")
    d = ImageDraw.Draw(img, "RGBA")
    img = tint(img, (255, 234, 185), 0.1)
    d = ImageDraw.Draw(img, "RGBA")
    draw_motes(d, 55, 2, spread=0.62)
    d.rounded_rectangle((180, 725, 900, 1485), radius=170, fill=(129, 75, 60, 235), outline=(54, 38, 35, 255), width=18)
    d.polygon([(135, 800), (540, 520), (945, 800)], fill=(92, 52, 50, 245), outline=(54, 38, 35, 255))
    d.rounded_rectangle((300, 850, 780, 1485), radius=155, fill=(255, 203, 88, 180), outline=(54, 38, 35, 230), width=11)
    sleeping = rosie_tired.rotate(-10, resample=Image.BICUBIC, expand=True)
    paste_center(img, sleeping, (520, 1230))
    # Quilt covers the lower body but leaves Rosie's sleepy face readable.
    d.polygon([(270, 1255), (760, 1225), (805, 1490), (285, 1515)], fill=(135, 103, 169, 222), outline=(60, 43, 67, 205))
    for x in range(330, 780, 90):
        d.line((x, 1244, x - 40, 1502), fill=(248, 207, 106, 145), width=7)
    d.polygon([(W + 40, 1015), (842, 1158), (W + 40, 1385)], fill=(36, 31, 36, 76))
    img.save(STORY / "shot_02_rosie_asleep.png")

    # 3
    img = load_bg("bog_dusk_bg.png")
    d = ImageDraw.Draw(img, "RGBA")
    d.ellipse((-140, 1260, W + 260, 2090), fill=(70, 92, 72, 210))
    tiptoe = hunger_large.rotate(-4, resample=Image.BICUBIC, expand=True)
    paste_center(img, tiptoe, (580, 1160))
    d.ellipse((150, 150, 270, 270), fill=(251, 235, 179, 210))
    img.save(STORY / "shot_03_hunger_arrives.png")

    # 4
    img = load_bg("bog_dusk_bg.png")
    d = ImageDraw.Draw(img, "RGBA")
    draw_barn(d, (90, 1005), 1.25, lit=False)
    draw_gold_stream(img, (315, 1100), (705, 980))
    paste_center(img, hunger_mid, (730, 1110))
    img.save(STORY / "shot_04_the_theft.png")

    # 5
    img = load_bg("reed_marsh_bg.png", grey=True)
    d = ImageDraw.Draw(img, "RGBA")
    d.rounded_rectangle((190, 690, 890, 1490), radius=165, fill=(93, 93, 91, 220), outline=(54, 54, 52, 230), width=16)
    d.polygon([(145, 775), (540, 525), (935, 775)], fill=(71, 72, 73, 235), outline=(54, 54, 52, 230))
    d.rounded_rectangle((315, 840, 765, 1490), radius=145, fill=(126, 132, 136, 115), outline=(64, 68, 72, 180), width=10)
    paste_center(img, rosie_surprise, (540, 1220))
    d.ellipse((475, 895, 615, 1035), fill=(120, 128, 134, 105), outline=(95, 100, 105, 135), width=6)
    d.polygon([(330, 1288), (670, 1260), (706, 1435), (350, 1470)], fill=(128, 112, 148, 165), outline=(62, 58, 72, 135))
    img.save(STORY / "shot_05_grey_dawn.png")

    # 6
    img = load_bg("golden_mire_bg.png", grey=True)
    d = ImageDraw.Draw(img, "RGBA")
    draw_motes(d, 20, 6, grey=True, spread=0.86)
    for cx in (180, 870, 720):
        pig = fit(rosie_sad, height=120)
        pig = tint(desaturate(pig, 0.75), (118, 129, 139), 0.2)
        paste_center(img, pig, (cx, random.randint(1010, 1190)))
    paste_center(img, rosie_sad, (540, 1320))
    d.ellipse((505, 1520, 575, 1562), fill=(95, 101, 106, 160))
    img.save(STORY / "shot_06_empty_valley.png")

    # 7
    img = load_bg("golden_mire_bg.png", grey=True)
    d = ImageDraw.Draw(img, "RGBA")
    d.polygon([(0, 1325), (430, 965), (W, 1235), (W, H), (0, H)], fill=(58, 69, 76, 230))
    for i in range(155):
        random.seed(70 + i)
        x = random.randint(570, 990)
        y = random.randint(760, 1135)
        r = random.randint(10, 34)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 202, 49, random.randint(120, 225)))
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow, "RGBA")
    gd.ellipse((475, 610, 1060, 1240), fill=(255, 179, 29, 72))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(42)))
    paste_center(img, fit(hunger, height=430), (760, 820))
    paste_center(img, rosie_back, (275, 1555))
    img.save(STORY / "shot_07_hunger_begins.png")

    names = [
        "shot_01_valley_of_tickles.png",
        "shot_02_rosie_asleep.png",
        "shot_03_hunger_arrives.png",
        "shot_04_the_theft.png",
        "shot_05_grey_dawn.png",
        "shot_06_empty_valley.png",
        "shot_07_hunger_begins.png",
    ]
    thumbs = [fit(open_rgba(STORY / name), height=360) for name in names]
    contact = Image.new("RGBA", (thumbs[0].width * 7, 360), (26, 28, 31, 255))
    for i, thumb in enumerate(thumbs):
        contact.alpha_composite(thumb, (i * thumb.width, 0))
    contact.save(STORY / "storyboard_contact_sheet_v1.png")


def main() -> None:
    if not ROSIE_REF.exists():
        raise FileNotFoundError(ROSIE_REF)
    if not HUNGER_REF.exists():
        raise FileNotFoundError(HUNGER_REF)
    STORY.mkdir(parents=True, exist_ok=True)
    SPRITES.mkdir(parents=True, exist_ok=True)

    rosie = open_rgba(ROSIE_REF)
    hunger = remove_light_checker(open_rgba(HUNGER_REF))
    hunger.save(OUT / "great_hunger_mean_reference_cutout_v2.png")
    hunger.save(OUT / "great_hunger_reference_cutout_v1.png")
    build_sprites(rosie, hunger)
    build_storyboard(rosie, hunger)

    manifest = OUT / "generated_storyboard_manifest_v1.md"
    manifest.write_text(
        "# Great Hunger storyboard composite manifest\n\n"
        "Generated by `scripts/build_great_hunger_storyboard.py` from real project art.\n\n"
        f"- Rosie reference: `{ROSIE_REF}`\n"
        f"- Hunger reference: `{HUNGER_REF}` (meaner crowned-hog version)\n"
        "- Storyboard output: `assets/concepts/great-hungerer/storyboard/`\n"
        "- Sprite output: `assets/concepts/great-hungerer/sprites/`\n"
        "- Rosie animation pack: `rosie_all_states_sheet_v1.png`, `rosie_all_states_contact_v1.png`, "
        "and `rosie_{idle,happy,sad,surprise,tired,jump,walk,wave}_preview_v1.gif`. "
        "`happy` and `surprise` exports remove the source floor ovals without modifying shipped source sprites.\n"
        "- Hunger animation pack: `great_hunger_action_sheet_v2.png`, `great_hunger_action_contact_v2.png`, "
        "and `great_hunger_{idle,waddle,gloat,slurp}_preview_v2.gif`. "
        "The generated rear/turnaround sheet is rejected for production and should not be used as an animation target.\n"
        "- Note: these are first-pass composited production placeholders. The prompt pack in "
        "`docs/great-hunger-opening-production.md` remains the source for higher-fidelity AI reruns.\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()

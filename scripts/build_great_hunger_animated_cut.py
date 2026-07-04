#!/usr/bin/env python3
"""Build the Great Hunger opening from generated panels and animated frames."""

from __future__ import annotations

import json
import hashlib
import math
import os
import random
import shutil
import subprocess
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "concepts" / "great-hungerer"
PANELS = OUT / "generated_panels"
VIDEO = OUT / "video"
GENERATED_SOURCES = OUT / "generated_sources"
TMP = ROOT / "tmp" / "great-hunger-animated-cut"
FRAMES = TMP / "frames"

WIDTH = 1080
HEIGHT = 1920
FPS = 12
VOICE = "Samantha"
VOICE_RATE = "142"
ELEVENLABS_DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"
ELEVENLABS_DEFAULT_MODEL_ID = "eleven_multilingual_v2"
CTA_DURATION = 1.8
CTA_AUDIO_OVERLAP = 0.55
APP_NAME = "Tickle the Pig"
APP_ICON = ROOT / "assets" / "images" / "icon.png"
CTA_TITLE = "Season 2: The Great Hunger"
CTA_SUBTITLE = "Help bring back the joy."
CTA_LINES = ("The Mud Wars begin July 11.", "On the App Store")
CTA_BUTTON = "Play on the App Store"
CTA_CAPTION = "Season 2 begins July 11. Help Rosie bring back the joy."
BASE_STORY_DURATIONS = [4.0, 2.35, 2.8, 3.5, 3.65, 2.35, 4.05]


@dataclass(frozen=True)
class Shot:
    source: Path
    slug: str
    title: str
    target_duration: float
    narration: str
    motion: str
    panel_name: str
    effect: str
    zoom: tuple[float, float]
    pan: tuple[float, float]


SHOTS = [
    Shot(
        source=Path("/Users/bbroeking/Downloads/Generated image 1.png"),
        slug="shot_01_valley_of_tickles",
        title="The Tickle Bloom",
        target_duration=4.0,
        narration="The valley once glowed with tickles, golden sparks of joy in every porch light and puddle.",
        motion="Slow push through golden motes. Warm, drifting, alive.",
        panel_name="shot_01_valley_of_tickles.png",
        effect="warm_motes",
        zoom=(1.0, 1.055),
        pan=(0.0, -54.0),
    ),
    Shot(
        source=Path("/Users/bbroeking/Downloads/Generated image 2.png"),
        slug="shot_02_rosie_asleep",
        title="Rosie's Dream",
        target_duration=4.0,
        narration="Rosie slept through the hush before dawn.",
        motion="Gentle push toward sleeping Rosie. Motes orbit softly.",
        panel_name="shot_02_rosie_asleep.png",
        effect="sleep_motes",
        zoom=(1.0, 1.045),
        pan=(-18.0, -36.0),
    ),
    Shot(
        source=GENERATED_SOURCES / "shot_03_hunger_arrives_closeup.png",
        slug="shot_03_hunger_arrives",
        title="The Crown Blocks The Moon",
        target_duration=4.0,
        narration="Then something crowned and hungry found the glow.",
        motion="Low-angle reveal. Crown crosses the moon.",
        panel_name="shot_03_hunger_arrives.png",
        effect="ominous_glint",
        zoom=(1.0, 1.035),
        pan=(0.0, -26.0),
    ),
    Shot(
        source=Path("/Users/bbroeking/Downloads/Generated image 4.png"),
        slug="shot_04_the_theft",
        title="The Great Slurp",
        target_duration=6.0,
        narration="The Great Hunger opened wide, and the tickles streamed from every home.",
        motion="Wide spiral of golden motes pulled from barns and flowers into the Hunger.",
        panel_name="shot_04_the_theft.png",
        effect="slurp_streams",
        zoom=(1.0, 1.065),
        pan=(0.0, -72.0),
    ),
    Shot(
        source=Path("/Users/bbroeking/Downloads/Generated image 5.png"),
        slug="shot_05_grey_dawn",
        title="The Last Tickle",
        target_duration=4.0,
        narration="By morning, the color was gone. One last spark reached Rosie, then slipped away.",
        motion="Rosie reaches. The last mote flickers from gold to grey.",
        panel_name="shot_05_grey_dawn.png",
        effect="last_tickle",
        zoom=(1.0, 1.035),
        pan=(24.0, -22.0),
    ),
    Shot(
        source=Path("/Users/bbroeking/Downloads/Generated image 6.png"),
        slug="shot_06_empty_valley",
        title="The Quiet Valley",
        target_duration=4.0,
        narration="The whole valley had gone quiet.",
        motion="Slow pan across opened barns and sad pigs.",
        panel_name="shot_06_empty_valley.png",
        effect="grey_drift",
        zoom=(1.0, 1.025),
        pan=(36.0, -16.0),
    ),
    Shot(
        source=Path("/Users/bbroeking/Downloads/Generated image 7.png"),
        slug="shot_07_hunger_begins",
        title="The Hoard On The Hill",
        target_duration=4.5,
        narration="High on the hill, he kept what he stole. Now Rosie needs everyone to win the joy back.",
        motion="Rosie from behind. Distant hoard glows. End unresolved.",
        panel_name="shot_07_hunger_begins.png",
        effect="hoard_glow",
        zoom=(1.0, 1.045),
        pan=(0.0, -38.0),
    ),
]


def run(args: list[str]) -> None:
    subprocess.run(args, check=True)


def load_env_files() -> None:
    for env_file in (ROOT / ".env", ROOT / ".env.local"):
        if not env_file.exists():
            continue
        for raw_line in env_file.read_text(errors="ignore").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            os.environ.setdefault(key, value)


def elevenlabs_api_key() -> str | None:
    return os.environ.get("ELEVENLABS_API_KEY") or os.environ.get("ELEVEN_LABS_API_KEY")


def ffprobe_duration(path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "json",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(json.loads(result.stdout)["format"]["duration"])


def smoothstep(t: float) -> float:
    return t * t * (3.0 - 2.0 * t)


def copy_panels() -> None:
    PANELS.mkdir(parents=True, exist_ok=True)
    for shot in SHOTS:
        if not shot.source.exists():
            raise FileNotFoundError(shot.source)
        shutil.copyfile(shot.source, PANELS / shot.panel_name)


def cover_frame(base: Image.Image, shot: Shot, t: float) -> Image.Image:
    eased = smoothstep(t)
    zoom = shot.zoom[0] + (shot.zoom[1] - shot.zoom[0]) * eased
    scale = max(WIDTH / base.width, HEIGHT / base.height) * zoom
    scaled = base.resize((math.ceil(base.width * scale), math.ceil(base.height * scale)), Image.Resampling.LANCZOS)

    max_x = max(0, scaled.width - WIDTH)
    max_y = max(0, scaled.height - HEIGHT)
    x = max_x / 2 + shot.pan[0] * (eased - 0.5)
    y = max_y / 2 + shot.pan[1] * (eased - 0.5)
    x = min(max(0, x), max_x)
    y = min(max(0, y), max_y)
    return scaled.crop((round(x), round(y), round(x) + WIDTH, round(y) + HEIGHT)).convert("RGBA")


def add_vignette(frame: Image.Image, opacity: int = 72) -> None:
    mask = Image.new("L", (WIDTH, HEIGHT), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((-WIDTH * 0.22, -HEIGHT * 0.12, WIDTH * 1.22, HEIGHT * 1.08), fill=255)
    mask = ImageOps.invert(mask.filter(ImageFilter.GaussianBlur(110)))
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, opacity))
    frame.alpha_composite(Image.composite(overlay, Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0)), mask))


def add_glow_dot(draw: ImageDraw.ImageDraw, x: float, y: float, r: float, alpha: int, color=(255, 195, 50)) -> None:
    for scale, a_mul in ((3.2, 0.14), (2.0, 0.24), (1.0, 0.92)):
        rr = r * scale
        draw.ellipse(
            (x - rr, y - rr, x + rr, y + rr),
            fill=(color[0], color[1], color[2], max(0, min(255, round(alpha * a_mul)))),
        )


def add_warm_motes(frame: Image.Image, t: float, seed: int, count: int = 90) -> None:
    rng = random.Random(seed)
    overlay = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    for _ in range(count):
        x = rng.uniform(-60, WIDTH + 60)
        y0 = rng.uniform(-60, HEIGHT + 80)
        speed = rng.uniform(18, 90)
        wobble = rng.uniform(8, 34)
        phase = rng.uniform(0, math.tau)
        y = (y0 - t * speed) % (HEIGHT + 120) - 60
        x += math.sin(t * math.tau + phase) * wobble
        pulse = 0.52 + 0.48 * math.sin((t * rng.uniform(2.0, 5.2) + phase) * math.tau)
        r = rng.uniform(1.2, 5.8)
        add_glow_dot(draw, x, y, r, round(95 + pulse * 150))
    frame.alpha_composite(overlay.filter(ImageFilter.GaussianBlur(0.35)))


def add_sleep_motes(frame: Image.Image, t: float) -> None:
    overlay = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    center_x, center_y = 620, 820
    for i in range(12):
        angle = t * math.tau * 0.75 + i * math.tau / 12
        x = center_x + math.cos(angle) * (280 + 10 * math.sin(i))
        y = center_y + math.sin(angle * 0.78) * 180 + i * 8
        add_glow_dot(draw, x, y, 4 + (i % 3), 130 + round(60 * math.sin(angle) ** 2))
    frame.alpha_composite(overlay.filter(ImageFilter.GaussianBlur(0.25)))


def add_ominous_glint(frame: Image.Image, t: float) -> None:
    overlay = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    alpha = round(80 + 90 * math.sin(t * math.tau * 2.0) ** 2)
    draw.line((420, 206, 676, 206), fill=(255, 223, 114, alpha), width=3)
    draw.line((548, 110, 548, 292), fill=(255, 223, 114, alpha), width=2)
    add_glow_dot(draw, 548, 206, 12, alpha)
    frame.alpha_composite(overlay.filter(ImageFilter.GaussianBlur(1.0)))
    add_vignette(frame, 92)


def add_slurp_streams(frame: Image.Image, t: float) -> None:
    overlay = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    target = (610, 445)
    for strand in range(9):
        phase = strand / 9
        points = []
        for step in range(34):
            p = step / 33
            x = WIDTH * (0.04 + 0.92 * p)
            y = HEIGHT * (0.82 - 0.58 * p)
            y += math.sin((p * 3.0 + phase + t * 1.8) * math.tau) * (58 - p * 30)
            x += math.sin((p * 1.5 + phase) * math.tau) * 54
            pull = p**2
            x = x * (1 - pull * 0.28) + target[0] * pull * 0.28
            y = y * (1 - pull * 0.28) + target[1] * pull * 0.28
            points.append((x, y))
        draw.line(points, fill=(255, 188, 24, 86), width=8)
        draw.line(points, fill=(255, 235, 110, 150), width=3)
    add_warm_motes(overlay, t, 4404, count=45)
    frame.alpha_composite(overlay.filter(ImageFilter.GaussianBlur(0.35)))


def add_last_tickle(frame: Image.Image, t: float) -> None:
    overlay = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    fade = max(0.0, 1.0 - smoothstep(t) * 1.15)
    x = 695 + math.sin(t * math.tau) * 18
    y = 925 - t * 72
    add_glow_dot(draw, x, y, 9, round(230 * fade))
    for i in range(20):
        ang = i * math.tau / 20 + t * 1.4
        rr = 22 + 40 * t
        add_glow_dot(draw, x + math.cos(ang) * rr, y + math.sin(ang) * rr, 1.5, round(110 * fade))
    frame.alpha_composite(overlay.filter(ImageFilter.GaussianBlur(0.45)))
    if t > 0.62:
        grey = ImageEnhance.Color(frame.convert("RGB")).enhance(1.0 - (t - 0.62) * 1.15).convert("RGBA")
        frame.paste(grey)


def add_grey_drift(frame: Image.Image, t: float) -> None:
    overlay = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    for i in range(34):
        x = (i * 97 + t * 42) % (WIDTH + 120) - 60
        y = (i * 211 - t * 76) % (HEIGHT + 120) - 60
        r = 1.0 + (i % 4) * 0.5
        draw.ellipse((x - r, y - r, x + r, y + r), fill=(215, 215, 215, 32))
    frame.alpha_composite(overlay.filter(ImageFilter.GaussianBlur(1.4)))
    add_vignette(frame, 78)


def add_hoard_glow(frame: Image.Image, t: float) -> None:
    overlay = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    pulse = 0.65 + 0.35 * math.sin(t * math.tau * 1.25) ** 2
    for r, alpha in ((240, 28), (150, 48), (76, 72)):
        draw.ellipse((535 - r, 470 - r * 0.36, 535 + r, 470 + r * 0.36), fill=(255, 194, 35, round(alpha * pulse)))
    add_warm_motes(overlay, t, 7707, count=28)
    frame.alpha_composite(overlay.filter(ImageFilter.GaussianBlur(0.55)))
    add_vignette(frame, 88)


def apply_effect(frame: Image.Image, shot: Shot, t: float) -> Image.Image:
    if shot.effect == "warm_motes":
        add_warm_motes(frame, t, 1001, count=115)
    elif shot.effect == "sleep_motes":
        add_sleep_motes(frame, t)
    elif shot.effect == "ominous_glint":
        add_ominous_glint(frame, t)
    elif shot.effect == "slurp_streams":
        add_slurp_streams(frame, t)
    elif shot.effect == "last_tickle":
        add_last_tickle(frame, t)
    elif shot.effect == "grey_drift":
        add_grey_drift(frame, t)
    elif shot.effect == "hoard_glow":
        add_hoard_glow(frame, t)
    return frame.convert("RGB")


def build_macos_voiceover(index: int, text: str) -> Path:
    audio = TMP / f"shot_{index:02d}.aiff"
    run(["say", "-v", VOICE, "-r", VOICE_RATE, "-o", str(audio), text])
    return audio


def build_elevenlabs_voiceover(index: int, text: str, previous_text: str, next_text: str) -> Path:
    api_key = elevenlabs_api_key()
    if not api_key:
        raise RuntimeError("ELEVENLABS_API_KEY is required for ElevenLabs voiceover")

    voice_id = os.environ.get("ELEVENLABS_VOICE_ID", ELEVENLABS_DEFAULT_VOICE_ID)
    model_id = os.environ.get("ELEVENLABS_MODEL_ID", ELEVENLABS_DEFAULT_MODEL_ID)
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128"
    payload = {
        "text": text,
        "model_id": model_id,
        "voice_settings": {
            "stability": 0.58,
            "similarity_boost": 0.82,
            "style": 0.18,
            "use_speaker_boost": True,
        },
        "previous_text": previous_text,
        "next_text": next_text,
    }
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"xi-api-key": api_key, "Content-Type": "application/json"},
        method="POST",
    )
    text_hash = hashlib.sha1(text.encode("utf-8")).hexdigest()[:10]
    audio = TMP / f"shot_{index:02d}_elevenlabs_{text_hash}.mp3"
    if audio.exists() and not os.environ.get("FORCE_ELEVENLABS_REGEN"):
        return audio
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            audio.write_bytes(response.read())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"ElevenLabs request failed with HTTP {exc.code}: {body}") from exc
    return audio


def build_voiceover(index: int, text: str, previous_text: str, next_text: str, provider: str) -> Path:
    if provider == "elevenlabs":
        return build_elevenlabs_voiceover(index, text, previous_text, next_text)
    return build_macos_voiceover(index, text)


def full_narration_text() -> str:
    return "\n\n".join(shot.narration for shot in SHOTS)


def build_silent_audio(index: int, duration: float) -> Path:
    audio = TMP / f"shot_{index:02d}_silence.wav"
    run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "anullsrc=channel_layout=mono:sample_rate=44100",
            "-t",
            f"{duration:.3f}",
            "-c:a",
            "pcm_s16le",
            str(audio),
        ]
    )
    return audio


def planned_story_durations(audio_duration: float) -> list[float]:
    durations = list(BASE_STORY_DURATIONS)
    current_total = sum(durations)
    needed_total = max(audio_duration - CTA_AUDIO_OVERLAP, current_total * 0.8)
    scale = needed_total / current_total
    return [duration * scale for duration in durations]


def render_frames(index: int, shot: Shot, duration: float) -> tuple[Path, int]:
    shot_dir = FRAMES / f"shot_{index:02d}"
    if shot_dir.exists():
        shutil.rmtree(shot_dir)
    shot_dir.mkdir(parents=True, exist_ok=True)

    base = Image.open(PANELS / shot.panel_name).convert("RGB")
    frame_count = max(1, math.ceil(duration * FPS))
    for frame_index in range(frame_count):
        t = frame_index / max(1, frame_count - 1)
        frame = cover_frame(base, shot, t)
        frame = apply_effect(frame, shot, t)
        draw_bottom_caption(frame, shot.narration)
        frame.save(shot_dir / f"frame_{frame_index + 1:04d}.jpg", quality=92, optimize=True)
    return shot_dir, frame_count


def collect_frame_sequence(frame_dirs: list[Path], out_dir: Path) -> int:
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    output_index = 1
    for frame_dir in frame_dirs:
        for frame in sorted(frame_dir.glob("frame_*.jpg")):
            shutil.copyfile(frame, out_dir / f"frame_{output_index:05d}.jpg")
            output_index += 1
    return output_index - 1


def build_full_video(frame_dirs: list[Path], audio: Path, out_path: Path, audio_duration: float) -> tuple[float, int]:
    sequence_dir = FRAMES / "full_sequence"
    frame_count = collect_frame_sequence(frame_dirs, sequence_dir)
    duration = frame_count / FPS
    run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "warning",
            "-y",
            "-framerate",
            str(FPS),
            "-i",
            str(sequence_dir / "frame_%05d.jpg"),
            "-i",
            str(audio),
            "-t",
            f"{duration:.3f}",
            "-af",
            f"afade=t=out:st={max(0.0, audio_duration - 0.42):.3f}:d=0.42,apad",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "160k",
            "-ar",
            "44100",
            "-ac",
            "1",
            "-movflags",
            "+faststart",
            str(out_path),
        ]
    )
    return duration, frame_count


def load_font(size: int, *, bold: bool = False) -> ImageFont.ImageFont:
    names = [
        "/System/Library/Fonts/Supplemental/Avenir Next.ttc",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
    ]
    for name in names:
        path = Path(name)
        if path.exists():
            try:
                return ImageFont.truetype(str(path), size=size)
            except OSError:
                continue
    return ImageFont.load_default()


def draw_centered_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    y: int,
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int, int],
    stroke_fill: tuple[int, int, int, int] = (0, 0, 0, 190),
    stroke_width: int = 3,
) -> int:
    bbox = draw.textbbox((0, 0), text, font=font, stroke_width=stroke_width)
    x = round((WIDTH - (bbox[2] - bbox[0])) / 2)
    draw.text((x, y), text, font=font, fill=fill, stroke_width=stroke_width, stroke_fill=stroke_fill)
    return bbox[3] - bbox[1]


def draw_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int, int],
    stroke_fill: tuple[int, int, int, int] = (0, 0, 0, 180),
    stroke_width: int = 0,
) -> None:
    draw.text(xy, text, font=font, fill=fill, stroke_width=stroke_width, stroke_fill=stroke_fill)


def rounded_icon(path: Path, size: int, radius: int) -> Image.Image:
    icon = Image.open(path).convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size, size), radius=radius, fill=255)
    icon.putalpha(mask)
    return icon


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        bbox = draw.textbbox((0, 0), candidate, font=font)
        if bbox[2] - bbox[0] <= max_width or not current:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_bottom_caption(frame: Image.Image, text: str) -> None:
    target_mode = frame.mode
    working = frame if frame.mode == "RGBA" else frame.convert("RGBA")
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    font = load_font(34, bold=True)
    lines = wrap_text(draw, text, font, WIDTH - 150)
    line_h = 42
    block_h = len(lines) * line_h + 38
    x0 = 62
    x1 = WIDTH - 62
    y1 = HEIGHT - 72
    y0 = y1 - block_h
    draw.rounded_rectangle((x0, y0, x1, y1), radius=18, fill=(3, 4, 5, 168), outline=(255, 210, 92, 70), width=2)
    y = y0 + 20
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font, stroke_width=2)
        x = round((WIDTH - (bbox[2] - bbox[0])) / 2)
        draw.text((x, y), line, font=font, fill=(255, 249, 236, 245), stroke_width=2, stroke_fill=(0, 0, 0, 210))
        y += line_h
    working.alpha_composite(overlay)
    if frame.mode != "RGBA":
        frame.paste(working.convert(target_mode))


def render_cta_frames(index: int, duration: float) -> tuple[Path, int]:
    shot_dir = FRAMES / f"shot_{index:02d}_cta"
    if shot_dir.exists():
        shutil.rmtree(shot_dir)
    shot_dir.mkdir(parents=True, exist_ok=True)

    base = Image.open(PANELS / SHOTS[-1].panel_name).convert("RGB")
    title_font = load_font(58, bold=True)
    hero_font = load_font(72, bold=True)
    subtitle_font = load_font(38, bold=True)
    small_font = load_font(29, bold=False)
    button_font = load_font(32, bold=True)
    app_font = load_font(34, bold=True)
    icon = rounded_icon(APP_ICON, 98, 22)
    frame_count = max(1, math.ceil(duration * FPS))

    for frame_index in range(frame_count):
        t = frame_index / max(1, frame_count - 1)
        frame = cover_frame(base, SHOTS[-1], 0.9 + 0.1 * t)
        add_hoard_glow(frame, t)
        dark = Image.new("RGBA", (WIDTH, HEIGHT), (4, 5, 6, 70))
        frame.alpha_composite(dark)
        add_vignette(frame, 108)

        overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay, "RGBA")
        for y in range(0, HEIGHT, 8):
            top_alpha = max(0, 150 - y // 4)
            bottom_alpha = max(0, (y - 1180) // 3)
            alpha = min(180, max(top_alpha, bottom_alpha))
            if alpha:
                draw.rectangle((0, y, WIDTH, y + 8), fill=(2, 3, 4, alpha))

        for i in range(34):
            angle = i * math.tau / 26 + t * 0.9
            x = WIDTH / 2 + math.cos(angle) * (240 + (i % 5) * 34)
            y = 610 + math.sin(angle * 0.76) * (88 + (i % 4) * 18)
            add_glow_dot(draw, x, y, 2.0 + (i % 3), 42 + round(36 * math.sin(angle) ** 2))

        rise = round((1.0 - smoothstep(t)) * 28)
        draw_centered_text(draw, CTA_TITLE.upper(), 110 + rise, title_font, (244, 217, 156, 255), stroke_width=4)
        draw_centered_text(draw, CTA_SUBTITLE, 226 + rise, hero_font, (255, 250, 235, 255), stroke_width=5)
        draw_centered_text(draw, CTA_LINES[0], 340 + rise, subtitle_font, (255, 209, 75, 255), stroke_width=4)

        lockup_w = 760
        lockup_h = 152
        lockup_x = round((WIDTH - lockup_w) / 2)
        lockup_y = 1188
        draw.rounded_rectangle((lockup_x, lockup_y, lockup_x + lockup_w, lockup_y + lockup_h), radius=22, fill=(6, 7, 8, 186), outline=(255, 204, 82, 98), width=2)
        overlay.alpha_composite(icon, (lockup_x + 28, lockup_y + 27))
        draw_text(draw, (lockup_x + 150, lockup_y + 30), APP_NAME, app_font, (255, 250, 240, 255), stroke_fill=(0, 0, 0, 170), stroke_width=2)
        draw_text(draw, (lockup_x + 150, lockup_y + 78), CTA_LINES[1], small_font, (219, 205, 183, 255), stroke_fill=(0, 0, 0, 140), stroke_width=1)

        button_w = 332
        button_h = 58
        button_x = lockup_x + lockup_w - button_w - 28
        button_y = lockup_y + 47
        draw.rounded_rectangle((button_x, button_y, button_x + button_w, button_y + button_h), radius=14, fill=(246, 184, 41, 246), outline=(85, 51, 25, 160), width=2)
        button_bbox = draw.textbbox((0, 0), CTA_BUTTON, font=button_font)
        button_text_x = button_x + round((button_w - (button_bbox[2] - button_bbox[0])) / 2)
        draw_text(draw, (button_text_x, button_y + 13), CTA_BUTTON, button_font, (38, 24, 15, 255))

        draw_centered_text(draw, CTA_CAPTION, 1744, small_font, (248, 241, 224, 238), stroke_width=3)
        frame.alpha_composite(overlay)
        frame.convert("RGB").save(shot_dir / f"frame_{frame_index + 1:04d}.jpg", quality=93, optimize=True)

    return shot_dir, frame_count


def build_clip(index: int, frames_dir: Path, frame_count: int, audio: Path) -> tuple[Path, float]:
    duration = frame_count / FPS
    clip = TMP / f"shot_{index:02d}.mp4"
    run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "warning",
            "-y",
            "-framerate",
            str(FPS),
            "-i",
            str(frames_dir / "frame_%04d.jpg"),
            "-i",
            str(audio),
            "-t",
            f"{duration:.3f}",
            "-af",
            "apad",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "160k",
            "-ar",
            "44100",
            "-ac",
            "1",
            "-movflags",
            "+faststart",
            str(clip),
        ]
    )
    return clip, duration


def shell_quote_for_concat(path: Path) -> str:
    return str(path).replace("'", "'\\''")


def concat_clips(clips: list[Path], out_path: Path) -> None:
    concat = TMP / "concat.txt"
    concat.write_text("".join(f"file '{shell_quote_for_concat(path)}'\n" for path in clips), encoding="utf-8")
    run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "warning",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat),
            "-c",
            "copy",
            "-movflags",
            "+faststart",
            str(out_path),
        ]
    )


def write_manifest(durations: list[float], out_path: Path, provider: str) -> None:
    lines = [
        "# The Great Hunger generated-panel animated cut",
        "",
        f"- Output: `{out_path.relative_to(ROOT)}`",
        f"- Panels: `{PANELS.relative_to(ROOT)}`",
        f"- Frame sequences: `{FRAMES.relative_to(ROOT)}`",
        f"- Frame rate: {FPS} fps",
        f"- Voice provider: {provider}",
        "- Audio mode: continuous narration track",
        f"- ElevenLabs voice id: `{os.environ.get('ELEVENLABS_VOICE_ID', ELEVENLABS_DEFAULT_VOICE_ID)}`" if provider == "elevenlabs" else f"- Voice: macOS {VOICE}, draft timing voice.",
        f"- CTA: {CTA_TITLE} / {' '.join(CTA_LINES)}",
        "",
        "| Shot | Duration | Frames | Panel | Effect | Narration |",
        "|---|---:|---:|---|---|---|",
    ]
    for i, (shot, duration) in enumerate(zip(SHOTS, durations), start=1):
        narration = shot.narration.replace("|", "\\|")
        frame_count = math.ceil(duration * FPS)
        lines.append(f"| {i} | {duration:.1f}s | {frame_count} | `{shot.panel_name}` | {shot.effect} | {narration} |")
    if len(durations) > len(SHOTS):
        frame_count = math.ceil(durations[-1] * FPS)
        lines.append(
            f"| 8 | {durations[-1]:.1f}s | {frame_count} | `{SHOTS[-1].panel_name}` | cta_card | {CTA_TITLE}. {' '.join(CTA_LINES)} |"
        )
    lines.extend(["", "Total runtime: {:.1f}s".format(sum(durations))])
    (OUT / "generated_panel_video_manifest_v1.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    load_env_files()
    provider = "elevenlabs" if elevenlabs_api_key() else "macos"
    required_binaries = ["ffmpeg", "ffprobe"]
    if provider == "macos":
        required_binaries.append("say")
    for binary in required_binaries:
        if not shutil.which(binary):
            raise RuntimeError(f"{binary} is required")

    VIDEO.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)
    FRAMES.mkdir(parents=True, exist_ok=True)
    copy_panels()

    narration = full_narration_text()
    try:
        audio = build_voiceover(0, narration, "", "", provider)
    except RuntimeError as exc:
        if provider != "elevenlabs":
            raise
        print(f"ElevenLabs unavailable, falling back to macOS voice: {exc}")
        provider = "macos"
        if not shutil.which("say"):
            raise RuntimeError("macOS say is required for fallback voiceover") from exc
        audio = build_voiceover(0, narration, "", "", provider)

    audio_duration = ffprobe_duration(audio)
    story_durations = planned_story_durations(audio_duration)
    frame_dirs: list[Path] = []
    durations: list[float] = []
    for index, (shot, duration) in enumerate(zip(SHOTS, story_durations), start=1):
        frames_dir, frame_count = render_frames(index, shot, duration)
        clip_duration = frame_count / FPS
        frame_dirs.append(frames_dir)
        durations.append(clip_duration)
        print(f"{shot.slug}: {frame_count} frames, {clip_duration:.2f}s")

    cta_index = len(SHOTS) + 1
    frames_dir, frame_count = render_cta_frames(cta_index, CTA_DURATION)
    clip_duration = frame_count / FPS
    frame_dirs.append(frames_dir)
    durations.append(clip_duration)
    print(f"shot_08_cta: {frame_count} frames, {clip_duration:.2f}s")

    out_path = VIDEO / "great_hunger_generated_panels_animated_v2.mp4"
    build_full_video(frame_dirs, audio, out_path, audio_duration)
    write_manifest(durations, out_path, provider)
    print(out_path)


if __name__ == "__main__":
    main()

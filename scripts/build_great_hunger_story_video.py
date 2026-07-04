#!/usr/bin/env python3
"""Build a narrated MP4 slideshow for The Great Hunger opening."""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "concepts" / "great-hungerer"
STORY = OUT / "storyboard"
VIDEO = OUT / "video"
TMP = ROOT / "tmp" / "great-hunger-video"

WIDTH = 1080
HEIGHT = 1920
FPS = 30


SHOTS = [
    {
        "image": STORY / "shot_01_valley_of_tickles.png",
        "title": "The Tickle Bloom",
        "duration": 4.0,
        "narration": "Once, the valley glowed with tickles. Little sparks of joy, rising from every puddle, petal, and porch light.",
    },
    {
        "image": STORY / "shot_02_rosie_asleep.png",
        "title": "Rosie's Dream",
        "duration": 4.0,
        "narration": "Rosie dreamed beneath their glow, safe in the hush before morning.",
    },
    {
        "image": STORY / "shot_03_hunger_arrives.png",
        "title": "The Crown Blocks The Moon",
        "duration": 4.0,
        "narration": "But joy has a scent. And far beyond the reeds, something hungry found it.",
    },
    {
        "image": STORY / "shot_04_the_theft.png",
        "title": "The Great Slurp",
        "duration": 6.0,
        "narration": "The Great Hunger opened his mouth, and the whole valley began to dim.",
    },
    {
        "image": STORY / "shot_05_grey_dawn.png",
        "title": "The Last Tickle",
        "duration": 4.0,
        "narration": "By dawn, only one small spark remained. Rosie reached for it, but even that light slipped away.",
    },
    {
        "image": STORY / "shot_06_empty_valley.png",
        "title": "The Quiet Valley",
        "duration": 4.0,
        "narration": "Then she saw the truth. It was not only her barn. Every home had gone quiet.",
    },
    {
        "image": STORY / "shot_07_hunger_begins.png",
        "title": "The Hoard On The Hill",
        "duration": 4.5,
        "narration": "High on the hill, the Hunger kept what he had stolen. And the valley waited for someone brave enough to win it back.",
    },
]


def run(args: list[str]) -> None:
    subprocess.run(args, check=True)


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


def shell_quote_for_concat(path: Path) -> str:
    return str(path).replace("'", "'\\''")


def build_voiceover(index: int, text: str) -> Path:
    audio = TMP / f"shot_{index:02d}.aiff"
    # Samantha is present on stock macOS installs and works well enough for draft timing.
    run(["say", "-v", "Samantha", "-r", "142", "-o", str(audio), text])
    return audio


def build_clip(index: int, shot: dict[str, object], audio: Path) -> tuple[Path, float]:
    image = Path(shot["image"])
    if not image.exists():
        raise FileNotFoundError(image)

    audio_duration = ffprobe_duration(audio)
    duration = max(float(shot["duration"]), audio_duration + 0.45)
    frames = round(duration * FPS)
    clip = TMP / f"shot_{index:02d}.mp4"
    zoom = "zoompan=z='min(zoom+0.00042,1.035)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
    video_filter = (
        f"scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=increase,"
        f"crop={WIDTH}:{HEIGHT},"
        f"{zoom}:d={frames}:s={WIDTH}x{HEIGHT}:fps={FPS},"
        "format=yuv420p"
    )
    run(
        [
            "ffmpeg",
            "-y",
            "-loop",
            "1",
            "-i",
            str(image),
            "-i",
            str(audio),
            "-t",
            f"{duration:.3f}",
            "-vf",
            video_filter,
            "-af",
            "apad",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-c:a",
            "aac",
            "-b:a",
            "160k",
            "-shortest",
            "-movflags",
            "+faststart",
            str(clip),
        ]
    )
    return clip, duration


def concat_clips(clips: list[Path], out_path: Path) -> None:
    concat = TMP / "concat.txt"
    concat.write_text("".join(f"file '{shell_quote_for_concat(path)}'\n" for path in clips), encoding="utf-8")
    run(
        [
            "ffmpeg",
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


def write_metadata(durations: list[float], out_path: Path) -> None:
    lines = [
        "# The Great Hunger story video",
        "",
        f"- Output: `{out_path.relative_to(ROOT)}`",
        "- Voice: macOS Samantha, draft timing voice.",
        "- Final voice target: ElevenLabs pensive storybook narrator.",
        "",
        "| Shot | Duration | Title | Narration |",
        "|---|---:|---|---|",
    ]
    for i, (shot, duration) in enumerate(zip(SHOTS, durations), start=1):
        narration = str(shot["narration"]).replace("|", "\\|")
        lines.append(f"| {i} | {duration:.1f}s | {shot['title']} | {narration} |")
    lines.append("")
    lines.append("Total runtime: {:.1f}s".format(sum(durations)))
    (OUT / "video_story_manifest_v1.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg is required")
    if not shutil.which("ffprobe"):
        raise RuntimeError("ffprobe is required")
    if not shutil.which("say"):
        raise RuntimeError("macOS say is required for the draft voiceover")

    VIDEO.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)

    clips: list[Path] = []
    durations: list[float] = []
    for index, shot in enumerate(SHOTS, start=1):
        audio = build_voiceover(index, str(shot["narration"]))
        clip, duration = build_clip(index, shot, audio)
        clips.append(clip)
        durations.append(duration)

    out_path = VIDEO / "great_hunger_story_v1.mp4"
    concat_clips(clips, out_path)
    write_metadata(durations, out_path)
    print(out_path)


if __name__ == "__main__":
    main()

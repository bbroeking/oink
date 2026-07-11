#!/usr/bin/env python3
"""Generate the Deep Root cozy SFX set via the ElevenLabs sound-generation API.

Reads ELEVENLABS_API_KEY from .env / .env.local (same lookup the Great Hunger
animated-cut script uses). Writes small mp3s to assets/sounds/deeproot/.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "sounds" / "deeproot"
API_URL = "https://api.elevenlabs.io/v1/sound-generation"
# 44.1kHz / 64kbps keeps each clip tiny while staying warm — the whole set
# lands well under the 1.5MB asset budget.
OUTPUT_FORMAT = "mp3_44100_64"


def load_env() -> None:
    for env_file in (ROOT / ".env", ROOT / ".env.local"):
        if not env_file.exists():
            continue
        for raw in env_file.read_text(errors="ignore").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def api_key() -> str | None:
    return os.environ.get("ELEVENLABS_API_KEY") or os.environ.get("ELEVEN_LABS_API_KEY")


# key, prompt, duration_seconds, prompt_influence, loop
SFX = [
    (
        "scrape",
        "Short soft dirt scrape with a small wooden hand-crank ratchet turning, "
        "cozy earthy dig, close-mic, gentle, no music",
        0.7,
        0.4,
        False,
    ),
    (
        "creak",
        "A taut plant root fiber creaking and stretching under tension, organic "
        "woody strain, soft, short, close-mic, no music",
        0.9,
        0.4,
        False,
    ),
    (
        "truffle_pop",
        "A soft earthy dirt pop as a truffle pulls free, followed instantly by a "
        "tiny bright playful coin sparkle chime, joyful cozy reward, no music",
        1.3,
        0.5,
        False,
    ),
    (
        "shimmer",
        "Gentle magical golden shimmer chime, soft twinkling bell sparkle rising, "
        "warm cozy fairy glimmer, short, no music",
        1.1,
        0.45,
        False,
    ),
    (
        "ambience",
        "Gentle seamless loop of soft wind drifting over a misty peat bog, distant "
        "reeds rustling, faint marsh air, calm cozy ambience, no music, no voice",
        8.0,
        0.3,
        True,
    ),
    (
        "pouch_clink",
        "Soft small leather pouch with a single muffled coin clink and a light "
        "fabric rustle, cozy, short, close-mic, no music",
        0.7,
        0.4,
        False,
    ),
]


def generate(key: str, prompt: str, dur: float, influence: float, loop: bool) -> bytes:
    payload = {
        "text": prompt,
        "duration_seconds": dur,
        "prompt_influence": influence,
        "loop": loop,
    }
    req = urllib.request.Request(
        f"{API_URL}?output_format={OUTPUT_FORMAT}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"xi-api-key": key, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read()


def main() -> None:
    load_env()
    key = api_key()
    if not key:
        print("STOP: no ELEVENLABS_API_KEY found in env/.env/.env.local", file=sys.stderr)
        sys.exit(2)

    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for name, prompt, dur, influence, loop in SFX:
        dest = OUT / f"{name}.mp3"
        try:
            audio = generate(key, prompt, dur, influence, loop)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            print(f"FAIL {name}: HTTP {exc.code}: {body}", file=sys.stderr)
            sys.exit(1)
        dest.write_bytes(audio)
        kb = len(audio) / 1024
        total += len(audio)
        print(f"  {name:14s} {kb:7.1f} KB  ({dur:.1f}s req)")
    print(f"TOTAL: {total/1024:.1f} KB  -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

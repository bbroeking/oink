#!/usr/bin/env python3
"""Build deterministic 750x1050 RGBA Rive derivatives for five card fixtures."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "assets/rive/card-packs/art"
MANIFEST_PATH = OUTPUT_DIR / "manifest.json"
TARGET_SIZE = (750, 1050)
SOURCES = {
    "firefly_swarm": "assets/images/trading-cards/base-set-art/034-firefly-swarm-print-v1.png",
    "mud_shovel": "assets/images/hats/mud_shovel.png",
    "puddle_duckling": "assets/images/trading-cards/base-set-art/038-puddle-duckling-print-v1.png",
    "mushroom_cap": "assets/images/hats/mushroom_cap.png",
    "moon_firefly": "assets/images/trading-cards/base-set-art/046-moon-firefly-print-v1.png",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize(source_path: Path, output_path: Path) -> dict[str, object]:
    with Image.open(source_path) as source:
        source.load()
        source_size = source.size
        source_mode = source.mode
        rgba = source.convert("RGBA")
        scale = min(TARGET_SIZE[0] / rgba.width, TARGET_SIZE[1] / rgba.height)
        scaled_size = (
            max(1, round(rgba.width * scale)),
            max(1, round(rgba.height * scale)),
        )
        resized = rgba.resize(scaled_size, Image.Resampling.LANCZOS)
        offset = (
            (TARGET_SIZE[0] - scaled_size[0]) // 2,
            (TARGET_SIZE[1] - scaled_size[1]) // 2,
        )
        canvas = Image.new("RGBA", TARGET_SIZE, (0, 0, 0, 0))
        canvas.alpha_composite(resized, offset)
        canvas.save(output_path, format="PNG", compress_level=9, optimize=False)

    with Image.open(output_path) as result:
        if result.size != TARGET_SIZE or result.mode != "RGBA":
            raise RuntimeError(f"Invalid normalized output: {output_path}")

    return {
        "source": source_path.relative_to(ROOT).as_posix(),
        "sourceSha256": sha256(source_path),
        "sourceWidth": source_size[0],
        "sourceHeight": source_size[1],
        "sourceMode": source_mode,
        "output": output_path.relative_to(ROOT).as_posix(),
        "outputSha256": sha256(output_path),
        "outputWidth": TARGET_SIZE[0],
        "outputHeight": TARGET_SIZE[1],
        "outputMode": "RGBA",
        "contentBox": {
            "x": offset[0],
            "y": offset[1],
            "width": scaled_size[0],
            "height": scaled_size[1],
        },
    }


def build() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    cards = {}
    for card_id, relative_source in SOURCES.items():
        cards[card_id] = normalize(
            ROOT / relative_source,
            OUTPUT_DIR / f"{card_id}.png",
        )
    manifest = {
        "version": 1,
        "purpose": "Rive dynamic-image runtime derivatives; originals are unchanged",
        "algorithm": "RGBA transparent canvas, contain, center, Pillow LANCZOS, PNG compress_level=9",
        "target": {"width": TARGET_SIZE[0], "height": TARGET_SIZE[1], "mode": "RGBA"},
        "cards": cards,
    }
    MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    check()


def check() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    if set(manifest.get("cards", {})) != set(SOURCES):
        raise RuntimeError("Manifest must contain exactly the five Rive fixture identities")
    for card_id, relative_source in SOURCES.items():
        record = manifest["cards"][card_id]
        source_path = ROOT / relative_source
        output_path = ROOT / record["output"]
        if record["source"] != relative_source or record["sourceSha256"] != sha256(source_path):
            raise RuntimeError(f"Source metadata changed for {card_id}; rebuild derivatives")
        if record["outputSha256"] != sha256(output_path):
            raise RuntimeError(f"Output hash mismatch for {card_id}")
        with Image.open(output_path) as output:
            if output.size != TARGET_SIZE or output.mode != "RGBA":
                raise RuntimeError(f"Output format mismatch for {card_id}")
    print(f"Verified {len(SOURCES)} normalized card images at {TARGET_SIZE[0]}x{TARGET_SIZE[1]} RGBA")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="verify existing outputs without rewriting")
    args = parser.parse_args()
    check() if args.check else build()

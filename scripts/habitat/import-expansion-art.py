#!/usr/bin/env python3
"""Import a generated transparent furnishing; preserve source and derive exports."""
import argparse
import json
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("item_id")
    parser.add_argument("source", type=Path)
    args = parser.parse_args()
    catalog = json.loads((ROOT / "docs/design/barn-furnishing-expansion-100.json").read_text())
    if args.item_id not in {item["id"] for item in catalog["items"]}:
        raise ValueError("Unknown expansion furnishing")
    with Image.open(args.source) as original:
        if original.mode != "RGBA":
            raise ValueError("Generated source must contain an alpha channel")
        alpha = original.getchannel("A")
        if alpha.getextrema()[0] != 0 or alpha.getextrema()[1] < 200:
            raise ValueError("Generated source must have transparent and substantial visible pixels")
        # Only remove empty padding. Do not remove a painted background or alter art.
        bounds = alpha.getbbox()
        if bounds is None:
            raise ValueError("Empty furnishing")
        sprite = original.crop(bounds)
        sprite.thumbnail((480, 480), Image.Resampling.LANCZOS)
        export = Image.new("RGBA", (sprite.width + 32, sprite.height + 32))
        export.paste(sprite, (16, 16))
        thumb = export.copy()
        thumb.thumbnail((128, 128), Image.Resampling.LANCZOS)
    base = ROOT / "assets/images/habitat"
    source = base / "source/expansion" / f"{args.item_id}.png"
    target = base / "expansion" / f"{args.item_id}.png"
    thumbnail = base / "thumbnails/expansion" / f"{args.item_id}.png"
    for file in (source, target, thumbnail):
        file.parent.mkdir(parents=True, exist_ok=True)
    if args.source.resolve() != source.resolve():
        shutil.copy2(args.source, source)
    export.save(target, optimize=True)
    thumb.save(thumbnail, optimize=True)
    print(json.dumps({"id": args.item_id, "source": str(source), "asset": str(target), "thumbnail": str(thumbnail), "size": export.size, "bytes": target.stat().st_size}))


if __name__ == "__main__":
    main()

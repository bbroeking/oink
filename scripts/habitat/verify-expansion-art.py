#!/usr/bin/env python3
"""Validate generated exports and render contact sheets for human art acceptance."""
import argparse
import hashlib
import json
import math
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "assets/images/habitat"
OUT = ROOT / "artifacts/habitat-expansion-2026-09-06/art"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--partial", action="store_true")
    args = parser.parse_args()
    data = json.loads((ROOT / "docs/design/barn-furnishing-expansion-100.json").read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    rows, missing = [], []
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 17)
    for item in data["items"]:
        path = BASE / "expansion" / (item["id"] + ".png")
        if not path.exists():
            missing.append(item["id"])
            continue
        paths = [path, BASE / "thumbnails/expansion" / path.name, BASE / "source/expansion" / path.name]
        for index, file in enumerate(paths):
            with Image.open(file) as im:
                assert im.mode == "RGBA", file
                assert im.getchannel("A").getextrema()[0] == 0, file
                assert im.getchannel("A").getextrema()[1] >= 200, file
                assert im.getchannel("A").getbbox(), file
                if index < 2:
                    limit = 512 if index == 0 else 128
                    assert max(im.size) <= limit, file
                    assert all(im.getpixel(p)[3] == 0 for p in [(0, 0), (im.width - 1, 0), (0, im.height - 1), (im.width - 1, im.height - 1)]), file
        rows.append({"id": item["id"], "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "bytes": path.stat().st_size})
    assert len({row["sha256"] for row in rows}) == len(rows), "Duplicate art exports"
    for start in range(0, 100, 10):
        group = data["items"][start:start + 10]
        sheet = Image.new("RGB", (1200, 570), "#fcf4e2")
        draw = ImageDraw.Draw(sheet)
        for i, item in enumerate(group):
            x, y = (i % 5) * 240, (i // 5) * 285
            file = BASE / "expansion" / (item["id"] + ".png")
            if file.exists():
                sprite = Image.open(file)
                sprite.thumbnail((220, 220), Image.Resampling.LANCZOS)
                sheet.paste(sprite, (x + (240 - sprite.width) // 2, y + (230 - sprite.height) // 2), sprite)
            label = item["name"]
            # Keep asset names legible without modifying any source artwork.
            words, lines = label.split(), [""]
            for word in words:
                candidate = (lines[-1] + " " + word).strip()
                if draw.textlength(candidate, font=font) > 225:
                    lines.append(word)
                else:
                    lines[-1] = candidate
            draw.multiline_text((x + 10, y + 232), "\n".join(lines), font=font, fill="#493624", spacing=3)
        sheet.save(OUT / f"collection-{start // 10 + 1:02d}.jpg", quality=90)
    report = {"expected": 100, "validated": len(rows), "missing": missing, "runtimeBytes": sum(row["bytes"] for row in rows), "items": rows}
    (OUT / "asset-validation.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({k: v for k, v in report.items() if k != "items"}))
    if missing and not args.partial:
        raise SystemExit("Missing required art")
    if not missing:
        constants = (ROOT / "constants/habitat.ts").read_text()
        anchors = {name: tuple(map(float, values)) for name, *values in re.findall(r"(wall|ceiling|floor_centerpiece|floor_left|floor_right|surface):.*anchor: \{ x: ([\d.]+), y: ([\d.]+), width: ([\d.]+), height: ([\d.]+) \}", constants)}
        categories = {"wall_decor": ["wall"], "ceiling_decor": ["ceiling"], "floor_decor": ["floor_left", "floor_right"], "floor_centerpiece": ["floor_centerpiece"], "surface_decor": ["surface"]}
        matrix = []
        for theme in ["warm_plank_barn", "spring_whitewash", "midnight_rafters"]:
            background = Image.open(BASE / (theme + ".png")).convert("RGBA").resize((390, 844))
            for group in range(10):
                cells = []
                for item in data["items"][group * 10:group * 10 + 10]:
                    for position in categories[item["category"]]:
                        scene = background.copy()
                        cx, cy, rw, rh = anchors[position]
                        bounds = (round(rw * 390), round(rh * 844))
                        sprite = Image.open(BASE / "expansion" / (item["id"] + ".png"))
                        sprite.thumbnail(bounds, Image.Resampling.LANCZOS)
                        x, y = round(cx * 390 - sprite.width / 2), round(cy * 844 - sprite.height / 2)
                        assert x >= 0 and y >= 0 and x + sprite.width <= 390 and y + sprite.height <= 844
                        scene.alpha_composite(sprite, (x, y))
                        cell = Image.new("RGB", (195, 458), "#fcf4e2")
                        cell.paste(scene.resize((195, 422), Image.Resampling.LANCZOS).convert("RGB"))
                        ImageDraw.Draw(cell).text((3, 425), f"{item['id'][:23]}\n{position}", fill="#493624", font=ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 11))
                        cells.append(cell)
                        matrix.append({"theme": theme, "item": item["id"], "position": position, "bounds": [x, y, sprite.width, sprite.height]})
                sheet = Image.new("RGB", (195 * 7, 458 * math.ceil(len(cells) / 7)), "#fcf4e2")
                for index, cell in enumerate(cells):
                    sheet.paste(cell, ((index % 7) * 195, (index // 7) * 458))
                sheet.save(OUT / f"scene-{theme}-{group + 1:02d}.jpg", quality=90)
        assert len(matrix) == 420
        (OUT / "scene-placement-validation.json").write_text(json.dumps({"count": len(matrix), "placements": matrix}, indent=2) + "\n")


if __name__ == "__main__":
    main()

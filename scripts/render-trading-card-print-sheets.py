#!/usr/bin/env python3
"""Build US Letter 3x3 trading-card print sheets.

Cards remain exactly 2.5x3.5 inches. The 3x3 grid fits on US Letter with
0.5-inch side margins and 0.25-inch top/bottom margins.
"""

from pathlib import Path
import csv

from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parent.parent
CARD_DIR = ROOT / "docs" / "marketing" / "trading-cards"
MICROGAME_DIR = CARD_DIR / "equipment-game"
BASE_SET_DIR = CARD_DIR / "base-set-84" / "visual-system"
OUT_DIR = ROOT / "output" / "pdf"

CARDS = {
    "meet": CARD_DIR / "01-meet-rosie-app-store.png",
    "herd": CARD_DIR / "02-join-the-herd-app-store.png",
    "cap": CARD_DIR / "03-ticket-takers-cap-reward.png",
    "crown": CARD_DIR / "04-release-party-crown-reward.png",
}

POINTS_PER_INCH = 72
CARD_W = 2.5 * POINTS_PER_INCH
CARD_H = 3.5 * POINTS_PER_INCH
GRID_W = CARD_W * 3
GRID_H = CARD_H * 3
PAGE_W, PAGE_H = letter
LEFT = (PAGE_W - GRID_W) / 2
BOTTOM = (PAGE_H - GRID_H) / 2


def draw_cut_guides(pdf: canvas.Canvas) -> None:
    """Draw exterior crop ticks without marking the card faces."""
    tick = 0.16 * POINTS_PER_INCH
    pdf.saveState()
    pdf.setStrokeColorRGB(0.25, 0.20, 0.22)
    pdf.setLineWidth(0.35)

    for col in range(4):
        x = LEFT + col * CARD_W
        pdf.line(x, BOTTOM - tick, x, BOTTOM)
        pdf.line(x, BOTTOM + GRID_H, x, BOTTOM + GRID_H + tick)

    for row in range(4):
        y = BOTTOM + row * CARD_H
        pdf.line(LEFT - tick, y, LEFT, y)
        pdf.line(LEFT + GRID_W, y, LEFT + GRID_W + tick, y)

    pdf.restoreState()


def draw_sheet(
    pdf: canvas.Canvas,
    card_paths: list[Path],
    *,
    mirror_columns: bool = False,
) -> None:
    if not 1 <= len(card_paths) <= 9:
        raise ValueError("A 9-up sheet requires between one and nine cards.")

    for index, card_path in enumerate(card_paths):
        row_from_top, col = divmod(index, 3)
        if mirror_columns:
            col = 2 - col
        x = LEFT + col * CARD_W
        y = BOTTOM + (2 - row_from_top) * CARD_H
        pdf.drawImage(
            ImageReader(str(card_path)),
            x,
            y,
            width=CARD_W,
            height=CARD_H,
            preserveAspectRatio=True,
            mask="auto",
        )

    draw_cut_guides(pdf)
    pdf.showPage()


def build_pdf(
    path: Path,
    sheets: list[tuple[list[Path], bool]],
    title: str,
) -> None:
    pdf = canvas.Canvas(str(path), pagesize=letter, pageCompression=1)
    pdf.setTitle(title)
    pdf.setAuthor("Tickle the Pig")
    pdf.setSubject("Nine-up trading card print sheets")
    for sheet, mirror_columns in sheets:
        draw_sheet(pdf, sheet, mirror_columns=mirror_columns)
    pdf.save()


def main() -> None:
    microgame_cards = sorted(
        path
        for path in MICROGAME_DIR.glob("*.png")
        if path.name[:2].isdigit()
    )
    microgame_back = MICROGAME_DIR / "card-back-crown-reward.png"
    manifest_path = BASE_SET_DIR / "card-manifest.csv"
    base_set_cards: list[Path] = []
    if manifest_path.exists():
        with manifest_path.open(newline="") as manifest_file:
            for row in csv.DictReader(manifest_file):
                key = row["slot"] if row["type"] == "gear" else row["type"]
                base_set_cards.append(
                    BASE_SET_DIR / f"{row['number']}-{key}-{row['id']}.png"
                )
    missing = [str(path) for path in CARDS.values() if not path.exists()]
    if len(microgame_cards) != 9:
        missing.append(
            f"{MICROGAME_DIR} (expected 9 playable PNGs, found {len(microgame_cards)})"
        )
    if not microgame_back.exists():
        missing.append(str(microgame_back))
    if len(base_set_cards) != 88:
        missing.append(
            f"{manifest_path} (expected 88 base-set cards, found {len(base_set_cards)})"
        )
    missing.extend(str(path) for path in base_set_cards if not path.exists())
    if missing:
        raise SystemExit(
            "Missing card renders. Run the card renderers first:\n"
            + "\n".join(missing)
        )

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Balanced one-sheet assortment: three install cards of each style and
    # three reward cards total (two Cap, one Crown).
    mixed = [
        "meet", "herd", "meet",
        "cap", "crown", "cap",
        "herd", "meet", "herd",
    ]
    build_pdf(
        OUT_DIR / "tickle-the-pig-cards-mixed-9up.pdf",
        [([CARDS[key] for key in mixed], False)],
        "Tickle the Pig - Mixed Trading Cards - 9-up",
    )

    build_pdf(
        OUT_DIR / "tickle-the-pig-cards-full-sets-9up.pdf",
        [([CARDS[key]] * 9, False) for key in ("meet", "herd", "cap", "crown")],
        "Tickle the Pig - Trading Card Full Sets - 9-up",
    )

    build_pdf(
        OUT_DIR / "rosies-loadout-armory-fronts-only-9up.pdf",
        [(microgame_cards, False)],
        "Rosie's Loadout - Nine-card Armory Fronts",
    )

    # Duplex-ready: fronts first, then horizontally mirrored backs for
    # portrait printing with "flip on long edge". All current backs are
    # identical, but retaining the mirror operation keeps registration correct
    # if card-specific backs are introduced later.
    build_pdf(
        OUT_DIR / "rosies-loadout-armory-9up.pdf",
        [
            (microgame_cards, False),
            ([microgame_back] * 9, True),
        ],
        "Rosie's Loadout - Duplex Nine-card Armory",
    )

    base_set_sheets = [
        base_set_cards[index:index + 9]
        for index in range(0, len(base_set_cards), 9)
    ]
    build_pdf(
        OUT_DIR / "rosies-loadout-base-set-88-fronts-9up.pdf",
        [(sheet, False) for sheet in base_set_sheets],
        "Rosie's Loadout - 88-card Base Set Fronts",
    )
    build_pdf(
        OUT_DIR / "rosies-loadout-base-set-88-duplex-9up.pdf",
        [
            side
            for sheet in base_set_sheets
            for side in (
                (sheet, False),
                ([microgame_back] * len(sheet), True),
            )
        ],
        "Rosie's Loadout - 88-card Base Set Duplex",
    )

    print(f"Wrote print sheets to {OUT_DIR}")


if __name__ == "__main__":
    main()

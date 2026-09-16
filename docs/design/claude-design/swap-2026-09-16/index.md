# The swap on a barn visit — flow canvas (2026-09-16)

Design canvas: https://claude.ai/code/artifact/c3237437-6cd2-4538-9027-677aeba4e554

Spec: `docs/design/2026-09-16-satchel-audit-and-barn-trading-plan.md` Part 2 (§2 flow, §6 client, §12 wire contract). Eight phone boards in flow order plus flow notes; static mockups (not a clickable prototype), awaiting the founder's flow review.

| Board | File | What it shows |
| --- | --- | --- |
| 1 · Visit · a match in the bag | `Main.dc.html` | The shipped visit with the bubble's new second line (*will swap*); the strip lifts the match; head line says tap it to swap. |
| 2 · The offer tray | `Tray.dc.html` | The tray rising from the strip: three server-chosen options (×3 = the host has several), *…or just give it*. |
| 3 · The tray · gift only | `TrayGiftOnly.dc.html` | Options empty: one honest line and the one button. |
| 4 · The receipt · swapped | `Receipt.dc.html` | The delivery's dialog with both finds; host's gain first, tickles second. |
| 5 · The receipt · a gift | `ReceiptGift.dc.html` | One find, plus *and a generous tick*. |
| 6 · After · the strip goes quiet | `After.dc.html` | The taken find in the bag with a from-a-friend mark; the bubble reads *next time*. |
| 7 · Same day · swapped already | `SwappedToday.dc.html` | The `already_today` gate drawn as a state: bubble line, tiles at rest, strip says come back tomorrow. |
| 8 · Nap card · Swap | `NapSwap.dc.html` | *Leave a find* becomes *Swap* under Head home. |
| Flow notes | `Rationale.dc.html` | The tray, gift only, the receipt, after/next day, the nap card, what the server answers. |

Tokens from `constants/theme.ts`; anatomy from `components/BarnVisitModal.tsx` + `components/visit/*` (build 190); the room (`warm_plank_barn`), Rosie's sprites and the find glyphs are shipped art (`img/`, downsampled). `build.py` writes the `.dc.html` boards from one shared style block — edit it, run it, re-seed (`barn-swap.html`), republish to the URL above.

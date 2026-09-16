# Shop — The Storefront (chosen 2026-09-16)

Design canvas: https://claude.ai/code/artifact/5c3e1a08-ae8c-43bf-ac90-7be02924c4e4

Round one drew three front-page directions on one axis each (what leads the page · whether your friends are in it · whether it is a grid or a place); the founder chose **C · The Storefront** and asked for the open Troughs and the current sounder to move into it, the Trough to show on Home, and a random tickle reward for pushing a Trough past a notch. Page 1 is the chosen direction; page 2 keeps the three round-one sketches.

## Page 1 · The Storefront

| Board | File | What it shows |
| --- | --- | --- |
| The Storefront | `Main.dc.html` | The store with the sounder's open Troughs in a wooden trough by the counter (notched rows) and friends who bought today standing at the counter wearing it; Closet / Furnish as hanging signs by the chalkboard. |
| Home · the trough in the yard | `HomeTrough.dc.html` | An open sounder Trough as a small trough beside the mound — slop level, lit notches, the friend's pig peeking over it; tapped, one tag (`140 of 200 · chip in ›`). |
| Home · Trough on the fan | `HomeFan.dc.html` | `Trough` joins Dig · Barn · Bury a truffle with the leading drive on its hand line. |
| Home · the sheet, past a notch | `TroughSheet.dc.html` | Today's TroughSection in a Sheet with a notched track; the receipt line and the toast after a chip passed the third notch (bank 19 → 21). |
| Rationale + build order | `Rationale.dc.html` | Where things live in the scene, the Home rules, the notch reward and its guardrails, the three-build order. |

## Page 2 · Directions (round 1)

`DropFirst.dc.html` (A · not chosen) · `NeighborsShop.dc.html` (B · its Troughs-as-cards and sounder strip folded into C) · `Storefront.dc.html` (C · the round-one sketch).

Tokens read from `constants/theme.ts`; card anatomy from `app/(tabs)/shop.tsx`; Home anatomy from `../barn/barn-home.html` (the ratified comp); Trough copy from `components/TroughSection.tsx`; fan rows from `components/Barn.tsx`. Art is the shipped art, downsampled (`../shop/img/` plus `img/`: companion portraits, the yard painting, Rosie's sprite, the stamp heart, the flame, the truffle). The shopkeep is placeholder art (Pepper with a tape note); friend names and drive numbers are sample data.

Balance: `tools/balance_trough_notch.py` + `docs/design/2026-09-16-trough-notch-balance.md` — the loop that settled the reward as the pot rule (replace, bank-only, floor 4).

Decisions logged 2026-09-16 in `SKILL.md` (product: storefront, trough on Home, notch drop + guardrails) and `docs/design/taste-standard.md` (craft: the five storefront rulings).

`canvas.json` lays the boards out. `shop-front-page-directions.html` is the seeded canvas (regenerable; re-seed from the `.dc.html` files + `canvas.json` when editing, then republish to the URL above).

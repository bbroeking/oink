# Shop — two catalogs, one shop (2026-09-13)

Design canvas: https://claude.ai/code/artifact/3a41f2c4-31d7-4029-9c75-4190a0eb6ec6

Four structural answers to "accessories worn by Rosie and furnishings placed in the Barn, in one shop". Every board carries the same stock and states (1,240-snout pocket · today's drop · Slop Club band with the MEMBERS ribbon and lock · hats and bows · Harvest Hoedown / Orchard Morning furnishings · a snout price on every tile · Owned / Wearing / Placed / Season pass). Tokens are read from `constants/theme.ts`; card anatomy from `app/(tabs)/shop.tsx`'s `ShopCard`; sheet / chip / button / segmented control from `components/ui`. Art is the shipped art, downsampled into `img/`.

| Board | File | One sentence | Pillar | Cost vs today |
| --- | --- | --- | --- | --- |
| A · Two Doors | `Main.dc.html` | The shop has two doors: for Rosie, for the Barn. | Collect | low (≈ 1 build) |
| B · One Aisle | `OneAisle.dc.html` | Scroll the shop; things are sorted by where they go. | Collect | medium (≈ 2 builds) |
| C · Try It On | `TryItOn.dc.html` | Tap a spot on Rosie or her room, buy what fits there. | Collect · Connect | high (≈ 4 builds) |
| D · Market Stalls | `MarketStalls.dc.html` | Buy from a stall; fill the table to earn its gifts. | Collect | medium-high (≈ 3 builds) |

`Rationale.dc.html` carries the per-board rationale, trade-offs and the recommendation (build A now; C's ghost-on-your-wall becomes the preview sheet's next step; D's set stalls return inside each door once accessories carry a `collection_id`; B's location kickers go into A's Barn door today). `canvas.json` lays the boards out; re-seed the canvas from these files when editing.

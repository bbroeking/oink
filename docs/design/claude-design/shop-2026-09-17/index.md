# Shop — less jumping (2026-09-17)

Design canvas: https://claude.ai/artifact/J4p2CfVJ7m9nzQD2aDujqW

The founder's brief: "we jump around a lot" in the Storefront. What jumps today: the store,
the Closet and the Pen are three rooms under one header; a Store sign appears only away from
the store and the chalkboard leaves; scroll is lost on every switch; buying and (until today)
wearing both opened the item sheet. Three directions, one axis each; the founder picks.

| Direction | Boards | The one idea |
| --- | --- | --- |
| A · One aisle | `Main.dc.html`, `A2_Closet.dc.html` | No rooms. The fitting room (your pig + slots) is pinned under the header; the shelves follow; the Closet is a section further down the same scroll. Pen and Furnish stay as small doors. |
| B · Signs that stay put | `B1_Store.dc.html`, `B2_Closet.dc.html` | Rooms stay, least code moves. The sign rail is identical in every room; a tapped coaster opens a try-on strip under its own shelf; only buying opens a sheet; each room keeps its scroll. |
| C · The fitting-room drawer | `C1_Store.dc.html`, `C2_Drawer.dc.html` | One screen. Shelves fill the tab; your pig waits in a drawer above the tab bar that tries on whatever you tap; pulled up, the drawer is the Closet, with Pen and Furnish as doors in its head. |

Art is the shipped art (item sprites downsampled; the dressed pig is the real renderer, cropped
from the simulator's Closet). Regenerate with `python3 gen.py` (asset urls are the canvas's
uploads). Prior round: `../shop-2026-09-16/` (the Storefront, chosen).

## Round 2 — A and B as separate layouts (same day)

Founder: "a decent start; iterate on A and B as different layout options" (C set aside). Page 1 of the
canvas; round 1 moved to page 2 (`R1_Main.dc.html` + the r1 files).

| Layout | Boards | The one idea |
| --- | --- | --- |
| A1 · the strip | `Main.dc.html`, `A1_Closet.dc.html` | Store first; your pig as a compact strip pinned under the header, the closet a section further down. |
| A2 · the hero fitting room | `A2_Hero.dc.html`, `A2_Hero_Closet.dc.html` | The pig leads the page the way the Closet does today, then folds to one line as you scroll so the shelves get the screen back. |
| B1 · rail of signs | `B1_Rail.dc.html`, `B1_Rail_Closet.dc.html` | Rooms stay; one rail of hanging signs identical in every room; a tapped coaster tries on under its own shelf. |
| B2 · folder tabs | `B2_Tabs.dc.html`, `B2_Tabs_Closet.dc.html` | Rooms as folder tabs on the wall; one fixed try-on bar under the tabs (the same bar is the wearing-now strip on the Closet tab); Furnish leaves the tab set because it navigates away. |

Regenerate with `python3 gen2.py` (imports `gen.py`).

## The signs' glyphs (same day)

Store · Closet · Pen painted in the fan-mark family through the Codex ImageGen lane off `dig/bag.png`
(prompts, raw magenta plates and a size preview in `docs/reviews/shop-signs-2026-09-17/`), keyed and
fitted to 256² at 88%: `assets/images/glyphs/{store,closet,pen}.png`, registered as `signStore` /
`signCloset` / `signPen` in `Glyph.tsx`; `HangingSign` draws a glyph at `ART_SIZE.glyphMd`. Furnish
uses the existing `barnDoor` glyph. The Store sign glyph is registered but only shows away from the store.

## Round 3 — A2, three layouts (same day)

Founder: "A2 seems to be the best; iterate on the layout there." Page 1 of the canvas (`launch` opens on it). **V1 (flanked) is the build** (same day): it keeps the Closet's own layout intact (the pig in the middle, slots down both sides) at the top of the store, and keeps the shop's two modes distinct — the cosmetics shop on this page (shelves, fitting room, Closet grid on one scroll), the furnishings shop its own place behind the Furnish door, because it dresses the Barn, not the pig.

| Layout | Boards | The one idea |
| --- | --- | --- |
| V1 · flanked | `V1_Flanked.dc.html`, `V1_Flanked_Scrolled.dc.html` | The pig centred, four slots a side, the Title row (earned, tap to pick) under the hero; Closet 13 · Pen · Furnish as doors beside the chalkboard; scrolling folds the hero to one line, which is where a tapped coaster tries on. |
| V2 · wide hero + peg rail | `V2_Wide.dc.html`, `V2_Wide_Scrolled.dc.html` | A wide card: the pig on the left, the words beside her, all eight slots as one peg rail under it; Closet · Pen · Furnish hang on a rope; the peg rail is what stays pinned. |
| V3 · in the store | `V3_Floor.dc.html`, `V3_Floor_Scrolled.dc.html` | She stands on the floor by the counter with the shopkeep behind; her slots on a peg board on the wall; the signs hang on the rope at the top; scrolling, she follows on the line. |

Regenerate with `python3 gen3.py`.

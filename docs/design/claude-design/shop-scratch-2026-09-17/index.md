# Shop — from scratch (2026-09-17, pass 3)

Design canvas: https://claude.ai/artifact/PkPQzpBECiqAARHqExFmZU

Founder: *"can we design a UI for this from scratch"* — after the pass-3 audit (`../../shop-ia-2026-09-17/README.md`). Three directions, one idea each, two to three phone boards apiece; all three keep the standing rulings (one scroll · owned = one tap · Furnish is a door out · the Pen keeps a room) and all three drop the hero-that-folds.

| Direction | Boards | The one idea |
| --- | --- | --- |
| A · The Counter | `Main.dc.html`, `A_Everything.dc.html`, `A_FittingRoom.dc.html` | Store first. The pig is a pinned try-on bar with her eight pegs (a real sticky header, never an overlay); Pen and Furnish are the only signs; everything under the shelves is ONE catalog behind a segment (Owned · All · Members); the paper doll and Titles live in a sheet off the bar. |
| B · The Mirror | `B_Today.dc.html`, `B_Mine.dc.html` | Split pane. Rosie in a mirror on the left with her pegboard under it; the right is one rail (Today · Mine · All). Tap a row and she wears it at once; an unowned item puts a ticket under the mirror. No try-on sheet, no scene, no fold. |
| C · The Rack | `C_Racks.dc.html`, `C_Face.dc.html` | Category first. The eight pegs ARE the navigation; every rack is one sideways plank ordered worn · new today · owned · the rest; today's drop and the counter are a compact band at the top; no separate closet. |

Tokens from `constants/theme.ts`; art is the shipped art (item sprites, painted glyphs, the tab signs; the dressed Rosie is the real renderer cropped from the 17 Pro). Regenerate with `python3 gen.py` (asset urls are the canvas's uploads) and republish the `project/` files to the URL above.

The Design MCP connector (`design.agent-native.com`) refused its OAuth handshake this session (resource-URL mismatch); the canvas went through the Artifact Design type instead, as the two earlier rounds did.

## Round 2 — A · The Counter, chosen (same day)

Founder: *"we can have a lot of titles so I don't know if that layout will work out. I think the counter is the best layout."* A is the build; B and C move to page 2. Page 1 iterates A:

| Board | What it shows |
| --- | --- |
| `Main.dc.html` | The store: sticky try-on bar (her window and a `Fitting room` chip both open the sheet), chalkboard + Pen · Furnish, three shelves, the members' shelf. |
| `A_Everything.dc.html` | Everything · Owned — your closet, one grammar. |
| `A_All.dc.html` | Everything · All — sun price = on the shelf today, grey price = not today, Wear / Wearing = yours, gold lock = members. |
| `A_Pen.dc.html` | The Pen as its own screen with `‹ back to the shop`. |
| `A_FittingRoom.dc.html` | The sheet: paper doll, and the title as ONE row (current · placement · `14 earned ›`) instead of a chip pile. |
| `A_Titles.dc.html` | The Titles picker: a list with search, Earned / Not yet tabs, one hand line per title for how it was earned, `Wearing` on the current one. Holds fifty. |
| `A_ItemSheet.dc.html` | A shelf tap on an unowned item: the thing and her wearing it, a ticket to buy, the Trough as the quiet second line. |

Regenerate with `python3 gen2.py` (imports `gen.py`).

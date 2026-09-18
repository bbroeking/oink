# The Pen and Furnish — proposed redesigns (2026-09-17)

Design canvas: https://claude.ai/code/artifact/97fcca64-6d1e-4dc3-ab85-2d221206aff7

Founder: *"we need to make new UI designs for the pen section and the furnish section … including layout, components, and any UI states needed."* Both are pushed routes behind the Shop's two hanging signs (the shop-IA pass, same day). One direction each, drawn to the shipped tokens, with a states sheet apiece. Nothing here is built; proposals only.

## Page 1 · The Pen — the paddock is the picker

| Board | What it shows |
| --- | --- |
| `Main.dc.html` | Not a member: the paddock (Rosie + the friend you are looking at, both `PigStage` idle loops in the build), five medallions hung on the fence, ONE card for the picked pig with the gold `Join Slop Club — Bandit moves in`. |
| `Pen_Member_Choosing.dc.html` | Member, no companion yet: the lilac `Recruit Pickles`. |
| `Pen_Confirm.dc.html` | The one `ConfirmDialog` (unchanged copy). |
| `Pen_Lives_Here.dc.html` | Recruited: Bandit's medallion wears the sage check, the card carries the home toggle (Rosie · At home / Bandit · Put at home), the others go dashed. |
| `Pen_In_The_Field.dc.html` | Looking at another pig after the choice: a state line, no control. |
| `Pen_States.dc.html` | Medallion states (default · selected · pressed · recruited · locked), the four card actions incl. busy (a label, never a spinner), page loading, roster-read failed (`EmptyState kind="error"`), Reduce Motion note. |

What goes: the five-card grid and its orphan fifth card, the three repeats of "this cannot be changed", four "Tap to preview" lines, the separate `memberStory` / `joinStory` / `homeChoices` blocks (they collapse into the one card). Draft copy: each pig's hand line ("keeps whatever he finds") is new — `utils/pigs.ts` carries none today.

## Page 2 · Furnish — the room above the racks

| Board | What it shows |
| --- | --- |
| `Furnish.dc.html` | The top: crown with the Snouts pocket, the sticky **spots bar** (your Barn window → Decorate; six pegs showing what hangs at each spot; a sun dot when something new fits), search, Everything · Mine · Wishes, a jump rail of collections, the featured section with its progress track + reward pips. |
| `Furnish_Scrolled.dc.html` | Scrolled: the bar is a real sticky header (layout height, never an overlay). |
| `Furnish_Spot.dc.html` | A peg tapped: the catalog is what fits the back wall, one hand line says what hangs there now, `clear ×`. |
| `Furnish_Mine.dc.html` | Mine: Place / In room. |
| `Furnish_Wallow.dc.html` | Wallow gifts as the last section ("earned, never bought") instead of the sky card at the top. |
| `Furnish_States.dc.html` | One tile grammar (sun price · grey price · New · Place · In room · rank gift · collection reward), peg states, tile pressed, page loading, Mine / Wishes empty, could-not-reconnect, spot-with-nothing-that-fits. |

What goes: the Wallow card above the goods, the 4-way segment ("New" becomes the ribbon and the peg dot), the "All designs" chip, the state Tag + Button pair on every tile (the capsule is the action's face, per the Shop's 2026-09-17 grammar), the "272 Snouts available." sentence (the sun pocket instead). The item sheet stays as it is.

Regenerate with `python3 gen.py`, then re-seed and republish (`the-pen-and-furnish.html`; images ride from `./img`).

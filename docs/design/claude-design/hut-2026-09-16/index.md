# The Trading Hut — flow canvas (2026-09-16)

Design canvas: https://claude.ai/code/artifact/69db9658-dfc5-4340-a5d4-980e50398d6c

Spec: `docs/design/2026-09-16-trading-hut.md`. Six phone boards in flow order plus flow notes; static mockups (not a clickable prototype), awaiting the founder's flow review.

| Board | File | What it shows |
| --- | --- | --- |
| 1 · Home · the hut, dark | `Main.dc.html` | Unmet: the dark hut up the field at the right edge; tapped, the shutters rattle and one tag. |
| 2 · Home · the lantern lit | `HutLit.dc.html` | After a dig receipt lands the third pebble: lantern lit, the hooded bust in the hatch — no toast, no arrow. |
| 3 · The hut · first entry | `HutOnboarding.dc.html` | The sheep's line, the exact deal for the set held, one button. |
| 4 · The hut · the counter | `HutCounter.dc.html` | Lantern · hatch · chalk slate (today's fancy ×2) · line · slot; stacks with the deal on the ready one; the confirm pill. |
| 5 · The hut · the slip | `HutSlip.dc.html` | The printed slip with the 38 → 43 tally; the stack gone; Dealings' first row. |
| 6 · The hut · shutters down | `HutDark.dc.html` | Known dark after the third sale: shutters, lantern out, slate blank, stacks with "one more". |
| Flow notes | `Rationale.dc.html` | The three states, the deal, placement, what the section is not, art still to land. |

Tokens from `constants/theme.ts` as lifted for the Shop canvas; Home anatomy from `../barn/barn-home.html`; the yard, Rosie and the find glyphs are shipped art (`img/`). The hooded bust and the hut are inline-SVG placeholders until the icon sheet lands. `build.py` writes the `.dc.html` boards from one shared style block — edit it, run it, re-seed (`trading-hut.html`), republish to the URL above.

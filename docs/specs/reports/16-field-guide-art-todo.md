# Field Guide — art TODO (spec 16)

The Field Guide ships with existing art where a glyph/sprite fits, and a **drawn
ink-silhouette placeholder** (a soft ink blob, not emoji) for the pages that have
no fitting art yet. This is the founder's ImageGen-lane worklist to replace those
placeholders. Flat-sticker law applies: front silhouette only, cozy paper-sticker
style, ink outline, matches `assets/images/glyphs/` and `assets/images/hats/`.

## Pages already covered by existing art (no action needed)

| Page | Art used |
|------|----------|
| Golden Truffle | `assets/images/hats/golden_truffle.png` (the minted-coin sprite) |
| Mud Wrap & Warm Tea | `glyphs/coffee.png` (the warm-tea cup) |
| Snouts | `assets/images/snout-coin.png` (via the shared coin) |
| The Exchange | `glyphs/scales.png` (the trade scales) |
| Feeding Windows | `glyphs/sun.png` (the time-of-day marker) |

## Pages needing a new sprite (currently drawn-placeholder)

Each wants one square sticker sprite, transparent PNG, ~same footprint as the
existing glyphs. Drop into `assets/images/glyphs/`, then wire it into
`constants/fieldGuide.ts` (swap `placeholder: true` for `glyph`/`image`).

1. **Truffle** (`truffle`) — a fat raw truffle knot, earthy/dark (distinct from
   the polished *Golden* Truffle coin). The thing you pull from the mud.
2. **Lucky Number** (`lucky_number`) — a golden numbered ticket / lucky token;
   reads as "the day's magic count," not a generic star.
3. **Trough** (`trough`) — a little stone feeding trough / wishing bowl; the
   shared object friends fund.

Optional polish (nice-to-have, not blocking): a dedicated **feeding-window /
clock** glyph could replace the `sun` stand-in on the Feeding Windows page.

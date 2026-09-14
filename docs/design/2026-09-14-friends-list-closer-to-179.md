# Friends list — three variants closer to build 179 (2026-09-14)

Companion to the canvas at <https://claude.ai/code/artifact/9e0cc762-18de-4dff-adf3-d7e5678d54e0>
(page 3, "Closer to 179"). The regression review that started this is
`docs/reviews/2026-09-13-friends-tab-regression-review.md`.

## What "how it used to be" means, from the 179 source (`dd4516b`)

- **One paper sticker, flat rows.** The whole list was a single `Sticker` (rotate 0,
  radius 14, the 4,4 shadow) holding rows split by dashed rules — the "single-card
  scrapbook" pattern. No per-row tilt, no per-row shadow. A row was ~64pt.
- **Row anatomy:** pig avatar (36, 48 for prestige) · name + `#code` · one sub line
  (`wears X`, else ♥ tickles + alignment) · `in {Sounder}` · then the rail: **star**
  (pin, 30pt, no chrome) · `tickled today` hand tag when pair-locked · **sun visit
  door** (34pt circle, barn icon) · `›`.
- **Row tap = profile sheet.** Ask · Bless · Curse were a 3-tab control on the sheet;
  Visit Barn and Report · Block were there too. Nothing ritual-shaped lived on the row.
- **States:** visit door spent = cream2 fill + dimmed (today we'd use the `DISABLED`
  chrome, never opacity); pair-locked = same plus the `tickled today` tag; pinned = filled
  ink star, sorted to the top. No streak chip (it landed later).

The current implementation (this morning's B) is the opposite shape: every friend is
its own tilted card with a four-cell action bar (Visit · Bless · Curse · Profile) and a
masking-tape pin. It is the most one-tap of any design we have drawn, and the tallest.

## V1 · The 179 ledger (pure restore)

**Layout.** One sticker, dashed-ruled rows, ~64pt each. Rail: star · `tickled today` ·
sun visit door · `›`. Row tap opens the profile sheet. Ritual strip above the list goes
(there are no doors to explain). Sounder banner stays full width. Scrapbook stays gone.

**State presentation.** Visit door: `DISABLED` chrome when the global budget is spent or
this pair is locked; the pair lock also gets the `tickled today` tag. Pinned: filled ink
star, row floats to the top. Streak: a flame + count folded into the sub line after the
tickle count (no separate chip). Blessed/cursed today: on the profile sheet only.

**What changes from now.** Delete `ActionCell`, `RowPin`, the action bar, the
`useRitualDoor` calls in the row, the ritual strip and `actionCellTier`. Add a flat
"ledger" mode to `ListRow` (no tilt, no shadow, dashed bottom rule, no radius) or wrap
rows in one `Sticker` with `Divider`s. Restore the round visit door (it was `RitualDoor`
until this morning — recoverable from git). The profile sheet already carries
Ask · Bless · Curse and Visit Barn, so nothing new is needed there. Reverses the
2026-09-12 SKILL.md ruling ("a blessing is one tap where the friend already is") — log it.

**Verify.** (1) Tap cost: Bless and Curse become row → sheet → cast, three taps; watch
`send_blessing` / `send_curse` per active user for a week against the last week of the
door row. If blessings fall, V2 is the answer. (2) Rail width at 375pt: star 30 +
tag ~70 + door 34 + chevron 14 + gaps ≈ 160pt leaves ~150pt for the name column —
check `in The Thundering Wallowers` truncates cleanly and the tag drops to the sub line
on narrow phones. (3) Density: with 6–8 friends the whole list should sit above the
tab bar on a 17 Pro. (4) The row-tap → sheet → Bless path still opens on the Bless
tab for friends (the 2026-09-12 sheet default).

## V2 · Ledger + blessing door (179 with the one ruling we want to keep)

**Layout.** Same ledger. Rail: star · **bless door** (sun, today's blessing art) ·
**visit door** (sky, barn). The `›` goes — the row tap is still the profile, and the
two doors already say "this row does things". One tag above the list names today's
blessing and what is left. Curse stays on the profile sheet.

**State presentation.** Bless door shows the cast ritual's own art once sent (the
existing `door.icon`), `DISABLED` chrome when capped. Visit door as V1. Pair lock:
no room for the tag on the rail — it moves to the sub line as a muted kicker. Pinned:
filled star. Streak: folded into the sub line as in V1.

**What changes from now.** As V1, but keep `useRitualDoor` for bless only and the
round `RitualDoor` for both doors (sun for bless, sky for visit — the fill is the
difference, the glyph is the confirmation). Ritual strip shrinks to one tag. Curse
leaves the row entirely; the sheet's Curse tab is unchanged.

**Verify.** (1) Two round doors side by side read as two different verbs: ask three
people "which one visits?" cold — if anyone hesitates, label the doors with a
`kickerPillSm` under each (costs ~14pt of row height). (2) Rail at 375pt: 30 + 34 +
34 + gaps ≈ 115pt, so the name column keeps ~195pt — check `wears Party Crown` and the
crew line. (3) The curse being on the sheet again is exactly what 2026-09-12 called
"four taps from Home" — decide whether the curse is a daily verb or an occasional one
(the `send_curse` count answers it). (4) Bless door + sheet Bless both cast the same
ritual — make sure a sheet cast updates the door's `sent` art without a reload.

## V3 · Porch + herd (hybrid)

**Layout.** Pinned friends render as this morning's B card (four-cell bar, tape tag)
under a `★ your porch` kicker; everyone else is a 179 ledger row under `the herd`.
Pin = promote to the porch; unpin = back to the ledger. One list, two row drawings.

**State presentation.** Porch cards carry every state on their cells as today. Ledger
rows carry only the visit state (door + tag) and the star. Blessing a herd pig is
row → sheet → Bless; the assumption is that you bless the pigs you pinned.

**What changes from now.** Keep the B row for `isFav`; add the ledger row for the rest;
`FlatList` renders two item types (no `getItemLayout`). Section kickers via
`SectionHeader`. The ritual strip stays (the porch cards still have doors). Empty porch
(no pins) = the whole list is a ledger with a one-line nudge ("pin a pal to bring them
up to the porch").

**Verify.** (1) The mixed list reads as intentional, not inconsistent — screenshot with
0, 1, 3 and 8 pins and look. (2) Whether people pin at all: `friend_favorites` inserts
per active user this week is the baseline; if it is near zero, the porch is empty for
almost everyone and V3 collapses to V1. Consider auto-pinning the three most-visited
friends on first launch of the new list. (3) The B card's height inside the porch:
three pinned friends is ~420pt before the herd begins — check the herd still lands
above the fold on a 17 Pro. (4) Pin/unpin moves a row between sections — the
`LayoutAnimation` we deleted this morning is probably wanted back for that one move.

## Shared checks, whichever we pick

- Quick iteration loop: Metro restart per edit batch, `simctl` screenshot on the 17 Pro
  at 393pt and the SE-class 375pt (the tier boundary is 390), demo account with one
  friend and a seeded account with eight.
- `__tests__/friendRitualDoors.test.tsx` encodes the tap model — it changes with the
  choice, and it should keep asserting where every verb lives.
- The taste standard's 2026-09-14 entry ("a row that owns four verbs shows four cells")
  is written for B; V1/V2 are the "rail of doors" branch it already allows, V3 uses both.
- Scorecard stays at 0 and the `adaptiveLayout` source-scan test passes (every
  geometry reads `useWindowDimensions`).

## Recommendation

V2. It is the 179 list to look at — one sticker, flat rows, star, sun door, row tap to
the sheet — with the single addition the 2026-09-12 ruling was right about: the daily
blessing on the row. The curse goes back to the sheet, where a two-tap arm inside a
labelled control is easier to trust than a round glyph. If the `send_curse` numbers say
the curse is a daily verb after all, V3 is the escape hatch: pinned friends get the
full bar, the herd stays a ledger.

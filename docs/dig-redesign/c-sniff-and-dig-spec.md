# Sniff & Dig — the Truffle Patch as a nose game against a closing jaw (spec)

> **Status:** proposed 2026-09-13 (design canvas: *Truffle Patch Redesign*,
> direction C). One of three equal-depth iterations on the shipped patch;
> siblings: `a-snout-deep-spec.md`, `b-one-patch-four-snouts-spec.md`.
> Nothing here is built.

## The sentence

**"Sniff to smell what's near, dig to take it — before he eats the row."**

## Shape

- **Opening.** The Great Hungerer lies across the top of the patch, jaw on row
  one. Every tile is buried. A bite strip shows six empty dots: `he bites every
  6 stirs`.
- **The one new decision.** Every stir is either a **sniff** (costs 1, moves no
  mud, marks the tile with how many finds touch it) or a **dig** (costs 2,
  takes the tile). Knowing more and taking sooner pull against each other,
  and the row he is chewing toward decides which one you cannot afford.
- **Pressure.** Every six stirs he eats the topmost remaining row. Whatever was
  still buried there is gone — it was never yours. Spatial, visible, countable.
- **End.** Stirs out, or `Pack up`. No auto-finish.
- **Duration.** 26 stirs (13 digs, or a mix), 45–90 s.

## Rules

- **Geometry.** 6×5 tiles, uniform depth 2 (`DEPTH_MAP` → `[2,2,2]` in this
  mode). Same find set as today via draws 1–4: L truffle, domino truffle,
  shimmer (1 in 2), junk (1), 3 stones, relic server-rolled (2 in 5).
  Layout guarantee: no find in row 0 (his jaw row) — placement retries rows
  1–4 only, so the first bite is never a loss.
- **Verbs.**
  - **Sniff** (tap): cost 1. Marks the tile with `scent = number of find tiles
    in the 3×3 around it`, itself included; stones do not count; buried and
    uncovered alike. Range 0–9; typical 0–3. A tile can be sniffed once.
  - **Dig** (hold 400 ms, or the Dig verb selected then tap): cost 2.
    `applySplash(layers, idx, "shove")` unchanged: −2 on the tile (clears it),
    −1 on four neighbours (half-clears). Two adjacent digs clear a 2-wide run.
  - Rub retires from this mode.
- **Budget.** 26 stirs; 30 when a crewmate has already submitted this Feeding
  (the existing `prior_cnt ≥ 1` slot).
- **Bites.** After stirs 6, 12, 18, 24 he eats the topmost remaining row
  (rows 0, 1, 2, 3 in order). Eaten tiles cannot be sniffed or dug; a
  cluster with any uncollected tile in an eaten row is lost; a find already
  fully uncovered is banked at reveal and is never eaten. Row 4 is never eaten
  (the budget ends first). With the +4 co-op stirs, the fourth bite still lands
  at 24; stirs 25–30 are safe.
- **Banking.** As today: a find is banked the moment its last tile clears
  (`clusterRevealed`). `p_finds` = banked finds. `p_missed` = touched,
  uncollected clusters (eaten or not) — the existing carry path gilds the best.
- **End of auto-finish.** `afterReveal`'s *both truffles → finish()* is
  deleted; a dig ends on stirs or `Pack up`.
- **Reused untouched:** `Minstd`, `generateBoard` draw order, `applySplash`,
  `clusterRevealed`, `clusterTouched`, `clusterAnchor`, `clusterBox`,
  `partiallyRevealedFinds`, `gildedSilhouetteDepth`, `feedingPhaseView`,
  `windowIndex`.
- **Changed:** `generateBoard` gains a `rowsAllowed` placement constraint;
  new `scentAt(board, idx)`, `biteRowAt(stirs)`, `eatenRows(stirs)`;
  `nearestFindDistance`/`warmthWhisper`/`nextStreak` retire from this mode
  (scent is the whisper now); `STIR_SHOVE` unused here (dig cost is its own
  constant `SNIFF_DIG_COST 2`).

## Sounder

- **Before.** Feeding card unchanged: who has dug, `dig now`, the countdown.
- **During.** Co-op depth = +4 stirs (`26 → 30`) and one line under the bite
  strip: `Jen dug first — four extra stirs`. No shared state.
- **Sounder Bonus** unchanged: a truffle-minting dig gets +1 `'dig_echo'` when
  another member submitted this Feeding, either order, paid back to the
  earlier member.
- **After.** The share card (`digShareData`) becomes the nose story: the
  scent marks you placed and the rows he ate, spoiler-light — the shareable
  skill proof ("found the crown by nose, row four, one stir to spare").
- No new social act.

## Economy

- **Per outcome.** Banked ≥ 1 truffle cluster: `+1 GT` (`'dig'`) as today;
  Sounder Bonus +1; blessing +1. Every banked find is one race find and one
  meter drain; relic to the Burrow Book. `+20 Pass XP` per submitted dig.
  Eaten finds pay nothing and cost nothing; an eaten touched cluster carries
  gilded.
- **Back of envelope (today).** ≈ 0.85 GT + 20 XP; ≈ 3 credited finds of
  ≈ 4.4 on the board; ≈ 60–70 % of mud cleared by feel.
- **Sniff & Dig.** Blind play (13 digs, no sniffs) clears ≈ 13 tiles + halves
  ≈ 18 tile-equivalents of 30, minus rows eaten before reached → ≈ 2 finds,
  ≈ 0.6 GT. Skilled play (≈ 7 sniffs + ≈ 9 digs) reads the two clusters and
  the relic and takes ≈ 4 of 4.4 finds, ≈ 0.95 GT + the relic 0.4 × 2 in 5.
  Expected value across the population ≈ today's; the spread between blind
  and skilled play is the design (earned mastery), and it is capped by the
  same one-`'dig'`-mint rule — skill buys finds and relics, not truffle
  inflation.
- **Closed-economy check.** Mints unchanged in kind and reason. The server
  recomputes the banked set from the action log (below), so a forged claim
  equals an honest flawless run at best. Nothing is taken from anyone: what
  he eats was buried and unclaimed.

## Surfaces

- **Entry.** Barn button's shovel face → `useFeedingCta.start()` → the modal.
- **Dig screen (top → bottom).** Corners only, patch ≥ 60 %:
  1. Top-left: back chip + sign — kicker `the truffle patch · Feeding`, title
     `closes in 2h 10m`.
  2. Bite strip (one sm sticker): six dots, filled rose as stirs spend; hand
     line `he bites every 6 stirs` → `2 stirs until he bites` → `1 stir until
     he bites`.
  3. The patch: 6×5 grid, 358 × 430 pt on the clearing scene, ≈ 60 %; the
     Hungerer sits ON the patch's top edge, 150 pt, his belly on the next row
     to go. Eaten rows draw as bitten-away scallops in cream (the tiles are
     gone, not greyed). Sniffed tiles carry a hand numeral in paper with an ink
     halo; a hot ring marks the tile under threat.
  4. Whisper: `press your snout to the mud to sniff. the mark is how many
     finds touch that tile.` · `two scents, twice. a cluster runs between them
     — or two finds do. one more sniff would tell. or dig now.` · (rose)
     `two rows gone. the truffle is in the next one. dig it — now.`
  5. Pouch (left, count). Footer: two verb buttons the whole width —
     `Sniff · costs 1 · smells what's near` / `Dig · costs 2 · takes it`; the
     selected verb is sun, the other paper. Hold-to-dig works regardless.
- **Pressure.** No sheet. The bite strip at one dot, the rose whisper, the
  Hungerer leaning onto the next row, the rose rim on the patch. Under Reduce
  Motion he steps, never slides.
- **Payoff.** A lilac Burrow Book sticker mid-screen when a relic banks:
  kicker `new in your Burrow Book`, art, `The Tiny Crown`, hand line `found by
  nose, row four, with one stir to spare.` Then the receipt: `+2 Golden
  Truffles` · `+20 Pass XP · 4 finds for The Bramble Snouts`; ledger `two
  truffles, one shimmer, the crown — banked and counted` / `he ate: two stones
  and his own boot — good. let him.`; buttons `Back to Barn` · `Share the dig`.
- **Season tab.** Feeding card gains one line after a dig: `dug · by nose, 4
  finds` / `dug · he ate two rows`. Hunger meter unchanged.

## Server sketch

- **Migration** `20260915020000_sniff_and_dig.sql`, flag `dig_sniff_on()`
  default false.
- `war_rootings += action_log text[], rows_eaten smallint`.
- `open_rooting()` unchanged in shape; `mode: 'sniff'` when on.
- `submit_rooting(p_finds, p_actions, p_missed)` → new
  `submit_rooting_sniff(p_actions text[], p_missed text[])`: the ordered log
  (`'n7'` sniff tile 7, `'d13'` dig tile 13; cap 30 entries by cost). The
  server **replays** it: a SQL port of `applySplash` shove (integers, depths
  ×2 to avoid halves), bite rows at cumulative cost 6/12/18/24, then derives
  the banked set itself from `rooting_finds(seed)` + the layout (a SQL port of
  the placement draws — today only draws 1–4 are ported; this mode needs the
  full layout on the server, ≈ 120 lines, and locks the row-0 guarantee).
  `p_finds` is dropped: the server's replay is the claim. Mints as today.
  Carries the 20260799 body for mints/echo/carry verbatim.
- **Fairness / idempotency.** Seed-true layout on both ends; the log is the
  only input; a replay is pure so a re-submit returns the same receipt (and
  the durable-receipt row from `20260913010000`). One dig per pig per Feeding
  by the existing PK; window-stamped.
- **Untouched:** `utils/digSession.ts` entirely.

## Client sketch

| file | change | size |
| --- | --- | --- |
| `utils/rooting.ts` | row-constrained placement, `scentAt`, `eatenRows`, `biteRowAt`, `simulateSniff(seed, policy)` | M |
| `utils/digBrush.ts` | verb-aware brush: tap = selected verb, hold = dig | S |
| `constants/dig.ts` | `SNIFF_COST 1`, `SNIFF_DIG_COST 2`, `SNIFF_BUDGET 26/30`, `BITE_EVERY 6` | S |
| `components/mudwar/TrufflePatch.tsx` | verb state, scent map, bite schedule, action log; delete auto-finish, whispers, free rub | L |
| `components/mudwar/LivingMudSurface.tsx` | scent numerals, eaten-row scallops, Hungerer-on-edge layer, hot ring (Skia) | M |
| `components/mudwar/LivingMudReceipt.tsx` | Burrow Book reveal sticker, `he ate` line | M |
| `components/mudwar/LivingMudScene.tsx` | verb footer | S |
| `hooks/useRooting.ts` | submit the log; `rowsEaten`, `ateList` in `RootingOutcome` | M |
| `utils/digShare.ts` | scent marks + eaten rows in the share grid | S |
| new `components/mudwar/BiteStrip.tsx`, `VerbFooter.tsx` | | S |
| `utils/digSession.ts`, `utils/feedingClock.ts`, `useFeedingCta.tsx` | untouched | — |

Survives: kernel (with the shove path as the dig), reducer, feeding clock,
Skia surface, share, progress save/restore (snapshot gains `scent` and
`actionLog`).

## Charter check

1. **Pillar.** Collect — a relic is found by reading the patch, not by
   scratching it; the Book fills by nerve *and* nose. Contend — the most
   legible Hungerer of the three, a clock anyone can point at. Connect is
   served only as today (a sentence and four stirs). Cost: it is the least
   herd-shaped of the three.
2. **One sentence.** Holds: two verbs, one clock.
3. **Fair by construction.** The server replays the log and names the finds;
   the client's claim is not an input. Stronger than today.
4. **Losing warm.** Nothing is ever taken; what he eats was never yours; junk
   he eats is a joke. A blind player still banks ≈ 2 finds.
5. **Pipeline.** No new art beyond the scallop drawing and numerals.
6. **Taste.** Which pillar — Collect. Would a designer who knows this game
   make this choice — a gorging pig eating the patch row by row is the
   Hungerer's fiction made literal, and the numerals are honest and small.

## Risks & open questions

- **Numbers on tiles.** The charter allows small honest numbers for game
  state, never feelings; scent is state. Confirm the hand numeral reads at
  arm's length on a 55-pt tile and under VoiceOver (`scent two` per tile).
- **Solo puzzle in a co-op season.** The herd only appears as +4 stirs. If
  Connect is the founder's priority this direction loses on the lens.
- **Server port.** The full layout generator (placement retries, row
  constraint) must be ported to SQL for the replay. ≈ 120 lines; parity test
  via `scripts/golden_output.sql`-style fixtures against `utils/rooting.ts`.
- **Deduction dead-ends.** Scent alone cannot always disambiguate two
  adjacent singles from a domino; accept (dig is the tiebreak) or add a
  second sniff mark (`deep sniff`, cost 2, shows the nearest find's
  direction). Prefer accept; keep the sentence.
- **Row-0 guarantee** changes the draw count (retries) for boards where a
  placement lands in row 0 — unique boards were already non-byte-stable; the
  server port makes the client's board irrelevant to validation anyway.
- **Party of one.** Unchanged — it is the same game with 26 stirs and no
  crewmate line. No shame state.
- Open: should the bite cadence be 6 stirs, or 5 with a 30 budget (six
  bites, row 4 eaten at the end for a hard finish)?

## Order of work

1. **Kernel + sim** — `scentAt`, `eatenRows`, row-constrained placement,
   `simulateSniff` for blind vs. skilled policies; lock budget and cadence.
2. **Server** — SQL layout port + shove replay + `submit_rooting_sniff`,
   golden fixtures; Docker-harness validation; founder "go" before push.
   Flag off.
3. **Client behind `DIG_SNIFF`** — verb footer, scent marks, bite strip,
   eaten rows in Skia, the Burrow Book reveal; practice mode first.
4. **Share card** with scent marks; Season line.
5. Flag on for the dev crew for three Feedings (blind vs. skilled find
   counts); then all.

# One Patch, Four Snouts — the Truffle Patch as the herd's shared ground (spec)

> **Status:** proposed 2026-09-13 (design canvas: *Truffle Patch Redesign*,
> direction B). One of three equal-depth iterations on the shipped patch;
> siblings: `a-snout-deep-spec.md`, `c-sniff-and-dig-spec.md`. Nothing here is
> built. Amends, if adopted, the glossary line "it is not a shared live board"
> (see Risks).

## The sentence

**"Your herd shares one patch each Feeding — dig where they haven't, finish
what they started."**

## Shape

- **Opening.** One board per Sounder per Feeding. Whoever digs first sees fresh
  mud; everyone after sees the herd's hoofprints — cleared tiles wearing the
  digger's mark, their finds wearing their face, their half-dug clusters
  peeking through.
- **The one new decision.** Where to spend your stirs: **finish a crewmate's
  half-dug find** (a sure thing; the find is credited to you and the assist to
  them) or **break fresh ground** (yours alone; the relic, if any, is only
  where nobody has dug). At your last stirs, with a cluster you cannot finish:
  **mark it** for a crewmate who has not dug, or rub anyway.
- **Pressure.** Two clocks the player already knows: his attention on this dig
  (stirs, drawn as his face) and the Feeding's own clock — the patch closes
  and he gorges on whatever the herd left.
- **End.** Stirs out, or `Pack up`. No auto-finish.
- **Duration.** 16–20 stirs, 30–60 s; the herd's board lives the 4 h open phase.

## Rules

- **Geometry.** 6 cols × R rows, `R = 4 + ceil(roster / 2)`: 1–2 pigs → 5,
  3–4 → 6, 5–6 → 7, 7–8 → 8. Depth per tile from `DEPTH_MAP` as today.
- **Layout.** `generateCrewBoard(seed, rosterN, uniqueId)` — new in
  `utils/rooting.ts`. Draws 1–4 unchanged (parity: `rooting_finds(seed)` still
  names the base set). Then per member `m ≥ 1`: one more truffle cluster
  (alternating L / domino, orientation drawn), one shimmer draw (1 in 2), and
  one stone; junk once per board; relic server-rolled once per board (2 in 5).
  Find ids become `truffle_l`, `truffle_d`, `truffle_2`… `truffle_8` — the
  server's `crew_patch_finds(seed, n)` mirrors the draw order.
- **Stir budget.** 16 per member; 20 when at least one crewmate has already
  submitted this Feeding (the existing `prior_cnt ≥ 1` slot, re-tuned from
  20/25). Rub costs 1 (`applySplash` rub, unchanged). Shove costs **2** (was 3)
  and stays `−2 / −1`: same mud per stir as a rub, half the taps, twice the
  jump on his face — fast is loud, not worse.
- **Ownership.** A cluster is credited to the pig who clears its **last** tile
  (the finisher). Every pig whose hoofprint is on that cluster and who is not
  the finisher is an **assist**. Single-tile finds go to whoever clears them.
  Stones are inert. The relic belongs to its finisher.
- **What the herd changes.** Tiles a crewmate cleared are cleared for you
  (depth 0, marked). You cannot re-dig them. A crewmate's collected find shows
  as theirs and is not claimable.
- **End of auto-finish.** `afterReveal`'s *both truffles → finish()* is deleted;
  a dig ends on stirs or `Pack up`.
- **Gorge.** At window end, every uncollected find on the herd's board is his.
  Half-dug clusters he ate are *missed* for their starter — the existing carry
  path (`partiallyRevealedFinds`, gilded next Feeding) applies to the starter.
- **Reused untouched:** `Minstd`, `applySplash`, `clusterRevealed`,
  `clusterTouched`, `clusterAnchor`, `clusterBox`, `partiallyRevealedFinds`,
  `nearestFindDistance`, `warmthWhisper`, `gildedSilhouetteDepth`,
  `feedingPhaseView`, `windowIndex`, `crewBoardSeed` (now the seed's real job).
- **Changed:** `generateBoard` gains `generateCrewBoard`; `claimableFinds`
  takes an owner map; `STIR_SHOVE 3 → 2`; `nextStreak`/free rub retire (the
  herd is the efficiency bonus now).

## Sounder

- **Before.** The Feeding card is the herd strip: four chips — `Jen · dug at
  7:40`, `you · dig now`, `Marco · not yet`, `Pip · not yet` — plus `2 finds
  still buried`.
- **During.** The strip rides the top of the dig. Hoofprints on tiles;
  faces on collected finds; a half-dug cluster wears a tag `Jen started this ·
  2 rubs to finish`. Warm/cold whispers point only at finds nobody has touched.
- **Sounder Bonus** (unchanged rule, one addition): a truffle-minting dig gets
  +1 `'dig_echo'` when another member submitted this Feeding, either order,
  paid back to the earlier member. Addition: an **assist** on a finished
  truffle cluster pays the assisting pig's dig as if it had minted a truffle
  (`'dig_assist'`, +1 GT), once per pig per Feeding. So starting a truffle
  and running out of stirs is never a zero.
- **Marker** (new social act). One per pig per Feeding. Tap a buried or
  half-dug tile → `Mark it for Marco` → the tile wears a pin for every
  crewmate who has not dug; one push per un-dug crewmate per Feeding at most
  (`patch_marker` route), copy `Rosie left you a truffle half-dug — 1h 12m`.
  No marker when everyone has dug; no marker in a party of one.
- **After.** The receipt is the herd's haul: faces, who found what, assists
  named, `still buried when he gorges: 1 truffle`, and `Nudge Marco` (the
  marker's push, or a plain nudge if no marker was placed; same cap).

## Economy

- **Per outcome.** Finisher of ≥ 1 truffle cluster: `+1 GT` (`'dig'`) as
  today; +1 Sounder Bonus; +1 blessing; +1 assist if you started a cluster a
  crewmate finished (and minted nothing yourself). Every credited find (each
  truffle cluster, shimmer, junk, relic) is one race find and one meter drain.
  `+20 Pass XP` per submitted dig, as today. Relic to the Burrow Book of its
  finisher; dupes bump `found_count`.
- **Back of envelope (today).** ≈ 0.85 GT + 20 XP per dig; ≈ 3 credited finds
  per dig; a full herd of four ≈ 12 finds per Feeding on four private boards.
- **One patch.** Herd of four, 6×6, 4 clusters + 2 shimmer + 1 junk + 0.4
  relic ≈ **7.4 finds available**; four pigs at 16–20 stirs clear ≈ 65 % of 36
  tiles → ≈ 6 credited finds per herd-Feeding. Per pig ≈ 1.5 finds and
  ≈ 0.9 GT (cluster-per-member keeps the truffle mint rate ≈ today's; the
  assist adds ≈ +0.1). Race finds per herd fall from ≈ 12 to ≈ 6, for every
  herd equally — the Dig-Off's Monday ladder is relative, so standings are
  unaffected; the Hunger meter's drain per Feeding halves and the stage
  thresholds (`MILESTONE_THRESHOLDS`, `hunger_meter()`) need re-tuning ×0.5.
- **Closed-economy check.** Every mint is server-side via `mint_truffles`
  (`'dig'`, `'dig_echo'`, `'blessed_dig'`, new `'dig_assist'`), ledgered,
  999-capped. A find is credited exactly once (finisher). Nothing is taken:
  what he gorges was uncollected by anyone; a starter's eaten cluster carries
  gilded. A party of one gets a private 6×5 board — today's economy exactly.

## Surfaces

- **Entry.** Barn button's shovel face → `useFeedingCta.start()` → the modal.
  The Barn button's tag reads `dig · Jen's been` when a crewmate has dug.
- **Dig screen (top → bottom).** Corners only, patch ≥ 60 %:
  1. Top-left: back chip + sign — kicker `your herd's patch · Feeding`, title
     `closes in 2h 10m`. Top-right: the Hungerer, tag `gorging` / `stirring` /
     `lifting his snout` (his attention on *this* dig).
  2. Herd strip: one chip per member — face, name, `dug at 7:40` / `digging` /
     `2 rubs left` / `not yet`.
  3. The patch: 6 × R grid, 358 × 430 pt on the clearing scene, ≈ 60 %.
     Hoofprint chips (initial on a pastel disc) on the corner of cleared tiles;
     faces on collected finds; pins on marked tiles; a `Jen started this · 2
     rubs to finish · pays you both` tag on a half-dug cluster.
  4. Whisper: `Jen dug at 7:40 and found a truffle. she left one half-dug —
     finish it, or root somewhere new.` · `a shimmer drifts free. Jen's
     truffle is two rubs from done — or keep rooting where it's warm.`
  5. Pouch (left, count) · footer `Pack up` + help chip.
- **Pressure sheet** (last 2 stirs with a half-dug cluster and an un-dug
  crewmate): kicker `he's lifting his snout`, title `two rubs left. the
  truffle needs three.`, line `Marco and Pip haven't dug. the patch closes in
  1h 12m — he gorges on whatever the herd leaves.`, choices `Mark it for
  Marco · pins the tile · "Rosie left you a truffle half-dug — 1h 12m"` /
  `Rub anyway · two rubs of fresh ground · the truffle stays half-dug`.
- **Payoff.** Sign `the herd's haul · this Feeding`; `+2 Golden Truffles` ·
  `+20 Pass XP · 3 finds for The Bramble Snouts`; ledger rows `Jen · a
  truffle, at 7:40 — and she started the big one` / `you · finished Jen's
  truffle — Sounder Bonus, for both of you` / `you · a shimmer pocket` /
  `Marco · 1h 12m left — a truffle marked for him, three rubs from done` /
  `Pip · not yet`; total line `still buried when he gorges · 1 truffle`; the
  Hungerer with `he gorges in 1h 12m`; buttons `Back to Barn` · `Nudge Marco`.
- **Season tab.** The Feeding card *is* the herd strip plus `still buried: 2`
  and the marker pin if one is set. Nothing new on the Dig-Off card.

## Server sketch

- **Migration** `20260915010000_crew_patch.sql`, flag `dig_crew_patch_on()`
  default false.
- New table `crew_patches (crew_id, window_index, seed, roster_n, unique_id,
  layers smallint[], cleared_by uuid[], finds_by jsonb, markers jsonb,
  gorged_at, PRIMARY KEY (crew_id, window_index))`. `layers`/`cleared_by` are
  tile-indexed; `finds_by` maps find id → finisher + assists.
- `open_rooting()` — on flag: upsert the crew's row for the window (seed =
  `crewBoardSeed` derivation, already the server's), return `seed, roster_n,
  layers, cleared_by, finds_by, markers, crew_dug` in the existing envelope
  (`mode: 'crew_patch'`). Practice and crewless: today's path.
- `submit_rooting(p_finds, p_actions, p_missed)` → gains `p_layers
  smallint[]` (the client's final depths): under `SELECT … FOR UPDATE` on the
  crew row, merge `min(server, client)` per tile, stamp `cleared_by` for tiles
  the caller took to 0, compute finishers/assists server-side from the merge
  (never from `p_finds`; `p_finds` is intersected with what the merge says the
  caller finished), credit each find once, mint, write `finds_by`. Two pigs
  digging at once: the second merge sees the first; a cluster finished by
  both in the same instant is credited to the earlier `submitted_at`.
- `set_patch_marker(p_tile int)` — one per pig per window (`markers[uid]`),
  enqueues `patch_marker` pushes to un-dug members, one per recipient per
  window (dedup key `crew:window:recipient`).
- `gorge_crew_patches()` — cron at window end (or lazy on next open): for each
  starter of an uncollected touched cluster, run the carry path.
- **Fairness / idempotency.** Row lock orders writes; `war_rootings` PK
  `(user_id, window_index)` keeps one dig per pig per Feeding; a re-submit
  returns the durable receipt; all state is window-stamped and expires with
  the window. Finds credited once, by the merge.
- **Untouched:** `utils/digSession.ts` — session, dug-window, practice
  lockout, mirror key, reconcile.

## Client sketch

| file | change | size |
| --- | --- | --- |
| `utils/rooting.ts` | `generateCrewBoard`, owner-aware `claimableFinds`, `finisherOf(cluster, clearedBy)` | M |
| `utils/dig.ts` | `FeedingState += crew board fields`; `CrewDug += dug_at` | S |
| `constants/dig.ts` | `STIR_SHOVE 2`, budget 16/20, rows-by-roster | S |
| `components/mudwar/TrufflePatch.tsx` | herd strip, owner map, marker flow, pressure sheet; delete auto-finish + free rub | L |
| `components/mudwar/LivingMudSurface.tsx` | hoofprint chips, face marks, pins (Skia) | M |
| `components/mudwar/LivingMudReceipt.tsx` | the herd's haul, `Nudge` | M |
| `components/mudwar/useFeedingCta.tsx` | pass crew board through; Barn tag copy | S |
| `hooks/useRooting.ts` | `p_layers` submit, `setMarker`, outcome `assists`, `stillBuried` | M |
| `utils/notificationRouting.ts` | `patch_marker` → the dig | S |
| new `components/mudwar/HerdStrip.tsx`, `MarkSheet.tsx` | | S |
| `utils/digSession.ts`, `utils/feedingClock.ts` | untouched | — |

Survives: kernel, reducer, feeding clock, Skia surface, share card (gains
faces), progress save/restore (snapshot gains `clearedBy`).

## Charter check

1. **Pillar.** Connect first — the herd is in the mud and the last beat is a
   push with a truffle in it. Contend — every herd find is a race find the
   herd watches itself assemble. Collect unchanged. Cost: halves race finds per
   herd and the meter's drain rate (re-tune), and a late digger has more
   information than an early one — the same gift as today's extra stirs.
2. **One sentence.** Holds; one new noun (a marker).
3. **Fair by construction.** Server merge under a row lock decides finishers;
   the client never names an owner. Un-dug pigs are empty chips, never drag.
4. **Losing warm.** Nothing taken from anyone; a half-dug find is a gift; the
   only word for a pig who has not dug is `not yet`; what he gorges is the
   herd's leftover, unnamed.
5. **Pipeline.** No new art; faces are existing avatars.
6. **Taste.** Which pillar — Connect. Would a designer who knows this game make
   this choice — the Sounder Bonus stops being a sentence and becomes a tile
   you finished for Jen.

## Risks & open questions

- **Glossary.** `CONTEXT.md` › *Truffle Patch*: "Sounder members receive the
  same base layout but dig their own copy independently; it is not a shared
  live board." This direction makes it shared and asynchronous (never live —
  no presence, no realtime). Adopting it means amending that line and the
  Sounder entry's "separate copies". The task brief listed this rule as
  non-load-bearing; the founder should confirm.
- **Late-digger edge.** The fourth pig sees three pigs' reveals. Bounded by
  cluster-per-member (there is always fresh ground) and by the assist mint
  (starters are paid). Watch for "wait for Jen" behaviour in telemetry.
- **Concurrency.** Two pigs digging the same minute both see the open-time
  board; the merge is last-tile-wins on `submitted_at`. Surface it honestly in
  the receipt (`Marco got there first`) — never silently.
- **Meter re-tune.** Finds per Feeding halve; `hunger_meter()` stage
  thresholds and `MILESTONE_THRESHOLDS` need ×0.5 or the season stalls.
- **Push fatigue.** Cap is one marker push per recipient per Feeding; the
  quiet-hours rule of the push pipeline applies.
- **Party of one.** Private 6×5 board, no strip, no marker, receipt says `your
  patch` — exactly today's dig with the layout fixes. No shame state.
- Open: does the marker need a *from* face on the pin, or is the push enough?
- Open: should `Nudge` exist without a marker, or is a marker the only nudge?

## Order of work

1. **Kernel** — `generateCrewBoard`, owner-aware claims, finisher/assist math,
   tests; `STIR_SHOVE 2` under the flag.
2. **Server** — `crew_patches`, `open_rooting`/`submit_rooting` merge,
   receipts; Docker-harness validation; founder "go" before push. Flag off.
3. **Client behind `DIG_CREW_PATCH`** — herd strip, hoofprints/faces in Skia,
   the haul receipt. Marker off.
4. **Marker + push** — `set_patch_marker`, route table, pressure sheet, Nudge.
5. **Gorge + carry** for starters; meter re-tune migration.
6. Flag on for the dev crew for three Feedings; then all.

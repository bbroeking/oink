# The Barn Draw — a random prize mechanic for furnishings (proposal, 2026-09-16)

Numbers: `tools/balance_barn_draw.py`. Catalog: `docs/design/barn-furnishing-expansion-100.json` (80 for-sale designs in 10 collections, 20 milestone gifts). Machinery it reuses: the Monday tickle draw (`20260916110000_monday_tickle_draw.sql`: participation gate, weighted roll, catch-up curve, `app_settings` tuning, one receipt per user per ISO week) and `grant_habitat_item()` (idempotent per `(user, source, source_ref)`).

**A rule this reverses.** The furnishing expansion's recorded rules say *"No random rewards, Motes, wagering, or real-money acquisition."* This proposal keeps the last three and drops the first, on the grounds that the Monday tickle draw (spec'd today) already made random rewards part of the game. That reversal is the founder's to make; it is logged nowhere yet.

## One sentence

**Every Monday, every snout that dug draws a design for their Barn, and each herd draws one gilded piece among its diggers.**

## Why two layers

A single game-wide raffle with a handful of winners fails the charter twice: almost everyone gets a public zero, and at this player base the expected wait is measured in years (3 prizes a week among 400 entrants: a 10-ticket player wins once in 63 weeks; a 1-ticket player once in 965). So the draw has an *everyone* layer, where the smallest prize is still a design, and a *herd* layer, where scarcity lives at the size of the competitive unit.

## Layer 1 · Everyone's draw

**Eligibility.** Same gate as the tickle purse: dug at least one feeding in the draw week. One draw per snout per ISO week; drawable all the following week; the receipt is a row in the same table (or a sibling column on `monday_draws`).

**Prize pool.** The week's *featured collection*, rotating through the ten in `display_order` (`iso_week mod 10`), restricted to its **8 for-sale designs the player does not own**. The two milestone gifts (own 4, own 8), the Wallow keepsakes, the season-pass tiers and the spoils bunting are never in the pool. They stay earned. A drawn design counts toward the collection milestones exactly as a bought one does (`_reconcile_habitat_collection` counts owned for-sale designs regardless of source).

**Odds.** A tier is rolled first, then a design is picked uniformly within that tier among the unowned. Weights are relative, live in `app_settings.barn_draw`, and mirror the purse's shape:

| tier | designs in a collection | price | base weight |
| --- | --- | --- | --- |
| common | 4 | 50 | 60 |
| uncommon | 2 | 100 | 28 |
| rare | 2 | 175 | 12 |

If the rolled tier has nothing unowned, the roll steps to the nearest tier that does. **Catch-up:** the purse's curve, applied to the rare weight, keyed on consecutive draws without a rare (×1.5 after two, ×2 after three, cap ×3). **Complete collection:** if the player owns all 8, the Barn draw pays nothing and the tickle purse is that Monday's whole prize. The draw retires itself per player, per collection.

**What it hands out** (30-week run, 55% weekly eligibility, behaviour knobs in the script):

| measure | value |
| --- | --- |
| designs per player per week | 0.55 |
| snout value per player per week | ≈ 47 |
| rares per player per 30 weeks | 3.0 |
| designs owned after 30 weeks, draws alone | median 17 of 80 |
| a snout who digs every week, 30 weeks | 30 designs · ≈ 2,565 snouts of value |
| completed a whole featured collection from draws alone | 0% |

Read: the draw is a steady drip of about one common a fortnight, worth roughly what one Monday purse is. It never completes a collection on its own, so buying stays the way a collection gets finished and the shop keeps its sink. A weekly digger gets a design every week, which is the rendezvous the charter wants.

## Layer 2 · The herd prize

**Prize.** One **gilded design** per herd per week: a grant-only variant of the featured collection's rare (gold-tinted, `prestigeRank`-style exclusivity, no snout price, no milestone). Ten pieces of art, one per collection; until an asset lands, the client tints the base rare, as `gold_bunting` does today.

**Pool of entrants.** The herd's members who dug that week (quorum applies, as for spoils). A herd of one is its own lottery and simply wins.

**Tickets.** Earned only, never bought, capped at 10 a week:

| action | tickets |
| --- | --- |
| a dug feeding | 1 each |
| a Trough notch crossed (the pot rule's notches) | 1 each |
| a visit-streak day kept | 1 each |

Slop Club membership adds nothing. Snouts add nothing.

**Winner selection.** Weighted sampling without replacement: each entrant gets a key `U^(1/tickets)` with `U` uniform on (0,1); the largest key wins (Efraimidis–Spirakis, exactly proportional to tickets, one line of SQL over `random()`). One prize per player per week even if K > 1. **Verifiability:** the server commits `sha256(seed)` for the week into `app_settings` when the week opens and reveals the seed with the results, so any player can recompute the draw from the published entrant list. Odds shown to the player as `1 in N` from their tickets over the herd's total, the way the purse shows `next_rare_odds`.

**Odds at herd scale** (one prize a week):

| herd | 1 ticket | 6 tickets | 10 tickets | spread |
| --- | --- | --- | --- | --- |
| 5 pigs | 5.5% a week | 26% a week | 36% a week | 6.4× |
| 4 pigs | 9.4% | 32% | 42% | 4.5× |
| 25 pigs (friends + crew) | 0.9% | 5.4% | 8.7% | 9.7× |

A regular digger in a full herd wins the gilded piece about once a month; a once-a-week digger about twice a season. Widening the pool to friends-plus-crew turns that into once or twice a year, which is why the herd is the right scope.

Fairness by construction: odds are linear in tickets and the cap holds the spread to at most 10×; a bottom-half herd finish adds a catch-up step to its members' tickets next week, mirroring the purse; nobody who did not dig is named, and nobody who dug goes home with nothing, because Layer 1 already paid them.

## Where it shows

- **The Monday draw sheet** grows a second envelope: the purse, then the design, on the same pink disc grammar. The gilded piece, when won, gets the season-pass claim sheet (`Hang it in the Barn` / `Claim, hang it later`).
- **The Almanac's Race panel** carries the herd's gilded piece as the week's stake beside the bunting.
- **The Barn collection** marks drawn designs with the existing `new` ribbon and the herd prize as a gilded tile in the collection's row.

## Guardrails

- Faucet bound: ≈ 47 snouts of value per player per week, server-tuned; the pool never includes anything with status attached.
- One design and at most one gilded piece per player per week; already-owned is a no-op receipt.
- Pure server randomness (`random()` inside the RPC), never a client roll; the client prints whatever the tuning row says.
- No real money anywhere near it: no paid tickets, no paid re-rolls, no member odds.

## Build

1. `app_settings.barn_draw` tuning row + compiled fallback. 2. `draw_barn_design()` beside `draw_monday_purse()`, sharing its week and eligibility helpers, granting through `grant_habitat_item(uid, item, 'barn_draw', iso_week)`. 3. `barn_draw_tickets` (user, iso_week, source, n) written by the dig, trough and visit paths; `resolve_herd_prizes(iso_week)` run by the race cycle. 4. Ten gilded assets through the art pipeline. 5. The sheet and the panel rows.

## Open decisions

1. Reverse the expansion's "no random rewards" rule, or not.
2. The herd prize's pool: the crew (5) or friends-plus-crew.
3. Whether Trough notches earn tickets on top of the tickle spill, or only one of the two.

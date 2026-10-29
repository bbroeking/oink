# Card pack cadence model — 2026-10-13

## Recommendation

Weekly-only is too sparse for an 82-identity collectible pool. Launch with:

- one ordinary pack for the first completed, server-receipted Dig of each UTC day; and
- one ordinary Monday pack for an eligible Drum week.

Keep the Prestige parcel out of the baseline forecast because lap speed varies significantly by player. It remains a bonus source rather than the cadence required to make the collection feel alive.

Under the hypothetical pack policy below, weekly-only reaches 90% collection coverage in a median 105 days and full coverage in a median 336 days. Daily plus weekly reaches the same milestones in 14 and 42 days. The daily cadence is fast in its first two weeks, but it gives a daily collector repeated contact with the pack experience and avoids making an 88-card feature feel like a once-a-week side room.

These are simulations of proposed behavior, not approved odds or launch tuning.

## Inputs

The card source is `docs/marketing/trading-cards/base-set-84/cards.mjs`; the simulation read its generated equivalent, `landing/cards/cards.json`. The catalog has 88 identities:

- six Legends, excluded from ordinary packs;
- 31 commons;
- 26 uncommons;
- 16 rares;
- six epics; and
- nine legendary cards, of which six are the excluded Legends, leaving three pack-eligible legendary identities.

The modeled collectible denominator is therefore 82 deck identities.

The welcome grant includes all six Legends plus the exact 12-card Quick Play starter from `docs/design/2026-10-13-card-quick-play-rules.md`:

`ticket_takers_cap`, `bog_helmet`, `release_party_crown`, `toy_sword`, `mud_shovel`, `golden_truffle`, `firefly_aura`, `shadow_aura`, `golden_bog_aura`, `lantern_rabbit`, `bog_frog`, and `truffle_mole`.

The starter owns 12 of the 82 pack-eligible identities before the first random pack: three commons, six uncommons, no rares, one epic, and two legendary identities. This guaranteed epic/legendary coverage materially shortens those rarity pools. All six Legends are also granted, but do not count toward the 82 because ordinary packs exclude them.

The design proposal also mentions two fixed tutorial packs. Their identities are not specified, so this model omits them. Once their fixed contents are chosen, rerun the model from that larger starting collection; every distinct tutorial identity will bring the early thresholds forward.

## Hypothetical ordinary pack policy

Each pack contains five identities in source order:

1. common;
2. common;
3. uncommon;
4. mixed common/uncommon/rare, weighted 60% / 30% / 10%;
5. rare-or-better, weighted rare/epic/legendary 85% / 12% / 3%.

Within the rarity selected for a slot, an unseen identity is chosen before an owned identity. The pack avoids repeating the same identity when that rarity still has another eligible identity outside the current pack.

The simulation does **not** move a slot to another rarity when the selected rarity is fully owned. It draws an owned identity from that rarity. Duplicate protection therefore changes identity selection inside the selected rarity; it does not change the rarity roll. This distinction is necessary to avoid quietly improving published odds after a tier is exhausted.

The 60/30/10 and 85/12/3 weights are explicitly hypothetical. They are useful for comparing cadence, but are not approved player-facing odds.

## Method

The simulation ran 1,000 seeded player histories. Each began with the 12 Quick Play identities. A deterministic PRNG seed derived from `0xC0FFEE` was used for reproducibility. Each pack rolled its two weighted slots independently, then applied the within-rarity unseen-first rule and in-pack identity protection.

Coverage thresholds use `ceil(82 × threshold)`:

- 50% = 41 identities;
- 75% = 62 identities;
- 90% = 74 identities; and
- 100% = 82 identities.

Two schedules were compared:

- **Weekly:** one pack every seven days.
- **Daily plus weekly:** one pack per day plus an additional Monday pack, or eight packs per seven days. On Monday, the two entitlements are separate and may both wait unopened on the shelf.

Prestige packs, finishes, alternate art, future sets, purchases, trading, crafting, and any conversion of repeat copies were excluded.

## Results

### Calendar time to unique coverage

| Coverage | Weekly p10 | Weekly median | Weekly p90 | Daily + weekly p10 | Daily + weekly median | Daily + weekly p90 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 50% (41/82) | 42 days | 42 days | 42 days | 6 days | 6 days | 6 days |
| 75% (62/82) | 70 days | 70 days | 70 days | 9 days | 9 days | 9 days |
| 90% (74/82) | 98 days | 105 days | 112 days | 13 days | 14 days | 14 days |
| 100% (82/82) | 189 days | 336 days | 595 days | 24 days | 42 days | 75 days |

Mean completion was 374.9 days for weekly and 47.3 days for daily plus weekly. The pack-count distribution is identical between schedules: p10 27 packs, median 48, p90 85, mean 53.6. Calendar cadence is the difference.

The first thresholds are unusually tight because duplicate protection ensures that almost every early slot produces a new identity. The completion tail is broad because protection does not upgrade rarity. Once common, uncommon, and rare identities are exhausted, the player still needs the rare-or-better slot to roll the remaining epics at 12% or the remaining pack-eligible legendary at 3%.

### How quickly packs stop feeling new

The following values are the chance that a particular numbered pack contains at least one new identity, across all histories that still needed that pack:

| Pack number | Mean identities owned before pack | Chance of any new identity | Mean new identities in pack |
| ---: | ---: | ---: | ---: |
| 1 | 12.0 | 100.0% | 5.00 |
| 5 | 32.0 | 100.0% | 4.99 |
| 10 | 57.0 | 100.0% | 4.94 |
| 15 | 73.4 | 98.6% | 1.94 |
| 20 | 78.5 | 21.7% | 0.22 |
| 30 | 79.5 | 11.3% | 0.11 |
| 50 | 80.4 | 7.8% | 0.08 |

The collection experience has two very different phases:

- Packs 1–10 are almost entirely new cards.
- Around pack 15, common and uncommon protection is largely exhausted and new-card yield falls sharply.
- From pack 20 onward, the player is usually waiting for a small number of epic or legendary rarity rolls.

Across all new-card events, the weekly schedule produced a median seven-day gap, p90 35-day gap, and p99 196-day gap. Daily plus weekly produced a median one-day gap, p90 four-day gap, and p99 25-day gap. These event-gap values mix the generous early phase with the completion tail, so the pack-number table is the clearer product view.

## Interpretation

### Weekly-only is not a viable primary collection cadence

Weekly creates only five reveals per week. Even with strong unseen-first protection, half of the collection takes six weeks, 75% takes ten weeks, and 90% takes about fifteen weeks. The median full set takes 48 weeks; the p90 player takes 85 weeks. By pack 20, roughly five months into a weekly cadence, only about one pack in five contains anything new.

That pace can support an occasional prestige-like parcel, but it cannot carry the launch promise of opening, animating, collecting, and using an 82-identity deck pool.

### Daily plus weekly is appropriate for the collection pilot, with two cautions

Daily plus weekly makes the feature legible quickly: half the pool by day 6, three quarters by day 9, and 90% around day 14. It also gives the Rive opening work frequent use instead of one interaction per week.

The first caution is ceremony load. Eight packs per week means unopened entitlements must queue on the shelf and never interrupt a Dig or the Monday Drum. Batch-open and skip-to-receipt controls will matter earlier than the design may suggest.

The second caution is the pack-20 cliff. The proposed protection policy front-loads breadth, then leaves a long epic/legendary tail. That may be desirable if finishes, favorites, album display, and duplicate keepsakes make repeats enjoyable. If repeats feel empty, changing daily cadence will not fix the tail. The team would need a separately approved rule such as a visible rarity-specific pity counter, a set-completion choice, or a cosmetic surplus use. None is included in this recommendation.

## Earn source contract

The daily entitlement should be granted for the **first completed, server-receipted Dig in a UTC day**. It should be deterministic and once per day, not a chance attached to a find. Later Feedings that day should not grant another pack, and missed days should create no streak loss or catch-up debt.

The durable source must be server-side. Existing `rooting_receipts` are unique per `(user_id, window_index)`, but a daily entitlement also needs a unique source key such as `(user_id, source = daily_dig, UTC date)`. A crewless player must be eligible through the same successful Dig receipt. Do not infer eligibility from a client-local practice board, Sounder membership, or a UI completion callback.

The Monday entitlement remains keyed to the eligible Drum week and does not scale with balls. Its existing Tickle purse remains unchanged.

## Economy impact

Earned cards have no live currency value in this proposal. They cannot be bought with or converted to Tickles, Snouts, Motes, Golden Truffles, cosmetics, membership time, or store credit. Quick Play wins and losses mint nothing. Increasing pack cadence therefore does not inflate the live currency economy or alter standings.

It does increase **content supply** and opening attention. Players will own most common and uncommon identities quickly, and repeat counts will grow. That is a collection-design and production-capacity issue, not currency inflation. It should be measured through new identities per pack, unopened-pack backlog, reveal skips, favorite/album use, match starts, and repeat sentiment.

## Launch decision

Use daily first-Dig plus weekly Monday as the launch cadence for the collection pilot. Keep both sources earned, fixed, server-receipted, crew-independent, and non-streaking. Treat the hypothetical slot weights as a versioned experiment and publish them only after approval.

Before final tuning, rerun this model with the two fixed tutorial-pack identities, the actual Prestige Path completion distribution, and any approved repeat utility. The most important live checkpoint is pack 15–20: that is where the current policy changes from a stream of discoveries into a rarity tail.

## Reproducible repeat and foil extension

`scripts/prototypes/card-economy/simulate.mjs` independently reruns the same hypothetical collation against `landing/cards/cards.json` and reports completion-pack distribution, duplicate frequency by pack, repeats accumulated at completion, and the cadence of ten-repeat cosmetic claims. Reproduce with:

```sh
node scripts/prototypes/card-economy/simulate.mjs 10000
```

The 10,000-history run on 2026-10-13 returned median completion at 48 packs (p10 26, p90 84), matching the earlier 1,000-run result within expected Monte Carlo variation. Completion itself accumulated a median 170 repeats (p10 60, p90 350). The abrupt duplicate phase is visible directly:

| Pack | Any-repeat frequency | Mean repeats in pack |
| ---: | ---: | ---: |
| 1 | 0.0% | 0.00 |
| 5 | 0.3% | 0.00 |
| 10 | 5.1% | 0.06 |
| 15 | 100.0% | 3.07 |
| 20 | 100.0% | 4.79 |
| 30 | 100.0% | 4.89 |
| 50 | 100.0% | 4.91 |

With one credit per repeat and an illustrative cost of ten, the first affordable foil occurred at median pack 15 (p10 14, p90 15) and the tenth at median pack 34 (all reported percentiles 34). Calendar medians are about day 14 and day 30 at daily-plus-Monday full participation, or weeks 15 and 34 at weekly-only participation. Those conversions are schedule arithmetic, not retention forecasts.

Selection must not affect this cadence: with no goal, credits bank; with a selected eligible owned card, an explicit claim may debit ten; changing the selected goal preserves credits and every collected copy; any surplus carries over. Thus selection/no-selection are contract states rather than different random-economy scenarios.

These results are a sensitivity check on the provisional ten-repeat cost under the same unapproved slot weights, not approval of either the weights or the price. In particular, a tenth foil by pack 34 may be too fast if every finish needs bespoke art and too slow if finishes are a primary repeat-satisfaction loop. Test alternative costs only after production capacity and tutorial-pack contents are known.

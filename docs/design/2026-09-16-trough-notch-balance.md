# Trough notch reward — balance loop results (2026-09-16)

Tool: `tools/balance_trough_notch.py` (fixture: `tools/balance/catalog_costs.json`, the live catalog prices read 2026-09-16; output: `tools/balance/trough_notch.tuned.json`). Design: `docs/design/claude-design/shop-2026-09-16/`.

The loop simulates Troughs under the server's real rules (opener seeds 10%, per-donor quarter cap, 12h cooldown, 72h window, 10 · 25 · 50 · Max chips), measures what a reward rule mints, scores it against guardrails, nudges the rule, and repeats until nothing improves. Player behaviour (sounder size, chip odds, wallets) is a set of knobs at the top of the script.

## What the loop found

1. **Today's rule barely pays.** `floor(snouts/100)` is 0 for every 10 / 25 / 50 chip, so the 1-per-100 credit mints ≈ 0.24 tickles per drive and 95% of donors get nothing. "Match today's budget" is therefore not a usable target; the usable bound is the 2026-07-20 ceiling — a Trough mints at most `cost / 100`.
2. **A fixed drop table cannot be balanced against a ceiling that scales with price.** Any table that feels like something on a 120-snout Trough overshoots its 4-tickle ceiling (the server clamp bit on 12–55% of drives across the search), and any table that respects the cheap ceiling underspends the pricey ones.
3. **A slice of the allowance per notch is better but still overshoots**, because four independent random draws summing to the allowance overshoot half the time by construction.
4. **The pot rule balances itself.** The Trough holds a pot of `max(4, floor(cost/100))` tickles. Each notch a chip pushes past spills a random share of what is *left* in the pot (2/8 to 6/8 of the remainder); the filling notch spills the rest. The total can never exceed the pot, so nothing is ever clamped, a funded Trough always spends its whole allowance, and the amount is a genuine surprise. Every guardrail held on the first table and on three fresh seeds:

| policy | mint per drive | per 100 snouts | per donor | donors with 0 | chips that drop |
| --- | --- | --- | --- | --- | --- |
| today · floor(snouts/100) | 0.24 | 0.12 | 0.06 | 95% | — |
| pot · [2–6]/8 of what's left, floor 4 | 3.54 | 1.75 | 0.90 | 55% | 26% |
| pot · same, floor 0 (pure cost/100) | 2.49 | 1.24 | 0.64 | 65% | 20% |

Mint per *funded* drive with the floor-4 pot: 4.13 (a 400-snout Trough holds 4; a 1,200-snout one holds 12). Funded rate under the default behaviour knobs: ≈ 25% (the quarter cap needs four pigs).

## The two questions, answered by the numbers

- **Q1 — replace or stack?** Replace. Stacking the old 1-per-100 credit on top adds 0.24 tickles per drive; its real cost is a second sentence in the Field Guide. Recommend: the pot rule *is* the Trough reward.
- **Q2 — bank only, or `tickles_earned` too?** Bank only. If the credit also landed in `tickles_earned`, a player chipping into six drives a season would add ≈ 5.4 tickles to Most Tickles (≈ 1.4% of the ~400 a regular player plays). Small, but bank-only is zero by construction and keeps the 2026-07-17 ruling intact: a tickle counts when it is played.
- **The floor.** Keep `min_drive_cap = 4` so a cheap Trough can still drop about one tickle a notch; with a pure `cost/100` pot, items under 100 snouts hold nothing and the reward vanishes exactly where friends chip in most.

## What still lives with the founder

- The "donors with nothing" number (≈ 55%) is the honest cost of notch granularity: four notches, four to eight donors, most chips cross nothing. If that feels thin, the alternative is a tiny per-chip roll on top, which the loop can add as a policy.
- The behaviour knobs are assumptions. Once the store ships, replace them with the real `item_drive_donations` distribution and rerun.

## Rerun

```
python3 tools/balance_trough_notch.py                      # pot policy, floor 4, prints the report
python3 tools/balance_trough_notch.py --min-cap 0          # pure cost/100
python3 tools/balance_trough_notch.py --policy slice       # the rejected independent-slice rule
python3 tools/balance_trough_notch.py --drives 20000 --seed 7 --write tools/balance/trough_notch.tuned.json
```

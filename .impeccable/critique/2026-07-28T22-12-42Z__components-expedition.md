---
target: components/expedition (Rosie's Ramble v0 screens)
total_score: 22
p0_count: 1
p1_count: 2
timestamp: 2026-07-28T22-12-42Z
slug: components-expedition
---
Method: dual-agent (isolated design-review + detector-evidence subagents)

# Critique — Rosie's Ramble v0 screens (components/expedition)

## Design Health Score — 22/40 (Acceptable: significant improvements needed)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Nothing says time-away = walking; Zoomies silently reset on wall arrival; tucked card invisible unless in today's hand |
| 2 | Match System / Real World | 3 | "segments" leaks sim jargon; "8h of 20h away" bills the player for lost hours |
| 3 | User Control and Freedom | 2 | One-tap permanent Training tuck, no confirm/undo; no backdrop-tap dismiss; edge-swipe exits whole feature mid-fight |
| 4 | Consistency and Standards | 2 | Raw-Text kickers beside SectionHeader; RARITY_COLORS vs theme's RARITY_STRIPE; dot-vs-stripe for same rarity concept; "defeated" vs "steps aside" |
| 5 | Error Prevention | 2 | Trip-only cards playable in fights (zero effect); out-of-tickles dead end; unguarded permanent tuck |
| 6 | Recognition Rather Than Recall | 2 | Gear chips hide their stats — the equip decision can't be reasoned locally; tuck/play dual role untaught |
| 7 | Flexibility and Efficiency | 3 | Dev warp good; loop short |
| 8 | Aesthetic and Minimalist Design | 2 | 9-section scroll, two competing full-width CTAs, 7 eyebrows on one screen |
| 9 | Error Recovery | 2 | predictFight gives the wrong "why" when the tickle jar is empty |
| 10 | Help and Documentation | 2 | Enemy behavior lines = the law done right; but dev copy inside the player-facing send-off hint |
| **Total** | | **22/40** | |

## Anti-Patterns Verdict

Does not read as generic AI game UI — voice, ink silhouettes, and token discipline are unmistakably TTP. The slop here is the house kind: **governance erosion.** LLM + detector agree on: 15 fontSize overrides on TYPE roles (9/10/15/24 — two missing roles being voted for), 1 detector finding (SpaceMono-Regular outside DESIGN.md, dev drawer), 4 off-scale spacing literals, kicker density (7 eyebrows on the journal), rarity swatches pulled from constants/hats.ts instead of theme's RARITY_STRIPE, zero tilt on the interactive layer (Sticker clones with the scrapbook angle amputated), no Tape on the postcard, and **zero motion** in a codebase with 18 animated refs in Barn.tsx alone. Clean: 0 raw hex, 0 emoji, correct shadows, all shared-Button targets ≥44pt, all body-text contrast ≥4.5:1 (only sub-4.5: muteSoft placeholder glyphs at large sizes, AA-large borderline). Browser overlays N/A (native).

## Priority Issues

- **[P0] The send-off tickle is a placebo.** settle() zeroes zoomies on wall arrival (utils/expedition.ts:847) and walking zoomies do nothing — the ritual spends a tickle for zero effect under copy claiming "affection helps." Honesty is the charter. Fix in kernel: carry send-off zoomies into the first wall or make the send-off free and ceremonial and say so.
- **[P1] predictFight is tickle-blind.** At 0 tickles it says "stuck" but blames gear (utils/expedition.ts:985-1005). Violates the loss-legibility law. Branch the why on bursts <= 0.
- **[P1] Gear is illegible at the moment of choice.** No stat pips on chips/cards; prediction a full scroll from the choices it grades. Add bonk/cushion/sparkle pips, show the enemy ask beside the verdict, dock the prediction.
- **[P2] Victory shows the wrong enemy.** ScuffleView.tsx:70 falls back to the goose when wallEnemyId nulls on defeat — beat the snail, see a dimmed goose.
- **[P2] Peak with no ceremony.** Postcard (the loop's peak) and burst/HP moments are static; add tape-in, staggered finds, animated bar — through useMotionPolicy (reduced-motion).
- **[P2] Send-off IA.** Two competing CTAs, 9 sections, RoadMap never scrolls to Rosie, dev copy in the player hint (JournalHome.tsx:126-129).
- **[P3] Governance sweep.** Promote 9/15pt to TYPE roles; adopt RARITY_STRIPE; one rarity affordance; kicker diet; a11y (RosiePose/EnemySilhouette labels, accessibilityViewIsModal on 3 overlays, progressbar roles); scrim vs safe-area insets; 2 unused imports; "segments"→player word; reframe "8h of 20h".

## Persona Red Flags

- **Casey (one-thumb, interrupted):** state survives interruption (AsyncStorage per action — good); send-off CTA at the bottom of a 9-section scroll; mid-fight return lands on journal; edge-swipe exits the feature.
- **Jordan (first-timer):** fails at beat two — nothing teaches time-away = walking, "tuck" undefined, dual-role card untaught, ZOOMIES unglossed, and the first taught action (send-off tickle) is a placebo, teaching a false lesson.
- **Warm-spare-minute friend (90s):** postcard auto-presents on focus — perfect; then dropped onto the full journal with no "what matters now"; the fight is 10 metronomic taps of one button against a 90-second budget.

## Minor Observations

TAB_SAFE on a non-tab screen; overlays are Views not Modal (no focus trap); yesterday's tucked card active-but-invisible (spec's satchel summary missing); GearRack renders nothing for empty gearOwned (unreachable today); mute-on-cream all pass contrast; hydrate() fail-soft is good craft.

## Which UI earns its place

| Surface | Verdict |
|---|---|
| Journal home | Needs rework — no ritual verb, competing CTAs, prediction far from choices |
| Send-off (gear+cards) | Needs rework — illegible stats, untaught tuck, placebo tickle |
| Postcard | **Earns it** — right content model, right voice; needs ceremony, not rethink |
| Fight | Needs rework — legible but emotionally flat; wrong-enemy victory bug |
| Bestiary | **Earns it** — ?→silhouette→dimmed at near-zero art cost; "defeated" needs the house voice |

## Questions to Consider

1. Is Zoomies a feeling? The charter says feelings are shown, never numbered — should Rosie's excitement be sprite energy instead of "0/5"?
2. Does the trip need a verb? Real-elapsed accrual means she's always already walking — commit to a "wave her off" ritual or redesign the journal as a live window.
3. Should affection be ammunition? The fight spends tickles (the currency of warmth) as tap-ammo — does that survive the SKILL.md lens?

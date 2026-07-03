---
title: "Mud Wars — the complete rewards spec (Golden Truffles, payouts, exclusives)"
type: memo
date: 2026-07-03
tags: [mud-wars, rewards, economy, golden-truffles, war-spoils, exclusives, season-2, founder-decision]
status: draft
---

# Mud Wars — the rewards spec

What you get for fighting: the Golden Truffle economy, the exact win/lose/draw payout table, participation prizes, and the exclusives release program. Grounded in the shipped code (verified 2026-07-03): the 25 `war_exclusive` cost=0 items (`20260650`), the winner-only random-drop trigger (`grant_war_spoils_on_resolve`, `20260660`), the raw-snout winner payout in `resolve_war` (`20260668:640-646` — own mud 1:1 + 50% loser pot, THE open faucet), `war_winner_regen` 72h + `mud_champion/veteran/legend` at 1/5/25 wins, and `buy_hat` (`20260688`) as the redemption template. Folds in the founder direction from [[mudwar-hunger-arc-cadence-2026-07]]: the Truffle Dig heartbeat, and dug truffles ARE the war currency.

**One paragraph:** Everything the war pays out is either a **Golden Truffle** (the war-only currency you dig from the Hunger's hoard and earn from wars — spendable only at the **Truffle Exchange** on war-exclusive cosmetics) or a **direct cosmetic drop** (win drops, loss consolation, season commemoratives). Snouts leave the war economy entirely — `resolve_war` stops minting them (closing rollout precondition #2 / open decision B2). Winners earn more truffles, a tier-weighted drop, titles, and the regen buff; **losers always carry something home**; every contributor gets paid something; ghosts get nothing.

---

## 1. The Golden Truffle economy

**Fiction:** the Hunger compresses stolen tickles into golden truffles and buries them. Every truffle you dig up or shake loose in a war is joy pried back from his hoard.

### Sources (per member, all war-scoped)

| Source | Amount | Cap |
|---|---|---|
| **Truffle Dig** (8h feeding window, [[mudwar-hunger-arc-cadence-2026-07]]) | 1/dig; **2** when the golden echo fires (2+ crewmates dig the same window) | 6/day |
| **Personal mud milestones**, minted DURING the war (losers-keep research: pay along the way, not only at resolve) | cross 10 mud → 5 · cross 25 → 10 · cross 50 → 15 | 30/war |
| **War resolve — WIN** | 20 + floor(own mud / 5), capped +20 | 40/war |
| **War resolve — LOSS** | 10 + floor(own mud / 10), capped +10 | 20/war |
| **War resolve — DRAW** | 15 flat, both crews | — |
| **No-quorum war** | 5 to anyone with ≥1 action | — |
| **Bot war win** | 10 flat (replaces the 25-snout HOUSE_BONUS) | — |
| **Season stage-drop** (Hunger crosses a stage) | 15 to every player who contributed during that stage | 5×/season |

A weekly-active war pig lands **~50–65 truffles/week**; a heartbeat-only player (digs, no wars) ~15–20.

### Sinks

- **The Truffle Exchange** — the war shop (§4a). The only sink in v1; keep it that way so pricing stays legible.
- Explicitly NOT sinks: no truffle→snout conversion in either direction, ever (the isolation firewall in currency form).

### Caps + anti-abuse

- **Pouch cap 999.** At cap, digs/milestones still bank mud and drain the Hunger but mint 0 truffles, with a gentle nudge: *"Your pouch is full — the Exchange is open."* **Never lossy auto-conversion** (CoC League Medals' one hated mistake).
- **Bot wars:** 10 truffles flat, and — **policy fix** — the random cosmetic drop fires on the **first bot-war win only** (onboarding taste of spoils). Discovered live discrepancy: the shipped trigger grants a cosmetic on EVERY human-beats-bot resolve (`20260660` only guards the memberless-bot-wins case), while the lint doc claims bot wars grant no cosmetics. Since bot wars stamp no 24h cooldown, that's a slow but real farm (~1 exclusive/war-length). Close it in the trigger carry.
- **Alt-proofing:** truffles mint only from war-scoped actions already behind the crew/war membership gates; digs are 1/window/member (composite-PK bucket, whale-flat); milestone mints key off the same capped mud that feeds the fold.
- All grants flow through one `mint_truffles(user, delta, reason, war)` helper → both the balance and the ledger, so every truffle is auditable.

### Migration shape (recommendation: column + ledger)

`profiles.golden_truffles bigint NOT NULL DEFAULT 0` (fast reads, `buy`-style `FOR UPDATE` debits) **plus** append-only `truffle_ledger (id, user_id, delta, reason text, war_id, created_at)` for audit/abuse analytics. A ledger-only design makes every balance read an aggregate; a column-only design loses provenance. Both is cheap.

**Sequencing footgun:** the resolve payout swap carries `resolve_war` — **from the `20260668` def**, and if Bog Weather (M1, [[mudwar-scope-a-weathered-2026-07]]) has landed first, from M1's def. Milestone mints ride the SAME `throw_mud`/`submit_run` carries M1 makes — author them as one combined carry pass, never two migrations carrying the same function independently ([[project_carry_latest_def_footgun]]).

---

## 2. Per-war payout table (all gated on ≥1 war action — ghosts get nothing)

| Outcome | Truffles | Cosmetic drop | Titles / progress | Buff | Narrative beat |
|---|---|---|---|---|---|
| **WIN** | 20 + floor(own/5) (≤40) | **1 tier-weighted drop**, unowned-only: Muddy 40 / Caked 30 / Prize 20 / Champion 8 / Heirloom 2 (%) | `war_wins`+1 → mud_champion / veteran / legend at 1/5/25 | `war_winner_regen` ×0.85, 72h (shipped) | "The Hunger lost N tickles — and your crew carried the day." |
| **LOSS** | 10 + floor(own/10) (≤20) | **Guaranteed 1 Muddy-tier consolation** from a fixed pool (`muddy_cap`, `mud_shovel`, `mud_splatter_aura`), unowned-first, 1/war | — | — | "You lost the rope — but the Hunger lost N tickles." |
| **DRAW** | 15 both sides | Loss-consolation rules for both crews | — | — | "No one took the rope. The Hunger still went hungry." |
| **NO-QUORUM** | 5 | 1 Muddy recolor to anyone with ≥1 action | — | — | "Too few pigs answered — but every dig counted." |
| **BOT WAR (win)** | 10 flat | First bot win only: 1 Muddy/Caked drop | no war_wins, no titles (shipped rule, keep) | regen buff (shipped, keep) | "The Mudlarks scatter. Practice pays a little." |

**Soft pity (v1, no new column):** after 2 consecutive losses/draws (COUNT over resolved wars), the next win-drop rolls ≥Caked; after 3, ≥Prize. **Dupe insurance:** the unowned-only filter is already shipped; when a tier is owned out, escalate to the next tier; when all 25 are owned, the drop pays **30 truffles** instead (*"Your trunk is full — the Exchange pays out."*).

**What this replaces:** the shipped `own + 50%-loser-pot` raw-snout mint into `counter`/`tickles_earned` (`20260668:640-646`) is **deleted, fully, at the flip** — no grandfathering concern; the war has never been player-visible. `tickles_earned` and the leaderboard stop being touched by wars at all (precondition #2 closed).

---

## 3. Participation prizes

- **In-week milestone mints** (§1) — the war pays as you play, so a mid-week dropout still banked something.
- **Dig treatment is gift-framed, never streak-framed:** no "dig streak," no broken-chain UI. Instead a per-war **Snuffle Count** (windows dug this war) that only fills: 10 windows in one war → +10 truffle bonus at resolve, win or lose. Missed windows are simply never shown.
- **Permanent kept title** (the Truffle Hunt lineage): **"Truffle Snuffler"** at 50 lifetime windows dug; **"Master Snuffler"** at 250. Cosmetic, survives season resets.
- **Crew-level:** Mud Fort stages (A-v1) stay the crew's shared visible milestone; fort completion (stage 6) mints +10 truffles to every contributor — the "we built this" bonus.
- **Season-level:** each Hunger stage-drop pays 15 truffles + a commemorative (§4e) to that stage's contributors.

---

## 4. The exclusives release program

Everything war-exclusive stays `cost=0` (unbuyable with snouts — `buy_hat` rejects it, shipped) and is priced **only in truffles** or granted directly.

**(a) The Truffle Exchange — rotating stock.** 4 slots, rotating weekly on the same ISO-week key as Bog Weather (one shared "the bog turns over on Monday" moment): 1 Muddy recolor slot · 1 Caked slot · 1 Prize slot · 1 marquee slot alternating Champion/Heirloom. Small window = scarcity with a return promise (stock recurs on a published cycle — no one-time-ever FOMO). Prices: **Muddy 25 · Caked 60 · Prize 120 · Champion 250 · Heirloom 500**, Heirloom purchases cooldown-limited to 1/player/4 weeks (CoC's apex-item pacing, minus the overflow sin).

**(b) Named-season vaulting.** The shipped 25 carry `war_season='s2_mud_derby'` conceptually (column lands with this build). At season end the s2 pool **vaults**: no longer drops or stocks, permanently wearable. Each future war season ships its own ~25-item batch (one art run + recolors). **Flashback weeks**: 1 week mid-next-season where the Exchange marquee slot stocks a vaulted item at +50% price.

**(c) Sets + capstones (phase-2, art already defined).** `cosmetic_sets` + `set_id`: **Swamp King** (swamp_crown, bog_helmet, golden_truffle, golden_bog_aura, golden_mire_bg) and **Mud Derby Festival** (rosette_cap, prize_sash, festival_pennant, confetti_aura, mud_derby_bg, festival_night_bg). Completing a set grants an unbuyable **capstone** (Swamp King's Court aura / Festival Float held) — capstones are where **animation** lives ("motion at the top — players can't fake it"), via the Phase-3 sprite-sheet path. No set completes in one war by construction (drops + weekly stock pacing).

**(d) Apex: evolving Heirlooms (phase-2).** `evolve_stage` bumps an owned Heirloom's look per 5 war wins with the same crew — the crew-permanence reward (gates on decision B3 = permanent crews, recommended yes).

**(e) Season-stage community grants.** One commemorative recolor per Hunger stage crossed (5 total, e.g. "Peckish Pin"), granted to that stage's contributors — a wearable timeline of the season's story. **Famished finale exclusive:** "Hunger's Bane" title + a finale item (the Hunger's own tilted crown, `hungers_crown`) for everyone with ≥1 war action during the season, granted by the Judgement-Day job if the meter completes.

**(f) First 8 weeks (from the flip):**

| Week | Exchange marquee | Event beat | New release |
|---|---|---|---|
| 1 | Champion: swamp_crown | flip week; first bot-war drop live | Exchange opens (25 + first 8 recolors) |
| 2 | Heirloom: firefly→golden ladder (Prize: golden_truffle) | first full PvP week | +8 recolors |
| 3 | Champion: confetti_aura | expected Hunger stage-drop #1 | commemorative #1 |
| 4 | **Heirloom: heirloom_mire_aura** | Flashback preview teased | +8 recolors |
| 5 | Champion: bog_dusk_bg | stage-drop #2 pace check | commemorative #2 |
| 6 | Heirloom: golden_mire_bg | **sets announced** (progress strips visible) | set_id backfill (phase-2 start) |
| 7 | Champion: festival_pennant | Mud Derby Festival set week | derby recolors |
| 8 | Heirloom: festival_night_bg | season-half review; retune prices/thresholds | Swamp King capstone art revealed |

---

## 5. Rarity ladder v1 — mapping the shipped 25

War-facing tier names relabel the shipped `hats.rarity` values (no schema change: Muddy=common, Caked=uncommon, Prize=rare, Champion=epic, Heirloom=legendary):

- **Muddy (5):** muddy_cap · slop_bucket · mud_shovel · mud_splatter_aura · mud_pit_bg
- **Caked (5):** slop_bucket_hat · reed_hat · mud_pie · swamp_bubble_aura · reed_marsh_bg
- **Prize (7):** bog_helmet · golden_truffle · crew_pennant · firefly_aura · mud_derby_bg · rosette_cap · prize_sash
- **Champion (5):** swamp_crown · golden_bog_aura · bog_dusk_bg · festival_pennant · confetti_aura
- **Heirloom (3):** heirloom_mire_aura · golden_mire_bg · festival_night_bg

Win-drop odds 40/30/20/8/2 (loss = guaranteed Muddy pool). The shipped trigger's flat `ORDER BY random()` becomes a tier-weighted pick in the same carry. **Volume engine:** `scripts/recolor.py` on the 6 base anchors × 8 mud-tones ≈ **34 free SKUs** — released 8/two-weeks to keep the Exchange's Muddy/Caked slots fresh without new art quota.

---

## 6. Build cost

| # | Item | Surface | Est |
|---|---|---|---|
| R1 | Golden Truffles: column + ledger + `mint_truffles` + resolve_war payout swap + milestone mints (combined carry with Bog Weather M1) + bot-policy fix + tier-weighted/pity drop (extends the 20260660 trigger carry, absorbing A-v1's M5 consolation) | 1–2 migrations | 2.0 d |
| R2 | Truffle Exchange: `exchange_stock()` (ISO-week rotation) + `redeem_war_cosmetic()` (buy_hat clone, truffle-denominated, Heirloom cooldown) + Exchange sheet UI (members-shop band pattern) | 1 migration + 1 component | 1.5 d |
| R3 | Payout surfacing: truffle pouch chip (war screen + Exchange), resolved-modal payout/consolation/drain lines, WarSpoilsSheet tier styling | existing components | 0.5 d |
| | **Rewards v1 total** | | **4.0 d** |

Reconciled against the path in [[mudwar-hunger-arc-cadence-2026-07]] (~16 d): R1 absorbs A-v1's consolation migration (−0.5) and the dig RPC already mints truffles (−0.5), and this work **replaces** the separately-estimated "build the token ledger during A" item from [[mudwar-scope-c-hungers-hoard-2026-07]] (2–3 d). **Net add ≈ +3.0 d → ≈ 19–20 dev-days to a bounded-cohort flip, with the economy wall (precondition #2) closed for good.** Phase-2 (sets/capstones/evolve/animation, §4c–d): L, post-flip, gated on B3.

---

## 7. Principle + firewall check

| Stream | Verdict |
|---|---|
| Dig truffles | floor-verb, capped 6/day, whale-flat (P3) ✓ · echo = rendered co-presence (P5/P6) ✓ |
| Milestone mints | pay-as-you-play, win-or-lose (P4 race-not-duel inside the duel) ✓ |
| Win/loss purses | both sides paid; winner premium preserved; capped (P3/P4) ✓ |
| Consolation + pity | loss never pays zero; caps prevent lose-farming (1/war, Muddy-only) ✓ |
| Snuffle Count | gain-only, no broken-streak framing (P8 gift-not-guilt) ✓ |
| Exchange | published rotation, recurring stock — scarcity without one-time FOMO (P8) ✓ · volume from recolors/sets, not art quota (P9) ✓ |
| Titles/commemoratives | persistent name-attributed artifacts (P7) ✓ |
| **Firewall** | truffles ↔ snouts never convert; war items stay cost=0/unbuyable; resolve_war stops touching counter/tickles_earned/leaderboard; nothing reads VIP/alignment/wealth ✓ |

Residual risks: Exchange pricing is guesswork until real earn rates exist — re-tune at week 8 (calendar). The 2% Heirloom drop on a ~30-player beta means Heirlooms effectively come from the Exchange first; that's intended (earned saving, not lottery).

## Connects to
- [[mudwar-hunger-arc-cadence-2026-07]] — the arc + the dig verb this pays out
- [[mudwar-scope-a-weathered-2026-07]] · [[mudwar-scope-c-hungers-hoard-2026-07]] — build plans this folds into
- [[mudwar-consolidated-brief-2026-07]] — the designed-only economy (A11–A13) this v1-izes
- [[mudwar-war-spoils-items]] — the 5-tier ladder / sets / gacha source design

# Spec 21 — Race tickle spoils + the weekly board as the hero

**Status:** authored, migration UNPUSHED (founder pushes). Client + spec land together.
**Charter fit:** Contend (the winnable-every-Monday race is legible and rewarding) · Connect (every digging Sounder takes a share — no public zero).

## The problem

The Dig-Off has two boards riding one RPC (`race_standings`): a **season-cumulative**
board (every crew's finds all season) and a **weekly** race (finds per digging
snout, Monday spoils). But the season tab made the *season* board the headline and
buried the weekly race as a one-line beat — the opposite of what serves the game.
The weekly race is the one **anyone can win by simply digging strong this week**;
it should read first. And the weekly spoils (Golden Truffles + a podium hat) were
stated only as a faint line — the reward wasn't obvious, and small/sub-quorum
Sounders that dug all week won **nothing** at all.

## The decision

1. **Promote the weekly board to the hero.** On the season tab's dig-off area the
   **weekly race is the top, biggest card** (a `sun` Sticker), with a prominent
   **this-week's-spoils strip**. The **season-cumulative board drops below** as a
   secondary, **collapsible** card (peek of 3 rows → expand → full-field link) —
   always visible, never the focus.

2. **Tickles become a spoil, top-heavy, everyone-who-digs-wins.** On top of the
   existing truffle + podium-hat payout, the weekly race now banks **tickles**:
   - **Podium (per digging member):** 1st **25**, 2nd **15**, 3rd **10** tickles.
   - **Field (per digging member of a ranked crew):** top half **6**, the rest **4**.
   - **Participation floor:** every digging snout in a **sub-quorum** crew (dug ≥1
     but < the 2-digger quorum) banks **3** tickles. A solo digger's week is never
     a public zero — showing up earns something.
   Concrete numbers are **server-tunable** (`_race_tickles_for_rank`); the client
   renders what `race_standings().prizes` reports, with a compiled fallback
   (`DEFAULT_RACE_PRIZES`) for a pre-push client. Every tier is ≥ the floor and
   every ranked tier beats sub-quorum, so the ladder reads honestly top-to-bottom.

3. **Tiebreak honesty is absolute.** Tickle spoils are paid into the **spendable
   tap pool** via `grant_tickles()` (`user_items.item_count` — the "ready to
   tickle" bank; over-cap-tolerant). They **NEVER touch `profiles.tickles_earned`**,
   which is the season's Most-Tickles tiebreak and must stay *earned by tickling*.
   Adding granted tickles there would repeat exactly the pollution the spec-15
   clawback removed. `grant_tickles` is the audited chokepoint (20260580) and
   writes `item_count` only — verified.

## Prize ladder — why these numbers

Tickles are a **consumable tap currency**, not status: spent constantly, capped at
25 (50 for members), regenerated on a clock. A weekly grand prize of 25 tickles
(over a non-member's whole bank) is exciting and obvious without polluting anything
— it's a day-plus of taps handed to the winning barnyard, gone once spent, invisible
to every leaderboard. The floor of 3 is a warm token for the small herds, not an
economy faucet. Truffles + the podium hat (the status rewards) are unchanged.

| Tier | Tickles | Truffles | Podium hat |
|---|---|---|---|
| 1st | 50 | 12 | yes |
| 2nd | 30 | 5 | yes |
| 3rd | 20 | 8 | yes |
| ranked, top half | 12 | 5 | — |
| ranked, rest | 8 | 2 | — |
| sub-quorum digger | 5 | — | — |

Paid **per digging member** (a member who didn't dig gets nothing — leavers forfeit,
per the departed-ledger rule). Sub-quorum crews still get **no race-end push** (the
charter's no-shame rule) but their diggers now get a **warm in-app announcement**
("your digging counted — N tickles are yours") — a positive reward, not a placed-
nowhere shame.

## Server (migration `20260767000000_race_tickle_spoils.sql`, authored/unpushed)

- **`_race_tickles_for_rank(rank, ranked_n)`** — new IMMUTABLE ladder helper. Rank 0
  (or any non-positive) is the participation floor. Podium branches (1/2/3) are
  ranked_n-independent; rank ≥ 4 splits top-half (6) vs the rest (4).
- **`_race_pay_cycle(cycle)`** — carried VERBATIM from 20260719 (its latest def;
  20260720 didn't touch it), + on each ranked digger a `grant_tickles(...,
  _race_tickles_for_rank(rank, n))`; + a new **sub-quorum participation loop** that
  grants the floor to current members who dug (mirrors the ranked branch's
  member/dug gating); + `tickles_paid` folded into `cycle_payouts.detail.members`;
  + announcement copy naming the tickles. No push for sub-quorum.
- **`race_standings()`** — carried VERBATIM from 20260720, + a top-level **`prizes`**
  object (tickle + truffle ladders) read straight from the two payout helpers so the
  strip can never drift from what the cycle actually pays.

Carry-latest-def discipline (build-93 law) honored; `grant_tickles` and
`_race_truffles_for_rank` reused unchanged.

## Client

- **`utils/dig.ts`** — `RacePrizes`/`PrizeLadder` types, `prizes` on `RaceStandings`
  (parsed with the `DEFAULT_RACE_PRIZES` fallback), `tickles_paid` on `LastRace`.
- **`components/season1/RaceSection.tsx`** — reworked: `WeeklyHero` (spoils strip +
  weekly board + countdown + sub-quorum nudge) is the top card; `SeasonBoard`
  (collapsible, cumulative) sits below; `SpoilsStrip` renders the podium tickle
  ladder (medal-tinted badges, `TickleIcon` numbers) + truffles/hat + the "every
  digging snout banks N+ tickles" floor, all from `state.prizes`; the last-race line
  and ceremony now name tickles alongside truffles. Design primitives only (Sticker,
  tokens, TickleIcon/Glyph) — no raw hex/sizes, no emoji.
- **`app/race-standings.tsx`** — honors a `board` route param so "see the full
  season ›" lands on the season lens.

## Guardrails / push order

`race_standings` is feature-dark until this migration ships, so the section renders
nothing pre-push. After the client ships but before the migration pushes, the server
still returns standings without `prizes` → the client uses `DEFAULT_RACE_PRIZES`
(matching the migration's numbers), so the strip is always sensible. Never run
`supabase db push` — founder pushes.

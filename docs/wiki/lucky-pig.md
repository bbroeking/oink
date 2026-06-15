---
title: Lucky Pig
aliases: [lucky-pig, lucky window, lucky burst, lucky title]
tags: [system, core-loop, economy, onboarding]
status: stable
sources:
  - code: utils/luckyPig.ts
  - code: hooks/useLuckyPig.ts
  - sql: supabase/migrations/20260519020000_lucky_pig.sql
  - sql: supabase/migrations/20260519030000_lucky_titles.sql
  - doc: docs/systems-overview.md
last_compiled: 2026-06-13
---

# Lucky Pig

A surprise reward burst: a rare client-rolled trigger opens a short "lucky window" in which extra tickles can double, and one in five triggers also drops a rare folklore title.

## How it works

On any non-lucky tickle the client rolls a trigger die. Steady-state chance is **5%**, boosted to **12%** during the time-bounded launch window (`LUCKY_BOOST_UNTIL_ISO`, through 2026-05-22), or **40%** while the `sun_beam` blessing is active (`utils/luckyPig.ts:8-28`, [[blessings-curses-effects]]). A hit opens a window of **10 tickles** (`LUCKY_WINDOW_SIZE`).

Inside an open window, each tickle rolls a **30%** double die (`LUCKY_DOUBLE_CHANCE`); on a hit the caller fires the `lucky_bonus_tickle()` RPC, which adds +1 to the counter *without* consuming a tickle from the bank (`supabase/migrations/20260519020000_lucky_pig.sql:16-44`). The window counter decrements per tickle and is the only state the double-roll reads (`hooks/useLuckyPig.ts:185-189`).

**Title drop:** at trigger time the hook rolls a **20%** sub-die (`LUCKY_TITLE_UNLOCK_CHANCE`); the result is held and, on burst-modal dismiss, calls `unlock_random_lucky_title()` to grant one of 10 Eastern-European folklore titles the user doesn't yet own (Glücksschwein, Szerencsemalac, etc.). These are lucky-exclusive — not purchasable or battle-pass (`supabase/migrations/20260519030000_lucky_titles.sql:36-101`, [[achievements-and-titles]]).

**First-time guarantee:** a user who has never triggered is force-fired on their 8th tickle (`LUCKY_GUARANTEED_BY_TICKLE_N`), capping the "I never see this feature" case. Window state, the ever-triggered flag, and the pre-first count are AsyncStorage-persisted so they survive cold start (`hooks/useLuckyPig.ts:149-180`). The first completed flow also fires the iOS App Store review prompt (`hooks/useLuckyPig.ts:66-98`).

## Key files

- `utils/luckyPig.ts` — tunables + pure `rollLucky()` trigger math (unit-testable, no React).
- `hooks/useLuckyPig.ts` — stateful window/double/title lifecycle, AsyncStorage persistence, review prompt.
- `supabase/migrations/20260519020000_lucky_pig.sql` — `lucky_bonus_tickle()` RPC (one +1 per call).
- `supabase/migrations/20260519030000_lucky_titles.sql` — seeds 10 lucky titles + `unlock_random_lucky_title()`.

## Connects to

- [[core-loop-and-tickle-trade]] — the tickle tap is what rolls the lucky die; doubles feed the same counter.
- [[blessings-curses-effects]] — the `sun_beam` blessing boosts the trigger chance to 40%.
- [[achievements-and-titles]] — the 20% drop grants lucky-exclusive folklore titles.
- [[snouts-economy]] — bonus tickles add to the counter without spending from the bank.

## Open questions / risks

- **Client-trusted / spoofable.** All rolls (trigger, double, title) happen client-side with no server verification; a modder can fake the bonus. Documented as an accepted trade-off — granular `lucky_bonus_tickle()` (one +1 per call) caps abuse to network-rate spam, and `unlock_random_lucky_title()` only ever grants titles the user lacks, so the loot ceiling is the 10 fixed titles (`supabase/migrations/20260519020000_lucky_pig.sql:9-14`).
- The daily *lucky-number raffle* (`20260506000000_bonus_lucky_tickles.sql`, server-rolled global counter) is a separate mechanic from this client-rolled window despite the shared "lucky" naming — easy to conflate.
- `LUCKY_BOOST_UNTIL_ISO` (2026-05-22) is past; steady-state 5% is now the live trigger chance unless re-promoted.

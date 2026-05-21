# Season 1 — Implementation Log

Living notes recorded *as* each phase is built. Updated after the build
completes. Companion to `season-1-goblins-vs-angels.md` (the plan) and
`season-1-goblins-vs-angels.html` (the pitch).

---

## Phase 0 — Alignment foundation ✅ (commit dbb3d04)

- `alignment_score` column on profiles, ±100 range with CHECK clamp.
- `alignment_label(score)` SQL fn + `utils/alignment.ts` mirror.
- `shift_alignment(target, delta)` RPC — single chokepoint.
- Trigger on tickle_trades: +2 fulfill, +5 repay.
- `public_user_stats` extended with alignment fields.
- Test scaffold bootstrapped — jest-expo `transformIgnorePatterns`
  fixed for pnpm hoisting. 14 tests.

**Note:** 7-day debt decay + inactivity decay deferred (need cron).

## Phase 1 — Schism reveal + visibility ✅ (commit 4cf8404)

- `schism.sql`: schism_seen_angel_at/goblin_at + check_schism_status
  + mark_schism_seen RPCs. ±25 threshold (foreshadowing beat).
- `AlignmentSchismModal` — one-time reveal, side-specific copy.
- `AlignmentBadge` (ui/) — 3 sizes + compact mode.
- `_layout.tsx` polls check_schism_status on auth + AppState active.
- Leaderboard rows show the badge. 27 tests total.

**Note:** badge NOT yet wired into Friends.tsx + TickleTradeModal —
picked up in Phase 2 since those files get touched anyway.

## Phase 2 — Blessings + Curses + Cleanse ✅

- `blessings.sql` — blessings table, one-per-pair-per-day unique
  index via generated `sent_on` date, `daily_blessing_kind()`
  (DOY % 4 rotation), `send_blessing` RPC (3/day cap, friends-only,
  instant bountiful_snouts payout, +1 alignment to sender).
- `curses.sql` — symmetric curses table + `send_curse` (-1 alignment),
  `coin_pinch` snout loss capped at 10/day per receiver,
  `cleanse_curses()` (5-snout wipe), `blessing_clears_curses` trigger
  (a blessing received nukes active curses), `my_active_effects()`
  for the Barn to read live effects.
- `utils/rituals.ts` — metadata + DOY-rotation mirror of the SQL.
- `RitualPicker` — one component, bless/curse modes, shows today's
  rotation kind, fires the right RPC.
- `CleanseModal` — lists active curses, 5-snout cleanse.
- UserSheet gains a bless/curse toggle + RitualPicker when friends.
- +23 tests (rituals rotation, RitualPicker, CleanseModal). 50 total.

**Stubbed / deferred:** the actual gameplay effect application
(regen multiplier, half-taps, miasma overlay) is NOT yet wired into
the Barn tickle loop — `my_active_effects()` exposes the data; a
follow-up wires Barn to honor it. CleanseModal is built but not yet
auto-surfaced from Barn (Phase 3 touches Barn, will mount it there).

## Phase 3 — Barn overlay + Weekly bounties ✅

- `bounties.sql` — `user_bounty_claims` table, `current_week_start()`
  (Monday UTC anchor), `my_weekly_bounties()` returning 3 of a
  6-bounty pool (rotating window by ISO-week % 6) with live progress
  computed from tickle_trades/blessings/curses, and `claim_bounty()`
  (re-derives progress server-side, grants snouts once per week).
- `BarnOverlay` (ui/) — pure-RN themed decoration, no image assets.
  Angel = white cloud puffs + warm tint; goblin = gold coin piles +
  green tint; neutral = null. pointerEvents="none".
- `BountyCard` — single bounty row, 3 states (in-progress / ready /
  claimed), progress bar, claim CTA.
- `BountyBoard` — fetches my_weekly_bounties on focus, maps cards.
- Barn fetches alignment_score, mounts BarnOverlay.
- season.tsx mounts BountyBoard at the top of the tier ScrollView.
- +9 tests. 59 total.

**Stubbed / deferred:** BarnOverlay uses View-based shapes — if
richer art is wanted, swap for generated PNGs later. CleanseModal
still not auto-surfaced from Barn (would need a my_active_effects
poll on Barn focus — small follow-up).

## Phase 4 — Alignment leaderboard + Judgement Day ✅

- `alignment_leaderboard.sql` — `alignment_leaderboard(per_side)`
  RPC returning the two ranked extremes (generous DESC + greedy
  ASC) with within-side ranks. Neutral users omitted.
- `finale.sql` — extends titles source CHECK with 'season', seeds
  5 finale titles, `season_finales` table, `finalize_season()`
  (ranks everyone, grants top3/top10/participant/neutral rewards,
  resets all alignment to 0 — idempotent per season_key, NOT
  granted to authenticated so only an admin/cron can fire it),
  `my_finale_result()` + `mark_finale_seen()` for the modal.
- `JudgementDayModal` — verdict reveal: side emblem, bracket
  headline, rank line, earned title + snouts, reset note.
- leaderboard.tsx gains an "alignment" scope (3rd toggle): pulls
  alignment_leaderboard, renders a flat ranked list (no champion
  poster), trailing number shows signed alignment instead of ♥.
- `_layout.tsx` polls my_finale_result on auth + foreground,
  mounts JudgementDayModal at root.
- +7 tests. 65 total.

**Stubbed / deferred:** finalize_season is callable from the SQL
console only — no cron wired (intentional; the user triggers the
finale manually at season end). seraph_wings + cursed_crown
exclusive ITEMS are not seeded (need icon-gen art) — finale grants
titles + snouts only for now; add the items in a follow-up once
the art exists.

## Phase 5 — Build 62 + ship

_(pending)_

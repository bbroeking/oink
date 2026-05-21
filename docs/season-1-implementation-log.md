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

## Phase 5 — Build 62 + ship ✅ (prepared)

- `docs/builds/2026-05-20-build-62.md` written — covers all 15
  commits + 21 migrations since build 61, with the full Known
  Issues list (stubbed gameplay effects, ungenerated icons, etc).
- `constants/release_notes.ts` — v1.4.0 "Season 1: Goblins vs
  Angels" entry added; ReleaseNotesModal will fire it on first
  launch post-update.
- Pre-build gate: `tsc --noEmit` clean, `jest` 65/65 green.

**Handed to the user:** the actual `eas build --local` + TestFlight
upload is a user-side step — it needs Xcode signing, ~20+ min, the
16GB Metro heap, and is CocoaPods-flake-prone (all per project
memory). Everything is staged so it's a single command:

```
COCOAPODS_DISABLE_STATS=true \
NODE_OPTIONS="--max-old-space-size=16384" \
  eas build --local --platform ios --profile production
```

If CocoaPods barfs with the null-byte error:
`pod cache clean --all && rm -rf ios/Pods ios/build` then retry.

**Post-build TODO (update this section after the build ships):**
- [ ] record the EAS build number
- [ ] confirm migrations pushed (`npm run db:push`) before the
      build hits TestFlight testers
- [ ] App Store Connect Name field manual edit

---

## Post-build design change — trade economy flipped

After the phases shipped, the trade economy was inverted to make
**greed the mechanically profitable path** (the whole point of the
season's tension):

- **fulfill**: giver spends N from their bank; the **asker pockets
  2N**. Giver gets nothing material — only a social promise.
- **No repay step.** The `repaid` status, `repay_tickle_trade` RPC,
  `repaid_at` column, and the one-fulfilled unique index are all
  removed. `fulfilled` is terminal.
- **alignment**: fulfill → giver +2 (generous), asker −2 (greedy).
  Asking-and-never-giving-back is now literally the Goblin path.
- Rippled through 6 migrations (tickle_trades, trade_cooldown,
  push_delivery, achievements views+trigger, alignment, bounties),
  the TickleTradeModal (repay UI removed), Friends/Barn copy, and
  release notes. Bounties `debt_settler`/`loop_closer` → `well_asked`/
  `even_hand`.
- Refactor bug caught + fixed: `request_tickles` blocked new trades
  while a `fulfilled` row existed — but `fulfilled` is terminal now,
  so a pair could never trade again. Now only `pending` blocks.

Also from the /review pass:
- **claim_bounty double-grant fixed** — `IF NOT FOUND` guard after
  the conflict-insert (concurrent claims could double-pay).
- **Tests added** — `supabase/tests/00_pure_functions.sql` (pgTAP,
  alignment_label + ritual rotations + week math) and
  `utils/bounties.ts` + `__tests__/bounties.test.ts` (rotation,
  13 tests). 78 TS tests total.

## Cross-phase deferred work (one place)

Tracked so it isn't lost between sessions:

1. Wire the Barn tickle loop to honor `my_active_effects()`
   (regen multiplier, half-taps, miasma overlay).
2. Auto-surface CleanseModal from Barn on a my_active_effects poll.
3. Achievement banner in Barn (unviewed-unlock surfacing).
4. Generate saintly/goblin cosmetic icons (8 ladder + 2 finale),
   seed them as hats, wire as achievement/finale reward items.
5. AlignmentBadge into Friends.tsx + TickleTradeModal rows.
6. Cron for finalize_season (currently manual SQL call).
7. 7-day debt-decay + inactivity alignment decay (need cron).

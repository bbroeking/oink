---
title: Mud Fights Code Review — June 2026
type: review
date: 2026-06-13
tags: [review, lint, mud-fights, security, sql]
target: Sounder Mud Fights feature (supabase/migrations/20260647000000_mud_fights.sql + client)
method: 5 independent dimension reviewers → adversarial verification of every finding
result: 20 findings confirmed, 0 refuted
---

# Mud Fights Code Review — 2026-06-13

Independent multi-agent review of the [[../../sounder-mud-fights]] feature (pre-DB-push). Every finding was adversarially verified against the actual code; **0 of 20 were refuted.** HIGH + the MED economy/auth guards were fixed the same day.

## 🔴 HIGH (all FIXED)

1. **`titles_source_check` carry-latest-def → migration aborts on prod.** Rebuilt from `20260526_finale` but `20260569_world_cup_flags` is newer and seeded ~47 `source='world_cup'` rows; omitting `'world_cup'` makes `ADD CONSTRAINT` fail validation. → Added `'world_cup'`. (`mud_fights.sql` ~233)
2. **Winner regen buff never granted.** Self-blessing `(m.user_id, m.user_id, 'war_winner_regen')` violates `blessings CHECK (sender_id <> receiver_id)`; swallowed by the savepoint. → Carved out the kind in `blessings_check`. (~645)
3. **`war_state` leaks any war's roster + slings** to non-participants (SECURITY DEFINER, no auth check; war ids ship in announcements). → Gated on `is_war_participant`. (~818)
4. **`war_side` directly callable** by any authenticated user (default PUBLIC execute) → even broader leak. → `REVOKE EXECUTE … FROM PUBLIC` (internal helper for `war_state`). (~927)
5. **Two simultaneous wars** — a crew mid-bot-war (challenger) could be challenged + accept as defender; `accept_challenge` had no defender-busy guard and `challenge_crew`/`find_challengeable_crews` ignored bot wars. → Added defender-busy guard + dropped the `is_bot_war=false` filters. (~427, ~487, ~899)
6. **Resolved-screen CTA was dead** — `my_war()` keeps returning the resolved war, so "Start a new fight" looped on the recap. → Added a `dismissedWarId` flow that drops to the challenge picker. (`app/mud-war.tsx`)

## 🟡 MED (economy/auth FIXED; coverage noted)

- **Bot-farm** (free snouts + leaderboard + titles by re-fighting the fixed-pace house). → Bot wins now credit only a flat stipend + buff; **no `tickles_earned`, no `war_wins`/titles.**
- **Collusion** (two crews mint leaderboard credit at zero cost). → 24h rematch cooldown per crew pair in `challenge_crew`.
- **`enforce_crew_cap` count was unlocked** → concurrent accepts could exceed 5. → `SELECT … FOR UPDATE` on the crews row.
- **PendingWar swallowed accept/decline failures** (every non-leader defender sees the buttons). → Branches on `r.ok`, surfaces a note.
- **TOCTOU one-war race** (split partial unique indexes don't cover cross-role; concurrent challenges). → Accept-time guard covers the common path; advisory-lock is the deferred belt-and-braces. *(partial)*
- **Untested paths**: tie/no-winner, bot-war payout, RLS, title thresholds; weak double-resolve assertion. *(deferred)*

## 🟢 LOW (deferred)

`resolve_war` is `authenticated`-callable but verified safe (idempotent/deterministic); optimistic sling discards server `remaining`; `mud_wars` not in the realtime publication (challenger stuck on "Challenge sent"); splat-timer cleanup (harmless on RN 18); dead `resolveWar()` wrapper + 8 unused constants; hardcoded "5-day"/"72h"/quorum-2/cap-5 magic values; helper-test boundary gaps.

## Verification note

The independent review caught 6 HIGH bugs the author's own self-review missed (the self-review only confirmed `resolve_war` idempotency, which the panel agreed is correct). Two were showstoppers — #1 prevents the migration from applying at all; #3/#4 are data-leak vulns. Lesson reinforced: **for SQL constraint changes, grep ALL definitions, not the one a prior summary called "latest"** ([[architecture-seams]] carry-latest-def footgun).

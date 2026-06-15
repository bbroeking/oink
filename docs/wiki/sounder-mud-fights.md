---
title: Sounder Mud Fights (Clan Wars)
aliases: [mud fights, clan wars, sounder, mud war]
tags: [system, season, competitive, social]
status: stable
sources:
  - doc: docs/sounder-mud-fight-spec.md
  - sql: supabase/migrations/20260647000000_mud_fights.sql
  - code: utils/mudWars.ts
  - code: hooks/useMudWar.ts
  - code: app/mud-war.tsx
  - code: components/SounderCard.tsx
  - code: constants/mudFights.ts
last_compiled: 2026-06-13
---

# Sounder Mud Fights (Clan Wars)

An optional weekly clan-war layer: rally a ≤5-friend crew (a "Sounder") and fight another crew on a **fully isolated, reset-to-zero field** where the only verb is a flat daily "mud sling" — no core-game buffs leak in. Built but **dark-launched** behind `MUD_FIGHTS_VISIBLE = false` (`constants/featureFlags.ts`).

## How it works

- **Sounder = crew.** Create one (`create_crew`), invite friends (leader-only, `are_friends`-gated), accept/decline; cap 5, one crew per user — all `SECURITY DEFINER` RPCs in the migration. The `SounderCard` on the Friends hub is crew bookkeeping; war flow lives on `/mud-war`.
- **Fairness by construction.** A war starts both crews at zero. The only contribution is **mud slinging**: a flat **20/day per member**, use-or-lose, no modifiers (`sling_mud`, `DAILY_ALLOTMENT`). Regen/blessings/alignment/VIP cannot touch a war — the spec's core ask. A crew's ceiling is `members × 20 × days`.
- **Scoring: per-capita active average, quorum 2.** `SUM(mud) / COUNT(members WHERE mud > 0)`, requiring ≥2 active members, so a 5-crew vs 3-crew is fair and alts/ghosts drag the average down (`resolve_war`, `war_side`).
- **Lifecycle.** Leader `challenge_crew` → defender `accept_challenge` stamps a 5-day window (`WAR_LENGTH_DAYS`). Low population is handled by a seeded house-bot crew "The Mudlarks" (`challenge_house`), which auto-accepts and scores a synthetic 12/day (`BOT_DAILY_PACE`).
- **Lazy idempotent resolve.** `resolve_war` runs on first read after `ends_at` (cloning the Trough's lazy pattern — no cron), guarded by `FOR UPDATE` + `resolved_at` so it never double-pays.
- **Payout.** Each winner gets their own mud 1:1 in snouts (`counter + tickles_earned`) **+ a per-capita share of 50% of the loser's pot** (beating the bot pays a flat `HOUSE_BONUS` 25, no pot). Winners also get a `war_winner_regen` blessing (×0.85 for 72h, folded into `regen_secs_for`) and `mud_champion`/`veteran`/`legend` titles. Both-below-quorum or a tie = no winner, no payout (mud was free).
- **Client.** `useMudWar` backs the tug-of-war screen with optimistic sling taps + a throttled realtime subscription on `mud_slings`; resolved wars surface via the existing WhileAway/`system_announcements` path.

## Key files

- `docs/sounder-mud-fight-spec.md` — the design + locked decisions (Q1–Q6).
- `supabase/migrations/20260647000000_mud_fights.sql` — 5 tables, cap-5 trigger, recursion-safe RLS, ~14 RPCs incl. `resolve_war`; extends `blessings`/`titles`/`regen_secs_for`.
- `constants/mudFights.ts` — client mirror of the server constants (must stay in sync).
- `utils/mudWars.ts` — typed RPC wrappers + pure helpers (`perCapita`, `ropePosition`, `formatCountdown`).
- `hooks/useMudWar.ts` — war-state hook: lazy resolve on read, optimistic slings, realtime.
- `components/SounderCard.tsx` — Friends-hub crew create/invite/roster UI.
- `app/mud-war.tsx` — the war screen (no-war/pending/active/resolved states + sling tap juice).

## Connects to

- [[friends-graph]] — invites are friends-gated; a Sounder is built from your friends.
- [[referral-program]] — "Sounder" was reclaimed from the referral downline (now backend-only behind `SOUNDER_VISIBLE`).
- [[blessings-curses-effects]] — the winner buff reuses the blessing infra (`war_winner_regen` kind).
- [[regen]] — the buff is a ×0.85/72h factor inside `regen_secs_for`, the only way a war pays back into the core loop.
- [[snouts-economy]] — payout mints snouts via `counter` + `tickles_earned`.
- [[achievements-and-titles]] — wins grant `mud_champion`/`veteran`/`legend` titles.
- [[core-loop-and-tickle-trade]] — the isolated field deliberately excludes buffed tickles; it's the anti-boredom valve over the tap loop.
- [[trough]] — `resolve_war` clones the Trough's lazy first-reader resolution pattern.
- [[seasons-and-judgement-day]] — pinned as the next-season headline competitive layer.
- [[notifications]] — challenge/start/resolve announcements are inline `system_announcements` inserts.

## Open questions / risks

A multi-agent review (2026-06-13, full report: [[../outputs/lint/2026-06-13-mud-fights-review]]) found 20 verified issues (0 refuted). The HIGH set + the MED economy/auth guards were fixed in `20260647000000_mud_fights.sql` + the client **before** any DB push:

- **FIXED — migration would have aborted on prod.** `titles_source_check` was rebuilt omitting `'world_cup'` (the carry-latest-def footgun, see [[architecture-seams]]); now carried from `20260569_world_cup_flags` and includes it.
- **FIXED — winner regen buff was never granted.** The self-blessing violated `blessings`' `CHECK (sender_id <> receiver_id)`; the constraint now carves out `kind = 'war_winner_regen'`.
- **FIXED — roster/sling leak.** `war_state` now gates on `is_war_participant`; `war_side`'s default PUBLIC execute is `REVOKE`d (internal helper for `war_state` only).
- **FIXED — two simultaneous wars.** `accept_challenge` rejects a defender already in a live war; `challenge_crew` + `find_challengeable_crews` no longer ignore bot wars.
- **FIXED — bot-farm.** Beating the house now credits only a flat snout stipend + the regen buff — NO `tickles_earned` (leaderboard) and NO `war_wins`/titles, so a fixed-pace bot can't be farmed for rank/prestige.
- **FIXED — collusion.** `challenge_crew` enforces a 24h rematch cooldown per crew pair.
- **FIXED (client)** — dead resolved-screen CTA, silent accept/decline failures, and the crew-cap concurrent-accept race.

Remaining / by-design:
- **Bot wins still give a small bounded reward** (flat stipend + buff) so the house is worth fighting; full neutralization (cosmetic-only) is the stricter [[identity-model]]-memo stance if farming the buff proves a problem.
- **One-war-per-crew TOCTOU** has a low-probability window (two leaders racing concurrent challenges); the accept-time guard covers the common path — an advisory lock is the belt-and-braces follow-up.
- **Test gaps**: tie/no-winner, bot-war payout, RLS, and title thresholds are untested (pgTAP covers one real-war path + double-resolve).
- **Server/client constant drift** (`constants/mudFights.ts` vs inlined RPCs) — future `mud_fight_const()` (P3).
- **Not yet DB-pushed**; pgTAP `supabase/tests/02_mud_fights.sql` runs only after it's applied.
- Cooperation-bonus mud, war-history wall, crew-title ramp deferred to P3.

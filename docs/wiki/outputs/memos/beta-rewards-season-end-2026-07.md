---
title: "Beta rewards + the season-end moment (design + build)"
type: memo
date: 2026-07-03
tags: [season-1, beta, rewards, titles, finale, judgement-day, season-end, founder-direction]
status: draft
---

# Beta rewards + the season-end moment

Founder direction (2026-07-03): *"A set of rewards and achievements for people who participated in the beta. Anyone currently participating should get some reward. People towards the top should get titles and different things. When the season ends, notify them in the UI."* Everything flag-hidden from live clients until the moment fires.

Built as `supabase/migrations/20260704400000_beta_rewards.sql` (HELD) + `components/SeasonEndModal.tsx` + `hooks/useSeasonEnd.ts`, gated on a new `season1_finale` server flag. Related-but-separate: the one-time **3-months-free Slop Club grandfather grant** planned for public launch ([[project_slop_club_grandfather_beta]] memory) — that is a launch-day lane, not part of this migration.

## Who counts as a beta participant

`username IS NOT NULL AND username <> '' AND tickles_earned > 0 AND NOT hide_from_leaderboard`

- Mirrors `finalize_season`'s named-profiles loop (`20260526…finale.sql`) + adds the meaningful-play floor (any lifetime tickle) and excludes the demo/junk accounts (`hide_from_leaderboard`, `20260586`).
- No date cutoff needed: the grant fires **at season end, before public launch**, so everyone qualifying then *is* the beta.
- **Ranked tiers** additionally exclude `is_test` (it's the admin flag, and Brian is already leaderboard-hidden via `20260604`) — the owner still gets the participant reward, never a podium title.

## The reward set

Ranking metric = **`profiles.tickles_earned`** (the game's main leaderboard, `20260512`). All titles `source='season'`, `for_sale=false` (the earned-only rule, `20260677`), display_order 405–408 after the finale's 400–404.

| Tier | Who | Title | Snouts |
|---|---|---|---|
| Podium | rank 1 | **Snoutfather** (pre) — "The very top of the founding herd." | 1000 |
| Podium | rank 2–3 | **Bog Royalty** (pre) — "Top three of the founding herd." | 750 |
| Top table | rank 4–10 | **Of the Trough Table** (post) — "Top ten of the founding herd." | 500 |
| Everyone qualifying | all | — | 250 |

**Every qualifier additionally gets** (podium included):
- Title: **Founding Herd** (post) — "Played before the gates opened."
- Cosmetic: **Founder's Mud Ribbon** (`beta_founder_ribbon`, neck slot, legendary, `cost=0`) — permanently unbuyable, beta-only forever.

Achievements integration deliberately skipped: titles + a kept cosmetic + the announcement do the founder's job without inventing a retroactive achievement ladder; can be added later if wanted.

## Why live clients can't see any of it early (verified predicates)

- **Cosmetic**: seeded `cost = 0` → invisible in Browse unless owned (`app/(tabs)/shop.tsx:633` — `(r.cost > 0 && !r.pass_exclusive) || ownedSet.has(r.id)`), never in the daily drop (`daily_shop()` latest def `20260688` filters `cost > 0`), unbuyable (`buy_hat()` rejects `cost <= 0`, per `20260685`), and the Closet lists owned items only. Same hiding lane the 25 war-exclusive items already live in on prod.
- **Titles**: catalog is public-read but surfaces only show owned titles (the shop Titles tab was removed by `20260677`), so seeded-but-ungranted titles render nowhere.
- **The modal + any season-end copy**: behind the `season1_finale` app_config flag (seeded FALSE, same pattern as `world_boss` in `20260704200000`).
- ⚠️ **Art gate**: `beta_founder_ribbon` must have real art (`HAT_IMAGES` entry + placement spec) **before the grant fires** — an art-less granted item is exactly the orphan-cosmetics bug `20260685` cleaned up. It rides art Batch 8 (Sheet E) in `docs/briefs/s2-art-chatgpt-briefs.md`.

## The season-end moment

**Grant engine**: `grant_beta_rewards()` — SECURITY DEFINER, **not** granted to authenticated (service-role/SQL only, like `finalize_season`). Idempotent: inserts `beta_reward_grants (user_id PK)` `ON CONFLICT DO NOTHING`; only fresh rows get titles + ribbon + snouts + a per-user **inline** `system_announcements` INSERT (kind `season`, `data.screen='season'` — an already-routable screen; NEVER the admin-gated `send_system_announcement()`, per the footgun memory).

**Two documented firing options** (the coupling decision stays with Brian; nothing in the migration schedules anything):
1. **A — couple to Judgement Day**: carry `finalize_season` (latest def = `20260526`) adding one `PERFORM public.grant_beta_rewards();` — one moment, but welds beta grants to the DESTRUCTIVE alignment-wipe cron (already live: `judgement-day-season-1` fires **01:00 UTC Jul 12** per `20260658` — note the wiki page's "July 15" is stale).
2. **B — fire by hand (recommended)**: at season end run `SELECT public.grant_beta_rewards();` then flip the flag (`UPDATE app_config SET enabled = true WHERE key = 'season1_finale';`). Decoupled from the cron, reversible pacing, and the flag flip is the single "reveal" switch.

**How players learn about it in the UI**:
1. **Inbox**: the per-user announcement ("The Founding Herd — thank you" + what they earned).
2. **The SeasonEndModal**: a 3-beat storybook recap (GreatHungerIntroModal's structural pattern) on the season screen — *the season settles → what you earned (rank band, titles, ribbon, snouts) → the Hungerer stirs (Season-2 teaser)*. Shows when `season1_finale` is ON + `my_beta_reward()` returns a grant + no local seen-stamp (AsyncStorage `beta_reward_seen_v1`; server row is the durable truth, the stamp only stops re-shows on this device). `__DEV__` preview chip like the intro modal.
3. The existing `JudgementDayModal` (alignment verdict) still runs its own lane — two moments can coexist; option B lets Brian sequence them.

## Key files
- `supabase/migrations/20260704400000_beta_rewards.sql` — titles + ribbon seed, grants table, `grant_beta_rewards()`, `my_beta_reward()`, flag seed. HELD.
- `hooks/useSeasonEnd.ts` · `components/SeasonEndModal.tsx` · mounted in `app/(tabs)/season.tsx`.
- `utils/betaRewards.ts` — pure predicate/band logic (client mirror) + `__tests__/betaRewards.test.ts`.

## Connects to
- [[seasons-and-judgement-day]] — the finale machinery this rides beside (and its stale July-15 date)
- [[mudwar-rewards-spec-2026-07]] — the Season-2 economy these founder rewards precede
- [[clan-buildout-audit-2026-07]] · [[world-boss-the-great-hunger-2026-07]]

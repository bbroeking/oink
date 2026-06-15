---
title: Achievements & Titles
aliases: [achievements, titles, badges, name decorations]
tags: [cosmetics, progression, social, season]
status: stable
sources:
  - code: app/achievements.tsx
  - sql: supabase/migrations/20260520060000_achievements.sql
  - sql: supabase/migrations/20260559000000_achievements_expand.sql
  - sql: supabase/migrations/20260511000000_titles.sql
  - sql: supabase/migrations/20260520070000_achievement_unviewed.sql
  - code: constants/title_types.ts
  - code: constants/emojiArt.ts
  - code: components/AchievementUnlockModal.tsx
  - code: components/TitlesSection.tsx
last_compiled: 2026-06-13
---

# Achievements & Titles

A unified achievement catalog that auto-grants rewards (snouts, free hats, **titles**) when a player crosses a threshold, and the titles system — name decorations a player equips into one `active_title_id` slot, sourced from many systems.

## How it works

**Achievements** live in one catalog table (`achievements`: `category`, `tier`, `threshold`, `reward_*`, `is_top_tier`, plus a player-facing `display_category` of *Generous / Greedy / Social*) seeded across `20260520060000_achievements.sql` (8 trade ladders) and expanded to 17 in `20260559000000_achievements_expand.sql` (bless/curse distinct, alignment milestones, lucky count, friend count, blessings received). The technical `category` selects which counter `try_claim_achievements()` reads; `display_category` only groups the UI.

Rewards are **auto-granted server-side** when a threshold is crossed — DB triggers on trades, blessings, curses, friendships, `profiles.alignment_max_*`, and `daily_lucky_claims` each call `try_claim_achievements(user, category)`, which is idempotent and walks tiers in order (`20260559000000_achievements_expand.sql:120`). Top-tier achievements (`is_top_tier`) continue into an **infinite "Level N"** ladder: each 2× past the base threshold bumps `user_achievements.level` and pays +500 snouts (`20260520060000_achievements.sql:181`).

The **screen** (`app/achievements.tsx`) calls `my_achievements()` for one round-trip with progress + claimed + `viewed_at`. "Claim" only acknowledges — it calls `mark_achievement_viewed` (`viewed_at` added in `20260520070000_achievement_unviewed.sql`); the reward already landed. A "Ready" card = claimed but `viewed_at` NULL; `AchievementUnlockModal.tsx` is the launch-time **reveal** of the same unviewed set.

**Titles** (`20260511000000_titles.sql`): catalog `titles` (`id`, `name`, `placement` pre/post, `source`), ownership `user_titles`, and one equipped `profiles.active_title_id`. `equip_title()` verifies ownership; `TitlesSection.tsx` lets a player switch the active title (`TitleRow` shape in `constants/title_types.ts`). The `source` CHECK grew migration-by-migration: `battle_pass`, `shop`, `lucky`, `sounder`, `achievement`, `season`, `mud_war` (`20260647000000_mud_fights.sql:233`).

## Key files
- `app/achievements.tsx` — achievements screen: filter chips, progress cards, Claim-as-acknowledge
- `supabase/migrations/20260520060000_achievements.sql` — catalog tables, `try_claim_achievements`, infinite top-tier, `my_achievements`
- `supabase/migrations/20260559000000_achievements_expand.sql` — `display_category`, 9 new ladders + triggers + retroactive backfill
- `supabase/migrations/20260520070000_achievement_unviewed.sql` — `viewed_at` + `mark_achievement_viewed`
- `supabase/migrations/20260511000000_titles.sql` — titles/user_titles/`active_title_id`, `equip_title`, `claim_tier_reward` title path
- `constants/title_types.ts` — `TitleRow` shared shape
- `constants/emojiArt.ts` — `achievementIcon()` id→medallion mapping
- `components/AchievementUnlockModal.tsx` — two-stage reveal of unviewed unlocks
- `components/TitlesSection.tsx` — owned-titles list + equip/unequip

## Connects to
- [[shop-cosmetics-closet]] — `source='shop'` titles are bought; titles equip from the closet
- [[battle-pass-and-slop-club]] — `claim_tier_reward` grants `source='battle_pass'` titles
- [[lucky-pig]] — `source='lucky'` titles + the `lucky_count` achievement ladder
- [[sounder-mud-fights]] — `source='mud_war'` win titles (Mud Champion/Veteran/Legend)
- [[seasons-and-judgement-day]] — `source='season'` finale titles
- [[world-cup-allegiance]] — `source='world_cup'` flag titles
- [[friends-graph]] — `friend_count` Social achievements (sounder size)
- [[core-loop-and-tickle-trade]] — trade volume drives the Generous/Greedy ladders
- [[blessings-curses-effects]] — bless/curse-distinct + blessings-received ladders
- [[alignment]] — alignment milestone achievements (Saint, Halo Bearer, Goblin King)
- [[snouts-economy]] — achievements pay out snouts (incl. per-level bonus)
- [[identity-model]] — `active_title_id` decorates the public username

## Open questions / risks
- `source='world_cup'` exists in the CHECK (`20260569000000_world_cup_flags.sql`) but isn't in the task's named taxonomy list — confirm whether it should be folded into [[world-cup-allegiance]] or treated as a season artifact.
- `claim_tier_reward` matches battle-pass title rewards by name→slug (`title_id_from_name`); a display-name typo silently no-ops the title grant (`20260511000000_titles.sql:184`).
- Infinite top-tier levels grant snouts but no new title/item past the named ceiling — by design, but worth flagging for balance.
</content>
</invoke>

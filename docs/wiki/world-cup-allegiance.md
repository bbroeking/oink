---
title: World Cup Allegiance
aliases: [allegiance, hog-cup, world-cup, fly-your-colors]
tags: [system, season, social, cosmetic, event]
status: stable
sources:
  - doc: docs/world-cup-allegiance.md
  - doc: docs/world-cup-ideas.md
  - code: constants/worldCupFlags.ts
  - code: components/AllegianceModal.tsx
  - sql: supabase/migrations/20260585000000_world_cup_allegiance.sql
  - sql: supabase/migrations/20260640000000_allegiance_switching.sql
last_compiled: 2026-06-13
---

# World Cup Allegiance

A time-boxed "pick-a-side" event riding the real 2026 men's World Cup: every player picks one of 47 qualified countries to back, and that country's flag flies on their pig and Barn. It's a self-contained day-one drop, **not** tied to [[seasons-and-judgement-day]] or [[alignment]] (`docs/world-cup-ideas.md`).

## How it works

On first launch after the event build, a skippable modal (`components/AllegianceModal.tsx`) shows a 3-column grid of all 47 teams from `WORLD_CUP_TEAMS` in `constants/worldCupFlags.ts` (Iran + a sanctions denylist are excluded). "Maybe later" hides it for the session only — no persistent dismiss — so the invite re-surfaces each launch until a pick is made (`docs/world-cup-allegiance.md`).

Confirming calls the `choose_allegiance(p_flag_id)` RPC, which: sets `profiles.allegiance_country` + `allegiance_chosen_at`, grants the country flag (`flag_<slug>`), and auto-equips it as `active_flag_id` so allegiance shows on the pig and leaderboard. The **first** pick also grants + equips the free `soccer_field_day` ("Sunny Pitch") soccer background as a celebratory wallpaper (`supabase/migrations/20260640000000_allegiance_switching.sql`).

**Switching is free and unlimited.** The original "locked once chosen" design (`docs/world-cup-allegiance.md`) was reverted by migration `20260640`: re-picking updates the allegiance, accumulates the new flag, and is idempotent on the same country. The background grant rides **only** the first pick, so a switch never stomps the player's current background. Re-entry is now via tapping the flag on the Barn, which re-opens the modal preselected to the current country (`AllegianceModal.tsx` `currentFlagId`).

This is the first instance of a reusable event/Rivalry frame: a pick-a-side overlay layered on top of the cosmetic system, distinct from the durable [[alignment]] identity. The end-of-tournament payoff is a **teaser only** — the pick is stored to grade against the eventual champion later, but no reward logic ships (`docs/world-cup-allegiance.md`).

## Key files

- `constants/worldCupFlags.ts` — `WORLD_CUP_TEAMS` (47 teams, slug/name/title), flag image map, and the sanctions `WORLD_CUP_DENYLIST`.
- `components/AllegianceModal.tsx` — flag-grid picker, reward-hint copy, confirm/skip + switch-preselect.
- `supabase/migrations/20260585000000_world_cup_allegiance.sql` — original `choose_allegiance`, soccer-background seeds, `allegiance_country`/`allegiance_chosen_at` columns.
- `supabase/migrations/20260640000000_allegiance_switching.sql` — drops the first-pick lock; switching semantics.
- `docs/world-cup-ideas.md` — full event design (cosmetics, pick'em, meta-board) and day-one scope cuts.

## Connects to

- [[shop-cosmetics-closet]] — flags are flag-category cosmetics; soccer backgrounds are seeded shop items, equipped via the closet's cosmetic slots.
- [[barn-and-habitat]] — the chosen flag flies on the Barn exterior, which is also the re-entry tap target for switching.
- [[alignment]] — allegiance is a parallel, lighter identity axis ("Fly Your Colors") explicitly modeled after but decoupled from Goblins-vs-Angels.
- [[achievements-and-titles]] — each country carries a representable title (e.g. "Samba Star") alongside the flag.
- [[identity-model]] — allegiance is a visible, social identity marker shown next to the player everywhere.
- [[seasons-and-judgement-day]] — the event runs as a standalone overlay alongside, not inside, the season finale.

## Open questions / risks

- **Doc/code drift:** `docs/world-cup-allegiance.md` still describes a locked, never-switch pick and a Shop "Back your country" card (`AllegianceCard.tsx`, now deleted). The shipped behavior (migration `20260640`) is free switching via the Barn flag. The design doc is stale, not authoritative.
- **No finale payoff:** the "pick the right one → reward at the final whistle" promise is copy + a stored pick only; the grading/reward step is unbuilt. Players are promised something that does not yet exist.
- **Stretch scope cut:** pick'em, country meta-leaderboard, and event sounds (`docs/world-cup-ideas.md`) did not ship for day one — allegiance + cosmetics only.

---
title: Alignment (Goblins vs Angels)
aliases: [alignment, schism, generous-greedy, pilgrim]
tags: [system, season, social, economy]
status: stable
sources:
  - code: utils/alignment.ts
  - sql: supabase/migrations/20260521000000_alignment.sql
  - sql: supabase/migrations/20260536000000_alignment_notifications.sql
  - sql: supabase/migrations/20260581000000_alignment_teeth.sql
  - sql: supabase/migrations/20260630000000_alignment_regen_linear.sql
  - doc: docs/season-1-goblins-vs-angels.md
  - doc: docs/alignment-teeth-spec.md
last_compiled: 2026-06-13
---

# Alignment (Goblins vs Angels)

A per-player reputation score from -100 to +100, derived purely from trade and ritual behavior — generous acts push you toward Angel, selfish ones toward Goblin. It is the core axis of Season 1 and has real mechanical "teeth."

## How it works

`profiles.alignment_score` is an `int` clamped to `[-100, +100]` by a CHECK constraint, and every change funnels through the `shift_alignment(target_user_id, delta)` SECURITY DEFINER RPC, which clamps and bumps `alignment_updated_at` (`supabase/migrations/20260521000000_alignment.sql`). There are no factions to join — your score is your reputation.

**What shifts it** (the `delta` passed to `shift_alignment`):
- Fulfill a trade as the giver: **+2** — or **+3** if you're currently Greedy (score < 0), so the climb out is faster than the fall in (redemption rule, `supabase/migrations/20260581000000_alignment_teeth.sql`).
- Have your own request fulfilled (you pocketed the double): **-2** (`supabase/migrations/20260521000000_alignment.sql` trade trigger).
- Cast a blessing: **+1** (`supabase/migrations/20260522000000_blessings.sql`).
- Cast a curse: **-1** — active mischief (`supabase/migrations/20260523000000_curses.sql`, `20260534000000_one_ritual_per_day.sql`).

**Hysteresis labels.** `alignment_label(score)` returns `goblin | neutral | angel`. The original thresholds were ±34, but `supabase/migrations/20260536000000_alignment_notifications.sql` unified them with the schism reveal at **±25** so "crossing into Generous/Greedy" is one beat. `utils/alignment.ts` mirrors this (`ALIGNMENT_ANGEL_THRESHOLD = 25`). UI display names: angel = "Generous", goblin = "Greedy", neutral = "Pilgrim".

**The teeth** (`alignmentEffects` in `utils/alignment.ts`, mirroring SQL):
- Regen: **linear ±0.4%/point, capped at ±10%** (full strength by ±25). `regen_secs_for` applies `1 - clamp(score*0.4, -10, 10)/100` (`supabase/migrations/20260630000000_alignment_regen_linear.sql`).
- Blessings scale `+0.5%/point`, curses `-0.5%/point` — Generous = better blesser, Greedy = better curser (specialist tradeoff, `docs/alignment-teeth-spec.md`).

**Schism reveal.** Crossing ±25 fires a one-time fullscreen reveal plus milestone push notifications at ±10/±25/±50/±100 (`supabase/migrations/20260536000000_alignment_notifications.sql`).

## Key files

- `utils/alignment.ts` — client mirror: `alignmentLabel`, `alignmentEffects`, display/icon/color helpers.
- `supabase/migrations/20260521000000_alignment.sql` — column, `alignment_label`, `shift_alignment`, trade-fulfill trigger (+2/-2).
- `supabase/migrations/20260536000000_alignment_notifications.sql` — unifies label/schism at ±25; milestone push notifications.
- `supabase/migrations/20260581000000_alignment_teeth.sql` — specialist bless/curse factors + Greedy redemption (+3).
- `supabase/migrations/20260630000000_alignment_regen_linear.sql` — linear regen factor in `regen_secs_for`.
- `docs/season-1-goblins-vs-angels.md` — the 8-week design plan.
- `docs/alignment-teeth-spec.md` — the mechanical-effects spec.

## Connects to

- [[core-loop-and-tickle-trade]] — fulfilling/asking trades is the primary alignment driver (+2/-2/+3).
- [[blessings-curses-effects]] — casting shifts alignment (+1/-1) and alignment scales their potency.
- [[regen]] — alignment is one multiplicative factor in `regen_secs_for`.
- [[seasons-and-judgement-day]] — Judgement Day ranks alignment and resets every score to 0.
- [[happiness-and-mood]] — sits alongside alignment as another `regen_secs_for` factor.
- [[lucky-pig]] — design proposes fairy/imp variant keyed to alignment.

## Open questions / risks

- **"Decline -1" is unconfirmed.** Declining a trade request only triggers a push notification (`supabase/migrations/20260552000000_decline_and_achievement_push.sql`); no `shift_alignment` call was found for declines. The -1 effects in the SQL come from curse casts, not declines.
- **Two label thresholds in history.** Old migrations/comments reference ±34; current canonical value is ±25. Any query reading the original `alignment_label` body could disagree — verify the latest CREATE OR REPLACE wins (carry-latest-def footgun).
- **Client/SQL drift.** `utils/alignment.ts` thresholds and percentages must stay synced with the latest migrations by hand; there's no shared source of truth.

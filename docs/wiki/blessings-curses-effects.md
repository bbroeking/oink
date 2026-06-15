---
title: Blessings, Curses & Active Effects
aliases: [blessings, curses, rituals, active-effects, hoofprints]
tags: [system, social, season]
status: stable
sources:
  - code: utils/rituals.ts
  - code: utils/activeEffects.ts
  - code: hooks/useActiveEffects.ts
  - sql: supabase/migrations/20260522000000_blessings.sql
  - sql: supabase/migrations/20260523000000_curses.sql
  - doc: CONTEXT.md
last_compiled: 2026-06-13
---

# Blessings, Curses & Active Effects

The Season 1 friend-to-friend ritual system: a player casts a **blessing** (angel-coded) or **curse** (goblin-coded) on a friend, which lands on the receiver as a timed **active effect** — shown player-facing as "Hoofprints."

## How it works

Two sides of one mechanic (`CONTEXT.md` lines 8–10):

- **Ritual** = the sender-side cast. `utils/rituals.ts` holds the metadata + daily rotation; `send_blessing()` / `send_curse()` are the `SECURITY DEFINER` RPCs (`20260522000000_blessings.sql`, `20260523000000_curses.sql`).
- **Active effect** = the receiver-side row, read by the `my_active_effects()` RPC and the `useActiveEffects` hook.

**Daily rotation.** Each day exactly one kind of each is castable, picked by `(EXTRACT(DOY) % 4)`. The client (`dailyBlessingKind`/`dailyCurseKind`, `utils/rituals.ts:104-110`) MUST mirror the SQL (`daily_blessing_kind()`/`daily_curse_kind()`) or the UI offers a kind the server rejects (`utils/rituals.ts:1-6`).

**Kinds** (`utils/rituals.ts:43-95`; durations in the send RPCs):
- Blessings — `warm_tea` (2× regen, 1h), `sun_beam` (next-[[lucky-pig]] boost, 24h), `halo_kiss` (+5 tickles, instant), `bountiful_snouts` (+5 snouts, instant; NULL `expires_at`).
- Curses — `sluggish_snout` (½ regen, 1h), `phantom_itch` (1-in-3 taps slip, 24h), `goblin_whisper` (green miasma, 4h), `coin_pinch` (snips up to 3 snouts, instant).

Casting shifts the sender's [[alignment]]: blessing `+1`, curse `−1` (`shift_alignment`, both migrations).

**Anti-grief caps** (`20260523000000_curses.sql:7-15`):
- One cast per (sender, receiver) per UTC day (unique index); 3 casts/sender/day, raised to **5 for VIP** (`is_vip`).
- `coin_pinch` snout loss capped at **−10/day per receiver** across all incoming curses; past the cap the row still records but takes 0.
- Regen-debuff curses carry `expires_at`; the comment notes the Barn caps total debuff to **2h/day** when reading `my_active_effects`.

**Cleanse / cancel.** Receiving any blessing while cursed clears active curses (`blessing_clears_curses` trigger). `cleanse_curses()` spends **5 snouts** to wipe active incoming curses (no-op + free if none). The hook's `cleanse()` (`hooks/useActiveEffects.ts:126-136`) is optimistic, then reconciles on failure.

## Key files
- `utils/rituals.ts` — sender-side kind metadata + `(DOY % 4)` daily-rotation accessors.
- `utils/activeEffects.ts` — receiver-side pure helpers: `fetchActiveEffects`, `effectMeta`, `partitionBySource`, `formatLeft`.
- `hooks/useActiveEffects.ts` — stateful read path (fetch, focus refresh, realtime on blessings/curses) + cleanse mutation.
- `supabase/migrations/20260522000000_blessings.sql` — `blessings` table, `send_blessing`, `daily_blessing_kind`.
- `supabase/migrations/20260523000000_curses.sql` — `curses` table, `send_curse`, `cleanse_curses`, `my_active_effects`, clear trigger.

## Connects to
- [[alignment]] — every cast nudges the sender toward Giver or Greedy.
- [[regen]] — `warm_tea`/`sun_beam` boost and `sluggish_snout` halves tickle regen.
- [[lucky-pig]] — `sun_beam` boosts the next Lucky Pig, then burns off.
- [[snouts-economy]] — `bountiful_snouts`/`coin_pinch` move snouts; cleanse costs 5.
- [[friends-graph]] — `are_friends` gates who you can bless or curse.
- [[notifications]] — incoming casts surface in the Inbox ("bob cursed you").
- [[seasons-and-judgement-day]] — rituals are the Season 1 alignment driver.
- [[battle-pass-and-slop-club]] — VIP/Pro raises the daily cast cap to 5.

## Open questions / risks
- The 2h/day regen-debuff cap and `phantom_itch` miss gate live in Barn read-side code (`components/Barn.tsx`), not in these files/migrations — the cap is only documented as a comment in the SQL.
- Client/server rotation drift is a standing footgun: any reorder of the rotation arrays must be mirrored in both `utils/rituals.ts` and the SQL `ARRAY[...]` literals.
- `my_active_effects()` excludes instant effects (NULL `expires_at`), so `bountiful_snouts`/`coin_pinch`/`halo_kiss` never appear as Hoofprints.

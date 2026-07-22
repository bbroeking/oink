# Spec 14 — Mud-wrap stacking: extend duration, never multiply regen

**Decision trail:** SKILL.md decision log 2026-07-16 (option 1, founder call).
Migration AUTHORED ONLY — never `db push`.

## Current state

`mud_wrap` is a ritual/blessing (utils/rituals.ts:91 — "tickle regen runs
double speed for a few hours"; duration `interval '3 hours'` mapped in
supabase/migrations/20260714000000_coop_dig_rebuild.sql:738). Today,
re-casting on an already-wrapped pig either stacks a second active-effect row
(risking multiplied regen) or is wasted — determine which by reading the
LATEST definition of the ritual-casting function (find the alphabetically
newest migration that defines it — carry-latest-def rule; grep migrations for
the cast function that inserts blessing rows, and check how the regen
multiplier aggregates across active effect rows in the regen computation).
ALSO check the admin-gated-announcement footgun (CLAUDE.md memory): if the
cast function inserts into system_announcements, the INSERT must stay inlined.

## The change

When a mud-wrap is cast on a pig that already has an active mud-wrap:
- EXTEND the existing effect's `expires_at` by the wrap duration (additive
  time), instead of creating a parallel row.
- The regen multiplier NEVER compounds — one wrap's worth, regardless of how
  many friends wrapped you.
- Cap total banked duration at a sane ceiling (recommend 12h — 4 wraps) so a
  coordinated herd can't bank a week of double-regen; pick the cap constant
  server-side and surface it in the migration comment.
- The caster's cast still "lands" (no error, ritual consumed as today, push/
  announcement per existing behavior) — a second friend's wrap is never
  wasted, it adds time. Receiver's active-effect card shows the extended
  expiry naturally via `my_active_effects`.

## Client

Check whether any client surface assumes at-most-one mud-wrap row or computes
regen from effect rows (hooks/useActiveEffects.ts, utils/activeEffects.ts,
Barn regen derivation). If the server dedupes into one row, the client likely
needs nothing — verify and state so.

## Migration

Timestamped after the latest authored migration (after
20260746000000_seeded_crew_boards.sql if spec 08 landed first — check
`ls supabase/migrations | tail` and number accordingly). Carry the latest
definition of every function you replace.

## Verify

- db-harness smoke: wrap → wrap again ⇒ one row, extended expiry, capped at
  ceiling; regen multiplier unchanged. Wire into run.sh (watch the 50–53 glob
  gap).
- Full JS suite + typecheck.

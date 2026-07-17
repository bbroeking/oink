# Spec 06 — Small fixes batch (GH #12): four one-pointers

**Source:** GitHub issue #12 (`gh issue view 12`). All client except (a)'s
read of an existing RPC field. No migrations needed.

## (a) lucky_won toast

The `update_profile_and_item_count` RPC already returns `lucky_won` (latest
def `supabase/migrations/20260683000000_referral_reward_ladder.sql:313-315`)
but the client never reads it — `components/Barn.tsx:634-643` checks only
`res == null`. Add a celebratory toast in `handleIncrement` when
`res.lucky_won` is truthy (Barn's existing toast queue; whimsy voice; check
the migration for what the win pays and say it concretely). NOTE: this is
the server daily-lucky-number event — distinct from the client-rolled Lucky
Pig burst (`utils/luckyPig.ts`); don't entangle them.

## (b) shop UTC-midnight refresh

`app/(tabs)/shop.tsx:706-710` — the countdown interval early-returns when
`resetsIn <= 0`, freezing at 0 until refocus. Fix: when the countdown
crosses 0, call `load()` (the :700 focus loader) to refetch today's shop +
reseed `resetsIn`. Guard against a tight loop if the server still returns 0.

## (c) 28/25 over-cap toast wording

`components/Barn.tsx:662-677` (`handleAvailableTap`): the over-cap ternary
at :668-670 and the "N / cap" pill at :675 read as a bug when banked over
cap ("28/25"). Fix per the issue's intent: when `itemCount > cap`, the pill
and copy should present the banked state honestly (e.g. cap-reached copy
that acknowledges the bank) rather than an impossible fraction. Keep the
existing whimsy voice; the in-code comment at :664-665 describes the intent.

## (d) Wardrobe → Closet strings

Remaining USER-FACING strings only:
- `app/(tabs)/season.tsx:2003` — button text "Show in wardrobe".
- `constants/release_notes.ts:116` — "The wardrobe is now a dress-up
  screen…" (historical release note — check with the diff reviewer whether
  historical notes should be rewritten; recommend leaving history intact and
  only fixing if it renders in-app today).
Do NOT rename the internal `"wardrobe"` view-enum tokens in shop.tsx
(:545 … :1110) — code-internal, rename is out of scope. Comments too.

## Verify

Full suite + typecheck. For (b), a unit test on the rollover behavior if the
countdown logic is extractable cheaply; otherwise manual-reasoning note in
the report.

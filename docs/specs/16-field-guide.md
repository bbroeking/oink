# Spec 16 — The Field Guide: economy discovery journal

**Decision trail:** founder grill 2026-07-17 — SKILL.md decision log entry +
CONTEXT.md glossary (Field Guide, Burrow Book). Read both first, plus
docs/design/taste-standard.md. Any migration is AUTHORED ONLY — never
`db push`.

## What it is

A second shelf beside the Burrow Book on the `dig-collection` screen: eight
evergreen entries about the game's economy objects. Journal, not manual —
every entry is a mysterious silhouette until the player first encounters the
thing, then opens via a full ceremony reveal (the Book's relic-reveal
pattern). Each open entry: one whimsy-voice line (what it is) + one honest
value line (what it does/pays) with REAL numbers fed from server config.

## V1 entries + unlock triggers + value lines

| # | Entry | Unlock trigger (client-observed) | Value line source |
|---|---|---|---|
| 1 | Truffle | first patch find | drains the Hungerer + mints Golden Truffles — counts from the dig receipt lane |
| 2 | Golden Truffle | first golden minted | spend in the Exchange (rate from Exchange config/RPC) |
| 3 | Lucky Number | first `lucky_won` (spec 06 toast lane) | 3 daily numbers vs the global counter; +5 tickles (read the payout from the RPC result, fallback 5) |
| 4 | Trough | first trough seen funded OR first donation | friends fund the item, opener seeds 10% — NO tickle kickback (post-spec-15 truth) |
| 5 | Mud Wrap & Warm Tea | first wrap/tea received (active-effects lane) | regen ×2 for the duration; repeat wraps EXTEND time (spec 14), duration from server (3h base, 12h ceiling) |
| 6 | Snouts | first tap converts (effectively immediate) | a tap turns a tickle into a snout; snouts buy the shop |
| 7 | The Exchange | first Exchange visit | truffles → cosmetics, earn-only |
| 8 | Feeding Windows | first patch dig | three feedings a day, open first 4h — times COMPUTED from `feedingSchedule` (utils/feedingConfig.ts), never hard-coded (the +2h flip must self-update the entry) |

Echo is DELIBERATELY absent (founder cut — mechanic mid-redesign). Do not
add it.

## Build shape

- **Unlock state, server-side:** additive migration — `field_guide_pages
  (user_id, page_id text, unlocked_at)` + idempotent
  `unlock_field_guide_page(p_page text)` (SECURITY DEFINER, auth.uid(),
  ON CONFLICT DO NOTHING, whitelist the 8 page ids) + a read RPC (or fold
  into the table with RLS select-own). NO edits to existing hot functions —
  detection is client-observed at the moments listed above, fired
  fail-soft (client tolerates the un-pushed server: AsyncStorage mirror,
  reconcile on fetch like storybook_seen did in spec 05).
- **Shelf UI:** extend `app/dig-collection.tsx` — the screen becomes two
  `SectionHeader`ed shelves ("the Burrow Book" seasonal + "the Field Guide"
  evergreen). Reuse the Book's silhouette/card grid components if they
  extract cleanly; tokens only.
- **Ceremony reveal:** a popup-queue slot (`usePopupSlot`, pick a priority
  BELOW ceremonies like schism/finale — suggest ~50) following the two-phase
  dismiss contract from spec 02 exactly. One reveal per unlock, queued not
  stacked; if multiple pages unlock in one session they present one at a
  time through the queue.
- **Art:** NO emoji (law). Use existing glyph/sprite art where it exists
  (`assets/images/glyphs/` — truffle, flame, coin etc.); where none fits,
  ship a drawn-placeholder card (ink silhouette + name) and append the
  needed sprites to a `docs/specs/reports/16-field-guide-art-todo.md` for
  the founder's ImageGen lane (flat-sticker law). Do not generate art.
- **Config-fed numbers:** wrap duration + ceiling, lucky payout, exchange
  rates — read from the server surface that owns each (app_setting /
  existing RPCs), compiled fallback, same pattern as
  `utils/feedingConfig.ts`. Never a bare client constant (standing rule).

## Verify

- Unit tests: unlock-state derivation, page-id whitelist, feeding-windows
  entry recomputes when the schedule config changes (assert vs a shifted
  config).
- Harness smoke for the migration (idempotent unlock, RLS own-rows-only,
  unknown page id rejected). Watch the run.sh arg pattern.
- Full suite + typecheck.

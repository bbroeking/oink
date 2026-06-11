# Spec: Closet titles + cleanup, and truffle re-digs

Two player-reported items (tracker #1, #2 + live follow-up report).

## A. Titles in the Closet (+ Closet cleanup)

**Problem.** Titles can only be changed in the Shop's separate **Titles** tab,
but in-app copy (Account) points players at the "Wardrobe" — the Closet — where
no title control exists. Players bounce between tabs and conclude it's broken.
Additionally the Closet has visual debt: item images overflow their tiles and
some tap targets are too small/hard to hit.

**Requirements.**
1. **Titles are switchable from the Closet.** A *Titles* section renders inside
   `ClosetView`'s scroll (reusing the existing `TitlesSection` component +
   `equip_title` RPC — no new server work). `shop.tsx` passes `userId`,
   `activeTitleId`, and the `onChange` setter through to `ClosetView`.
2. **The pig's title is visible and tappable on the fitting-room preview.** A
   title chip under the pig in the preview card shows the active title (or
   "No title — tap to pick"); tapping scrolls to the Titles section (same
   pattern as the existing slot-chip → category scroll-to). **No new native
   modal** — popup-queue discipline; everything inline in the ScrollView.
3. **Stale copy fixed.** Any copy directing players to the "Wardrobe"/Closet
   for titles must now be TRUE (it is, after 1) — and the Shop's Titles tab
   stays as-is (two entry points are fine; the Closet is canonical).
4. **Closet cleanup pass:**
   - Item images must not overflow tiles (`resizeMode: contain`, tile
     `overflow: hidden`, audit the legendary/background tiles which render
     larger art).
   - All tappables ≥ 44pt effective target (hitSlop where the visual must stay
     small — slot-chip ✕, coin pill).
   - Keep the existing design language (cream fitting room, rarity stripes).

**Out of scope:** title rarity art, new title content, Account screen redesign.

## B. Truffle re-digs after cooldown (tracker #1)

**Problem.** `truffle_digs` PK `(truffle_id, digger_id)` = one dig EVER per
visitor per truffle. With ≤3 active friends the pot strands (Jen 8, Freddy 5,
~7 stuck forever) and the host can't bury again (one active truffle per host).

**Requirements.**
1. Migration `20260629000000_truffle_redig_cooldown.sql`:
   - `truffle_digs` gets a surrogate PK (`id bigserial`); replace the PK with an
     index on `(truffle_id, digger_id, dug_at)`. Existing rows preserved.
   - `dig_truffle`: replace the one-dig-ever check with a per-(truffle, digger)
     **3h cooldown** (matches the visit cadence): if the caller's latest dig on
     THIS truffle is < 3h old → `{ok:false, error:'dig_cooldown', next_at}`.
     Otherwise allow another standard bite (40% of remaining, LEAST-capped).
   - Carry the latest live body (20260618 — inline announcements, never
     `send_system_announcement`) verbatim apart from this change. Alias every
     query over `truffle_digs` (the 42702 param-vs-column landmine class).
2. Client: surface the new `dig_cooldown` reason in the dig flow's error copy
   ("You've dug here recently — come back in <Xh Ym>."); map `next_at`.
3. Unit-testable invariants stay server-side; client copy only.

**Out of scope:** changing bite %, pot sizes, or the one-active-truffle rule.

## Verification

- `npx tsc --noEmit` clean; full jest green.
- Closet: titles section renders + equips; preview chip reflects change
  immediately; no image overflow at common device widths; no new native modals.
- Truffle: SQL reviewed for shape-compat (RETURNS jsonb keys unchanged),
  GRANTs present, alias discipline; migration sorts after `20260628`.
- DB push NOT run without explicit user go.

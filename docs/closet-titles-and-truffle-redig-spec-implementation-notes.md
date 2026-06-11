# Implementation notes — closet-titles-and-truffle-redig-spec

Running log. Sections: Off-spec decisions / Changes from spec / Tradeoffs / Heads-up.

## Off-spec decisions

- 2026-06-11: Spec written fresh from tracker #1/#2 + the live report (no prior
  spec file existed); implementing on branch `feature/closet-titles-truffle-redig`
  so the main working tree's in-flight build-94 state stays uncommitted and
  unaffected (repo rule: no commits on the default branch).

## Changes from spec

- 2026-06-11 (B): dig_cooldown copy reuses the modal's existing `lockLabel()`
  formatter for `<Xh Ym>` ("2h 05m" / "12m"); null/past `next_at` degrades to
  "3h"/"now" — same behavior the nap screen already has.
- 2026-06-11 (B, verifier fix): BarnVisitModal's shovel-visibility gate was still
  one-dig-EVER (any prior `truffle_digs` row hid the shovel forever — re-digs
  unreachable for exactly the stranded cohort; `.maybeSingle()` also errors once
  a 2nd row exists). Now fetches the latest `dug_at` and only hides within 3h;
  server stays authoritative.

## Tradeoffs

- 2026-06-11: (A) Slot-chip ✕ gets an asymmetric hitSlop (44×44 anchored to the
  chip's top-right corner — hitSlop can't extend past the parent chip), which
  steals the top-right of the chip from the scroll-to tap; accepted per spec.
- 2026-06-11: (A) No duplicate "Titles" closet header — TitlesSection's own
  "★ titles · N" kicker pill serves as the section heading.
- Titles get TWO entry points (Shop→Titles tab stays; Closet becomes canonical).
  Chosen over removing the tab to avoid breaking the `?view=titles` deep link
  (battle-pass reward dialog uses it — shop.tsx ~886).
- 2026-06-11 (B): `truffleFoundWrap` pill got `maxWidth: 84%` + text
  `flexShrink: 1` so the longer cooldown sentence wraps instead of running off
  the diorama; the short "+N snouts!" / "Already dug up!" renders unchanged.
- 2026-06-11 (B): dig_truffle's cooldown uses a `redig_wait constant interval`
  (not '3 hours' inlined twice) to match the function's share/floor_all style;
  the ledger INSERT carries `AS dd` too — harmless, keeps the alias rule total.

## Heads-up

- The truffle migration (20260629) will be written but NOT pushed — db:push
  stays behind the user's explicit go, per repo rule.
- Tracker #1/#2 should be closed when this lands; #2's "wardrobe copy" root
  cause was stale pointers from the titles-view split (Account.tsx:118,
  shop.tsx:899).
- 2026-06-11 (B): 20260629 drops the PK by its DEFAULT name `truffle_digs_pkey`
  (table was created in 20260610 without an explicit constraint name) — the
  migration fails loudly if prod ever renamed it.
- 2026-06-11 (B): client keeps the `already_dug` branch for old-server compat
  (pre-20260629 servers still return it); new branch maps `dig_cooldown` +
  `next_at`. Dig flow lives in components/BarnVisitModal.tsx (the spec's
  BuriedTruffleSheet/BuriedMound/useBuriedTruffle files don't exist).
- 2026-06-11: (A) Overflow root cause: itemThumbImg used %-width/height inside an
  aspectRatio-sized thumb — Yoga doesn't treat aspectRatio-derived height as
  definite for child % resolution, so the Image fell back to intrinsic px size
  (1024² legendary art, 752×1584 backgrounds). Fixed with absolute insets.
- 2026-06-11: (A) TitlesSection empty-state copy ("Earn titles by climbing the
  snout season pass.") omits the buyable path (Shop → Titles tab) — left as-is
  (out of file-touch scope), flagging for a later copy pass.
- 2026-06-11: (A) shop.tsx's unused `TitlesSection` import removed (orphaned by
  the 4e494f4 closet redesign; ClosetView now imports it itself).

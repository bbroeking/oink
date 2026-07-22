# Spec 10 — "Found the golden in N digs" receipt headline (wedge 5c)

**Source:** docs/wedge-plan.md §Phase 1 (5c). Client-only.

## What to build

The dig receipt's headline becomes the game's Wordle-3/6: one compact,
comparable, braggable number — **the dig count at which the golden truffle was
found** ("found the golden in 14"). The receipt end-card in
`components/mudwar/TrufflePatch.tsx` already knows the full dig sequence.

- If the golden was found: headline = "found the golden in N digs" (match the
  receipt's existing whimsy voice — check neighboring copy; lowercase
  storybook tone, FONTS.whimsy for the numeral treatment per the taste
  standard's TYPE tokens).
- If no golden this session: no headline change — do NOT invent a consolation
  stat; the existing receipt content stands.
- The number must agree with what spec 09's share block says ("4 finds in 19
  digs" + this headline both derive from the same dig-sequence source —
  extract one shared helper if 09 landed first, or leave a clean seam for it).

## Constraints

- Tokens only, no inline hex/sizes; reuse the receipt's existing row/headline
  structures rather than introducing a new layout system.
- Don't disturb the Burrow-Book / uniques lines already in the receipt.

## Verify

- Unit-test the headline derivation (dig sequence → N | null) in `__tests__/`.
- Full suite + typecheck.

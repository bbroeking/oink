# Spec 09 — Text-grid share on the dig receipt (wedge 5b)

**Source:** docs/wedge-plan.md §Phase 1 (5b). Read it first — the wedge test
is "does a 30-second session produce something worth texting?"

## What to build

One "share your dig" affordance on the dig receipt (the end-card ledger in
`components/mudwar/TrufflePatch.tsx`, ~line 1289+ "honest receipt") that
produces a compact text block and hands it to the native share sheet, with a
copy fallback:

```
tickle the pig · feeding #402
🟫🟫✨🍄🟫
✨🟫👑🟫🟫
4 finds in 19 digs
ticklethepig.com
```

- Emoji ARE allowed here — this is outbound message content, not UI (the UI
  emoji ban stands; see CLAUDE.md + taste standard).
- Spoiler-light: the grid shows only which of the player's DUG tiles found
  something and what kind (shape emoji per find class), never coordinates of
  undug board content. Derive the row/emoji mapping from the receipt's dig
  sequence data — the client already knows every dig + outcome.
- Header line: "tickle the pig · feeding #<window/feeding number>". Footer:
  `ticklethepig.com`.
- Use React Native `Share.share()`; provide a long-press or secondary "copy"
  that writes to the clipboard (expo-clipboard is likely already a dep —
  check package.json; do NOT add a new dependency without checking).

## Measurement (wedge-truth, same spec)

Count share-affordance taps: fire-and-forget, fail-soft. Prefer an existing
analytics/event lane if one exists (search for how other client events are
recorded); if none, a fail-soft RPC counter is acceptable ONLY as an authored
migration (never pushed) + client call that tolerates the RPC not existing
yet (errors swallowed, feature works offline).

## Constraints

- Button styling: shared `Button` primitive, tokens only (taste standard).
- The receipt's existing layout is carefully composed — add, don't reflow.
- Coordinate with spec 10 (golden-in-N headline) — if it landed first, place
  the share affordance under the headline stat; the two are designed to
  compose.

## Verify

- Unit-test the grid-text builder (pure function: dig sequence → text block)
  in `__tests__/`.
- Full suite + typecheck.

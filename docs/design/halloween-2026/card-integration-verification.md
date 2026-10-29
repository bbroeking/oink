# Spooky Snouts card integration — October 14, 2026

The additive collection has 34 stable SSN card identities: the original 22
followed by 12 additions. It maps one-to-one to 26 costume pieces and eight
backgrounds. The original 88-card catalog, print art and gameplay rules remain
the base set.

## Design and artwork

The existing private Claude Design Halloween canvas used the selected Tickle
the Pig Design System and an unchanged Mud Shovel reference. Its guidance
became the shared renderer's lilac seasonal perimeter, ITEM/PLACE labels,
first-copy rule and dark COLLECTION CARD band. Seasonal prints have no Rank,
stats or Training action.

All 34 selected illustrations are registered by the deterministic
`scripts/build-seasonal-card-art.mjs` writer. Exact `cardArtVersion` selection
prevents accidental use of a rejected attempt. Final selected v2 art is used
for 005, 007, 009, 014, 023 and 029. The other 28 use v1. Original generation
outputs and rejected workspace versions are retained. Prompts and copied
sources are saved in `art-generation.json`; selected-image review is in
`art-qa.md`.

The illustrations supply the art window. The existing React Native
`CollectibleCard` supplies every card frame and text panel; there is no second
HTML-only card implementation.

## Browser verification

Actual React Native Web/Rive preview: http://127.0.0.1:4320/.

- Played the Spooky Snouts three-card packet with Reduce motion off and the
  normal renderer: Moonbrew Witch Hat, Hedge Broom, foil Lantern Porch.
  Inspect/back during the first reveal resumed the same card. Each subsequent
  reveal settled normally, with the matching SSN raster source and footer.
- Reloaded during the first reveal and later in the album. The existing
  opening/receipt, three copies, local cosmetics and seasonal set selection
  survived. Reopening the saved receipt left quantities unchanged.
- The receipt names the matching permanent local preview cosmetic for each
  first copy and explicitly labels its ownership scope as local.
- Inspected all 34 card detail screens at 393 × 852. Every image loaded with
  nonzero natural dimensions. Each card measured 300 × 420. No silhouette
  clipping, fallback art, blank art windows or missing footer was observed.
  The captured metadata is `browser-card-checks.json`.
- Inspected Harvest Moon Cornfield at 320 × 568, scrolling the normal page.
  Its 300px card fits horizontally; the long name, rule, lower band and footer
  fit their panels.
- Switched to the base set and inspected Mud Shovel. Its Rank 2, 3 Bash,
  Training action, held slot and RLB 019/88 print remain intact.

Evidence: [new additions](new-card-preview-393.png),
[base/seasonal comparison](base-seasonal-family-comparison.png),
[all 34 cards](card-contact-sheet-393.png),
[receipt](preview-unlock-receipt-393.png),
[album](preview-seasonal-album-393.png),
[320px place](preview-place-320.png), and
[base reference](base-card-reference-393.png).
The individual 393px captures are in `card-preview-393/`.

## Source verification

Final focused run:

```sh
npx jest --watchman=false --runInBand \
  __tests__/cards-domain-catalog.test.ts \
  __tests__/cards-domain-constructed-deck.test.ts \
  __tests__/cards-domain-hedge-run.test.ts \
  __tests__/cards-domain-opening.test.ts \
  __tests__/cards-opening-playback.test.tsx \
  __tests__/cards-seasonal-render.test.tsx \
  __tests__/cards-seasonal-unlocks.test.ts
node scripts/build-seasonal-card-art.mjs --require-complete --check
```

Seven suites / 45 tests passed. Tests cover the full mapping, first-copy and
repeat receipts, exact persisted ownership derived from committed receipts,
tamper rejection, replay, album selection restoration, item/place rendering,
opening playback, and exclusion of all 34 seasonal IDs from constructed decks
and Hedge Run. TypeScript, scoped ESLint and diff checks pass. React
best-practices review found no actionable regression.

An initial Jest invocation hit sandboxed Watchman state permissions; the
documented run disables Watchman. The quality watcher hits the existing EMFILE
limit. The one-shot `quality:check` still fails the locked baseline: 138 text
line clamps exceed budget 91, and the older
`20260916140000_my_drives_opener_pig.sql` lacks the default-role revoke contract
for `my_drives`. These are not reported as passing.

## Production boundary

This completes the seasonal collection's integration into the existing local
card system: catalog, artwork, packet presentation, album, details and
persistent local cosmetic receipts. The production server migration remains
local/unapplied and the set inactive. No production reward, deploy, build or
database push was performed.

Card illustrations are not a certification that the new pieces fit animated
pigs. Shipping front/profile wearable art, Placement Studio pivots, all-six-pig
frame acceptance, runtime equipment registration, approved earned-pack sources,
live dates and cross-device account verification remain activation work. Do
not treat concept board overlays or a card PNG as calibrated accessory
geometry. The saved `pig-accessory-placement` skill/tool workflow performs
that later fitting.

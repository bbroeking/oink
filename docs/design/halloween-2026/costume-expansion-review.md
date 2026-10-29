# Halloween 2026 costume expansion — integration review

Review scope: the local prototype authority, costume fit catalog, card experience integration, fitting room, shared costume renderer, and focused tests for the five-costume packet.

## Review result

Pass after one state-restoration defect was fixed during review. No remaining correctness finding was identified in the reviewed scope. Visual placement and animation acceptance remain with the separate visual QA pass.

## Verified behavior

- The costume packet grant is idempotent and is added for both fresh snapshots and restored version-1 snapshots.
- The committed opening receipt replays without mutating state or granting the five costumes twice.
- First copies grant the five matching costume item IDs; seasonal costume results add no base-set repeat/foil progress.
- Restored authority validates card identity, finish, copy counts, item unlock identity, receipt ownership, and exact fixture length.
- The equipped costume is part of the persisted snapshot. Restore keeps it only when the ID is a known Rosie fit and the restored authority owns that item; unknown or unowned IDs resolve to no equipped costume.
- Locked costumes remain previewable in the fitting room, while the equip action stays disabled until the corresponding item is owned.
- `CostumeRosieStage` uses one `usePigPlayback` result to choose the Rosie frame and both costume layers. Native rendering therefore has one animation clock rather than independently advancing pig, hood, and romper layers.
- The packet shelf identifies the five-card costume fixture separately, reports the correct unopened count, and gives its pickup/resume control a costume-specific accessibility label.

## Finding resolved during review

The first implementation accepted either a three-result or five-result receipt before selecting the grant's fixture, but did not require the receipt length to equal that selected fixture. A tampered five-costume receipt could therefore be truncated to three internally consistent results. The authority now rejects any receipt whose result count differs from the selected fixture, with a focused regression test.

## Validation

- `npm test -- --watchAll=false --no-watchman --runInBand __tests__/cards-costume-game-integration.test.tsx __tests__/cards-domain-opening.test.ts`
- Final run: 2 suites passed, 17 tests passed.
- A prior rerun without `--no-watchman` hit the sandboxed Watchman state-file permission; the same Jest selection passed with Watchman disabled.

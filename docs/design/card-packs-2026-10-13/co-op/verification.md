# Co-op prototype verification — 2026-10-13

## Rules model

The isolated model is in `scripts/prototypes/coop-cards/`. It is not wired into the production app or automatically synchronized with Claude Design's prototype.

- `node --test scripts/prototypes/coop-cards/test.mjs`: **14/14 passed**, rerun by the lead after final formatting.
- Covers phase/turn gating, required and optional draw/discard choices, Legend trigger limits, ally-only combos, Energy validation, Guard splitting, tie targets, immediate wins, simultaneous defeat, the round-six clock, cleanup, partial draws, the exact round-two collaboration example, terminal trigger cutoff, and seeded whole-game card conservation/resource bounds.
- Full output: `rules-test-results.txt`.

## Synthetic play

500 fixed seeds per simple policy, same untuned learning encounter:

| Policy | Wins | Win rate | Average winning round |
| --- | --- | --- | --- |
| Attack first | 500 | 100% | 3.898 |
| Guard first | 498 | 99.6% | 4.546 |
| Conditional team | 481 | 96.2% | 4.744 |

Full output: `simulation-results.txt`. These policies are heuristics, not optimal play or human evidence. The results indicate an easy learning encounter and do **not** establish that cooperation is necessary, that strategies are balanced, or that the game is fun. A later difficulty pass should compare avoidable damage, overhealing, unused Energy and wasted Guard, then test a scenario that rewards responding to announced intent. Preserve this baseline for comparison.

## Repository gates

- `npm run quality:loop` could not remain running: existing watcher limit produced `EMFILE`.
- `npm run quality:check` failed on unrelated existing baseline gates: 138 line clamps against a budget of 91, and missing default-role revocation for the `my_drives` SECURITY DEFINER function in migration `20260916140000_my_drives_opener_pig.sql`.
- Full check output: `quality-check.txt`.
- This work adds exploratory docs/scripts and a private Claude canvas. No production app, database, release, or multiplayer service was changed.

## Template inspection

- Inspected the reusable `CoopCard` component in Claude Design with the original transparent Rosie illustration.
- Changed component width to 320 and text scale to 2: title and rules wrapped; the card expanded vertically rather than shrinking all content. Screenshot: `card-320-double-text.png`. This is component-width testing inside the desktop canvas, not a physical phone test.
- Enabled break-out mode: the enlarged original silhouette crosses the inner art rim while protected title and rules panels remain above it. Screenshot: `rosie-breakout-template.png`.
- Enabled reduced motion: the preview image reported `animation-name: none` and `transition-duration: 0s`.
- Inspected the completed workshop's four template variants and eight compact card definitions. Clean originals are used for Rosie, Pepper and Great Hungerer. Existing rectangular printed-art crops remain on Snoot Boop, Bog Frog, Root Around and Lantern Signal; four other Moves explicitly show missing art. Non-Legend clean cutouts remain outstanding.
- The lab includes fixed 280/320/393 Lantern Signal comparisons, a 55-word rules/long-title/two-digit Energy stress card, a doubled-text 320px card, and missing-art/reduced-motion cases. Long-title text wraps without horizontal overflow in its measured container. Saved `stress-tests.png` and `template-pair-320.png`. Full device accessibility acceptance remains open.

## Browser encounter smoke test

Private [Co-op Card Workshop](https://claude.ai/design/p/aec2145f-9fe2-4416-ab82-50c0100f537d?file=Co-op+Card+Workshop.dc.html), using both seats locally:

- Loaded the round-two teamwork fixture. Its initial state is 2 Progress, Rosie 12 Cheer, Pepper 7 Cheer (a prior-round example); this differs from the local model's zero-progress/full-Cheer unit-test fixture.
- Manually played Pepper's Duck Into the Mud: 4 Guard. Passed, then played Rosie's Toy Sword: +3 Progress, followed by Big Wind-Up: +4. Both passed.
- Allocated Guard 3 to Rosie and 1 to Pepper. Resolved Bottomless Gulp: Rosie remained at 12, Pepper fell to 5, Progress became 9, Guard cleared, and round 3 began with Rosie leading. These are the expected deltas.
- Played Root Around: two drawn cards were shown before the mandatory discard, while other plays/pass were disabled. Discarded Snoot Boop; Rosie's once-per-round ability then drew one and requested its own discard. Resolved it and returned to an actionable turn.
- Restart restored round 1, 0 Progress, both pigs at 12 Cheer and four cards each. Left the page ready for a new test. Screenshot: `encounter-preview.png`.
- This smoke test does not certify parity between the separate browser engine and local model. Browser terminal outcomes and all edge cases were not independently replayed by the lead. The 14 automated checks apply to the local model only.

## Human acceptance still required

Two people should play without coaching. Ask each to explain a card, predict the enemy phase, identify a useful partner setup, and resolve a draw/discard choice. Record whether they discuss a joint plan, whether one player controls every decision, and whether a session fits the provisional ten-minute target. Timing and enjoyment have not been measured.

# Snout Deep dig screen — baseline layout spec

Canvas: https://claude.ai/code/artifact/ca72fd4d-0bb5-420e-8fde-4fffe172e99a
(the "Proposed" artboard is the target). File: `components/mudwar/SnoutDeepPatch.tsx`.

## Goal

Move the wake meter out of the header's right column into a full-width row
under the rail. Nothing else on the screen changes.

## The row, top to bottom (no scrolling on a 402×874 phone)

1. Rail — close chip, sign. Unchanged.
2. Sleeper strip — NEW. One row, full width:
   - Hungerer face at the left, 56pt (`ART_SIZE.badge`).
   - `ProgressTrack` filling the rest of the row: `value = attention`,
     `max = wakeMeter.hi`, `band = {from: lo, to: hi}`, height `md`.
   - Under the track, one line: the state word left ("sound asleep" /
     "stirring" / "one eye open", hand voice, secondary tone); "50" and
     "110" right-aligned under the band's two ends (the stamp's `lo`/`hi`).
   - Remove the meter and tag from under the face in the header.
3. Verb cards — unchanged ("free · 5 left", "+1", "+10").
4. Layer chips — unchanged.
5. Board 6×5 — unchanged.
6. Whisper — unchanged, but every whisper string must fit two lines
   (≤ 100 characters). No ellipsis.
7. Pouch wells — unchanged.
8. Footer — unchanged ("Tie it off · leave", "Find the truffle first").

## Rules

- Tokens only (`SPACE`, `RADII`, `ART_SIZE`, `WHIMSY`); no raw numbers.
- Rules 1 (old builds) keeps today's header. The strip appears only when
  `state.rules === 2`.
- Accessibility: the strip is one element; its label reads
  "attention N of 110, band from 50; sound asleep".
- Keep every existing test green; add one that the strip renders under
  rules 2 and not under rules 1.

## Done when

- Preview `ticklethepig://snout-deep-preview` shows the strip full width
  under the rail with the band painted and the fill moving on a shove.
- `npx tsc --noEmit -p .`, eslint (0 errors), `npx jest`, `npm run -s
  scorecard` (0) all pass.

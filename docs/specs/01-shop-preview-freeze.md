# Spec 01 — Shop preview freezes at rest; Closet + Visit sync frames

**Decision trail:** founder call 2026-07-16; taste-standard decision log
("a moving pig with a pinned item is never acceptable"); CONTEXT.md Mood entry
carve-out. Read both before starting.

## The bug

`PigStage` (components/ui/PigStage.tsx) resolves every item-slot anchor with
`pigFrameIdx` (default 0), but never passes a `frameIdx` down to `SpritePig` —
which therefore auto-advances its animation internally
(components/ui/SpritePig.tsx: external `frameIdx` bypasses the auto-advance
interval, see ~line 137). Result: the pig plays its idle loop while the
equipped item stays pinned to frame 0's anchor. `SwipeElement.tsx:333-336` is
the ONE caller that does it right: `pigFrameIdx={pigFrameIdx}`
`onPigFrame={setPigFrameIdx}` — anchors track the live frame.

Broken callers:
- `components/ItemPreviewModal.tsx:260` (shop preview) — `pigAnimation="idle"`, no wiring
- `components/ClosetView.tsx:287` — no wiring
- `components/BarnVisitModal.tsx:840-852` — no wiring

## The fix (two treatments, per the mood-surface ruling)

1. **Shop preview (ItemPreviewModal): FREEZE.** Add a `pigFrozen?: boolean`
   prop to `PigStage` that, when true, passes `frameIdx={pigFrameIdx}` through
   to `SpritePig` (pinning it to frame 0 — the rest pose the placement studio
   tunes anchors against). ItemPreviewModal sets `pigFrozen`. Mood does NOT
   display here (documented carve-out) — keep `pigAnimation="idle"` so the
   frozen frame is the content rest pose regardless of mood.
2. **ClosetView + BarnVisitModal: SYNC**, exactly like SwipeElement — local
   `pigFrameIdx` state wired to `onPigFrame`. These are living mood surfaces
   (CONTEXT.md: Mood, Visit) — the pig must keep breathing and the item must
   ride along. Do not change which animation they play.

## Constraints

- Don't disturb SwipeElement or any other caller.
- `TickleParticlePreview` and background previews in ItemPreviewModal don't
  render a pig — untouched.
- No new tokens/styles; this is behavior only.

## Verify

- Unit: if a cheap test can assert SpritePig receives `frameIdx` when frozen,
  add it beside the existing component tests; otherwise rely on typecheck +
  suite.
- Run the full test suite (`npm test`) and `npx tsc --noEmit` if the repo
  typechecks standalone.

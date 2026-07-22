# Spec 02 — Popup queue cluster: BuriedTruffleSheet null-block + unmanaged sheets

**Source:** GitHub issues #3 and #4 (read both: `gh issue view 3` / `4`).
They share the popup-queue architecture — fix as one pass.

## Shared architecture (read first)

`components/ui/PopupQueue.tsx` owns popup arbitration (`PopupQueueProvider`,
`usePopupSlot(id, want, priority)`, `usePopupHold(active)`). One native Modal
presents at a time; every hide funnels through a `draining` phase with a
700ms `POPUP_HANDOFF_GAP_MS` before ONE re-admission decision. Lower priority
number wins. `usePopupHold` is a reference-counted gate: while held, nothing
admits and anything presented drains. Session flags live in
`utils/popupSession.ts` (in-memory, reset on cold launch).

**Load-bearing contract:** never flip one modal's `visible` false and
another's true in the same commit. Slots dismiss two-phase: `release()`
first, clear backing state one `POPUP_TEARDOWN_MS` (500ms) beat later, keep
the modal mounted meanwhile. The 500 < 700 relationship is intentional.

## Part A — #3: BuriedTruffleSheet renders null while presented

`components/BuriedTruffleSheet.tsx:56` — `if (!open || !status?.buried)
return null;` while `Barn.tsx:444` holds slot `"truffleSheet"` at priority 5
(highest in the app). When `truffleSheetOpen` sticks true but `status.buried`
is false (note `hooks/useBuriedTruffle.ts:47-49` fail-softs RPC failure to
`buried:false`), the machine sits `presenting` on a modal that never mounted:
no release, no drop, and priority 5 wins every contest → every other popup is
suppressed for the session.

Fix shape: the sheet's *want* must die (drop/onClose) whenever it would
render null while `visible` — the slot may never sit presented with no
mounted modal. Respect the two-phase teardown (don't cut `open` same-frame),
and don't treat a transient `truffle_status` fetch failure as a permanent
open sheet (fail-soft ≠ "not buried forever" — if status is failure-derived,
close quietly).

## Part B — #4: HoofprintsSheet + UserSheet are invisible to the queue

`components/HoofprintsSheet.tsx:71,81` and `components/UserSheet.tsx:432`
render unmanaged native Modals. Foreground polls in `app/_layout.tsx`
(schism :326, finale :351, achievements :726 — all re-fire on AppState
"active") can present a queued popup over them → the iOS #50152 wedge.

Preferred fix (the issue's "latch", matches the existing primitive): an
"unmanaged modal open" hold — `usePopupHold(open)` inside each unmanaged
sheet (or a tiny wrapper hook, e.g. `useUnmanagedModalHold(open)`, so future
sheets get it in one line). Holds already block admission and drain the
presented popup, which is exactly the wanted mutual exclusion.

Constraints:
- Do NOT convert UserSheet's nested BarnVisitModal/ConfirmDialog to slots —
  their nesting inside UserSheet's Modal is intentional iOS presentation
  ordering. The outer sheet's hold covers them.
- The hold must release on close so drained popups re-admit after the 700ms
  gap (verify a queued achievement fires after closing UserSheet).

## Verify

- Extend `__tests__` where the queue/popupSession already has coverage
  (`__tests__/…popup…` — check what exists) with: (a) a slot whose want dies
  while presented admits the next-priority want; (b) hold blocks admission.
- Full suite + typecheck.

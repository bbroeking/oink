// One number the whole visit chrome agrees on.
//
// The visit screen's header row, status capsules, stage toggle and bottom pill
// are all FIXED-height chrome wrapped around a `flex: 1` stage — they have no
// room to grow, so past one step of Dynamic Type they clip instead of
// expanding (an `accessibility-medium` device pass read "× Lea", "O" / "I" and
// "Leave a h"). Every text in that chrome takes this ceiling, which is the same
// cap the friend row took for the same structural reason (the 2026-09-12
// "a row's actions slide over its name" ruling).
//
// It is a CAP, not a rule: everything below the chrome — the scene, the
// dialogs — still scales the full 200% the design system
// requires.
export const VISIT_TYPE_CAP = 1.3;

import { AVATAR_SIZE, SPACE, STATUS_SAFE, TAP_MIN } from "@/constants/theme";
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

/** The height of a status capsule — the avatar sets it, so the header's total
 *  chrome is STATUS_SAFE + TAP_MIN + SPACE.sm + this. */
export const STATUS_TAG_H = AVATAR_SIZE[0];

/** The gap between the header row and the tally capsules (the status row's
 *  own top margin) — named so the chrome's height is a sum of named parts. */
export const STATUS_ROW_GAP = SPACE.sm;

/** The whole chrome above the scene — status inset, header row, gap, tally
 *  capsules — as the visit lays it out (`BarnVisitModal` `chrome`). */
export const VISIT_CHROME_H = STATUS_SAFE + TAP_MIN + STATUS_ROW_GAP + STATUS_TAG_H;

/** The toast line on the visit: one gap under the chrome, so a toast never
 *  covers the tallies (placement B, 2026-09-15). */
export const VISIT_TOAST_LINE = VISIT_CHROME_H + STATUS_ROW_GAP;

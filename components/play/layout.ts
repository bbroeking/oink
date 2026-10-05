// The Play screens' drawing geometry: the few fixed boxes the hub, the table
// and the wins board are DRAWN from (a pig's stage box, an icon's art box,
// how long a sticker hangs in the air). Spacing, radii, borders, type and
// colour all come from constants/theme.ts; these are sizes of drawings, not
// steps on the spacing scale, so they are named here once rather than
// re-declared per component. (2026-10-04)

import { ART_SIZE, MOTION, SPACE, TAP_MIN } from "@/constants/theme";

// ── The seat strip ───────────────────────────────────────────────────────────

/** The largest a seat's pig is drawn (two pigs on a 402pt phone). */
export const STRIP_PIG_MAX = 104;
/** The smallest (four pigs on a 375pt phone). */
export const STRIP_PIG_MIN = 64;
/** The scale every pig stage is drawn from (PigStage's 300pt canvas). */
export const STAGE = ART_SIZE.stage;
/** The sky band reserved over the pigs when a game floats a bubble there
 *  (Snout Says' clues): the bubble's 56pt floor plus its two tail dots. */
export const BUBBLE_SKY = 64;
/** Where a bubble's foot lands, as a share of the pig's box from its top: on
 *  the crown of the pig's head rather than in the empty air above it. */
export const BUBBLE_FOOT = 0.18;
/** The contact shadow under a pig, as a share of its box. */
export const SHADOW_FRAC = 0.5;
/** The active pig steps up by this much (drawing travel, not spacing). */
export const STEP_UP = SPACE.xs;
/** A pig's frame at the table's turn: how long the turn takes to read. */
export const TURN_BEAT_MS = MOTION.fade * 2;

// ── Compact chips (a board that stages its own pigs) ─────────────────────────

/** The portrait on a compact seat chip. */
export const CHIP_PORTRAIT = ART_SIZE.glyph;

// ── Emotes ───────────────────────────────────────────────────────────────────

/** One sticker button in the tray: the full touch frame. */
export const EMOTE_BUTTON = TAP_MIN;
/** The art inside it. */
export const EMOTE_ART = ART_SIZE.glyphMd;
/** The sticker that pops over a pig when it emotes. */
export const EMOTE_POP = ART_SIZE.glyph;
/** How long that sticker hangs over the pig: the toast's dwell. */
export const EMOTE_HOLD_MS = MOTION.toast;
/** How long a reaction's resting mood is held before the pig settles. */
export const MOOD_HOLD_MS = MOTION.toast;

// ── Game art ─────────────────────────────────────────────────────────────────

/** A game's icon on its hub card. */
export const GAME_ICON_CARD = ART_SIZE.badge;
/** A game's icon at the head of its sheet and on the invite landing. */
export const GAME_ICON_HERO = ART_SIZE.thumb;
/** A game's icon on a table row. */
export const GAME_ICON_ROW = ART_SIZE.glyph;
/** One icon in the fan of five (the door, the any-game shortcut). */
export const FAN_ICON = ART_SIZE.glyphMd;
/** How far each icon in the fan tucks under the one before it, as a share
 *  of the icon (so a smaller fan stays as readable as a big one). */
export const FAN_TUCK_FRAC = 0.4;
/** The fan's lean, outermost to centre, in degrees. */
export const FAN_TILTS: readonly number[] = [-14, -7, 0, 7, 14];

// ── Pigs on the hub and the landing ──────────────────────────────────────────

/** Your pig on the searching card. */
export const SEARCH_PIG = 88;
/** The inviter's pig on the invite landing. */
export const LANDING_PIG = ART_SIZE.reveal;
/** A seated pig in the lobby. */
export const LOBBY_PIG = ART_SIZE.thumb;

// ── Timing ───────────────────────────────────────────────────────────────────

/** How long the hub keeps watching for a table after a search or an accept
 *  stops: the queue's "matched" and the table's first snapshot are two
 *  frames that may arrive in either order. */
export const TABLE_WATCH_GRACE_MS = 15_000;
/** How long a table just pushed counts as open before its screen mounts
 *  (nav.ts): a second way to the same table firing in that beat is the same
 *  tap, not a second table. */
export const TABLE_OPEN_SETTLE_MS = MOTION.beat;
/** The beat a "Copied" stays on the copy button. */
export const COPIED_BEAT_MS = MOTION.toast;
/** The count of a badge past which it reads "9+". */
export const BADGE_MAX = 9;
/** The door's count badge: a dot that stays round around two glyphs (the
 *  Friends hub's Inbox badge, the same drawing). */
export const BADGE_SIZE = 18;

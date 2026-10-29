// The seasonal stall's clock (Pop-up Stall, 2026-10-29). Pure: every surface
// that says how long a stall stays (the card on the wall, the stall page's
// crown, the lilac tag on the try-on sheet, the buy confirm) asks these, so the
// stall can only ever tell one time.
//
// A stall lives through three phases, all read from its `closes_at`:
//   · open: opens_at <= now < closes_at, "leaving in N days";
//   · boarded: closes_at <= now < closes_at + 3 days, the packed-up sign and
//     "your haul";
//   · gone: past that, the card unmounts.
// The server answers the same question (seasonal_shelf() status); the client
// re-asks it against a ticking clock so a stall that closes while the shop is
// open boards itself without a refetch.

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;
/** How long the boarded sign stands after the window closes. */
export const BOARDED_DAYS = 3;

export type ShelfPhase = "upcoming" | "open" | "boarded" | "gone";

function toMs(at: string | number | Date | null | undefined): number | null {
	if (at == null) return null;
	const ms = at instanceof Date ? at.getTime() : typeof at === "number" ? at : Date.parse(at);
	return Number.isFinite(ms) ? ms : null;
}

/**
 * Where a stall is in its life at `now`. A stall with no dates is dark: it
 * reads as "upcoming" (never shown) rather than open.
 */
export function shelfPhase(
	window: { opensAt: string | null; closesAt: string | null },
	now: number,
): ShelfPhase {
	const opens = toMs(window.opensAt);
	const closes = toMs(window.closesAt);
	if (opens == null || closes == null || now < opens) return "upcoming";
	if (now < closes) return "open";
	if (now < closes + BOARDED_DAYS * DAY_MS) return "boarded";
	return "gone";
}

/** Whole days left, rounded up: 5 days and an hour is "6 days". */
export function daysLeft(closesAt: string | null, now: number): number {
	const closes = toMs(closesAt);
	if (closes == null) return 0;
	const ms = closes - now;
	return ms <= 0 ? 0 : Math.ceil(ms / DAY_MS);
}

/**
 * The countdown in the stall's voice: "leaving in 6 days", "leaving in 5h" on
 * the last day, "leaving in under an hour" at the very end. Null once closed.
 * `verb` lets the buy confirm say "leaves in 6 days" off the same clock.
 */
export function leavingLabel(
	closesAt: string | null,
	now: number,
	verb: "leaving" | "leaves" = "leaving",
): string | null {
	const closes = toMs(closesAt);
	if (closes == null) return null;
	const ms = closes - now;
	if (ms <= 0) return null;
	if (ms < HOUR_MS) return `${verb} in under an hour`;
	if (ms < DAY_MS) return `${verb} in ${Math.ceil(ms / HOUR_MS)}h`;
	const days = Math.ceil(ms / DAY_MS);
	return `${verb} in ${days} ${days === 1 ? "day" : "days"}`;
}

const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
] as const;

/**
 * The boarded sign's kicker: "closed Nov 9 · back next year". The date is the
 * last day the stall was open, in the player's own calendar (a window that
 * closes at midnight closed on the day before it). `backLine` is the shelf's
 * own promise (theme.back_line, e.g. "back next October").
 */
export function closedLabel(
	closesAt: string | null,
	backLine: string | null | undefined,
): string {
	const back = backLine?.trim() || "back next year";
	const closes = toMs(closesAt);
	if (closes == null) return `packed up · ${back}`;
	const lastOpen = new Date(closes - 1);
	return `closed ${MONTHS[lastOpen.getMonth()]} ${lastOpen.getDate()} · ${back}`;
}

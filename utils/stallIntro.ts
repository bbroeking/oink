// The Pop-up Stall's one-time intro (Halloween onboarding canvas, direction A
// plus B1's "new here?" tag, 2026-10-29). Pure: the storage keys, the trigger
// rule, and the three cards' words, all read from the live shelf so the winter
// set gets its own intro by being a new `seasonal_shelves` row.
//
// The sheet is once per set key per account: `stall_intro_seen:<key>:<uid>`
// is written the moment the sheet PRESENTS (Skip, Later, the hardware back and
// Step in all end it for good). The tag on the stall card stands until
// `stall_visited:<key>:<uid>` is written on the first stall page visit.

import { COSTUME_FRAMES } from "@/constants/costumeFrames.generated";
import { countWord } from "@/utils/shopShelves";
import type { SeasonalShelf, ShelfItem } from "@/utils/seasonalShelf";
import type { ShelfPhase } from "@/utils/shelfCountdown";

export const stallIntroSeenKey = (shelfKey: string, userId: string) =>
	`stall_intro_seen:${shelfKey}:${userId}`;

export const stallVisitedKey = (shelfKey: string, userId: string) =>
	`stall_visited:${shelfKey}:${userId}`;

/**
 * Does the intro want the queue: an open stall (a `preview: true` shelf reads
 * as open too), a signed-in player, and a seen-key read back as unset. `seen`
 * null means the read is still out: never show on a guess.
 */
export function shouldShowStallIntro({
	shelf,
	phase,
	userId,
	seen,
}: {
	shelf: SeasonalShelf | null;
	phase: ShelfPhase | null;
	userId: string | null;
	seen: boolean | null;
}): boolean {
	return !!shelf && phase === "open" && !!userId && seen === false;
}

/** The tag shows only once the visit key is read back as unset. */
export function showNewHereTag(phase: ShelfPhase | null, visited: boolean | null): boolean {
	return phase === "open" && visited === false;
}

// ── Per-set fallbacks ───────────────────────────────────────────────────────
// Server config first: a shelf row may carry `theme.intro_costume_id` and
// `theme.weekend_shelf` ({ starts_at, ends_at, line }). The compiled table is
// the fallback for the Halloween row, which shipped before the intro did; a
// set with neither simply has no costume pick and no daily-drop door.
interface WeekendShelf {
	starts_at: string;
	ends_at: string;
	line: string;
}

const SET_FALLBACKS: Record<string, { introCostumeId?: string; weekendShelf?: WeekendShelf }> = {
	halloween_2026: {
		introCostumeId: "halloween_2026_moonpuff_costume",
		// The daily drop's Halloween lead, UTC days Oct 30 to Nov 2 inclusive
		// (20261029170000_halloween_weekend_shelf).
		weekendShelf: {
			starts_at: "2026-10-30T00:00:00Z",
			ends_at: "2026-11-03T00:00:00Z",
			line: "A Halloween shelf, Oct 30 to Nov 2. Then it rides off.",
		},
	},
};

function themeWeekendShelf(shelf: SeasonalShelf): WeekendShelf | null {
	const raw = (shelf.theme as Record<string, unknown>).weekend_shelf;
	if (!raw || typeof raw !== "object") return null;
	const w = raw as Record<string, unknown>;
	return typeof w.starts_at === "string" &&
		typeof w.ends_at === "string" &&
		typeof w.line === "string" &&
		w.line.length > 0
		? { starts_at: w.starts_at, ends_at: w.ends_at, line: w.line }
		: null;
}

/** The daily-drop door's line, only while its window is current. */
export function weekendShelfLine(shelf: SeasonalShelf, now: number): string | null {
	const w = themeWeekendShelf(shelf) ?? SET_FALLBACKS[shelf.key]?.weekendShelf ?? null;
	if (!w) return null;
	const starts = Date.parse(w.starts_at);
	const ends = Date.parse(w.ends_at);
	if (!Number.isFinite(starts) || !Number.isFinite(ends)) return null;
	return now >= starts && now < ends ? w.line : null;
}

const isCostume = (i: Pick<ShelfItem, "category">) => i.category === "costume";

/**
 * The costume the second card dresses Rosie in: the theme's pick, else the
 * set's fallback, else the first costume with a complete skin. Null when the
 * stall sells none this binary can draw.
 */
export function introCostume(shelf: SeasonalShelf, items: readonly ShelfItem[]): ShelfItem | null {
	const drawn = items.filter((i) => isCostume(i) && !!COSTUME_FRAMES[i.id]?.idle_1);
	const themePick = (shelf.theme as Record<string, unknown>).intro_costume_id;
	const pick =
		(typeof themePick === "string" ? themePick : null) ?? SET_FALLBACKS[shelf.key]?.introCostumeId;
	return drawn.find((i) => i.id === pick) ?? drawn[0] ?? null;
}

export interface StallIntroDoor {
	id: "shop" | "closet" | "dailyDrop";
	title: string;
	line: string;
}

export type StallIntroCard =
	| { id: "stall"; kicker: string; title: string; body: string; hand: string }
	| {
			id: "costumes";
			kicker: string;
			title: string;
			caption: string;
			body: string;
			hand: string;
			costume: ShelfItem;
	  }
	| { id: "where"; kicker: string; title: string; doors: StallIntroDoor[]; hand: string };

const DOOR_WORDS = ["no doors", "one door", "two doors", "three doors"] as const;

/**
 * The sheet's cards, in order: the stall, full costumes (only when the stall
 * sells one this binary can draw), where to look. Every name and count comes
 * from the shelf payload; the kicker's "N of M" counts the cards drawn.
 */
export function stallIntroCards(
	shelf: SeasonalShelf,
	items: readonly ShelfItem[],
	now: number,
): StallIntroCard[] {
	const costumes = items.filter(isCostume).length;
	const pieces = items.length - costumes;
	const costume = costumes > 0 ? introCostume(shelf, items) : null;
	const total = costume ? 3 : 2;
	const pieceWords = `${countWord(pieces)} ${pieces === 1 ? "piece" : "pieces"}`;
	const costumeWords = `${countWord(costumes)} full ${costumes === 1 ? "costume" : "costumes"}`;
	const stock = costumes > 0 ? `${pieceWords} and ${costumeWords}` : pieceWords;

	const cards: StallIntroCard[] = [
		{
			id: "stall",
			kicker: `new in the shop · 1 of ${total}`,
			title: "A stall popped up",
			body: `${shelf.title} is pitched at the top of the Shop wall: ${stock}, here for a short while.`,
			hand: "Every piece says how long it stays. When the window shuts the stall boards up, and what you bought is your haul. Yours for keeps.",
		},
	];
	if (costume) {
		cards.push({
			id: "costumes",
			kicker: `new this year · 2 of ${total}`,
			title: "Full costumes",
			caption: `Rosie, then Rosie in ${costume.name}`,
			body: "A full costume turns Rosie into someone else, head to hoof, front and side.",
			hand: `Her hat, bow and the rest tuck away underneath and come back the moment it comes off. Rosie only: a companion pig swaps to her first. Try one on before you buy. Friends see "in ${costume.name}" when they visit.`,
			costume,
		});
	}
	const doors: StallIntroDoor[] = [
		{ id: "shop", title: "Shop", line: "The stall card at the top of the wall. New · Back · Yours." },
	];
	if (costume) {
		doors.push({
			id: "closet",
			title: "Closet",
			line: "The lilac Costume chip. Wear it, swap it, take it off.",
		});
	}
	const weekend = weekendShelfLine(shelf, now);
	if (weekend) doors.push({ id: "dailyDrop", title: "Daily drop", line: weekend });
	cards.push({
		id: "where",
		kicker: `${DOOR_WORDS[doors.length] ?? `${doors.length} doors`} · ${total} of ${total}`,
		title: "Where to look",
		doors,
		hand: "That is the whole map. Step in and the stall shows you the rest.",
	});
	return cards;
}

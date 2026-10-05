// Normalizer for the While-Away launch modal's system-announcement rows.
//
// The server sends a `trough_nudge` announcement with `{ drive_id }` in its
// `data`; the recipient chips into that drive from the Troughs on the Shop
// tab. This maps such a row to a deep-link route so the While-Away card can
// tap through to it. Extracted from app/_layout's inline normalizer so the
// threading (announcement row → event carrying its route) is unit-testable.
// The Barn-visit fold the modal draws lives here too, for the same reason.

import { routeForScreen } from "./notificationRouting";
import type { WhileAwayEvent } from "@/components/WhileAwayModal";

// A raw row as returned by the `my_unseen_announcements` RPC.
export type SystemAnnouncementRow = {
	id: number;
	kind: string;
	title: string;
	body: string;
	data?: unknown;
};

// An empty successful response is meaningfully different from a failed source:
// only the former proves there was nothing to show and may advance away_seen_v1.
// PostgREST query results expose `error`; the RPC wrapper exposes a failure as
// null, while a successful no-row announcement response is [].
export function launchEventSourcesSucceeded(
	queryResults: readonly { error?: unknown }[],
	systemRows: readonly unknown[] | null
): boolean {
	return systemRows !== null && queryResults.every((result) => result.error == null);
}

// Pull a non-empty string drive_id out of an announcement's `data`, or null.
function driveIdOf(data: unknown): string | null {
	const raw = (data as { drive_id?: unknown } | null | undefined)?.drive_id;
	return typeof raw === "string" && raw.length > 0 ? raw : null;
}

function emoteIdOf(data: unknown): string | null {
	const raw = (data as { emote_id?: unknown } | null | undefined)?.emote_id;
	return typeof raw === "string" && raw.length > 0 ? raw : null;
}

function screenOf(data: unknown): string | null {
	const raw = (data as { screen?: unknown } | null | undefined)?.screen;
	return typeof raw === "string" && raw.length > 0 ? raw : null;
}

// The in-app route an announcement taps through to, or null when it has no
// destination (unknown kind, or a trough_nudge missing its drive_id). Null
// rows render non-pressable — no dead affordance.
export function systemAnnouncementRoute(kind: string | undefined, data: unknown): string | null {
	if (kind === "trough_nudge" && driveIdOf(data)) {
		// Troughs live on the Shop tab — routeForScreen is the single
		// screen→route map (utils/notificationRouting).
		return routeForScreen("trough");
	}
	// Keep malformed trough nudges non-pressable, but let ordinary feature and
	// admin announcements opt into the same allow-listed destinations as push.
	if (kind === "trough_nudge") return null;
	return routeForScreen(screenOf(data));
}

// Map an unseen-announcement row to the While-Away modal's system event,
// carrying the tap-through route. The kind rides along so the modal can fold
// a run of plain Barn visits into one row (groupBarnVisits, below).
export function toWhileAwaySystemEvent(
	row: SystemAnnouncementRow
): Extract<WhileAwayEvent, { source: "system" }> {
	return {
		source: "system",
		announcementId: row.id,
		kind: row.kind,
		title: row.title,
		body: row.body,
		route: systemAnnouncementRoute(row.kind, row.data),
		emoteId: row.kind === "barn_visit" ? emoteIdOf(row.data) : null,
	};
}

// ── Folding Barn visits ──────────────────────────────────────────────────────
//
// Every first tap of a visit writes one `barn_visit` announcement ("Someone
// visited your Barn!" / "<name> came by and tickled your pig!"), so a popular
// pig came back to four identical rows, the same visitor twice among them. A
// recap is a summary: two or more plain visits become ONE row that names who
// came, each name once. A visit that left a parting note keeps its own row; it
// carries the visitor's sticker. (polish pass, 2026-10-04)

type SystemEvent = Extract<WhileAwayEvent, { source: "system" }>;

/** The folded row: who came (each name once, in arrival order) and how often. */
export type WhileAwayVisitGroup = {
	source: "visits";
	key: string;
	names: string[];
	count: number;
	route: string | null;
};

export type WhileAwayRow = WhileAwayEvent | WhileAwayVisitGroup;

// The server's body (20260691 tickle_at_barn): `<name> came by and tickled your
// pig!`, with 'A friend' standing in for a missing username.
const VISIT_BODY = /^(.+) came by and tickled your pig!$/;
const UNKNOWN_VISITOR = "A friend";
// How many names the folded line spells out before it counts the rest.
const VISIT_NAMES_SHOWN = 3;

function isPlainVisit(event: WhileAwayEvent): event is SystemEvent {
	return event.source === "system" && event.kind === "barn_visit" && !event.emoteId;
}

/** The visitor a plain visit names, or null when the body is not the server's shape. */
export function visitorNameOf(body: string): string | null {
	return body.match(VISIT_BODY)?.[1] ?? null;
}

/**
 * The recap's rows: the events in order, with every plain Barn visit folded
 * into one row at the position of the first. One visit stays a normal row.
 */
export function groupBarnVisits(events: readonly WhileAwayEvent[]): WhileAwayRow[] {
	const visits = events.filter(isPlainVisit);
	if (visits.length < 2) return [...events];
	const names: string[] = [];
	for (const visit of visits) {
		const name = visitorNameOf(visit.body) ?? UNKNOWN_VISITOR;
		if (!names.includes(name)) names.push(name);
	}
	const group: WhileAwayVisitGroup = {
		source: "visits",
		key: `visits-${visits[0].announcementId}`,
		names,
		count: visits.length,
		route: visits.find((visit) => visit.route)?.route ?? null,
	};
	const rows: WhileAwayRow[] = [];
	let placed = false;
	for (const event of events) {
		if (!isPlainVisit(event)) {
			rows.push(event);
		} else if (!placed) {
			rows.push(group);
			placed = true;
		}
	}
	return rows;
}

/** The folded row's two lines, in the server's own voice. */
export function visitGroupCopy(group: WhileAwayVisitGroup): { title: string; body: string } {
	const { names, count } = group;
	if (names.length === 1) {
		const times = count === 2 ? "twice" : `${count} times`;
		return {
			title: "Someone visited your Barn!",
			body: `${names[0]} came by ${times} and tickled your pig!`,
		};
	}
	const shown = names.slice(0, VISIT_NAMES_SHOWN);
	const rest = names.length - shown.length;
	const list =
		rest > 0
			? `${shown.join(", ")} and ${rest} more`
			: `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
	return {
		title: `${names.length} pigs visited your Barn!`,
		body: `${list} came by and tickled your pig!`,
	};
}

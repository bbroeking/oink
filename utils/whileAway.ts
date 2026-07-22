// Normalizer for the While-Away launch modal's system-announcement rows.
//
// The server sends a `trough_nudge` announcement with `{ drive_id }` in its
// `data`; the recipient chips into that drive from the Troughs on the Shop
// tab. This maps such a row to a deep-link route so the While-Away card can
// tap through to it. Extracted from app/_layout's inline normalizer so the
// threading (announcement row → event carrying its route) is unit-testable.

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

// Pull a non-empty string drive_id out of an announcement's `data`, or null.
function driveIdOf(data: unknown): string | null {
	const raw = (data as { drive_id?: unknown } | null | undefined)?.drive_id;
	return typeof raw === "string" && raw.length > 0 ? raw : null;
}

// The in-app route an announcement taps through to, or null when it has no
// destination (unknown kind, or a trough_nudge missing its drive_id). Null
// rows render non-pressable — no dead affordance.
export function systemAnnouncementRoute(
	kind: string | undefined,
	data: unknown
): string | null {
	if (kind === "trough_nudge" && driveIdOf(data)) {
		// Troughs live on the Shop tab — routeForScreen is the single
		// screen→route map (utils/notificationRouting).
		return routeForScreen("trough");
	}
	return null;
}

// Map an unseen-announcement row to the While-Away modal's system event,
// carrying the tap-through route.
export function toWhileAwaySystemEvent(
	row: SystemAnnouncementRow
): Extract<WhileAwayEvent, { source: "system" }> {
	return {
		source: "system",
		announcementId: row.id,
		title: row.title,
		body: row.body,
		route: systemAnnouncementRoute(row.kind, row.data),
	};
}

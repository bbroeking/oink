// Pass events — surfaces "X just trotted past you" notifications
// when another player overtakes the caller on the leaderboard.
// Polls unseen_pass_events on focus + on every tickle; dedupes
// against an in-memory set so a focus-bounce doesn't replay the
// same toast.
//
// The toast is fired via the showToast callback Barn passes; the
// onPress routes to the Friends hub (where the leaderboard lives).

import { useCallback, useRef } from "react";
import { router } from "expo-router";
import { rpc } from "@/utils/rpc";

// Pass notices are ambient, not part of the tickle transaction. A fast tap
// burst used to start one unseen_pass_events RPC per successful tap. Keep the
// first read, share it while in flight, then suppress repeat reads for a short
// window; focus still provides another natural refresh point.
const PASS_EVENT_POLL_MIN_INTERVAL_MS = 10_000;

// Friendly, slightly competitive pig-voice lines for pass events.
// Picked at random so it doesn't feel like the same notification.
const PASS_LINES: ((name: string) => string)[] = [
	(name) => `Oink! ${name} just trotted past you.`,
	(name) => `${name} snouted ahead. Don't look back.`,
	(name) => `${name} just hoofed past you on the board.`,
	(name) => `Squeal — ${name} edged ahead of you.`,
	(name) => `${name} muddied your lead.`,
];

interface PassEvent {
	id: number;
	passer_id: string;
	passer_username: string | null;
	passer_tickles: number;
	passed_tickles: number;
}

export interface UsePassEventsOptions {
	// Called when a fresh pass event is found — emits the toast UX.
	// Barn passes its showToast helper here.
	showToast: (title: string, body: string, onPress?: () => void) => void;
}

export interface UsePassEvents {
	check: () => Promise<void>;
}

export function usePassEvents(opts: UsePassEventsOptions): UsePassEvents {
	// Track which pass-event IDs we've already surfaced this session so
	// a focus-bounce (or a delayed seen-write) doesn't replay the same
	// toast.
	const shownIds = useRef<Set<number>>(new Set());
	const inFlightRef = useRef<Promise<void> | null>(null);
	const lastStartedAtRef = useRef(0);

	const showToastRef = useRef(opts.showToast);
	showToastRef.current = opts.showToast;

	const check = useCallback((): Promise<void> => {
		if (inFlightRef.current) return inFlightRef.current;
		const now = Date.now();
		if (now - lastStartedAtRef.current < PASS_EVENT_POLL_MIN_INTERVAL_MS) {
			return Promise.resolve();
		}
		lastStartedAtRef.current = now;

		const request = (async () => {
			const data = await rpc<PassEvent[]>("unseen_pass_events");
			if (!data) return; // RPC may not exist yet pre-migration — fail quiet.
			// Most recent first from the RPC — show the freshest pass we
			// haven't already surfaced this session.
			const fresh = data.find((r) => !shownIds.current.has(r.id));
			if (!fresh) return;
			shownIds.current.add(fresh.id);
			const name = fresh.passer_username?.trim() || "Someone";
			const line =
				PASS_LINES[Math.floor(Math.random() * PASS_LINES.length)](name);
			showToastRef.current(line, "Tap to see the leaderboard.", () => {
				rpc("mark_pass_event_seen", { event_id: fresh.id });
				router.push("/friends" as never);
			});
			// Fire-and-forget: mark seen so the next poll doesn't return it.
			rpc("mark_pass_event_seen", { event_id: fresh.id });
		})().finally(() => {
			if (inFlightRef.current === request) inFlightRef.current = null;
		});
		inFlightRef.current = request;
		return request;
	}, []);

	return { check };
}

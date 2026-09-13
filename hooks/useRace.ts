// The global dig-off RACE state for the season tab. Replaces useDigoff.
//
// Mirrors useHungerMeter's graceful fallback: until the migration is pushed,
// race_standings() resolves null and the hook reports `featureDark` so the
// section renders nothing (never an error, never a blank sticker). Refreshes on
// focus, and — cheaply — polls ONLY in the last hour before the cycle ends, so
// the ceremony beat lands on time without an idle herd paying for a poll all day.

import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router/react-navigation";
import {
	RaceCrewDetail,
	RaceStandings,
	fetchRaceCrewDetail,
	fetchRaceStandings,
} from "@/utils/race";
import { ensurePushPermission } from "@/utils/pushNotifications";

// How often to refetch during the closing hour of a cycle (the standings +
// countdown move, and the resolve ceremony needs to land promptly).
const POLL_MS = 60000;
// The window before cycle-end during which we poll.
const CLOSING_MS = 60 * 60 * 1000;

export interface UseRace {
	/** Undefined while the first fetch is in flight; null when the feature is dark. */
	state: RaceStandings | null | undefined;
	loading: boolean;
	/** True once we know the RPC isn't there (migration unpushed) — render nothing. */
	featureDark: boolean;
	refresh: () => Promise<void>;
}

export function useRace(enabled = true): UseRace {
	const [state, setState] = useState<RaceStandings | null | undefined>(undefined);
	const [loading, setLoading] = useState(false);

	const refresh = useCallback(async () => {
		if (!enabled) return;
		setLoading(true);
		const s = await fetchRaceStandings();
		setState(s);
		setLoading(false);
	}, [enabled]);

	useFocusEffect(
		useCallback(() => {
			if (enabled) refresh();
		}, [enabled, refresh])
	);

	// Entering the race is automatic, so the feature-moment is the first time the
	// section renders with a live `mine` — that's when the ceremony/standings
	// pushes become worth asking about. Tie the permission prompt to that beat
	// (repo convention: never at app launch), fired once. No-ops if already set.
	const askedPush = useRef(false);
	useEffect(() => {
		if (askedPush.current) return;
		if (state && state.mine) {
			askedPush.current = true;
			ensurePushPermission().catch(() => {});
		}
	}, [state]);

	// Poll only in the closing hour before the cycle ends. Outside that window an
	// idle herd pays for one fetch per focus and nothing more.
	const endsAtMs = state ? new Date(state.cycle.ends_at).getTime() : NaN;
	useEffect(() => {
		if (!enabled || !Number.isFinite(endsAtMs)) return;
		const now = Date.now();
		const untilEnd = endsAtMs - now;
		// Past the bell (awaiting the next cycle's standings) OR inside the closing
		// hour → poll. Otherwise sleep until the closing window opens.
		if (untilEnd <= CLOSING_MS) {
			const t = setInterval(() => refresh(), POLL_MS);
			return () => clearInterval(t);
		}
		const wake = setTimeout(() => refresh(), untilEnd - CLOSING_MS);
		return () => clearTimeout(wake);
	}, [enabled, endsAtMs, refresh]);

	return {
		state,
		loading,
		featureDark: state === null,
		refresh,
	};
}

// The expandable per-Sounder member ledger, shared by the season tab's Dig-Off
// card and the full-field standings page (both render the same CrewLedger under
// a tapped row). One crew open at a time; each crew's detail is fetched once and
// cached — "dark" when the RPC resolves null pre-push, which also collapses the
// row so a tap never opens an empty drawer.
export function useCrewLedger() {
	const [expandedCrew, setExpandedCrew] = useState<string | null>(null);
	const [detailCache, setDetailCache] = useState<
		Record<string, RaceCrewDetail | "dark">
	>({});
	const toggleCrew = useCallback(
		(crewId: string) => {
			const willExpand = expandedCrew !== crewId;
			setExpandedCrew(willExpand ? crewId : null);
			if (willExpand && detailCache[crewId] === undefined) {
				fetchRaceCrewDetail(crewId).then((d) => {
					if (d) {
						setDetailCache((c) => ({ ...c, [crewId]: d }));
					} else {
						setDetailCache((c) => ({ ...c, [crewId]: "dark" }));
						setExpandedCrew((cur) => (cur === crewId ? null : cur));
					}
				});
			}
		},
		[expandedCrew, detailCache],
	);
	return { expandedCrew, setExpandedCrew, detailCache, toggleCrew };
}

// The race, plus the Monday beat — `useRace` with the once-per-cycle "race is
// run" gate the old RaceSection kept: a just-closed cycle's placement shows as
// last week's finals until the player has looked at it (persisted under the
// same `race_seen` key, so the two never disagree), then folds into the live
// board. Owned by the screen, not the panel, so the strip's Race cell can print
// `Run` / `3rd` whether or not the Race panel is the one open.

import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRace, type UseRace } from "@/hooks/useRace";
import {
	fetchRaceHistory,
	type LastRace,
	type RaceHistoryWeek,
} from "@/utils/race";
import { devCeremonyFixture, type DevCeremony } from "@/utils/devSeasonOverrides";

const SEEN_KEY = "race_seen";

export interface RaceRun {
	race: UseRace;
	/** The fresh, unseen finals (or the dev fixture) — the Monday beat — else null. */
	run: LastRace | null;
	/** Last week's settled table, once the history read lands (null = not yet / dark). */
	finals: RaceHistoryWeek | null;
	/** My herd's rank on the live board, or null before its first find. */
	rank: number | null;
	dismissRun: () => void;
}

export function useRaceRun(
	enabled: boolean,
	refreshKey?: number,
	devCeremony?: DevCeremony,
	onDismissDevCeremony?: () => void
): RaceRun {
	const race = useRace(enabled);
	const { state, refresh } = race;
	useEffect(() => {
		if (refreshKey) refresh();
	}, [refreshKey, refresh]);

	const [seen, setSeen] = useState<Set<string>>(new Set());
	useEffect(() => {
		AsyncStorage.getItem(SEEN_KEY).then((v) => {
			if (!v) return;
			try {
				setSeen(new Set(JSON.parse(v) as string[]));
			} catch {}
		});
	}, []);

	const last = state?.last ?? null;
	const cycleClosed = !!state && !!last && last.cycle_key !== state.cycle.key;
	const liveRun = cycleClosed && last && !seen.has(last.cycle_key) ? last : null;
	const run = __DEV__ && devCeremony ? devCeremonyFixture(devCeremony) : liveRun;

	// Last week's table — read only while the Monday beat is up.
	const [finals, setFinals] = useState<RaceHistoryWeek | null>(null);
	const runKey = run?.cycle_key ?? null;
	useEffect(() => {
		if (!runKey) return;
		let alive = true;
		fetchRaceHistory().then((weeks) => {
			if (!alive || !weeks) return;
			setFinals(weeks.find((w) => w.cycle.key === runKey) ?? weeks[0] ?? null);
		});
		return () => {
			alive = false;
		};
	}, [runKey]);

	const dismissRun = useCallback(() => {
		if (__DEV__ && devCeremony) {
			onDismissDevCeremony?.();
			return;
		}
		if (!last) return;
		setSeen((prev) => {
			const next = new Set(prev);
			next.add(last.cycle_key);
			AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...next])).catch(() => {});
			return next;
		});
		refresh();
	}, [devCeremony, onDismissDevCeremony, last, refresh]);

	const rank = state?.mine?.rank ?? null;

	return { race, run, finals, rank, dismissRun };
}

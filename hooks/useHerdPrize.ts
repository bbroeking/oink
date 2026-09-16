// The Barn Draw for a screen: the crew's state (this week's sealed seed hash,
// the last draw that produced a winner) and the one ceremony — a win of mine
// the player hasn't looked at yet, persisted under `herd_prize_seen` so the
// reveal sheet opens exactly once per drawn week, the way the race's finals do.
//
// FAIL-SOFT: a pre-push server (herd_prize_state missing) or a crewless
// caller leaves `state` null — the Race panel's draw row renders nothing.
// One fetch per focus; nothing polls — the draw lands on Monday and holds.
import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router/react-navigation";
import { fetchHerdPrizeState, type HerdPrizeDraw, type HerdPrizeState } from "@/utils/barnDraw";

const SEEN_KEY = "herd_prize_seen";

export interface UseHerdPrize {
	/** Null until the first successful read (or when the feature is dark). */
	state: HerdPrizeState | null;
	/** The last draw when it came up me and I haven't looked at it — else null. */
	unseenWin: HerdPrizeDraw | null;
	loading: boolean;
	refresh: () => Promise<void>;
	/** Mark the unseen win looked-at; the sheet never reopens for that week. */
	dismissWin: () => void;
}

export function useHerdPrize(uid: string | null | undefined, enabled = true): UseHerdPrize {
	const [state, setState] = useState<HerdPrizeState | null>(null);
	const [loading, setLoading] = useState(false);
	const [seen, setSeen] = useState<Set<string> | null>(null);

	useEffect(() => {
		let live = true;
		AsyncStorage.getItem(SEEN_KEY)
			.then((v) => {
				if (!live) return;
				try {
					const arr = v ? (JSON.parse(v) as unknown) : [];
					setSeen(new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []));
				} catch {
					setSeen(new Set());
				}
			})
			.catch(() => {
				if (live) setSeen(new Set());
			});
		return () => {
			live = false;
		};
	}, []);

	const refresh = useCallback(async () => {
		if (!enabled) return;
		setLoading(true);
		const r = await fetchHerdPrizeState();
		setLoading(false);
		if (!r.ok) return;
		setState(r.state);
	}, [enabled]);

	useFocusEffect(
		useCallback(() => {
			void refresh();
		}, [refresh]),
	);

	const last = state?.last ?? null;
	// The seen set must have LOADED before a win counts as unseen, or the sheet
	// would flash on every cold start and dismiss into an empty set.
	const unseenWin =
		seen && last && uid && last.winnerUserId === uid && !seen.has(last.cycleKey) ? last : null;

	const dismissWin = useCallback(() => {
		if (!last) return;
		setSeen((prev) => {
			const next = new Set(prev ?? []);
			next.add(last.cycleKey);
			AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...next])).catch(() => {});
			return next;
		});
	}, [last]);

	return { state, unseenWin, loading, refresh, dismissWin };
}

// The Satchel's read path for a screen — the bag, my pig's wish, the shelf,
// the count — plus the two owner mutations (toss, "not this one"). One fetch
// per focus; the tuning cell is freshened alongside so the cap the screen
// draws is the server's, not the compiled one.
//
// FAIL-SOFT: an un-pushed server (my_satchel missing) leaves the state at
// EMPTY_SATCHEL and `available` false, and every surface that draws the bag
// draws nothing. The Barn never shows a broken bag.
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router/react-navigation";
import {
	EMPTY_SATCHEL,
	ensureSatchelTuningFresh,
	fetchMySatchel,
	rerollMyWish,
	tossFind,
	type PigWish,
	type SatchelState,
} from "@/utils/satchel";

export interface UseSatchel {
	state: SatchelState;
	/** False until the first successful read — the server has the feature. */
	available: boolean;
	loading: boolean;
	refresh: () => Promise<void>;
	toss: (itemId: number) => Promise<boolean>;
	/** The owner's one free reroll per wish. Resolves the new wish, or null. */
	notThisOne: () => Promise<PigWish | null>;
	/** Apply a server answer that already carries the new bag count. */
	applyBagCount: (count: number) => void;
}

export function useSatchel(enabled = true): UseSatchel {
	const [state, setState] = useState<SatchelState>(EMPTY_SATCHEL);
	const [available, setAvailable] = useState(false);
	const [loading, setLoading] = useState(false);

	const refresh = useCallback(async () => {
		if (!enabled) return;
		setLoading(true);
		ensureSatchelTuningFresh();
		const r = await fetchMySatchel();
		setLoading(false);
		if (!r.ok) return;
		setAvailable(true);
		setState(r.state);
	}, [enabled]);

	useFocusEffect(
		useCallback(() => {
			let live = true;
			void refresh().then(() => {
				if (!live) return;
			});
			return () => {
				live = false;
			};
		}, [refresh]),
	);

	const toss = useCallback(async (itemId: number) => {
		// Optimistic: the find leaves the strip now; a refusal puts it back.
		let removed: SatchelState["items"][number] | undefined;
		setState((s) => {
			removed = s.items.find((it) => it.id === itemId);
			return { ...s, items: s.items.filter((it) => it.id !== itemId) };
		});
		const r = await tossFind(itemId);
		if (!r.ok) {
			if (removed) {
				const back = removed;
				setState((s) => ({ ...s, items: [...s.items, back] }));
			}
			return false;
		}
		return true;
	}, []);

	const notThisOne = useCallback(async () => {
		const r = await rerollMyWish();
		const wish = r.wish ?? null;
		if (wish) setState((s) => ({ ...s, wish }));
		return r.ok ? wish : null;
	}, []);

	const applyBagCount = useCallback((count: number) => {
		setState((s) => (s.items.length === count ? s : { ...s, items: s.items.slice(0, count) }));
	}, []);

	return { state, available, loading, refresh, toss, notThisOne, applyBagCount };
}

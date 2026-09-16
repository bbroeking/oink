// The Satchel's read path for a screen — the bag, my pig's wish, the swap
// counts — plus the two owner mutations (toss, "not this one") and the two
// writers a swap answer uses (applyBag, removeItem). One fetch per focus; the
// tuning cell is freshened alongside so the cap the screen draws is the
// server's, not the compiled one.
//
// FAIL-SOFT: an un-pushed server (my_satchel missing) leaves the state at
// EMPTY_SATCHEL and `available` false, and every surface that draws the bag
// draws nothing. The Barn never shows a broken bag.
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router/react-navigation";
import {
	EMPTY_SATCHEL,
	ensureSatchelTuningFresh,
	fetchMySatchel,
	rerollMyWish,
	tossFind,
	type PigWish,
	type SatchelItem,
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
	/** Install the server's WHOLE bag (a swap answers with it), so the strip
	 *  never has to guess which row left by trimming to a count. */
	applyBag: (items: SatchelItem[]) => void;
	/** Drop one find by id — the optimistic half of a give. */
	removeItem: (itemId: number) => void;
}

export function useSatchel(enabled = true): UseSatchel {
	const [state, setState] = useState<SatchelState>(EMPTY_SATCHEL);
	// The bag as it stands right now, readable from inside a callback that ran
	// before a state update settled (the toss rollback needs the row's index).
	// Synced after commit, never during render — every reader is an event
	// handler, which by definition runs after one.
	const stateRef = useRef(state);
	useEffect(() => {
		stateRef.current = state;
	}, [state]);
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
		// Optimistic: the find leaves the strip now; a refusal puts it back
		// WHERE IT WAS — re-appending would silently reorder the bag. The row
		// and its index are read off the ref, synchronously: a state updater
		// runs when React decides to, which is not necessarily before the
		// round trip answers.
		const at = stateRef.current.items.findIndex((it) => it.id === itemId);
		const removed: SatchelItem | undefined = at < 0 ? undefined : stateRef.current.items[at];
		if (removed) setState((s) => ({ ...s, items: s.items.filter((it) => it.id !== itemId) }));
		const r = await tossFind(itemId);
		if (!r.ok) {
			if (removed) {
				setState((s) => {
					const items = [...s.items];
					items.splice(Math.max(0, Math.min(at, items.length)), 0, removed);
					return { ...s, items };
				});
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

	const applyBag = useCallback((items: SatchelItem[]) => {
		setState((s) => ({ ...s, items }));
	}, []);

	const removeItem = useCallback((itemId: number) => {
		setState((s) => ({ ...s, items: s.items.filter((it) => it.id !== itemId) }));
	}, []);

	return { state, available, loading, refresh, toss, notThisOne, applyBag, removeItem };
}

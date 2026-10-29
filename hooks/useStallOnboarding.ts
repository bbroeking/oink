// The Pop-up Stall's onboarding state (Halloween onboarding canvas, 2026-10-29):
// the one-time intro sheet's popup slot and the stall card's "new here?" tag.
// The pure rules and keys live in utils/stallIntro.ts; this owns the storage
// reads, the PopupQueue slot and the Step in hand-off.

import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useFocusEffect } from "expo-router/react-navigation";
import {
	POPUP_TEARDOWN_MS,
	releasePopupThenNavigate,
	usePopupSlot,
} from "@/components/ui/PopupQueue";
import { POPUP_PRIORITIES } from "@/constants/popupPriorities";
import type { SeasonalShelf } from "@/utils/seasonalShelf";
import type { ShelfPhase } from "@/utils/shelfCountdown";
import {
	shouldShowStallIntro,
	stallIntroSeenKey,
	stallVisitedKey,
} from "@/utils/stallIntro";

export type StallIntroAction = "step_in" | "skip";

/** Read a flag key: true set, false unset, null while the read is out. A
 *  failed read counts as set, so a broken store never re-shows anything. */
function useFlag(key: string | null, refreshOnFocus: boolean) {
	const [read, setRead] = useState<{ key: string; set: boolean } | null>(null);
	const load = useCallback(() => {
		if (!key) return;
		let cancelled = false;
		AsyncStorage.getItem(key)
			.then((v) => {
				if (!cancelled) setRead({ key, set: v != null });
			})
			.catch(() => {
				if (!cancelled) setRead({ key, set: true });
			});
		return () => {
			cancelled = true;
		};
	}, [key]);
	useEffect(() => (refreshOnFocus ? undefined : load()), [load, refreshOnFocus]);
	useFocusEffect(useCallback(() => (refreshOnFocus ? load() : undefined), [load, refreshOnFocus]));
	return read && read.key === key ? read.set : null;
}

/**
 * The intro sheet's slot. Wants the queue while the Shop tab is focused, a
 * stall is open and this set's seen-key is unset; writes the seen-key the
 * moment the sheet presents. `finish` ends it for good either way; "step_in"
 * then lands on the stall's New tab once the sheet has fully dismissed.
 */
export function useStallIntro({
	shelf,
	phase,
	userId,
	focused,
}: {
	shelf: SeasonalShelf | null;
	phase: ShelfPhase | null;
	userId: string | null;
	focused: boolean;
}) {
	const shelfKey = shelf?.key ?? null;
	const key = shelfKey && userId ? stallIntroSeenKey(shelfKey, userId) : null;
	const seen = useFlag(key, false);
	// Closed this session: the want drops a teardown beat after release.
	const [closed, setClosed] = useState<string | null>(null);
	const want =
		focused && closed !== key && shouldShowStallIntro({ shelf, phase, userId, seen });
	const slot = usePopupSlot("stallIntro", want, POPUP_PRIORITIES.stallIntro);

	// Seen on present, not on finish: Skip, Later, the hardware back and a
	// force-quit mid-sheet all end it for good. Only storage is written here;
	// flipping `seen` now would drop the want and hide the sheet at once.
	useEffect(() => {
		if (slot.visible && key) AsyncStorage.setItem(key, "1").catch(() => {});
	}, [slot.visible, key]);

	const { release } = slot;
	const finish = useCallback(
		(action: StallIntroAction) => {
			if (!key) return;
			const clear = () => setClosed(key);
			if (action === "step_in" && shelfKey) {
				releasePopupThenNavigate({
					release,
					clear,
					navigate: () =>
						router.push({ pathname: "/stall/[key]", params: { key: shelfKey } }),
				});
				return;
			}
			release();
			setTimeout(clear, POPUP_TEARDOWN_MS);
		},
		[key, release, shelfKey],
	);

	return { visible: slot.visible, finish };
}

/**
 * Has this account stepped into this set's stall. Re-read on every focus, so
 * the Shop's tag comes down the moment the player is back from the stall.
 * Null while the read is out (the tag waits rather than flashing).
 */
export function useStallVisited(shelfKey: string | null, userId: string | null): boolean | null {
	return useFlag(shelfKey && userId ? stallVisitedKey(shelfKey, userId) : null, true);
}

/** The stall page writes this on its first mount for a set. */
export function markStallVisited(shelfKey: string, userId: string): Promise<void> {
	return AsyncStorage.setItem(stallVisitedKey(shelfKey, userId), "1").catch(() => {});
}

// The rituals on SOMEBODY ELSE — the host of a Barn visit, the pig in a
// profile sheet. The visitor-side twin of `useActiveEffects`, and deliberately
// a fraction of its size (weekday rituals, 2026-09-14, plan phase 4).
//
// What it does NOT do, and why:
//   • no realtime — a visit is a minute long and a ritual lasts six hours, so
//     a channel per visited pig would be a subscription that never fires.
//   • no cleanse, no partition, no sender — `active_effects_of` returns kinds
//     only. Who cursed your friend is between them and their Inbox.
//   • no provider — every surface that visits somebody owns its own short-lived
//     copy, keyed by whose Barn it is.
//
// The return is just the kinds, which is exactly what `useRitualPresentationFor`
// wants: `const { kinds } = useVisitorEffects(id)` → `useRitualPresentationFor(kinds)`.

import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router/react-navigation";
import { remainingMs } from "@/utils/duration";
import { fetchActiveEffectsOf, type VisitorEffect } from "@/utils/activeEffects";

export interface UseVisitorEffects {
	/** The active ritual kinds on the target, blessings first. */
	kinds: string[];
	/** True only while the first (or a re-focused) read is in flight. */
	loading: boolean;
}

const REST: VisitorEffect[] = [];

export function useVisitorEffects(
	targetUserId: string | null,
): UseVisitorEffects {
	const [rows, setRows] = useState<VisitorEffect[]>(REST);
	const [loading, setLoading] = useState(false);

	// One fetch per focus, per target. `useFocusEffect` fires on mount too, so
	// this is the mount read, the id-change read and the re-focus read at once —
	// never two at once, which is what keeps a sheet open to a single round trip.
	useFocusEffect(
		useCallback(() => {
			if (!targetUserId) {
				setRows(REST);
				return;
			}
			let live = true;
			setLoading(true);
			void fetchActiveEffectsOf(targetUserId).then((fetched) => {
				if (!live) return;
				setRows(fetched.length > 0 ? fetched : REST);
				setLoading(false);
			});
			return () => {
				// A visitor who backs out mid-flight must not repaint the next
				// Barn with the last one's weather.
				live = false;
			};
		}, [targetUserId]),
	);

	// The server already excludes expired rows; this is the client's own clock
	// having its say, so a sheet left open past an expiry stops drawing it.
	const kinds = useMemo(
		() => rows.filter((r) => remainingMs(r.expires_at) > 0).map((r) => r.kind),
		[rows],
	);

	return { kinds, loading };
}

// The Monday tickle draw for a screen: the state (eligible / drawn / amount /
// the warming odds) and the one write, `draw()`.
//
// FAIL-SOFT: a pre-push server (monday_draw_state missing) leaves `state`
// null and `available` false — the Race panel's draw door renders nothing.
// `draw()` is optimistic about `drawn` (the disc can start its reveal the
// frame the snout taps) and settles on the server's purse; a refusal snaps
// back and a refetch reconciles. One fetch per focus; nothing polls — the
// purse doesn't move until the snout draws it.
import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router/react-navigation";
import {
	drawMondayPurse,
	fetchMondayDrawState,
	type MondayDrawState,
} from "@/utils/mondayDraw";

export interface UseMondayDraw {
	/** Null until the first successful read (or when the feature is dark). */
	state: MondayDrawState | null;
	/** True once the server has answered — the feature is live. */
	available: boolean;
	loading: boolean;
	/** In flight between the tap and the server's purse. */
	drawing: boolean;
	refresh: () => Promise<void>;
	/**
	 * Draw this week's purse. Resolves the settled state (drawn, with the
	 * amount) or null when the server refused / is dark. Calling it on a
	 * drawn week just re-reads the stored purse.
	 */
	draw: () => Promise<MondayDrawState | null>;
}

export function useMondayDraw(enabled = true): UseMondayDraw {
	const [state, setState] = useState<MondayDrawState | null>(null);
	const [available, setAvailable] = useState(false);
	const [loading, setLoading] = useState(false);
	const [drawing, setDrawing] = useState(false);
	const inFlight = useRef<Promise<MondayDrawState | null> | null>(null);

	const refresh = useCallback(async () => {
		if (!enabled) return;
		setLoading(true);
		const r = await fetchMondayDrawState();
		setLoading(false);
		if (!r.ok) return;
		setAvailable(true);
		setState(r.state);
	}, [enabled]);

	useFocusEffect(
		useCallback(() => {
			void refresh();
		}, [refresh]),
	);

	const draw = useCallback(async () => {
		// One roll per tap-burst: a second tap while the first is in flight
		// joins it rather than asking the server twice.
		if (inFlight.current) return inFlight.current;
		const run = (async () => {
			let previous: MondayDrawState | null = null;
			setDrawing(true);
			// Optimistic: the disc may begin its reveal now.
			setState((s) => {
				previous = s;
				return s && !s.drawn ? { ...s, drawn: true } : s;
			});
			const r = await drawMondayPurse();
			setDrawing(false);
			if (!r.ok) {
				// A refusal carries the honest snapshot (e.g. not_eligible);
				// otherwise snap back to what we had.
				setState(r.state ?? previous);
				return null;
			}
			setAvailable(true);
			setState(r.state);
			return r.state;
		})();
		inFlight.current = run;
		try {
			return await run;
		} finally {
			inFlight.current = null;
		}
	}, []);

	return { state, available, loading, drawing, refresh, draw };
}

// Shared ActiveEffects state for the signed-in player.
//
// Before this, every surface (the Barn miasma overlay, the chip strip, the
// Hoofprints sheet, and the Inbox panel) called useActiveEffects() directly,
// creating FOUR isolated copies of the state — each with its own fetch and
// realtime channel. cleanse() optimistically clears curses on only the copy
// that owns it (the sheet's / the inbox's), so the Barn overlay + chips stayed
// stale until a best-effort realtime UPDATE landed or the app cold-launched —
// that's the "clearing a curse doesn't refresh the Barn" bug.
//
// This Provider runs ONE always-enabled instance and shares it via context, so
// a cleanse from any surface updates every surface synchronously (and there's
// a single realtime subscription instead of four). It is mounted at the (tabs)
// layout so the Barn (index tab) and the Inbox (friends tab) share one state.
//
// useActiveEffects() stays exported but should now be called ONLY here — every
// other consumer reads useActiveEffectsContext() to avoid re-introducing an
// isolated copy.

import React, { createContext, useContext } from "react";
import { useActiveEffects, type UseActiveEffects } from "./useActiveEffects";

const ActiveEffectsContext = createContext<UseActiveEffects | null>(null);

export function ActiveEffectsProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	// Single, always-enabled instance. The previous per-surface `enabled`
	// suspension is no longer needed — there's one subscription for the whole
	// signed-in session instead of one per surface.
	const value = useActiveEffects();
	return (
		<ActiveEffectsContext.Provider value={value}>
			{children}
		</ActiveEffectsContext.Provider>
	);
}

export function useActiveEffectsContext(): UseActiveEffects {
	const ctx = useContext(ActiveEffectsContext);
	if (!ctx) {
		throw new Error(
			"useActiveEffectsContext must be used within an ActiveEffectsProvider"
		);
	}
	return ctx;
}

// The signed-in player's own card (name + look), for drawing YOUR pig where
// the server has not drawn it yet: the searching card on the hub. Read once
// per app session from the profile (utils/multiplayer/looks), shared by every
// caller, and never blocking: until it lands the caller draws a plain Rosie.

import { useEffect, useState } from "react";
import type { PlayerCard } from "@/multiplayer/protocol";
import { fetchMyPlayerCard } from "@/utils/multiplayer/looks";

let cached: PlayerCard | null = null;
let inflight: Promise<PlayerCard | null> | null = null;

function loadMyCard(): Promise<PlayerCard | null> {
	if (!inflight) {
		inflight = fetchMyPlayerCard()
			.then((card) => {
				if (card) cached = card;
				return card;
			})
			.catch(() => null)
			.finally(() => {
				inflight = null;
			});
	}
	return inflight;
}

export function useMyCard(): PlayerCard | null {
	const [card, setCard] = useState<PlayerCard | null>(cached);
	useEffect(() => {
		if (cached) return;
		let live = true;
		void loadMyCard().then((next) => {
			if (live && next) setCard(next);
		});
		return () => {
			live = false;
		};
	}, []);
	return card;
}

/** Test seam: forget the cached card. */
export function resetMyCardForTests(): void {
	cached = null;
	inflight = null;
}

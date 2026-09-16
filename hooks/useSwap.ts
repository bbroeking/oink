// The swap, as a state machine — the visit's ONE write, with no UI in it.
//
// Wire contract: docs/design/2026-09-16-satchel-audit-and-barn-trading-plan.md
// §12. The visit hands this hook the host's live wish and gets back an offer
// tray that opens, a nonce that survives a retry, and one named answer per
// refusal. `BarnVisitModal` keeps the mount point and the callbacks; every
// rule about what a reason MEANS lives here, where it can be tested without a
// renderer.
//
// The nonce: one per tray-tap (opening the tray for a find). A retry after a
// transport failure — `network`, `no_data`, or no reason at all — reuses it,
// so a swap that landed on the server but never answered replays instead of
// running twice. A NAMED refusal moved nothing, so the next attempt takes a
// fresh nonce.
//
// What each reason does (§5's table, from the client's side):
//   wish_changed / wrong_find → the wish AND the options are stale: install
//                               both, keep the tray open on the new options
//   option_gone               → only that option went: install the fresh
//                               options, the tray stays where it is
//   already_today             → the pair's daily gate is spent: mark the wish
//                               and close — the strip goes quiet
//   host_bag_full             → a gift has nowhere to land: keep the tray so
//                               the player can take something instead
//   a transport failure       → the tray stays up and the nonce holds, so a
//                               retry replays rather than swapping twice
//   anything else             → the tray closes and the reason is said once
import { useCallback, useRef, useState } from "react";
import type { SatchelFindId } from "@/constants/satchel";
import {
	newSwapNonce,
	swapRefusalCopy,
	swapWithHost,
	type FriendWish,
	type SatchelItem,
	type SwapResult,
} from "@/utils/satchel";

/** Transport failures — the server never saw a decision, so the nonce holds. */
function isTransportFailure(reason: string | undefined): boolean {
	return reason === undefined || reason === "" || reason === "network" || reason === "no_data";
}

export interface UseSwap {
	/** The bag find the tray is open for, or null when it is closed. */
	offerFor: SatchelItem | null;
	/** A call is in flight — the tray's tiles and link disable. */
	busy: boolean;
	/** Open the tray for a lifted find. Mints this tray-tap's nonce. */
	openTray: (item: SatchelItem) => void;
	closeTray: () => void;
	/** Send it: a find id takes that option back, null is "just give it". */
	swap: (take: SatchelFindId | null) => Promise<void>;
}

export function useSwap({
	hostId,
	hostName,
	wish,
	onWishChange,
	onSwapped,
	onRefused,
	enabled = true,
}: {
	hostId: string;
	/** Named in the refusals that point at the host's own pig. */
	hostName?: string;
	/** The host's live wish — `wish_no` is what the server is pinned to. */
	wish: FriendWish | null;
	/** Install a server-fresher wish / options / swapped_today on the bubble. */
	onWishChange: (patch: Partial<FriendWish>) => void;
	onSwapped: (result: SwapResult, item: SatchelItem) => void;
	/** Say a refusal once — the visit turns this into a toast. */
	onRefused: (copy: { title: string; text?: string }, reason: string) => void;
	/** False while the visit has no business swapping (a preview fixture). */
	enabled?: boolean;
}): UseSwap {
	const [offerFor, setOfferFor] = useState<SatchelItem | null>(null);
	const [busy, setBusy] = useState(false);
	const nonce = useRef<string | null>(null);
	// One swap per visit: once the server says yes, the strip is quiet and a
	// second call would be a second wish in the same sitting.
	const done = useRef(false);

	const openTray = useCallback(
		(item: SatchelItem) => {
			if (!enabled || done.current) return;
			nonce.current = newSwapNonce();
			setOfferFor(item);
		},
		[enabled],
	);

	const closeTray = useCallback(() => setOfferFor(null), []);

	const swap = useCallback(
		async (take: SatchelFindId | null) => {
			const item = offerFor;
			if (!item || !wish || busy || done.current) return;
			if (!nonce.current) nonce.current = newSwapNonce();
			const sent = nonce.current;
			setBusy(true);
			const r = await swapWithHost(hostId, item.id, take, wish.wish_no, sent);
			setBusy(false);

			if (r.ok) {
				done.current = true;
				nonce.current = null;
				setOfferFor(null);
				onSwapped(r, item);
				return;
			}

			// A transport failure means the server may or may not have acted:
			// the tray stays up and the SAME nonce retries, so a swap that
			// landed but never answered replays instead of running twice.
			if (isTransportFailure(r.reason)) {
				onRefused(swapRefusalCopy(r.reason, hostName), r.reason);
				return;
			}
			// A named refusal moved nothing: the next attempt is a new decision.
			nonce.current = newSwapNonce();

			switch (r.reason) {
				case "wish_changed":
				case "wrong_find":
					onWishChange({
						...(r.wish ?? {}),
						options: r.options ?? [],
						fulfilled_by_me: false,
					});
					break;
				case "option_gone":
				case "not_offered":
					onWishChange({ options: r.options ?? [] });
					break;
				case "already_today":
					onWishChange({ ...(r.wish ?? {}), swapped_today: true });
					setOfferFor(null);
					break;
				case "host_bag_full":
					break;
				default:
					setOfferFor(null);
					break;
			}
			onRefused(swapRefusalCopy(r.reason, hostName), r.reason);
		},
		[busy, hostId, hostName, offerFor, onRefused, onSwapped, onWishChange, wish],
	);

	return { offerFor, busy, openTray, closeTray, swap };
}

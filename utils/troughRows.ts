// The Trough's rows (Storefront build 2, 2026-09-16): what one open drive says
// about itself on a single line in the store, and how much a chip may carry.
// Pure so the trough in the store and the sheet's cards agree on the numbers
// — the quarter cap and the headroom under it are the server's rules
// (20260757: no pig funds more than 25% of a Trough, cumulative), restated
// once here for both.

import type { TroughDrive } from "@/hooks/useTroughDrives";

/** The default chip — the sheet's middle preset. */
export const TROUGH_DEFAULT_CHIP = 25;
/** The track's notches: the quarters a giver's reward is measured in. */
export const TROUGH_NOTCHES = 4;

export interface TroughRowState {
	/** Snouts still needed to fill the Trough. */
	gap: number;
	/** The most one giver may put in, cumulative (a quarter of the price). */
	cap: number;
	/** How much of that quarter this giver has left. */
	headroom: number;
	/** The chip the row offers: the default, clamped to the gap and the headroom. */
	chip: number;
	/** The giver has filled their quarter — the chip is gone, the row stays. */
	quarterFilled: boolean;
}

export function troughRowState(
	d: Pick<TroughDrive, "target" | "raised" | "my_contribution">,
	preset: number = TROUGH_DEFAULT_CHIP,
): TroughRowState {
	const gap = Math.max(0, d.target - d.raised);
	const cap = Math.ceil(d.target * 0.25);
	const headroom = Math.max(0, cap - d.my_contribution);
	const chip = Math.max(0, Math.min(preset, gap, headroom));
	return {
		gap,
		cap,
		headroom,
		chip,
		quarterFilled: gap > 0 && headroom === 0,
	};
}

/** "Sam's Top Hat", or "Your Top Hat" for the drive you opened. */
export function troughRowTitle(
	d: Pick<TroughDrive, "is_mine" | "opener_name" | "item_name" | "item_id">,
): string {
	const item = d.item_name ?? d.item_id;
	if (d.is_mine) return `Your ${item}`;
	return `${d.opener_name ?? "A friend"}'s ${item}`;
}

/** The store's pill: "2 open", or "1 update" when only receipts remain. */
export function troughPillLabel(open: number, receipts: number): string {
	if (open > 0) return `${open} open`;
	return `${receipts} ${receipts === 1 ? "update" : "updates"}`;
}

/**
 * The one Trough Home shows (the yard trough, the fan row's hand line): a
 * FRIEND's open drive nearest full — the herd's leading effort — ties to the
 * one closing soonest. Never your own (founder, 2026-09-16: "friends only" —
 * the thing in the yard invites a chip-in, and you can't chip into your own
 * ask; yours lives in the store). A friend's drive you can no longer chip
 * into (your quarter is in) still leads; the tag then says so. Null when no
 * friend's Trough is open.
 */
export function leadingTroughDrive<T extends Pick<TroughDrive, "target" | "raised" | "closes_at" | "is_mine">>(
	drives: readonly T[],
): T | null {
	let best: T | null = null;
	let bestFrac = -1;
	for (const d of drives) {
		if (d.is_mine) continue;
		const frac = d.target > 0 ? d.raised / d.target : 0;
		if (
			best === null ||
			frac > bestFrac ||
			(frac === bestFrac && d.closes_at < best.closes_at)
		) {
			best = d;
			bestFrac = frac;
		}
	}
	return best;
}

/** The yard tag's second line: what one tap on the sheet would offer. */
export function troughYardOffer(
	d: Pick<TroughDrive, "is_mine" | "target" | "raised" | "my_contribution">,
): string {
	if (d.is_mine) return "ask your Sounder ›"; // unreachable from the yard (friends only); kept for the row
	const state = troughRowState(d);
	if (state.gap === 0) return "landed ›";
	if (state.quarterFilled) return "your quarter is in ›";
	return `chip in ${state.chip} ›`;
}

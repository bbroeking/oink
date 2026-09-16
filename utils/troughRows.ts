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

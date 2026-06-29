// Slop Club monthly stipend — claims via claim_slop_stipend. The
// RPC is idempotent per UTC month and a no-op for non-members, so
// safe to call on every focus; it only pays out once a month for
// subscribers.
//
// No state today — just a single claim action. Wrapped as a hook so
// downstream additions (next-stipend countdown, claim history, etc.)
// have a natural home.

import { useCallback, useRef } from "react";
import { rpc } from "@/utils/rpc";

export interface UseStipendOptions {
	// Fires when the RPC reports an actual grant (ok && granted > 0).
	// Non-members or already-claimed-this-month silently no-op.
	onClaimed?: (granted: number) => void;
}

export interface StipendStatus {
	isMember: boolean;
	amount: number;
	claimedThisMonth: boolean;
	nextAt: string | null; // ISO date the next stipend unlocks (the 1st, UTC)
}

export interface UseStipend {
	// Claims the stipend; returns the granted amount (0 if no-op).
	claim: () => Promise<number>;
	// Read-only status for the claim UI (claimable vs already-claimed).
	status: () => Promise<StipendStatus | null>;
}

export function useStipend(opts: UseStipendOptions = {}): UseStipend {
	const onClaimedRef = useRef(opts.onClaimed);
	onClaimedRef.current = opts.onClaimed;

	const claim = useCallback(async () => {
		const r = await rpc<{ ok?: boolean; granted?: number }>(
			"claim_slop_stipend"
		);
		const granted = r?.ok && r.granted ? r.granted : 0;
		if (granted) onClaimedRef.current?.(granted);
		return granted;
	}, []);

	const status = useCallback(async (): Promise<StipendStatus | null> => {
		const r = await rpc<{
			is_member?: boolean;
			amount?: number;
			claimed_this_month?: boolean;
			next_at?: string | null;
		}>("slop_stipend_status");
		if (!r) return null;
		return {
			isMember: !!r.is_member,
			amount: r.amount ?? 250,
			claimedThisMonth: !!r.claimed_this_month,
			nextAt: r.next_at ?? null,
		};
	}, []);

	return { claim, status };
}

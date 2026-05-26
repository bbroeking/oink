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

export interface UseStipend {
	claim: () => Promise<void>;
}

export function useStipend(opts: UseStipendOptions = {}): UseStipend {
	const onClaimedRef = useRef(opts.onClaimed);
	onClaimedRef.current = opts.onClaimed;

	const claim = useCallback(async () => {
		const r = await rpc<{ ok?: boolean; granted?: number }>(
			"claim_slop_stipend"
		);
		if (r?.ok && r.granted) {
			onClaimedRef.current?.(r.granted);
		}
	}, []);

	return { claim };
}

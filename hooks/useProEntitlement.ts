// useProEntitlement — the client-side "does this user have Tickle
// the Pig Pro?" hook. Backed by the RevenueCat entitlement via
// utils/iap. Use this for COSMETIC / UI gates (showing the premium
// battle-pass track as unlocked, hiding the paywall CTA).
//
// Gameplay perks that mint resources (tickle-regen rate, the raised
// ritual cap) must NOT use this — they read profiles.is_pro
// server-side. See docs/subscriptions-spec.md §5.
//
// While IAP_ENABLED is false, isPro() resolves false, so this hook
// returns { isPro: false } everywhere — the correct inert state.
import { useEffect, useState } from "react";
import { isPro as fetchIsPro, onCustomerInfoUpdate } from "@/utils/iap";

interface ProEntitlement {
	isPro: boolean;
	loading: boolean;
}

export function useProEntitlement(): ProEntitlement {
	const [isPro, setIsPro] = useState(false);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;

		fetchIsPro().then((pro) => {
			if (!cancelled) {
				setIsPro(pro);
				setLoading(false);
			}
		});

		// Re-resolve when RevenueCat reports an entitlement change —
		// purchase completes, a renewal lands, restore returns, etc.
		const unsubscribe = onCustomerInfoUpdate((info) => {
			if (cancelled) return;
			setIsPro(!!info.entitlements.active["tickle_the_pig_pro"]);
		});

		return () => {
			cancelled = true;
			unsubscribe();
		};
	}, []);

	return { isPro, loading };
}

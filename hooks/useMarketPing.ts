// The Barn fan's peek at Bullion's Market: one read-only market_ping() per
// focus, so the Market row appears only once the server has the market and
// its line can say "an offer for you". FAIL-SOFT: an un-pushed server answers
// null and the row never draws.
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router/react-navigation";
import { fetchMarketPing, type MarketPing } from "@/utils/market";

export function useMarketPing(enabled = true): MarketPing | null {
	const [ping, setPing] = useState<MarketPing | null>(null);
	useFocusEffect(
		useCallback(() => {
			if (!enabled) return undefined;
			let cancelled = false;
			void fetchMarketPing().then((p) => {
				if (!cancelled) setPing(p);
			});
			return () => {
				cancelled = true;
			};
		}, [enabled]),
	);
	return ping;
}

// The Barn fan's peek at Bullion's Market: one read-only market_ping() per
// focus, so the Market row appears only once the server has the market and
// its line can say "an offer for you". FAIL-SOFT: an un-pushed server answers
// null and the row never draws.
import { useCallback, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router/react-navigation";
import { MARKET_ONBOARDED_KEY } from "@/constants/market";
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

/**
 * Has this device been through Bullion's three cards? Read on every focus, so
 * the fan's "new here?" line goes the moment the cards are done. Null until
 * read; a storage failure reads as done (never nag on a broken read).
 */
export function useMarketOnboarded(enabled = true): boolean | null {
	const [done, setDone] = useState<boolean | null>(null);
	useFocusEffect(
		useCallback(() => {
			if (!enabled) return undefined;
			let cancelled = false;
			AsyncStorage.getItem(MARKET_ONBOARDED_KEY)
				.then((v) => {
					if (!cancelled) setDone(v === "1");
				})
				.catch(() => {
					if (!cancelled) setDone(true);
				});
			return () => {
				cancelled = true;
			};
		}, [enabled]),
	);
	return done;
}

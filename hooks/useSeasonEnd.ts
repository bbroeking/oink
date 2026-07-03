// The season-end reveal — decides when the SeasonEndModal shows.
//
// Shows only when ALL of:
//   1. the season1_finale server flag is ON (seeded FALSE by the held
//      20260704400000 migration — the founder's single reveal switch),
//   2. my_beta_reward() returns the caller's grant (rows exist only after
//      grant_beta_rewards() fires at season end),
//   3. no local seen-stamp (AsyncStorage) — the server row is the durable
//      truth; the stamp only stops re-shows on this device.
//
// Safe on live/pre-migration servers: the flag reads false (safe default in
// useFeatureFlags) so the RPC is never even called.

import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { rpc } from "@/utils/rpc";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";
import type { BetaTier } from "@/utils/betaRewards";

const SEEN_KEY = "beta_reward_seen_v1";

export type BetaReward = {
	rank: number | null;
	tier: BetaTier;
	titleName: string | null;
	snouts: number;
};

type MyBetaRewardRow = {
	pending: boolean;
	rank?: number | null;
	tier?: BetaTier;
	title_name?: string | null;
	snouts?: number;
};

export function useSeasonEnd(): {
	show: boolean;
	reward: BetaReward | null;
	dismiss: () => void;
} {
	const finale = useFeatureFlag("season1_finale");
	const [reward, setReward] = useState<BetaReward | null>(null);
	const [show, setShow] = useState(false);

	useEffect(() => {
		if (!finale) return;
		let alive = true;
		(async () => {
			const seen = await AsyncStorage.getItem(SEEN_KEY);
			if (seen || !alive) return;
			const r = await rpc<MyBetaRewardRow>("my_beta_reward");
			if (!alive || !r?.pending || !r.tier) return;
			setReward({
				rank: r.rank ?? null,
				tier: r.tier,
				titleName: r.title_name ?? null,
				snouts: r.snouts ?? 0,
			});
			setShow(true);
		})();
		return () => {
			alive = false;
		};
	}, [finale]);

	const dismiss = useCallback(() => {
		setShow(false);
		// Stamp only when there was a real grant to see — a dev-preview
		// dismissal must never suppress the real moment later.
		if (reward) {
			AsyncStorage.setItem(SEEN_KEY, new Date().toISOString()).catch(() => {});
		}
	}, [reward]);

	return { show, reward, dismiss };
}

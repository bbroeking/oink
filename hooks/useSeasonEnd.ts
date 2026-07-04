// The season-end reveal — decides when the SeasonEndModal shows.
//
// Two outputs, deliberately decoupled:
//   • `reward` — the caller's Founding Herd grant, available whenever the
//     season1_finale flag is ON and my_beta_reward() returns a grant. It does
//     NOT depend on the seen-stamp, so it survives dismissal — that's what
//     lets season.tsx keep a persistent recap entry point ("only show the icon
//     when there IS a reward to recap").
//   • `show` — the ONE-TIME auto-open. True only when a reward exists AND
//     there's no local seen-stamp (AsyncStorage). `dismiss` writes the stamp,
//     so the modal auto-opens exactly once per device; the recap icon reopens
//     it thereafter.
//
// Gates on:
//   1. the season1_finale server flag (seeded FALSE by the held
//      20260704400000 migration — the founder's single reveal switch),
//   2. my_beta_reward() returning the caller's grant (rows exist only after
//      grant_beta_rewards() fires at season end).
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
			// The grant is the durable truth (my_beta_reward returns it for as
			// long as the row exists), so we always fetch it when the finale
			// flag is on — even after the reveal has been seen. This keeps
			// `reward` available so a persistent recap entry point can re-open
			// the moment; the seen-stamp only decides the ONE auto-open.
			const r = await rpc<MyBetaRewardRow>("my_beta_reward");
			if (!alive || !r?.pending || !r.tier) return;
			setReward({
				rank: r.rank ?? null,
				tier: r.tier,
				titleName: r.title_name ?? null,
				snouts: r.snouts ?? 0,
			});
			const seen = await AsyncStorage.getItem(SEEN_KEY);
			if (alive && !seen) setShow(true);
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

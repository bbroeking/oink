// This week's quests — the weekly bounties (my_weekly_bounties) as the Pass
// panel prints them, plus the claim. The same RPCs BountyBoard/BountyCard call;
// owned by the screen so the panel renders from data and stays testable.

import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router/react-navigation";
import * as Haptics from "expo-haptics";
import { rpc } from "@/utils/rpc";
import type { WeeklyBounty } from "@/components/BountyCard";

export type { WeeklyBounty };

export interface WeeklyQuests {
	/** null until the first read lands; [] when the week has none (pre-migration). */
	quests: WeeklyBounty[] | null;
	busyCode: string | null;
	claim: (code: string) => Promise<boolean>;
	refresh: () => void;
}

export function useWeeklyQuests(enabled = true): WeeklyQuests {
	const [quests, setQuests] = useState<WeeklyBounty[] | null>(null);
	const [busyCode, setBusyCode] = useState<string | null>(null);

	const refresh = useCallback(() => {
		if (!enabled) return;
		rpc<WeeklyBounty[]>("my_weekly_bounties").then((data) => {
			setQuests(data ?? []);
		});
	}, [enabled]);

	useFocusEffect(
		useCallback(() => {
			refresh();
		}, [refresh])
	);

	const claim = useCallback(
		async (code: string) => {
			if (busyCode) return false;
			setBusyCode(code);
			const r = await rpc<{ ok?: boolean; reason?: string }>("claim_bounty", {
				bounty_code: code,
			});
			setBusyCode(null);
			if (r?.ok) {
				Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
				refresh();
				return true;
			}
			return false;
		},
		[busyCode, refresh]
	);

	return { quests, busyCode, claim, refresh };
}

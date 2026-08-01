import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
	DEFAULT_PIG_ROSTER,
	activatePig,
	fetchPigRoster,
	recruitPig,
	type PigRoster,
} from "@/utils/pigRoster";
import type { PigId } from "@/utils/pigs";
import type { RpcResult } from "@/utils/rpc";

export interface UsePigRoster {
	roster: PigRoster;
	loading: boolean;
	busyPigId: PigId | null;
	refresh: () => Promise<void>;
	recruit: (pigId: PigId) => Promise<RpcResult<{ pig_id: PigId }>>;
	activate: (pigId: PigId) => Promise<RpcResult<{ pig_id: PigId }>>;
}

export function usePigRoster(): UsePigRoster {
	const [roster, setRoster] = useState<PigRoster>(DEFAULT_PIG_ROSTER);
	const [loading, setLoading] = useState(false);
	const [busyPigId, setBusyPigId] = useState<PigId | null>(null);

	const refresh = useCallback(async () => {
		setLoading(true);
		setRoster(await fetchPigRoster());
		setLoading(false);
	}, []);

	useFocusEffect(
		useCallback(() => {
			void refresh();
		}, [refresh]),
	);

	const recruit = useCallback(
		async (pigId: PigId) => {
			setBusyPigId(pigId);
			const result = await recruitPig(pigId);
			await refresh();
			setBusyPigId(null);
			return result;
		},
		[refresh],
	);

	const activate = useCallback(
		async (pigId: PigId) => {
			const previous = roster;
			setBusyPigId(pigId);
			setRoster((current) => ({
				...current,
				activePigId: pigId,
				pigs: current.pigs.map((pig) => ({
					...pig,
					selected: pig.id === pigId,
				})),
			}));
			const result = await activatePig(pigId);
			if (!result.ok) setRoster(previous);
			await refresh();
			setBusyPigId(null);
			return result;
		},
		[refresh, roster],
	);

	return { roster, loading, busyPigId, refresh, recruit, activate };
}


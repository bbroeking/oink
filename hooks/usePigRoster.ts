import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router/react-navigation";
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
	/**
	 * True when the last roster read never came back. The hook keeps showing the
	 * roster it last held (or the default) so nothing flashes, but a surface that
	 * offers the permanent companion choice must render an error + `refresh`
	 * rather than a silently wrong shelf. [B-02, B-14] (2026-09-11, wave 4)
	 */
	error: boolean;
	busyPigId: PigId | null;
	refresh: () => Promise<void>;
	recruit: (pigId: PigId) => Promise<RpcResult<{ pig_id: PigId }>>;
	activate: (pigId: PigId) => Promise<RpcResult<{ pig_id: PigId }>>;
}

export function usePigRoster(): UsePigRoster {
	const [roster, setRoster] = useState<PigRoster>(DEFAULT_PIG_ROSTER);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(false);
	const [busyPigId, setBusyPigId] = useState<PigId | null>(null);

	const refresh = useCallback(async () => {
		setLoading(true);
		const next = await fetchPigRoster();
		// `null` is unknown, not empty: keep the last known roster on screen and
		// raise the error flag so the surface can offer a retry.
		if (next) setRoster(next);
		setError(next == null);
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

	return { roster, loading, error, busyPigId, refresh, recruit, activate };
}


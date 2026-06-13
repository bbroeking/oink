// Crew (player-facing "Sounder") state for the caller. Backs the
// SounderCard on the Friends hub: roster, incoming/outgoing invites,
// and the create/invite/accept/decline/leave actions.
//
// Mirrors useActiveEffects: initial fetch, focus refresh, realtime,
// optimistic mutations. Realtime watches incoming invites (so a fresh
// invite appears without a manual refresh) and the caller's crew roster
// (joins/leaves). Membership is enforced server-side by RLS + the cap
// trigger; the client just reflects state.

import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/utils/supabase";
import {
	CrewState,
	fetchCrewState,
	createCrew as createCrewRpc,
	inviteToCrew as inviteRpc,
	acceptInvite as acceptRpc,
	declineInvite as declineRpc,
	leaveCrew as leaveRpc,
} from "@/utils/mudWars";
import { RpcResult } from "@/utils/rpc";

const EMPTY: CrewState = {
	crew: null,
	members: [],
	invitesIn: [],
	invitesOut: [],
	inWar: false,
	warId: null,
};

export interface UseCrew {
	crew: CrewState;
	loading: boolean;
	refresh: () => Promise<void>;
	create: (name: string) => Promise<RpcResult<{ crew_id: string }>>;
	invite: (userId: string) => Promise<RpcResult<{}>>;
	accept: (inviteId: string) => Promise<RpcResult<{ crew_id: string }>>;
	decline: (inviteId: string) => Promise<RpcResult<{}>>;
	leave: () => Promise<RpcResult<{}>>;
}

export function useCrew(enabled = true): UseCrew {
	const [crew, setCrew] = useState<CrewState>(EMPTY);
	const [loading, setLoading] = useState(false);

	const refresh = useCallback(async () => {
		if (!enabled) return;
		setLoading(true);
		setCrew(await fetchCrewState());
		setLoading(false);
	}, [enabled]);

	useFocusEffect(
		useCallback(() => {
			if (enabled) refresh();
		}, [enabled, refresh])
	);

	const crewId = crew.crew?.id ?? null;

	useEffect(() => {
		if (!enabled) {
			setCrew(EMPTY);
			return;
		}
		let cancelled = false;
		let channelKey: string | null = null;
		(async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (cancelled || !user) return;
			channelKey = `realtime:crew:${user.id}:${crewId ?? "none"}`;
			let ch = supabase.channel(channelKey).on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "crew_invites",
					filter: `invitee_id=eq.${user.id}`,
				},
				() => refresh()
			);
			if (crewId) {
				ch = ch.on(
					"postgres_changes",
					{
						event: "*",
						schema: "public",
						table: "crew_members",
						filter: `crew_id=eq.${crewId}`,
					},
					() => refresh()
				);
			}
			ch.subscribe();
		})();
		return () => {
			cancelled = true;
			if (channelKey) {
				supabase
					.getChannels()
					.filter((c) => c.topic === channelKey)
					.forEach((c) => supabase.removeChannel(c));
			}
		};
	}, [enabled, crewId, refresh]);

	const create = useCallback(
		async (name: string) => {
			const r = await createCrewRpc(name);
			await refresh();
			return r;
		},
		[refresh]
	);

	const invite = useCallback(
		async (userId: string) => {
			const r = await inviteRpc(userId);
			await refresh();
			return r;
		},
		[refresh]
	);

	const accept = useCallback(
		async (inviteId: string) => {
			// Optimistic: drop the invite so the card resolves immediately.
			setCrew((c) => ({ ...c, invitesIn: c.invitesIn.filter((i) => i.id !== inviteId) }));
			const r = await acceptRpc(inviteId);
			await refresh();
			return r;
		},
		[refresh]
	);

	const decline = useCallback(
		async (inviteId: string) => {
			setCrew((c) => ({ ...c, invitesIn: c.invitesIn.filter((i) => i.id !== inviteId) }));
			const r = await declineRpc(inviteId);
			if (!r.ok) await refresh();
			return r;
		},
		[refresh]
	);

	const leave = useCallback(async () => {
		const r = await leaveRpc();
		await refresh();
		return r;
	}, [refresh]);

	return { crew, loading, refresh, create, invite, accept, decline, leave };
}

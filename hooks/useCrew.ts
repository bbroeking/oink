// Crew (player-facing "Sounder") state for the caller. Backs the
// SounderCard on the Friends hub: roster, incoming/outgoing invites,
// and the create/invite/accept/decline/leave actions.
//
// Mirrors useActiveEffects: initial fetch, focus refresh, realtime,
// optimistic mutations. Realtime watches incoming invites (so a fresh
// invite appears without a manual refresh) and the caller's crew roster
// (joins/leaves). Membership is enforced server-side by RLS + the cap
// trigger; the client just reflects state.

import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/utils/supabase";
import { usePostgresChanges } from "./usePostgresChanges";
import {
	CrewState,
	JoinableCrew,
	fetchCrewState,
	fetchJoinable,
	createCrew as createCrewRpc,
	inviteToCrew as inviteRpc,
	acceptInvite as acceptRpc,
	declineInvite as declineRpc,
	cancelInvite as cancelRpc,
	requestToJoin as requestJoinRpc,
	cancelJoinRequest as cancelRequestRpc,
	acceptJoinRequest as acceptRequestRpc,
	declineJoinRequest as declineRequestRpc,
	leaveCrew as leaveRpc,
} from "@/utils/crews";
import { markSounderLeft } from "@/utils/sounderPath";
import { RpcResult } from "@/utils/rpc";

const EMPTY: CrewState = {
	crew: null,
	members: [],
	invitesIn: [],
	invitesOut: [],
	joinRequestsIn: [],
	joinRequestsOut: [],
	lifetime_finds: 0,
	milestones_claimed: [],
};

export interface UseCrew {
	crew: CrewState;
	loading: boolean;
	refresh: () => Promise<void>;
	create: () => Promise<RpcResult<{ crew_id: string; name: string }>>;
	invite: (userId: string) => Promise<RpcResult<{}>>;
	accept: (inviteId: string) => Promise<RpcResult<{ crew_id: string }>>;
	decline: (inviteId: string) => Promise<RpcResult<{}>>;
	cancel: (inviteId: string) => Promise<RpcResult<{}>>;
	// Knock-to-join: ask into an open Sounder, take your own ask back, and (as a
	// member) answer an incoming knock.
	requestJoin: (crewId: string) => Promise<RpcResult<{}>>;
	cancelRequest: (requestId: string) => Promise<RpcResult<{}>>;
	acceptRequest: (requestId: string) => Promise<RpcResult<{ crew_id: string }>>;
	declineRequest: (requestId: string) => Promise<RpcResult<{}>>;
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

	// Realtime: incoming crew_invites (scoped to me) always; then the
	// spec set branches on crewId — a member watches the roster + incoming
	// knocks on their crew, a crewless caller watches their OWN outgoing
	// knocks resolve. crewId is a keyPart AND a dep, so the channel rebuilds
	// when the caller joins/leaves. Lifecycle owned by usePostgresChanges.
	usePostgresChanges({
		topic: "crew",
		enabled,
		keyParts: [crewId],
		onDisabled: () => setCrew(EMPTY),
		specs: (uid) => {
			const specs = [
				{
					event: "*" as const,
					table: "crew_invites",
					filter: `invitee_id=eq.${uid}`,
					callback: () => refresh(),
				},
			];
			if (crewId) {
				specs.push({
					event: "*" as const,
					table: "crew_members",
					filter: `crew_id=eq.${crewId}`,
					callback: () => refresh(),
				});
				// Incoming knocks on the caller's crew — a fresh ask appears (and a
				// withdrawn one clears) without a manual refresh.
				specs.push({
					event: "*" as const,
					table: "crew_join_requests",
					filter: `crew_id=eq.${crewId}`,
					callback: () => refresh(),
				});
			} else {
				// Crewless: the caller's OWN outgoing knocks — when a member accepts or
				// declines, the "asked — waiting" state resolves on its own.
				specs.push({
					event: "*" as const,
					table: "crew_join_requests",
					filter: `requester_id=eq.${uid}`,
					callback: () => refresh(),
				});
			}
			return specs;
		},
		deps: [enabled, crewId, refresh],
	});

	const create = useCallback(
		async () => {
			// No name argument — the server names the Sounder at birth.
			const r = await createCrewRpc();
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

	const cancel = useCallback(
		async (inviteId: string) => {
			// Optimistic: drop the outgoing invite so the ghost row + its reserved
			// seat resolve immediately.
			setCrew((c) => ({ ...c, invitesOut: c.invitesOut.filter((i) => i.id !== inviteId) }));
			const r = await cancelRpc(inviteId);
			if (!r.ok) await refresh();
			return r;
		},
		[refresh]
	);

	const requestJoin = useCallback(
		async (crewId: string) => {
			const r = await requestJoinRpc(crewId);
			await refresh();
			return r;
		},
		[refresh]
	);

	const cancelRequest = useCallback(
		async (requestId: string) => {
			// Optimistic: drop the outgoing ask so the "asked — waiting" row resolves
			// to a fresh "ask to join" immediately.
			setCrew((c) => ({
				...c,
				joinRequestsOut: c.joinRequestsOut.filter((r) => r.id !== requestId),
			}));
			const r = await cancelRequestRpc(requestId);
			await refresh();
			return r;
		},
		[refresh]
	);

	const acceptRequest = useCallback(
		async (requestId: string) => {
			// Optimistic: drop the knock so the incoming row resolves at once; the
			// refresh grows the roster.
			setCrew((c) => ({
				...c,
				joinRequestsIn: c.joinRequestsIn.filter((r) => r.id !== requestId),
			}));
			const r = await acceptRequestRpc(requestId);
			await refresh();
			return r;
		},
		[refresh]
	);

	const declineRequest = useCallback(
		async (requestId: string) => {
			setCrew((c) => ({
				...c,
				joinRequestsIn: c.joinRequestsIn.filter((r) => r.id !== requestId),
			}));
			const r = await declineRequestRpc(requestId);
			if (!r.ok) await refresh();
			return r;
		},
		[refresh]
	);

	const leave = useCallback(async () => {
		const r = await leaveRpc();
		// Stamp the leaver flag on success so the Sounder path re-shows the "join
		// another" nudge. Here (the single hook chokepoint every leave path funnels
		// through) so no call site can forget it. Fail-soft inside markSounderLeft.
		if (r.ok) {
			const { data } = await supabase.auth.getSession();
			await markSounderLeft(data.session?.user?.id ?? null);
		}
		await refresh();
		return r;
	}, [refresh]);

	return {
		crew,
		loading,
		refresh,
		create,
		invite,
		accept,
		decline,
		cancel,
		requestJoin,
		cancelRequest,
		acceptRequest,
		declineRequest,
		leave,
	};
}

// Open Sounders the caller could join right now (find_joinable_crews).
// Focus-refreshed like useCrew; callers re-fetch after a failed join so a
// just-filled or just-warring crew falls off the list.
export function useJoinableCrews(enabled = true) {
	const [crews, setCrews] = useState<JoinableCrew[]>([]);
	const [loading, setLoading] = useState(true);

	const refresh = useCallback(async () => {
		if (!enabled) return;
		setCrews(await fetchJoinable());
		setLoading(false);
	}, [enabled]);

	useFocusEffect(
		useCallback(() => {
			if (enabled) refresh();
		}, [enabled, refresh])
	);

	return { crews, loading, refresh };
}

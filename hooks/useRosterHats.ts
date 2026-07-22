// Roster avatar lookup — maps a Sounder's member user_ids to their equipped
// `active_hat_id`, so crew surfaces (SounderCard roster, TransferLeadershipSheet)
// render the SAME PigAvatar look the Leaderboard shows. The crew_state RPC's
// member payload omits avatar fields; the Leaderboard reads them straight off
// `profiles` under RLS, and this hook does the same — one keyed profiles read,
// re-fetched only when the roster's id set changes.

import { useEffect, useState } from "react";
import { fetchMemberHats, fetchMemberProfiles, type RosterProfile } from "@/utils/crews";

export function useRosterHats(userIds: string[]): Map<string, string | null> {
	const [hats, setHats] = useState<Map<string, string | null>>(new Map());
	// Order-independent cache key so a re-render with the same members (new
	// array identity) doesn't refetch; only a real join/leave does.
	const key = [...userIds].sort().join(",");

	useEffect(() => {
		if (userIds.length === 0) {
			setHats(new Map());
			return;
		}
		let cancelled = false;
		fetchMemberHats(userIds).then((m) => {
			if (!cancelled) setHats(m);
		});
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key]);

	return hats;
}

export function useRosterProfiles(userIds: string[]): Map<string, RosterProfile> {
	const [profiles, setProfiles] = useState<Map<string, RosterProfile>>(new Map());
	const key = [...userIds].sort().join(",");

	useEffect(() => {
		if (userIds.length === 0) {
			setProfiles(new Map());
			return;
		}
		let cancelled = false;
		fetchMemberProfiles(userIds).then((next) => {
			if (!cancelled) setProfiles(next);
		});
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key]);

	return profiles;
}

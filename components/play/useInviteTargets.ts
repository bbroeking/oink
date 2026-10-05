// Who a player can invite to a table: their friends, each with the pig other
// players see (the same profile columns the play server snapshots into a
// seat, utils/multiplayer/looks), and the name of their Sounder when they
// ride with one. Read fresh every time the invite sheet opens; a failed read
// is "unknown" (null + failed), never "you have no friends".

import { useEffect, useState } from "react";
import type { PlayerCard } from "@/multiplayer/protocol";
import { fetchCrewState } from "@/utils/crews";
import { FRIEND_CAP_LIMIT, getFriendIds } from "@/utils/friendships";
import { LOOK_PROFILE_SELECT, playerCardFromProfile, type LookProfileRow } from "@/utils/multiplayer/looks";
import { supabase } from "@/utils/supabase";

export interface InviteTargetsRead {
	/** Friends, alphabetical; null when the read failed. */
	friends: PlayerCard[] | null;
	/** The caller's Sounder's name, or null when crewless (or unknown). */
	crewName: string | null;
}

export async function loadInviteTargets(): Promise<InviteTargetsRead> {
	const [ids, crew] = await Promise.all([getFriendIds(), fetchCrewState().catch(() => null)]);
	const crewName = crew?.crew?.name ?? null;
	if (ids === null) return { friends: null, crewName };
	const capped = ids.slice(0, FRIEND_CAP_LIMIT);
	if (capped.length === 0) return { friends: [], crewName };
	const { data, error } = await supabase.from("profiles").select(`id, ${LOOK_PROFILE_SELECT}`).in("id", capped);
	if (error || !Array.isArray(data)) return { friends: null, crewName };
	const rows = data as unknown as (LookProfileRow & { id: string })[];
	const friends = rows
		.map((row) => playerCardFromProfile(row.id, row))
		.sort((a, b) => a.name.localeCompare(b.name));
	return { friends, crewName };
}

export interface InviteTargets extends InviteTargetsRead {
	loading: boolean;
	retry: () => void;
}

export function useInviteTargets(open: boolean): InviteTargets {
	// A fresh read per opening, and per retry. Adjusted during render (the
	// React-sanctioned way) so the effect below only ever reads.
	const [openSeen, setOpenSeen] = useState(open);
	const [opening, setOpening] = useState(0);
	if (openSeen !== open) {
		setOpenSeen(open);
		if (open) setOpening((n) => n + 1);
	}
	const [attempt, setAttempt] = useState(0);
	const requestKey = `${opening}:${attempt}`;
	const [result, setResult] = useState<(InviteTargetsRead & { key: string }) | null>(null);

	useEffect(() => {
		if (!open) return;
		let live = true;
		void loadInviteTargets()
			.catch((): InviteTargetsRead => ({ friends: null, crewName: null }))
			.then((read) => {
				if (live) setResult({ ...read, key: requestKey });
			});
		return () => {
			live = false;
		};
	}, [open, requestKey]);

	const current = result?.key === requestKey ? result : null;
	return {
		friends: current?.friends ?? null,
		crewName: current?.crewName ?? result?.crewName ?? null,
		loading: open && current === null,
		retry: () => setAttempt((n) => n + 1),
	};
}

// The herd's feeding snapshot — who dug this feeding (feeding_state's crew_dug
// plus the caller's own `dug`), each member's Snout Deep layer line when the row
// carries one, per-member finds this week (race_crew_detail), and the roster's
// portraits. One read shared by the Feed and Herd panels and the tab strip's
// `4 of 6` cell, so the three can never disagree about who dug.
//
// Re-reads on focus and whenever `refreshKey` bumps (the dig modal never blurs
// the tab, so a banked dig ticks this explicitly — the stale-cards bug).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router/react-navigation";
import { useRosterProfiles } from "@/hooks/useRosterHats";
import type { UseCrew } from "@/hooks/useCrew";
import type { RosterProfile } from "@/utils/crews";
import { fetchFeedingState, type FeedingState } from "@/utils/dig";
import { fetchRaceCrewDetail, type RaceCrewDetail } from "@/utils/race";
import { digLayerLine } from "@/utils/snoutDeep";

export interface HerdMember {
	user_id: string;
	username: string;
	/** The caller's own row. */
	me: boolean;
	dug: boolean;
	/** "tied at the mud" / "woke at the root" — null on a classic dig. */
	layerLine: string | null;
	/** Finds this weekly cycle, or null until race_crew_detail answers. */
	finds: number | null;
}

export interface HerdFeeding {
	members: HerdMember[];
	profiles: Map<string, RosterProfile>;
	dugCount: number;
	/** The caller has dug this feeding (the shared CTA's own truth wins). */
	meDug: boolean;
	/** True until the feeding read lands. */
	loading: boolean;
	feeding: FeedingState | null;
	detail: RaceCrewDetail | null;
}

export function useHerdFeeding(
	crewHook: UseCrew,
	uid: string | null,
	refreshKey?: number,
	/** The shared feeding CTA's dug flag — the one source every dig surface reads. */
	dugThisWindow?: boolean
): HerdFeeding {
	const members = crewHook.crew.members;
	const crewId = crewHook.crew.crew?.id ?? null;
	const profiles = useRosterProfiles(members.map((m) => m.user_id));

	const [feeding, setFeeding] = useState<FeedingState | null>(null);
	const [loading, setLoading] = useState(true);
	const [detail, setDetail] = useState<RaceCrewDetail | null>(null);

	// One read, two triggers: focus (the tab came back) and the dig tick (a
	// banked dig under the modal that never blurs the tab). Each returns its
	// cancel so a stale answer never lands over a fresh one.
	const read = useCallback(() => {
		if (!crewId) {
			setLoading(false);
			return () => {};
		}
		let cancelled = false;
		fetchFeedingState().then((s) => {
			if (cancelled) return;
			setFeeding(s);
			setLoading(false);
		});
		fetchRaceCrewDetail(crewId).then((d) => {
			if (!cancelled) setDetail(d);
		});
		return () => {
			cancelled = true;
		};
	}, [crewId]);
	useFocusEffect(read);
	useEffect(() => {
		if (!refreshKey) return;
		return read();
	}, [refreshKey, read]);

	return useMemo(() => {
		const dugSet = new Set((feeding?.crew_dug ?? []).map((c) => c.user_id));
		const meDug = !!dugThisWindow || !!feeding?.dug;
		if (meDug && uid) dugSet.add(uid);
		const layer = new Map<string, string>();
		for (const c of feeding?.crew_dug ?? []) {
			const line = digLayerLine(c.layer_tied, c.woke);
			if (line) layer.set(c.user_id, line);
		}
		if (feeding?.dug && uid) {
			const line = digLayerLine(feeding.layer_tied, feeding.woke);
			if (line) layer.set(uid, line);
		}
		const finds = new Map((detail?.members ?? []).map((m) => [m.user_id, m.finds]));
		const rows: HerdMember[] = members.map((m) => ({
			user_id: m.user_id,
			username: m.username ?? "a pig",
			me: m.user_id === uid,
			dug: dugSet.has(m.user_id),
			layerLine: layer.get(m.user_id) ?? null,
			finds: detail ? (finds.get(m.user_id) ?? 0) : null,
		}));
		return {
			members: rows,
			profiles,
			dugCount: rows.filter((r) => r.dug).length,
			meDug,
			loading,
			feeding,
			detail,
		};
	}, [members, profiles, feeding, detail, uid, dugThisWindow, loading]);
}

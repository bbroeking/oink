// Receiver-side effects state for the caller. Backs three render
// surfaces: the Barn chip strip, the Hoofprints sheet, and the
// Inbox panel. Owns the live state of my_active_effects: initial
// fetch, focus refresh, realtime, and the cleanse mutation.
//
// Realtime subscribes to INSERT on blessings + curses (effects
// appearing) and UPDATE on curses (cleanse path). Receiver scoping
// is enforced by existing RLS SELECT policies; the filter on
// receiver_id is belt-and-braces.
//
// The `enabled` option exists so a mounted-but-closed surface
// (HoofprintsSheet stays mounted by its parent so it can animate
// in) can suspend fetch + sub while it has nothing to render.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/utils/supabase";
import {
	Effect,
	fetchActiveEffects,
	formatLeft,
	partitionBySource,
} from "@/utils/activeEffects";

export interface CleanseResult {
	ok: boolean;
	reason?: string;
	cleared?: number;
}

export interface UseActiveEffectsOptions {
	enabled?: boolean;
}

export interface UseActiveEffects {
	effects: Effect[];
	blessings: Effect[];
	curses: Effect[];
	loading: boolean;
	refresh: () => Promise<void>;
	cleanse: () => Promise<CleanseResult>;
	formatLeft: typeof formatLeft;
}

export function useActiveEffects(
	options: UseActiveEffectsOptions = {}
): UseActiveEffects {
	const enabled = options.enabled ?? true;
	const [effects, setEffects] = useState<Effect[]>([]);
	const [loading, setLoading] = useState(false);

	const refresh = useCallback(async () => {
		if (!enabled) return;
		setLoading(true);
		const rows = await fetchActiveEffects();
		setEffects(rows);
		setLoading(false);
	}, [enabled]);

	useFocusEffect(
		useCallback(() => {
			if (enabled) refresh();
		}, [enabled, refresh])
	);

	useEffect(() => {
		if (!enabled) {
			setEffects([]);
			return;
		}
		let cancelled = false;
		let channelKey: string | null = null;
		(async () => {
			const { data: { user } } = await supabase.auth.getUser();
			if (cancelled || !user) return;
			channelKey = `realtime:active-effects:${user.id}`;
			const ch = supabase
				.channel(channelKey)
				.on(
					"postgres_changes",
					{
						event: "INSERT",
						schema: "public",
						table: "blessings",
						filter: `receiver_id=eq.${user.id}`,
					},
					() => refresh()
				)
				.on(
					"postgres_changes",
					{
						event: "INSERT",
						schema: "public",
						table: "curses",
						filter: `receiver_id=eq.${user.id}`,
					},
					() => refresh()
				)
				.on(
					"postgres_changes",
					{
						event: "UPDATE",
						schema: "public",
						table: "curses",
						filter: `receiver_id=eq.${user.id}`,
					},
					() => refresh()
				)
				.subscribe();
			return () => {
				supabase.removeChannel(ch);
			};
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
	}, [enabled, refresh]);

	const cleanse = useCallback(async (): Promise<CleanseResult> => {
		// Optimistic: drop curse rows immediately so chips/cards
		// disappear before the round trip settles.
		setEffects((rows) => rows.filter((e) => e.source !== "curse"));
		const { data } = await supabase.rpc("cleanse_curses");
		const r = (data as CleanseResult | null) ?? { ok: false };
		if (!r.ok) {
			// The RPC said no — refresh to undo the optimistic removal.
			await refresh();
		}
		return r;
	}, [refresh]);

	const { blessings, curses } = useMemo(
		() => partitionBySource(effects),
		[effects]
	);

	return { effects, blessings, curses, loading, refresh, cleanse, formatLeft };
}

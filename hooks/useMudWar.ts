// Mud-war state for the caller's current war. Backs the /mud-war screen:
// the tug-of-war bar, per-capita scores, remaining slings today, the
// day countdown, and the sling-mud tap action.
//
// Mirrors useActiveEffects. Two things specific to wars:
//  • Lazy resolve — fetchWarState (my_war/war_state) resolves the war
//    server-side on first read after ends_at, so a plain refresh after
//    expiry produces the resolved state. No cron, no client timer.
//  • Optimistic sling — the tap bumps local state instantly (so the juice
//    feels immediate) and reverts on failure. Opponent's bar moves via a
//    throttled realtime subscription on mud_slings.

import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/utils/supabase";
import {
	WarState,
	WarSide,
	fetchWarState,
	slingMud as slingRpc,
	perCapita,
} from "@/utils/mudWars";
import { RpcResult } from "@/utils/rpc";

// Apply one optimistic sling to my side for the given user.
function bumpMine(war: WarState, userId: string): WarState {
	const members = war.mine.members.map((m) =>
		m.user_id === userId ? { ...m, slings: m.slings + 1 } : m
	);
	// If I had no row yet, add one.
	if (!members.some((m) => m.user_id === userId)) {
		members.push({ user_id: userId, username: null, slings: 1 });
	}
	const total = war.mine.total + 1;
	const active = members.filter((m) => m.slings > 0).length;
	const mine: WarSide = {
		...war.mine,
		members,
		total,
		active,
		perCapita: perCapita(total, active),
		quorumMet: active >= 2,
	};
	return {
		...war,
		mine,
		myRemainingToday: Math.max(0, war.myRemainingToday - 1),
	};
}

export interface UseMudWar {
	war: WarState | null;
	loading: boolean;
	refresh: () => Promise<void>;
	sling: () => Promise<RpcResult<{ slings_today: number; remaining: number }>>;
}

export function useMudWar(warId?: string, enabled = true): UseMudWar {
	const [war, setWar] = useState<WarState | null>(null);
	const [loading, setLoading] = useState(false);
	const userIdRef = useRef<string | null>(null);
	const lastRtRefresh = useRef(0);

	const refresh = useCallback(async () => {
		if (!enabled) return;
		setLoading(true);
		setWar(await fetchWarState(warId));
		setLoading(false);
	}, [enabled, warId]);

	useFocusEffect(
		useCallback(() => {
			if (enabled) refresh();
		}, [enabled, refresh])
	);

	const liveWarId = war?.warId ?? warId ?? null;

	useEffect(() => {
		if (!enabled) {
			setWar(null);
			return;
		}
		let cancelled = false;
		let channelKey: string | null = null;
		(async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (cancelled || !user) return;
			userIdRef.current = user.id;
			if (!liveWarId) return;
			channelKey = `realtime:mud-war:${liveWarId}`;
			supabase
				.channel(channelKey)
				.on(
					"postgres_changes",
					{
						event: "*",
						schema: "public",
						table: "mud_slings",
						filter: `war_id=eq.${liveWarId}`,
					},
					() => {
						// Throttle: a sling burst can fire many events/sec.
						const now = Date.now();
						if (now - lastRtRefresh.current < 1500) return;
						lastRtRefresh.current = now;
						refresh();
					}
				)
				.subscribe();
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
	}, [enabled, liveWarId, refresh]);

	const sling = useCallback(async () => {
		const current = war;
		const uid = userIdRef.current;
		if (!current || !uid || current.status !== "active") {
			return { ok: false, reason: "war_not_active" } as RpcResult<{
				slings_today: number;
				remaining: number;
			}>;
		}
		if (current.myRemainingToday <= 0) {
			return { ok: false, reason: "daily_cap" } as RpcResult<{
				slings_today: number;
				remaining: number;
			}>;
		}
		// Optimistic bump for instant tap-juice.
		setWar(bumpMine(current, uid));
		const r = await slingRpc(current.warId);
		if (!r.ok) {
			// Server said no (cap raced, war ended) — reconcile.
			await refresh();
		}
		return r;
	}, [war, refresh]);

	return { war, loading, refresh, sling };
}

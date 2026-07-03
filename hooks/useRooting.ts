// Truffle Patch session state — open a rooting for the current 8h feeding,
// submit the finds, remember "already dug this feeding".
//
// PRACTICE FALLBACK: until the 20260704100000 migration is pushed, the RPCs
// don't exist — rpcAction surfaces that as reason "network"/"no_data". We then
// run the identical board locally from a deterministic client seed and mark
// the session { practice: true } so the UI can badge it honestly ("practice
// patch — the real bog opens soon") and mint nothing. This makes the game
// fully playable in dev before any DB push.

import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { rpcAction, RpcResult } from "@/utils/rpc";
import {
	ClaimableFind,
	practiceSeed,
	windowIndex,
	windowEndsAtMs,
} from "@/utils/rooting";

export interface RootingSession {
	seed: number;
	windowIndex: number;
	windowEndsAtMs: number;
	practice: boolean;
}

export interface RootingOutcome {
	mud: number;
	truffles: number;
	echo: boolean;
	golden_truffles?: number;
	practice: boolean;
}

type OpenPayload = { seed: number; window_index: number; window_ends_at: string };
type SubmitPayload = {
	mud: number;
	truffles: number;
	echo: boolean;
	golden_truffles: number;
	root_mud_today: number;
};

// Reasons that mean "the server doesn't have the Patch yet" (migration
// unpushed) rather than a gameplay refusal.
const MISSING_RPC_REASONS = new Set(["network", "no_data"]);

const dugKey = (warId: string, win: number) => `rooting_done_${warId}_${win}`;

export function useRooting(warId: string | null) {
	const [session, setSession] = useState<RootingSession | null>(null);
	const [dugThisWindow, setDugThisWindow] = useState(false);
	const win = windowIndex();

	// "Already dug" is server-authoritative (open_rooting says already_rooted),
	// but we mirror it in AsyncStorage so the strip renders right on cold start
	// and in practice mode.
	useEffect(() => {
		let cancelled = false;
		setDugThisWindow(false);
		if (!warId) return;
		AsyncStorage.getItem(dugKey(warId, win)).then((v) => {
			if (!cancelled && v) setDugThisWindow(true);
		});
		return () => {
			cancelled = true;
		};
	}, [warId, win]);

	const open = useCallback(async (): Promise<
		RpcResult<{ session: RootingSession }>
	> => {
		if (!warId) return { ok: false, reason: "no_war" };
		const r = await rpcAction<OpenPayload>("open_rooting", { p_war: warId });
		if (r.ok) {
			const s: RootingSession = {
				seed: r.seed,
				windowIndex: r.window_index,
				windowEndsAtMs: new Date(r.window_ends_at).getTime(),
				practice: false,
			};
			setSession(s);
			return { ok: true, session: s };
		}
		if (r.reason === "already_rooted") {
			setDugThisWindow(true);
			return { ok: false, reason: r.reason };
		}
		if (MISSING_RPC_REASONS.has(r.reason)) {
			// Practice patch — identical board, nothing minted.
			const s: RootingSession = {
				seed: practiceSeed(warId, win),
				windowIndex: win,
				windowEndsAtMs: windowEndsAtMs(win),
				practice: true,
			};
			setSession(s);
			return { ok: true, session: s };
		}
		return { ok: false, reason: r.reason };
	}, [warId, win]);

	const submit = useCallback(
		async (
			finds: ClaimableFind[],
			actions: number
		): Promise<RpcResult<{ outcome: RootingOutcome }>> => {
			if (!warId || !session) return { ok: false, reason: "no_session" };
			const markDug = async () => {
				setDugThisWindow(true);
				await AsyncStorage.setItem(dugKey(warId, session.windowIndex), "1");
			};
			if (session.practice) {
				const truffles = finds.filter(
					(f) => f === "truffle_l" || f === "truffle_d"
				).length;
				await markDug();
				return {
					ok: true,
					outcome: {
						mud: Math.min(2, truffles),
						truffles: truffles > 0 ? 1 : 0,
						echo: false,
						practice: true,
					},
				};
			}
			const r = await rpcAction<SubmitPayload>("submit_rooting", {
				p_war: warId,
				p_finds: finds,
				p_actions: actions,
			});
			if (!r.ok) {
				if (r.reason === "already_rooted") await markDug();
				return { ok: false, reason: r.reason };
			}
			await markDug();
			return {
				ok: true,
				outcome: {
					mud: r.mud,
					truffles: r.truffles,
					echo: r.echo,
					golden_truffles: r.golden_truffles,
					practice: false,
				},
			};
		},
		[warId, session]
	);

	const clear = useCallback(() => setSession(null), []);

	return { session, dugThisWindow, open, submit, clear };
}

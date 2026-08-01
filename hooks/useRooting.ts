// Truffle Patch session state — open a rooting for the current commuter feeding,
// submit the finds, remember "already dug this feeding".
//
// Digging is crew-gated and purely co-op vs the Great Hungerer: a find mints
// Golden Truffles AND drains the global hunger meter. open_rooting() takes no
// args (the server resolves the caller's crew + window) and returns 'no_crew'
// when the caller has no Sounder — surfaced here as a distinct state the UI
// can read.
//
// PRACTICE FALLBACK: until the migrations are pushed the RPCs don't exist —
// rpcAction surfaces that as reason "network"/"no_data". We then run the
// identical board locally from a deterministic client seed and mark the session
// { practice: true } so the UI can badge it honestly and mint nothing.

import { useCallback, useEffect, useReducer, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { rpcAction, RpcResult } from "@/utils/rpc";
import { supabase } from "@/utils/supabase";
import { markFirstRealDig } from "@/utils/sounderPath";
import { cancelOpenReminder } from "@/utils/pushNotifications";
import { fetchFeedingState } from "@/utils/dig";
import {
	ClaimableFind,
	claimableFinds,
	generateBoard,
	normalizePouch,
	practiceSeed,
	windowIndex,
	windowEndsAtMs,
} from "@/utils/rooting";
import {
	digSessionReducer,
	initialDigSessionState,
	isDugThisWindow,
	dugMirrorKey,
	shouldReconcile,
} from "@/utils/digSession";
// A crewmate who has already dug this feeding — the feeding-state read module
// owns this shape; re-exported here so existing `import { CrewDug } from
// "@/hooks/useRooting"` call sites (if any) keep resolving.
import type { CrewDug } from "@/utils/dig";

export type { CrewDug };

export interface RootingSession {
	seed: number;
	windowIndex: number;
	windowEndsAtMs: number;
	practice: boolean;
	// Co-op depth: a crewmate already dug this feeding → the patch lets you dig
	// deeper (bigger stir budget); an active blessing makes digs luckier.
	coop: boolean;
	blessed: boolean;
	crewDug: CrewDug[];
	// The unique relic the server rolled onto this board (~2 in 5), or null.
	// Practice mode + a server that hasn't migrated → null → no unique on the board.
	uniqueId: string | null;
	// "The One That Got Away": the caller's carry slot re-buried on this board, or
	// null (empty slot / server not migrated → feature-dark). kind is the missed
	// find (truffle_l/truffle_d/unique); a unique carry pins THIS board's relic.
	carry: RootingCarry | null;
}

// The carried miss the server re-buries next feeding (gilded).
export interface RootingCarry {
	kind: "truffle_l" | "truffle_d" | "unique";
	uniqueId: string | null;
	gild: number;
}

export interface RootingOutcome {
	// Meter drain this dig banked (finds-denominated). Was: `mud`.
	// NOTE: the server reports drain_total as the GLOBAL running meter, not this
	// dig's delta — so the UI shows `credited` (this dig's finds) instead.
	drain: number;
	// Finds credited to the meter THIS dig (credited[].length) — the honest
	// per-dig "Joy reclaimed" number, distinct from the global `drain` total.
	credited: number;
	truffles: number;
	// You minted an extra "echo" truffle because a crewmate dug earlier this
	// feeding. Server-authoritative (`r.echo` = the function's my_echo) when the
	// migration is pushed; falls back to echo_names being non-empty for an
	// un-pushed server. Note echo can be TRUE with an empty echoNames — the +1
	// only needs a crewmate to have SUBMITTED, while echoNames lists only those
	// who also MINTED — so the receipt copy handles the names-empty case.
	echo: boolean;
	echoNames?: string[];
	// A blessing rode with this dig and minted +1 (blessed_dig). Server-
	// authoritative (`r.blessed`) when pushed; falls back to the session's
	// open-time blessing so the line still shows against an un-pushed server.
	blessed: boolean;
	milestone?: { threshold: number; title_id: string } | null;
	// The unique relic this dig surfaced (null unless one was carried + claimed).
	// `new` lights a fresh Burrow Book entry; else it's a dupe with found_count.
	uniqueFound?: { id: string; new: boolean; found_count: number } | null;
	// "The One That Got Away" outcomes (null → nothing this dig / feature-dark):
	//   carryCaught — the find you almost had was CAUGHT (gild paid extra drain).
	//   carryNext   — a new miss was re-buried; it comes back gilded next feeding.
	carryCaught?: { kind: string; gild: number } | null;
	carryNext?: { kind: string; gild: number } | null;
	practice: boolean;
	// "Beginner's snout": the one-time real Golden Truffle granted on the FIRST
	// practice dig (claim_beginners_snout). >0 → show the gift line; null/0 →
	// already claimed, migration unpushed, or not the first practice dig — the
	// end-card just omits the line (fail-soft). Only ever set on practice digs.
	snoutGift?: number | null;
}

type OpenPayload = {
	already?: boolean;
	seed: number;
	window_index: number;
	window_ends_at?: string;
	opened_at?: string;
	coop?: boolean;
	blessed?: boolean;
	crew_dug?: CrewDug[];
	// The relic id the server buried on this board, or null/absent (feature-dark).
	unique_id?: string | null;
	// The caller's carry slot re-buried on this board, or null/absent (feature-dark).
	carry?: { kind: string; unique_id: string | null; gild: number } | null;
};
type SubmitPayload = {
	credited: string[];
	truffles: number;
	echo_names: string[];
	// Added by 20260755000000_receipt_mint_breakdown — the function's own
	// my_echo / blessed flags, so the receipt can account for every minted
	// truffle. Optional here: an un-pushed server simply omits them (fail-soft).
	echo?: boolean;
	blessed?: boolean;
	drain_total: number;
	milestone: { threshold: number; title_id: string } | null;
	unique_found?: { id: string; new: boolean; found_count: number } | null;
	carry_caught?: { kind: string; gild: number } | null;
	carry_next?: { kind: string; gild: number } | null;
};

// A carry payload kind we trust (guards a malformed/foreign server value).
const CARRY_KINDS = new Set(["truffle_l", "truffle_d", "unique"]);
function toCarry(
	c: { kind: string; unique_id: string | null; gild: number } | null | undefined
): RootingCarry | null {
	if (!c || !CARRY_KINDS.has(c.kind)) return null;
	return {
		kind: c.kind as RootingCarry["kind"],
		uniqueId: c.unique_id ?? null,
		gild: typeof c.gild === "number" ? c.gild : 1,
	};
}

// Reasons that mean "the server doesn't have the Patch yet" (migration
// unpushed) rather than a gameplay refusal.
const MISSING_RPC_REASONS = new Set(["network", "no_data"]);

// The per-user cold-start mirror key (dugMirrorKey) and the reconcile debounce
// (RECONCILE_MIN_MS / shouldReconcile) now live in utils/digSession alongside the
// state machine they serve.

// The caller's user id for the mirror, or null when signed out (no mirror then —
// real digs require auth anyway; practice contexts just skip persistence).
async function mirrorUid(): Promise<string | null> {
	try {
		const { data } = await supabase.auth.getSession();
		return data.session?.user?.id ?? null;
	} catch {
		return null;
	}
}

// One-shot local flag: the first practice dig tries claim_beginners_snout()
// exactly once per install so we never re-hit the RPC on every practice run.
// (The server is idempotent too — this just spares the round-trip.)
const SNOUT_TRIED_KEY = "beginners_snout_tried_v1";

// Claim the one-time beginner's snout on the FIRST practice dig only. Returns
// the number of truffles actually granted (>0), or null when it shouldn't show
// a line (already tried locally, already claimed server-side, or the migration
// isn't pushed yet — rpcAction reason network/no_data/unknown). Fail-soft: any
// miss just yields null so the end-card omits the gift line.
async function claimBeginnersSnoutOnce(): Promise<number | null> {
	try {
		const tried = await AsyncStorage.getItem(SNOUT_TRIED_KEY);
		if (tried) return null;
		await AsyncStorage.setItem(SNOUT_TRIED_KEY, "1");
	} catch {
		// Storage hiccup — attempt the claim anyway; the server stays idempotent.
	}
	const r = await rpcAction<{ granted: number; balance: number }>(
		"claim_beginners_snout"
	);
	if (r.ok && typeof r.granted === "number" && r.granted > 0) return r.granted;
	return null;
}

export function useRooting() {
	// The dig-session state machine — every transition lives in the pure
	// digSessionReducer (utils/digSession); this hook is its React/AsyncStorage/RPC
	// adapter. `session`, `dugWindow` and `noCrew` all read off the reducer state.
	const [state, dispatch] = useReducer(digSessionReducer, initialDigSessionState);
	const { session, noCrew } = state;
	const win = windowIndex();
	// Derived + expiring: isDugThisWindow re-compares the recorded dug WINDOW
	// against the live clock, so the flag clears itself at the next window
	// rolls over (the founder's "still dug two hours later" bug).
	const dugThisWindow = isDugThisWindow(state);

	// "Already dug" is server-authoritative (open_rooting says already), but we
	// mirror it in AsyncStorage so the strip renders right on cold start. The
	// mirror is per-user: signed out → no uid → no mirror (dug stays false).
	// Re-reads when the window rolls (the new window's key won't exist yet).
	useEffect(() => {
		let cancelled = false;
		(async () => {
			const uid = await mirrorUid();
			if (!uid) return;
			const v = await AsyncStorage.getItem(dugMirrorKey(uid, win));
			if (!cancelled && v) dispatch({ type: "mirror_hydrated", window: win });
		})();
		return () => {
			cancelled = true;
		};
	}, [win]);

	// Server reconciliation — one cheap feeding_state() read that makes the
	// server's "did I dig this window" (keyed by ITS window_index, the same
	// offset-anchored floor((epoch - 7200)/28800) the client mirrors)
	// authoritative over local state.
	// Fired on window rollover and app foreground (useFeedingCta's AppState
	// listener). Fail-soft: a missing RPC / transport error keeps local state;
	// debounced so rapid fg/bg flips don't spam the poll.
	const lastReconcileRef = useRef(0);
	const reconcile = useCallback(async () => {
		const now = Date.now();
		if (!shouldReconcile(lastReconcileRef.current, now)) return;
		lastReconcileRef.current = now;
		try {
			const fs = await fetchFeedingState();
			if (!fs) return; // migration unpushed / transport hiccup — keep local
			// The reducer owns the reconcile DECISION (adopt a dug window / retire a
			// matching stale claim); the hook mirrors that decision into AsyncStorage.
			dispatch({ type: "reconciled", dug: fs.dug, window: fs.window_index });
			const uid = await mirrorUid();
			if (uid) {
				if (fs.dug) {
					await AsyncStorage.setItem(dugMirrorKey(uid, fs.window_index), "1");
				} else {
					await AsyncStorage.removeItem(dugMirrorKey(uid, fs.window_index));
				}
			}
		} catch {
			// fail-soft — reconciliation is a best-effort truth sync, never a gate.
		}
	}, []);

	// Rollover (and mount) reconcile: the derived flag above already flips the
	// UI the moment `win` advances; this re-syncs with the server in the
	// background (also heals a dig made on another device).
	useEffect(() => {
		reconcile();
	}, [win, reconcile]);

	const open = useCallback(async (): Promise<
		RpcResult<{ session: RootingSession }>
	> => {
		const r = await rpcAction<OpenPayload>("open_rooting");
		if (r.ok) {
			const s: RootingSession = {
				seed: r.seed,
				windowIndex: r.window_index,
				windowEndsAtMs: r.window_ends_at
					? new Date(r.window_ends_at).getTime()
					: windowEndsAtMs(r.window_index),
				practice: false,
				coop: r.coop ?? false,
				blessed: r.blessed ?? false,
				crewDug: r.crew_dug ?? [],
				// Absent (server not migrated) → null → the board carries no unique.
				uniqueId: r.unique_id ?? null,
				carry: toCarry(r.carry),
			};
			// A real server success clears the crewless flag; alreadyDug captures the
			// SERVER's window index (not the client clock) for the one-dig-per-feeding
			// rule the two should agree on.
			dispatch({ type: "opened", session: s, alreadyDug: r.already, clearNoCrew: true });
			return { ok: true, session: s };
		}
		if (r.reason === "no_crew") {
			dispatch({ type: "open_no_crew" });
			return { ok: false, reason: r.reason };
		}
		if (r.reason === "already_rooted") {
			dispatch({ type: "open_already_rooted", window: win });
			return { ok: false, reason: r.reason };
		}
		if (MISSING_RPC_REASONS.has(r.reason)) {
			// Practice patch — identical board, nothing minted. Leaves noCrew as-is
			// (a crewless player practicing is still crewless).
			const s: RootingSession = {
				seed: practiceSeed("patch", win),
				windowIndex: win,
				windowEndsAtMs: windowEndsAtMs(win),
				practice: true,
				coop: false,
				blessed: false,
				crewDug: [],
				uniqueId: null, // no uniques in practice
				carry: null, // no carry-over in practice
			};
			dispatch({ type: "opened", session: s });
			return { ok: true, session: s };
		}
		return { ok: false, reason: r.reason };
	}, [win]);

	const submit = useCallback(
		async (
			finds: ClaimableFind[],
			actions: number,
			// Carry-eligible finds the component saw partially revealed but never
			// collected — sent as p_missed so the server can re-bury the one that got
			// away (gilded). Omitted/[] → no carry-next this dig.
			missed: ClaimableFind[] = []
		): Promise<RpcResult<{ outcome: RootingOutcome }>> => {
			if (!session) return { ok: false, reason: "no_session" };
			// LAST GATE: p_finds must be a REAL array of THIS seed's server-valid
			// ids no matter what shape arrived at runtime (a bare "shimmer" string
			// reached PostgREST as a scalar on device → 22P02 malformed array
			// literal). Normalize, then re-intersect against the seeded board.
			const board = generateBoard(session.seed, session.uniqueId);
			const safeFinds = claimableFinds(
				board,
				normalizePouch(finds as unknown as Parameters<typeof normalizePouch>[0])
			);
			// p_missed is board-intersected the same way (a forged/foreign id can
			// never leave the client) and stripped of anything actually caught.
			const caught = new Set(safeFinds);
			const safeMissed = claimableFinds(
				board,
				normalizePouch(missed as unknown as Parameters<typeof normalizePouch>[0])
			).filter((f) => !caught.has(f));
			const markDug = async () => {
				// Route through the reducer's single lockout gate — a real submit records
				// the session's SERVER-issued window (the flag then expires on its own at
				// rollover, isDugThisWindow).
				dispatch({ type: "submit_landed", practice: false });
				// Persist the per-user cold-start mirror; signed out (no uid) → skip —
				// the in-memory window above still covers the live session.
				const uid = await mirrorUid();
				if (uid) await AsyncStorage.setItem(dugMirrorKey(uid, session.windowIndex), "1");
			};
			if (session.practice) {
				const truffles = safeFinds.filter(
					(f) => f === "truffle_l" || f === "truffle_d"
				).length;
				// A practice dig banks nothing and is freely replayable — it must NOT
				// persist the real-dig cold-start mirror (rooting_done_${win}). It used
				// to call markDug(), so a fresh player who practiced then founded a
				// Sounder in the SAME feeding window saw the crewed card mistake that
				// practice for a real dig ("dug this feeding — opens in …") and got
				// locked out of their first real dig. The server never records a
				// practice dig, so the local mirror was the only thing lying.
				//
				// The first practice dig mints one REAL Golden Truffle so the
				// onboarding value screen isn't hypothetical. Fail-soft: null when
				// already claimed / not the first practice / migration unpushed.
				const snoutGift = await claimBeginnersSnoutOnce();
				// Route the practice submit through the SAME lockout gate as a real one —
				// the reducer refuses to record the dug flag for practice, so the gate
				// can't be bypassed (the crewed-card lockout incident). No-op by design.
				dispatch({ type: "submit_landed", practice: true });
				return {
					ok: true,
					outcome: {
						drain: Math.min(2, truffles),
						credited: truffles,
						truffles: truffles > 0 ? 1 : 0,
						echo: false,
						blessed: false,
						milestone: null,
						uniqueFound: null, // no uniques banked in practice
						carryCaught: null,
						carryNext: null,
						practice: true,
						snoutGift,
					},
				};
			}
			const r = await rpcAction<SubmitPayload>("submit_rooting", {
				p_finds: safeFinds,
				p_actions: actions,
				p_missed: safeMissed,
			});
			if (!r.ok) {
				if (r.reason === "already_rooted") {
					await markDug();
					await cancelOpenReminder();
				}
				return { ok: false, reason: r.reason };
			}
			await markDug();
			await cancelOpenReminder();
			// The onboarding funnel's FIRST_DIG → DONE boundary — stamp that this
			// player has dug for real at least once (per-user, fail-soft). Derived,
			// not authoritative: the step machine reads this stamp so it retires the
			// step surfaces the moment a crewed player's first real dig lands.
			{
				const { data: sess } = await supabase.auth.getSession();
				await markFirstRealDig(sess.session?.user?.id ?? null);
			}
			return {
				ok: true,
				outcome: {
					drain: r.drain_total,
					credited: r.credited?.length ?? 0,
					truffles: r.truffles,
					// Server-authoritative echo/blessed when the mint-breakdown
					// migration is pushed; fail-soft to the old signals otherwise.
					echo: r.echo ?? (r.echo_names?.length ?? 0) > 0,
					blessed: r.blessed ?? session.blessed,
					echoNames: r.echo_names,
					milestone: r.milestone,
					uniqueFound: r.unique_found ?? null,
					carryCaught: r.carry_caught ?? null,
					carryNext: r.carry_next ?? null,
					practice: false,
				},
			};
		},
		[session]
	);

	const clear = useCallback(() => dispatch({ type: "cleared" }), []);

	// DEV-ONLY practice opener: dig any time, ignoring the 4h-open/4h-guarded
	// phase gate and the one-dig-per-feeding rule. Seeded off the current
	// minute so every open deals a fresh board; practice sessions mint nothing
	// (submit()'s practice branch), so this can never touch the real economy.
	// Call sites must gate on __DEV__ — this hook stays behavior-neutral.
	const openPractice = useCallback((): RootingSession => {
		const s: RootingSession = {
			seed: practiceSeed("dev", Math.floor(Date.now() / 60000)),
			windowIndex: win,
			windowEndsAtMs: windowEndsAtMs(win),
			practice: true,
			coop: false,
			blessed: false,
			crewDug: [],
			uniqueId: null,
			carry: null,
		};
		dispatch({ type: "opened", session: s });
		return s;
	}, [win]);

	return { session, dugThisWindow, noCrew, open, openPractice, submit, clear, reconcile };
}

// Season tab state for the caller — the season_state fetch, the profile read it
// rides alongside (alignment_score + tickles_earned), the memoized derivations
// (via utils/seasonPass), and the claim / claim-all / wallow actions. Mirrors
// useCrew: initial + focus refresh, flat action functions, a single in-flight
// (busy) guard.
//
// SEAM: the actions return STRUCTURED results — a discriminated claim result, the
// claim-all tally, the wallow RpcResult — and NOTHING user-facing. All UI stays
// in app/(tabs)/season.tsx: the dialog copy (title/body maps), the summary-text
// building, the mystery-reveal staging, the claim chime + haptic. The screen maps
// each structured result to its existing dialogs, so behavior is unchanged. busy
// lives here (the guard every action funnels through); the screen reads it to
// disable the wallow + claim-all buttons and calls refresh() at the original beat.
//
// SERVER-SIDE CLAIM ROUTING (Season Pass refactor, phase 3): the two claim
// actions now speak the CONSOLIDATION RPCs from migration
// 20260773000000_claim_season_consolidation — `claim_season_tier` (one tier) and
// `claim_ready_tiers` (sweep every ready tier in one transaction). The server now
// owns the prestige-vs-normal decision and the track resolution that the client
// used to derive; we still pass the screen's resolved track as a HINT (prestige
// forces free server-side, a normal claim derives premium-vs-free server-side).
// claim_season_tier returns a SUPERSET of the old per-tier claim response, so the
// RawClaim → ClaimResult mapping below is unchanged; claim_ready_tiers returns a
// jsonb tally that tallyFromRpc folds into the existing ClaimAllTally.
//
// A null from rpc() is an ordinary FAILURE (transport blip, or a refusal that
// didn't reach us) — not a signal to re-derive the claim client-side. A single
// claim surfaces {ok:false, reason:"network"}, which the screen already renders
// as its "Couldn't claim / give it another tap" fallback; claim-all folds the
// null through tallyFromRpc into a zeroed tally, so nothing is reported as
// claimed. Both are safe to retry: every claimer is idempotent server-side.

import { useCallback, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "expo-router/react-navigation";
import { supabase } from "@/utils/supabase";
import { rpc, rpcAction, RpcResult } from "@/utils/rpc";
import * as seasonPass from "@/utils/seasonPass";
import type {
	NextReward,
	SeasonState,
	TiersByNumber,
} from "@/utils/seasonPass";
import type { MysteryBoxRevealPayload } from "@/components/MysteryHatReveal";

// The raw claim RPC response — the same shape for claim_tier_reward and
// claim_wallow_tier. Mystery-box claims carry their grant on it.
interface MoteClaimFields {
	reward_type?: string;
	motes_granted?: number;
	motes_balance?: number;
}

type RawClaim =
	| ({ ok: boolean; reason?: string; current_tier?: number } & MysteryBoxRevealPayload & MoteClaimFields)
	| null;

// A claim outcome the screen maps to its dialogs. Success carries current_tier +
// the mystery grant (if any); failure carries the reason the title/body maps key
// on. A transport miss (raw null) collapses to reason "network", which isn't in
// the screen's maps — so it renders the same "Couldn't claim / give it another
// tap" fallback the raw-null path always did.
export type ClaimResult =
	| ({ ok: true; current_tier?: number } & MysteryBoxRevealPayload & MoteClaimFields)
	| { ok: false; reason: string; current_tier?: number };

// The claim-all tally. The screen turns this into its one summary beat (the
// "N rewards — X tickles + the Reed Hat" line) and stages lastMystery to follow.
export interface ClaimAllTally {
	reason?: string;
	claimedCount: number;
	failed: number;
	tickles: number;
	motes: number;
	motesBalance?: number;
	items: string[];
	lastMystery: MysteryBoxRevealPayload | null;
}

// The raw jsonb claim_ready_tiers returns. The success tally carries snake_case
// keys (claimed_count / failed / tickles / items / mysteries); a business refusal
// (unauthenticated / no_active_season) instead returns {ok:false, reason} with no
// tally fields — tallyFromRpc fail-softs those to a zeroed tally.
type RawClaimAll = {
	ok?: boolean;
	reason?: string;
	claimed_count?: number;
	failed?: number;
	tickles?: number;
	motes?: number;
	motes_balance?: number;
	items?: string[];
	mysteries?: MysteryBoxRevealPayload[];
} | null;

// Fold claim_ready_tiers' jsonb into the screen-facing ClaimAllTally. Pure +
// exported for unit tests. Key mapping is 1:1 except the tail: the server sends
// EVERY mystery-box grant as `mysteries[]`, the screen surfaces only the LAST, so
// lastMystery = the final element (or null when none). Every field is defaulted so
// a missing key / an {ok:false} refusal / a foreign shape degrades to zeros rather
// than throwing (fail-soft, matching the transport-miss path).
export function tallyFromRpc(raw: RawClaimAll): ClaimAllTally {
	const mysteries = Array.isArray(raw?.mysteries) ? raw!.mysteries! : [];
	return {
		...(raw?.ok === false && raw.reason ? { reason: raw.reason } : {}),
		claimedCount: raw?.claimed_count ?? 0,
		failed: raw?.failed ?? 0,
		tickles: raw?.tickles ?? 0,
		motes: raw?.motes ?? 0,
		...(raw?.motes_balance !== undefined ? { motesBalance: raw.motes_balance } : {}),
		items: Array.isArray(raw?.items) ? raw!.items! : [],
		lastMystery: mysteries.length ? mysteries[mysteries.length - 1] : null,
	};
}

// The wallow RPC's success payload.
export interface WallowFields {
	wallow_count: number;
	power_level: number;
	regen_percent: number;
	regen_seconds: number;
}

export interface UseSeason {
	state: SeasonState | null;
	// True when the last season_state read came back null (timeout/offline).
	loadError: boolean;
	busy: boolean;
	uid: string | null;
	alignmentScore: number;
	ticklesEarned: number | null;
	refresh: () => Promise<void>;
	// Derived (state-only) — the screen composes shownTrack / readyTiers from
	// these plus its own passTrack via utils/seasonPass.
	prestigeMode: boolean;
	claimedSet: Set<string>;
	tiersByNumber: TiersByNumber;
	wallowClaimedSet: Set<string>;
	wallowTiersByNumber: TiersByNumber;
	nextReward: NextReward | null;
	// Actions over the consolidation RPCs. null = the in-flight guard skipped
	// (or, for claimAll, nothing to claim) — the screen shows nothing.
	claim: (tier: number, track: "free" | "premium") => Promise<ClaimResult | null>;
	claimAll: (
		tiers: number[],
		track: "free" | "premium"
	) => Promise<ClaimAllTally | null>;
	wallow: () => Promise<RpcResult<WallowFields> | null>;
}

export function useSeason(): UseSeason {
	const [state, setState] = useState<SeasonState | null>(null);
	const [busy, setBusy] = useState(false);
	// A season_state read that came back null (timeout, offline) — the screen
	// shows an error with a retry instead of reading the season forever.
	// (2026-09-11 screen review)
	const [loadError, setLoadError] = useState(false);
	const [uid, setUid] = useState<string | null>(null);
	// The alignment placard + YOUR TAKE tickle cell read off the profile, fetched
	// alongside season_state (getSession is cached, so no extra round-trip beyond
	// the profile select). null tickles until the profile lands → a quiet dash.
	const [alignmentScore, setAlignmentScore] = useState(0);
	const [ticklesEarned, setTicklesEarned] = useState<number | null>(null);

	// The single in-flight guard — a ref (not busy state) so rapid double-taps are
	// rejected synchronously, before setBusy's async commit lands.
	const busyRef = useRef(false);
	const readVersion = useRef(0);
	const updateMotes = useCallback((balance: number | undefined) => {
		if (balance === undefined) return;
		readVersion.current += 1;
		setState((current) => current ? { ...current, motes: balance } : current);
	}, []);

	const refresh = useCallback(async () => {
		const version = ++readVersion.current;
		const data = await rpc<SeasonState>("season_state");
		if (version === readVersion.current) {
			if (data) {
				setState(data);
				setLoadError(false);
			} else {
				setLoadError(true);
			}
		}
		// Alignment placard reads the player's score directly off the profile
		// (season_state doesn't carry it).
		const { data: sess } = await supabase.auth.getSession();
		const id = sess.session?.user?.id;
		setUid(id ?? null);
		if (id) {
			const { data: prof } = await supabase
				.from("profiles")
				.select("alignment_score, tickles_earned")
				.eq("id", id)
				.single();
			const p = prof as { alignment_score?: number; tickles_earned?: number } | null;
			setAlignmentScore(p?.alignment_score ?? 0);
			setTicklesEarned(p?.tickles_earned ?? 0);
		}
	}, []);

	useFocusEffect(
		useCallback(() => {
			refresh();
		}, [refresh])
	);

	// ── Derivations (memoized calls into the pure module) ──────────────────────
	const claimedSet = useMemo(() => seasonPass.claimedSet(state?.claims), [state?.claims]);
	const tiersByNumber = useMemo(() => seasonPass.tiersByNumber(state?.tiers), [state?.tiers]);
	const wallowClaimedSet = useMemo(
		() => seasonPass.wallowClaimedSet(state?.wallow_claims),
		[state?.wallow_claims]
	);
	const wallowTiersByNumber = useMemo(
		() => seasonPass.wallowTiersByNumber(state?.wallow_tiers),
		[state?.wallow_tiers]
	);
	const prestigeMode = seasonPass.prestigeMode(state);
	const nextReward = useMemo(
		() =>
			seasonPass.nextReward(state, {
				prestige: prestigeMode,
				tiersByNumber,
				claimedSet,
				wallowTiersByNumber,
				wallowClaimedSet,
			}),
		[state, prestigeMode, tiersByNumber, claimedSet, wallowTiersByNumber, wallowClaimedSet]
	);

	const claim = useCallback(
		async (tier: number, track: "free" | "premium"): Promise<ClaimResult | null> => {
			if (busyRef.current) return null;
			busyRef.current = true;
			setBusy(true);
			// The server resolves prestige-vs-normal + track. We pass the screen's
			// resolved track as a hint (prestige forces free server-side; a normal claim
			// derives premium-vs-free server-side).
			const r = await rpc<RawClaim>("claim_season_tier", {
				target_tier: tier,
				target_track: track,
				...(state?.motes !== undefined ? {
					expected_season_id: state.season?.id,
					expected_wallow_lap: state.season_wallow_count ?? 0,
				} : {}),
			});
			busyRef.current = false;
			setBusy(false);
			// A null is an ordinary failure — reason "network", which the screen's
			// dialog maps don't key on, so it renders the generic retry copy.
			if (!r) return { ok: false, reason: "network" };
			if (!r.ok) return { ok: false, reason: r.reason ?? "", current_tier: r.current_tier };
			updateMotes(r.motes_balance);
			return { ...r, ok: true };
		},
		[state, updateMotes]
	);

	const claimAll = useCallback(
		async (tiers: number[], track: "free" | "premium"): Promise<ClaimAllTally | null> => {
			if (busyRef.current) return null;
			// `tiers` (the screen's readyTiers) survives ONLY as the no-op guard — the
			// server decides what's actually ready; we never send the list.
			if (tiers.length === 0) return null;
			busyRef.current = true;
			setBusy(true);
			// ONE transaction claims every ready tier server-side. Track is a hint;
			// prestige + track resolve server-side exactly as claim_season_tier.
			const raw = await rpc<RawClaimAll>("claim_ready_tiers", {
				target_track: track,
				...(state?.motes !== undefined ? {
					expected_season_id: state.season?.id,
					expected_wallow_lap: state.season_wallow_count ?? 0,
				} : {}),
			});
			// tallyFromRpc fail-softs a null (transport miss) into a zeroed tally, so a
			// failed sweep reports nothing claimed rather than a phantom haul.
			const tally = tallyFromRpc(raw);
			updateMotes(tally.motesBalance);
			busyRef.current = false;
			setBusy(false);
			return tally;
		},
		[state, updateMotes]
	);

	const wallow = useCallback(async (): Promise<RpcResult<WallowFields> | null> => {
		if (busyRef.current) return null;
		busyRef.current = true;
		setBusy(true);
		const r = await rpcAction<WallowFields>("wallow");
		busyRef.current = false;
		setBusy(false);
		return r;
	}, []);

	return {
		state,
		loadError,
		busy,
		uid,
		alignmentScore,
		ticklesEarned,
		refresh,
		prestigeMode,
		claimedSet,
		tiersByNumber,
		wallowClaimedSet,
		wallowTiersByNumber,
		nextReward,
		claim,
		claimAll,
		wallow,
	};
}

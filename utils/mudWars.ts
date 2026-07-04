// Sounder Mud Fights — client RPC layer + pure helpers.
//
// Mirrors utils/activeEffects.ts: typed wrappers concentrate the RPC
// names + result shapes for the new crew/war RPCs (see
// supabase/migrations/20260647000000_mud_fights.sql). Query RPCs use
// rpc<T>(); action RPCs use rpcAction<T>() so every caller branches on
// the same { ok, reason } shape. Pure helpers (perCapita, formatCountdown)
// live here so they're trivially unit-testable; the stateful hooks
// (useCrew, useMudWar) compose them in hooks/.

import { rpc, rpcAction, RpcResult } from "./rpc";
import { supabase } from "./supabase";
import { DAILY_ALLOTMENT } from "@/constants/mudFights";
import { type Rarity } from "@/constants/hats";

// ── Types ───────────────────────────────────────────────────────────────────

export interface Crew {
	id: string;
	name: string;
	leader_id: string | null;
	is_bot: boolean;
}

export interface CrewMember {
	user_id: string;
	username: string | null;
	role: "leader" | "member";
	active_title: string | null;
}

export interface InviteIn {
	id: string;
	crew_id: string;
	crew_name: string;
	inviter_id: string;
	inviter_name: string | null;
}

export interface InviteOut {
	id: string;
	invitee_id: string;
	invitee_name: string | null;
}

export interface CrewState {
	crew: Crew | null;
	members: CrewMember[];
	invitesIn: InviteIn[];
	invitesOut: InviteOut[];
	inWar: boolean;
	warId: string | null;
}

export interface WarSideMember {
	user_id: string;
	username: string | null;
	slings: number;
}

export interface WarSide {
	crew: { id: string; name: string; is_bot: boolean } | null;
	members: WarSideMember[];
	total: number;
	active: number | null;
	perCapita: number;
	quorumMet: boolean;
}

export type WarStatus = "pending" | "active" | "resolved" | "declined";

// ── Fronts (Phase 1c) — the contested-Blotto layer (war_fronts_state) ─────────
// Present on WarState.fronts only when the war is fronts_enabled. The board shows
// my own live mud per front; the opponent's allocation is fogged until a day folds
// (then it surfaces in `recap`). Mirrors war_fronts_state in 20260667.
export type PBand = "light" | "medium" | "heavy";

export interface FrontCell {
	front_key: string;
	value: number;          // V (rope notches if held)
	p_band: PBand;          // fuzzy hold-pressure hint (exact P hidden until fold)
	mineMud: number;        // my crew's capped effMud on this front today
	mineCommitters: number; // how many of my crew are committed here
}
export interface FrontPlan {
	front_key: string;
	locked: boolean;        // flips true on my first throw of the day
}
// The deployed-wave difficulty an opponent (or the bot) maps onto an area.
export type Difficulty = "easy" | "med" | "hard";

// The two recap shapes the server can send (war_fronts_state, post-fold):
//  • fronts (head-to-head, non-rhythm): a single fold winner per front.
//  • rhythm (mirror): each side holds independently vs the OTHER's deployed
//    pressure; the wave that attacked MY area is revealed (attackingMe).
// They're discriminated by DayRecap.mode so the board can render either.
export interface RecapFrontFronts {
	front_key: string;
	value: number;
	mineMud: number;
	themMud: number;                          // revealed only post-fold
	winner: "mine" | "them" | "none";         // server's authoritative fold outcome
}
export interface RecapFrontRhythm {
	front_key: string;
	value: number;
	mineMud: number;
	themMud: number;                          // revealed only post-fold
	mineHeld: boolean;                        // did I clear my area's hold-pressure?
	themHeld: boolean;                        // did the opponent clear theirs?
	attackingMe: Difficulty;                  // the hidden wave the opponent sent at MY area
	iDeployed: Difficulty;                    // the wave I sent at THEIR area
}
export type RecapFront = RecapFrontFronts | RecapFrontRhythm;
export interface DayRecap {
	day: string;
	mode?: "fronts" | "rhythm";   // absent on pre-rhythm servers -> treat as "fronts"
	fronts: RecapFront[];
}
export interface FrontsState {
	phase?: WarPhase;             // 'build' (Tend) | 'war' (Hold) | a terminal status
	board: FrontCell[];           // ordered by value desc
	myPlan: FrontPlan | null;
	myDeploy: Record<string, Difficulty> | null; // MY crew's deploy today (front_key -> diff); null until set
	accessTokens: number;         // my extra Hold-run attempts today (from barn visits)
	redeployUsed: boolean;        // my crew's one-per-war redeploy token spent?
	weeklyModifier: string | null;
	recap: DayRecap | null;       // last folded day, both sides revealed
}

// Phase of a rhythm war: Tend (build via the toss) -> Hold (defend via runs).
// On a non-rhythm war the server reports 'war' throughout; a terminal status
// (resolved/declined) can also surface here.
export type WarPhase = "build" | "war" | WarStatus;

export interface WarState {
	warId: string;
	status: WarStatus;
	endsAt: string | null;
	isBotWar: boolean;
	winnerCrew: string | null;
	iAmChallenger: boolean;
	myRemainingToday: number;   // legacy tap model (sling_mud fallback)
	myThrowsRemaining: number;  // throw-minigame budget (THROWS_PER_DAY - used today)
	ropePos?: number;           // daily-tug rope (challenger-positive notches; Phase 1b)
	ropeNorm?: number;          // rope normalized to the caller's POV, -1..1 (+ = me ahead)
	frontsEnabled?: boolean;    // this war uses the Fronts layer (Phase 1c)
	rhythmEnabled?: boolean;    // this war uses the Rhythm layer (Phase 1d; implies frontsEnabled)
	phase?: WarPhase;           // 'build' (Tend) | 'war' (Hold) | a terminal status
	buildEndsAt?: string | null; // Tend->Hold boundary (started_at + 48h); null on non-rhythm
	fronts?: FrontsState | null; // present iff frontsEnabled
	mine: WarSide;
	them: WarSide;
}

// The clan ladder — crew_leaderboard ("list of clans with relative strength").
export interface LadderEntry {
	crew_id: string;
	name: string;
	rating: number;
	wars_played: number;
	provisional: boolean;  // first 3 wars (high-K, unranked-ish)
	memberCount: number;
}

// The 4 outcome bands of a mud throw. The CLIENT classifies the release into a
// band and sends the ENUM; the SERVER owns the band->points map (whiff/weak/
// good/perfect -> 0/1/2/3) so a forged band can't beat honest play. This mirror
// is used only for the optimistic local bump.
export type MudBand = "whiff" | "weak" | "good" | "perfect";
export const BAND_POINTS: Record<MudBand, number> = { whiff: 0, weak: 1, good: 2, perfect: 3 };

export interface ChallengeableCrew {
	id: string;
	name: string;
	memberCount: number;
}

// An open Sounder the caller could join without an invite: has a free slot,
// at least one member, and no live war (find_joinable_crews mirrors these).
export interface JoinableCrew {
	id: string;
	name: string;
	memberCount: number;
	leaderName: string | null;
}

// Which Sounder a friend of the caller is in (friends_crews). Friends with
// no crew simply don't appear.
export interface FriendCrew {
	friend_id: string;
	crew_id: string;
	crew_name: string;
	memberCount: number;
}

// A row of the Sounder standings (sounder_standings) — spirit (7-day
// activity + intra-crew kindness, per snout) plus the scuffle elo
// (crew_ratings; null before a crew's first scuffle) and the roster for
// the expandable leaderboard rows.
export interface SpiritEntry {
	crew_id: string;
	name: string;
	memberCount: number;
	kindness: number;
	activity: number;
	spirit: number;
	rating: number | null;
	wars: number | null;
	members: { username: string | null; role: "leader" | "member" }[];
}

// ── Query wrappers (rpc<T>) ──────────────────────────────────────────────────
// Each always resolves to a usable rest-state value (null/empty on error),
// matching fetchActiveEffects' "no useful distinction at the render layer".

const EMPTY_CREW_STATE: CrewState = {
	crew: null,
	members: [],
	invitesIn: [],
	invitesOut: [],
	inWar: false,
	warId: null,
};

export async function fetchCrewState(): Promise<CrewState> {
	const s = await rpc<Partial<CrewState>>("crew_state");
	if (!s) return EMPTY_CREW_STATE;
	return { ...EMPTY_CREW_STATE, ...s };
}

export async function fetchWarState(warId?: string): Promise<WarState | null> {
	// my_war() finds the caller's current war; war_state(id) targets one.
	return warId
		? await rpc<WarState>("war_state", { p_war: warId })
		: await rpc<WarState>("my_war");
}

export async function fetchChallengeable(): Promise<ChallengeableCrew[]> {
	return (await rpc<ChallengeableCrew[]>("find_challengeable_crews")) ?? [];
}

export async function fetchJoinable(): Promise<JoinableCrew[]> {
	return (await rpc<JoinableCrew[]>("find_joinable_crews")) ?? [];
}

export async function fetchFriendsCrews(): Promise<FriendCrew[]> {
	return (await rpc<FriendCrew[]>("friends_crews")) ?? [];
}

export async function fetchSounderStandings(limit = 50): Promise<SpiritEntry[]> {
	return (await rpc<SpiritEntry[]>("sounder_standings", { p_limit: limit })) ?? [];
}

// The war-exclusive cosmetic the caller won from a given war, if any.
// grant_war_spoils_on_resolve (20260660) drops a per-user `war_spoils`
// system_announcement carrying data.hat_id; we read it back (RLS: own
// rows only) so the resolved-war reveal can show the actual item. Returns
// null when the player earned no cosmetic (bot war, or owned them all).
export interface WonCosmetic {
	id: string;
	name: string;
	rarity: Rarity;
}

export async function fetchWarSpoils(warId: string): Promise<WonCosmetic | null> {
	const { data: auth } = await supabase.auth.getUser();
	const uid = auth.user?.id;
	if (!uid) return null;
	const { data: ann } = await supabase
		.from("system_announcements")
		.select("data")
		.eq("user_id", uid)
		.eq("kind", "war_spoils")
		.eq("data->>war_id", warId)
		.order("dispatched_at", { ascending: false })
		.limit(1)
		.maybeSingle();
	const hatId = (ann?.data as { hat_id?: string } | null)?.hat_id;
	if (!hatId) return null;
	const { data: hat } = await supabase
		.from("hats")
		.select("id, name, rarity")
		.eq("id", hatId)
		.maybeSingle();
	return hat ? { id: hat.id, name: hat.name, rarity: hat.rarity as Rarity } : null;
}

// ── Action wrappers (rpcAction<T>) ───────────────────────────────────────────

export function createCrew(name: string): Promise<RpcResult<{ crew_id: string }>> {
	return rpcAction<{ crew_id: string }>("create_crew", { p_name: name });
}
export function inviteToCrew(inviteeId: string): Promise<RpcResult<{}>> {
	return rpcAction("invite_to_crew", { p_invitee: inviteeId });
}
export function acceptInvite(inviteId: string): Promise<RpcResult<{ crew_id: string }>> {
	return rpcAction<{ crew_id: string }>("accept_crew_invite", { p_invite: inviteId });
}
export function declineInvite(inviteId: string): Promise<RpcResult<{}>> {
	return rpcAction("decline_crew_invite", { p_invite: inviteId });
}
export function leaveCrew(): Promise<RpcResult<{}>> {
	return rpcAction("leave_crew");
}
export function joinCrew(crewId: string): Promise<RpcResult<{ crew_id: string }>> {
	return rpcAction<{ crew_id: string }>("join_crew", { p_crew: crewId });
}
export function transferCrewLeadership(newLeaderId: string): Promise<RpcResult<{}>> {
	return rpcAction("transfer_crew_leadership", { p_new_leader: newLeaderId });
}
export function kickCrewMember(memberId: string): Promise<RpcResult<{}>> {
	return rpcAction("kick_crew_member", { p_member: memberId });
}
// Leader-only concede: the other side wins now, elo applies as a loss.
export function forfeitWar(warId: string): Promise<RpcResult<{}>> {
	return rpcAction("forfeit_war", { p_war: warId });
}
export function claimEcho(): Promise<RpcResult<{ tickles: number }>> {
	return rpcAction<{ tickles: number }>("claim_echo");
}

// A resolved scuffle in the crew's match history (crew_match_history).
export interface MatchEntry {
	war_id: string;
	opponent: string;
	result: "won" | "lost" | "draw";
	forfeited: boolean;
	yieldedByUs: boolean;
	ropePos: number;
	isBot: boolean;
	resolvedAt: string;
}
export async function fetchMatchHistory(limit = 20): Promise<MatchEntry[]> {
	return (await rpc<MatchEntry[]>("crew_match_history", { p_limit: limit })) ?? [];
}

// The caller's currently catchable echo (crewmate's lucky pig, <10 min,
// unclaimed) — null when the bog is quiet.
export interface EchoState {
	id: number;
	sourceName: string | null;
	expiresAt: string;
}
export async function fetchActiveEcho(): Promise<EchoState | null> {
	return (await rpc<EchoState | null>("active_echo")) ?? null;
}
export function challengeCrew(targetCrewId: string): Promise<RpcResult<{ war_id: string }>> {
	return rpcAction<{ war_id: string }>("challenge_crew", { p_target: targetCrewId });
}
export function challengeHouse(): Promise<RpcResult<{ war_id: string }>> {
	return rpcAction<{ war_id: string }>("challenge_house");
}
export function acceptChallenge(warId: string): Promise<RpcResult<{ war_id: string }>> {
	return rpcAction<{ war_id: string }>("accept_challenge", { p_war: warId });
}
export function declineChallenge(warId: string): Promise<RpcResult<{}>> {
	return rpcAction("decline_challenge", { p_war: warId });
}
export function slingMud(
	warId: string
): Promise<RpcResult<{ slings_today: number; remaining: number }>> {
	return rpcAction<{ slings_today: number; remaining: number }>("sling_mud", { p_war: warId });
}
// Throw-minigame submit: send the band ENUM; the server clamps to points + caps.
export function throwMud(
	warId: string,
	band: MudBand
): Promise<RpcResult<{ pts_awarded: number; slings_today: number; throws_remaining: number }>> {
	return rpcAction<{ pts_awarded: number; slings_today: number; throws_remaining: number }>(
		"throw_mud",
		{ p_war: warId, p_band: band }
	);
}
// ── Rhythm actions (Phase 1d) ────────────────────────────────────────────────
// Hold-run submit: send the ARRAY of up to NOTES_PER_RUN band ENUMs (one per
// scored goblin); the server maps each via the same CASE throw_mud uses, banks
// the summed normalized mud into my area, and enforces the daily RUN budget.
// Mirrors throwMud's wire-is-band-enum-only anti-cheat contract.
export function submitRun(
	warId: string,
	bands: MudBand[]
): Promise<RpcResult<{ run_pts: number; notes_scored: number; slings_today: number; runs_remaining: number; front: string }>> {
	return rpcAction<{ run_pts: number; notes_scored: number; slings_today: number; runs_remaining: number; front: string }>(
		"submit_run",
		{ p_war: warId, p_bands: bands }
	);
}
// Leader-only deploy: map this crew's one hard/med/easy wave onto the opponent's
// THREE distinct areas (a bijection). Fogged + re-choosable until the day folds.
export function setDeploy(
	warId: string,
	hardFront: string,
	medFront: string,
	easyFront: string
): Promise<RpcResult<{ deploy: { hard: string; med: string; easy: string } }>> {
	return rpcAction<{ deploy: { hard: string; med: string; easy: string } }>("set_deploy", {
		p_war: warId,
		p_hard_front: hardFront,
		p_med_front: medFront,
		p_easy_front: easyFront,
	});
}

// ── Fronts actions (Phase 1c) ────────────────────────────────────────────────
// Self-assign which front your throws land on (pre-lock only; locks on first throw).
export function setFrontPlan(warId: string, frontKey: string): Promise<RpcResult<{ front: string }>> {
	return rpcAction<{ front: string }>("set_front_plan", { p_war: warId, p_front_key: frontKey });
}
// Leader spends the crew's one redeploy token to move a (possibly locked) member.
export function redeployMember(
	warId: string,
	userId: string,
	frontKey: string
): Promise<RpcResult<{ front: string }>> {
	return rpcAction<{ front: string }>("redeploy_member", {
		p_war: warId,
		p_user: userId,
		p_front_key: frontKey,
	});
}
// The public clan ladder.
export async function fetchCrewLeaderboard(limit = 50): Promise<LadderEntry[]> {
	return (await rpc<LadderEntry[]>("crew_leaderboard", { p_limit: limit })) ?? [];
}

export function resolveWar(warId: string): Promise<RpcResult<{ winner: string | null }>> {
	return rpcAction<{ winner: string | null }>("resolve_war", { p_war: warId });
}
// DEV/TEST only — fast-forward a war to resolution (admin-gated server-side).
// Wired to a __DEV__-only button on the war screen so we can playtest the full
// arc (sling -> resolve -> spoils -> win modal) without the 5-day wait.
export function devEndWarNow(warId: string): Promise<RpcResult<{ winner: string | null }>> {
	return rpcAction<{ winner: string | null }>("dev_end_war_now", { p_war: warId });
}

// DEV/TEST only — fast-forward a rhythm war from Tend into the HOLD phase so the
// rhythm core (Hold runs + leader deploy + mirror fold) is reachable without the
// 2-day Tend wait. Admin-gated server-side. Pairs with devEndWarNow.
export function devSkipToHold(warId: string): Promise<RpcResult<{ phase: string }>> {
	return rpcAction<{ phase: string }>("dev_skip_to_hold", { p_war: warId });
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

export function perCapita(total: number, active: number | null): number {
	if (!active || active <= 0) return 0;
	return Math.round((total / active) * 10) / 10;
}

// Rope position 0..1 for the tug-of-war bar — my share of the combined
// per-capita score. 0.5 when even; clamps to [0,1]. Both-zero → centered.
export function ropePosition(mine: number, theirs: number): number {
	const sum = mine + theirs;
	if (sum <= 0) return 0.5;
	return Math.min(1, Math.max(0, mine / sum));
}

// Coarse countdown to war end ("2d 3h", "5h", "12m", "ended").
export function formatCountdown(iso: string | null): string {
	if (!iso) return "";
	const ms = new Date(iso).getTime() - Date.now();
	if (ms <= 0) return "ended";
	const mins = Math.floor(ms / 60000);
	if (mins < 60) return `${mins}m`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) {
		const m = mins % 60;
		return m ? `${hrs}h ${m}m` : `${hrs}h`;
	}
	const days = Math.floor(hrs / 24);
	const h = hrs % 24;
	return h ? `${days}d ${h}h` : `${days}d`;
}

export function remainingToday(slingsToday: number): number {
	return Math.max(0, DAILY_ALLOTMENT - slingsToday);
}

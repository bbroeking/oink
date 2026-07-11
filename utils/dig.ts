// Truffle Patch dig / feeding-window server reads.
//
// Digging is crew-gated, purely co-op vs the Great Hungerer. This is the cheap
// poll RPC that backs the feeding strip's window state (countdown + who in your
// crew has already dug this feeding). The dig session itself (open/submit) lives
// in hooks/useRooting.ts; the pure board math in utils/rooting.ts.

import { rpc } from "./rpc";
import { num, str, strOrNull, obj, nonneg } from "./jsonb";
import { MILESTONE_THRESHOLDS } from "@/constants/dig";

// A crewmate who has already dug this feeding (feeding_state / open_rooting).
export interface CrewDug {
	user_id: string;
	display_name: string;
}

export interface FeedingState {
	window_index: number;
	window_ends_at: string;
	dug: boolean;
	crew_dug: CrewDug[];
}

export async function fetchFeedingState(): Promise<FeedingState | null> {
	return await rpc<FeedingState>("feeding_state");
}

// ── Herd milestones (lifetime herd finds → re-themed dig titles) ──────────────
// Server-granted at 150 / 600 / 1800 lifetime herd finds; every current member
// earns the title + a snout purse. This is the display side: a pure mapper the
// herd-milestones row and the SounderCard summary both read so the copy can
// never drift between them. Titles mirror the migration's milestone table.
export const MILESTONE_TITLES: Record<number, string> = {
	150: "Root Rustler",
	600: "Truffle Baron",
	1800: "Hunger's Bane",
};

export interface MilestoneProgress {
	lifetimeFinds: number;
	/** Highest milestone the herd has crossed (title + threshold), or null. */
	earnedTitle: string | null;
	earnedThreshold: number | null;
	/** The next milestone still to reach; null once all are earned. */
	nextTitle: string | null;
	nextThreshold: number | null;
	/** Within-band progress toward the next milestone, 0..1 (1 when all done). */
	pct: number;
	allDone: boolean;
}

// Pure — exported for tests + every milestone surface. Thresholds come from
// MILESTONE_THRESHOLDS (client mirror of the server table); `lifetimeFinds` is
// the herd's cumulative credited finds (crew_state.lifetime_finds).
export function milestoneProgress(lifetimeFinds: number): MilestoneProgress {
	const finds = Math.max(0, Math.floor(lifetimeFinds || 0));
	let earnedThreshold: number | null = null;
	let nextThreshold: number | null = null;
	for (const t of MILESTONE_THRESHOLDS) {
		if (finds >= t) earnedThreshold = t;
		else {
			nextThreshold = t;
			break;
		}
	}
	const allDone = nextThreshold == null;
	const floor = earnedThreshold ?? 0;
	const span = allDone ? 0 : nextThreshold! - floor;
	const pct = allDone ? 1 : span <= 0 ? 0 : Math.max(0, Math.min(1, (finds - floor) / span));
	return {
		lifetimeFinds: finds,
		earnedTitle: earnedThreshold != null ? MILESTONE_TITLES[earnedThreshold] : null,
		earnedThreshold,
		nextTitle: nextThreshold != null ? MILESTONE_TITLES[nextThreshold] : null,
		nextThreshold,
		pct,
		allDone,
	};
}

// ── The Dig-Off, now a GLOBAL RACE ────────────────────────────────────────────
// A race IS a dig-off: every Sounder is automatically racing every other Sounder.
// Two boards ride the same RPC:
//   • the SEASON board — cumulative finds over the whole season (the headline
//     ranking; every non-bot crew with ≥1 find ranks, no quorum).
//   • the WEEKLY beat — a 7-day cycle anchored to MONDAY 00:00 UTC; the week's
//     best diggers (finds per digging snout) take spoils every Monday. Quorum 2
//     diggers to be ranked, 1-digger herds show unranked.
// Rank-scaled weekly spoils pay at cycle end (server-side). No challenges, no
// queue, no bot rival, no accept — entering the race is automatic.
//
// All parsing is isolated here so the UI can treat the server jsonb defensively;
// the authoritative shape is owned by the parallel migration (20260719000000).
//
// GRACEFUL FALLBACK: the RPC may not be pushed when this code first runs.
// race_standings() then resolves null (rpc() swallows the missing-function
// error) and the feature renders dark — exactly like useHungerMeter's fallback.

// Defensive jsonb coercion (fields may be missing / typed loosely) — the shared
// helpers live in utils/jsonb.ts so the rules can't drift between call sites.

// ── Server-contract types ─────────────────────────────────────────────────────
export interface RaceCycleInfo {
	key: string;
	starts_at: string;
	ends_at: string;
}

/** A ranked crew (met quorum) — carries its server-assigned rank. */
export interface RankedStanding {
	rank: number;
	crew_id: string;
	name: string;
	/** Finds per digging snout — the score. */
	avg: number;
	diggers: number;
	total_finds: number;
	roster_size: number;
}

/** A sub-quorum crew — no rank until a second snout digs. */
export interface UnrankedStanding {
	crew_id: string;
	name: string;
	avg: number;
	diggers: number;
	total_finds: number;
	roster_size: number;
}

/** My crew's own line — `rank` is null while sub-quorum. */
export interface MyStanding {
	crew_id: string;
	rank: number | null;
	avg: number;
	diggers: number;
	total_finds: number;
}

/** A crew's cumulative season line — every crew with ≥1 find ranks (no quorum). */
export interface SeasonStanding {
	rank: number;
	crew_id: string;
	name: string;
	/** Cumulative finds across the whole season — the score. */
	total_finds: number;
	diggers: number;
	roster_size: number;
}

/** My crew's own cumulative season line. */
export interface MineSeason {
	rank: number;
	total_finds: number;
}

/** The race that JUST ended, with my placement + spoils. */
export interface LastRace {
	cycle_key: string;
	rank: number;
	of: number;
	truffles_paid: number;
	cosmetic_hat_id: string | null;
}

export interface RaceStandings {
	cycle: RaceCycleInfo;
	/** Cumulative season board — the headline ranking. */
	season: SeasonStanding[];
	/** My crew's cumulative season line, or null (crewless / no finds yet). */
	mineSeason: MineSeason | null;
	ranked: RankedStanding[];
	unranked: UnrankedStanding[];
	mine: MyStanding | null;
	last: LastRace | null;
}

function parseRankedStanding(v: unknown): RankedStanding {
	const s = obj(v);
	return {
		rank: nonneg(s.rank),
		crew_id: str(s.crew_id),
		name: str(s.name, "a Sounder"),
		avg: num(s.avg),
		diggers: nonneg(s.diggers),
		total_finds: nonneg(s.total_finds),
		roster_size: nonneg(s.roster_size),
	};
}

function parseUnrankedStanding(v: unknown): UnrankedStanding {
	const s = obj(v);
	return {
		crew_id: str(s.crew_id),
		name: str(s.name, "a Sounder"),
		avg: num(s.avg),
		diggers: nonneg(s.diggers),
		total_finds: nonneg(s.total_finds),
		roster_size: nonneg(s.roster_size),
	};
}

function parseSeasonStanding(v: unknown): SeasonStanding {
	const s = obj(v);
	return {
		rank: nonneg(s.rank),
		crew_id: str(s.crew_id),
		name: str(s.name, "a Sounder"),
		total_finds: nonneg(s.total_finds),
		diggers: nonneg(s.diggers),
		roster_size: nonneg(s.roster_size),
	};
}

function parseMineSeason(v: unknown): MineSeason | null {
	if (v == null) return null;
	const s = obj(v);
	const rank = nonneg(s.rank);
	const total_finds = nonneg(s.total_finds);
	// A season line only exists once the crew has a find; drop an empty one.
	if (rank <= 0 && total_finds <= 0) return null;
	return { rank, total_finds };
}

function parseMyStanding(v: unknown): MyStanding | null {
	if (v == null) return null;
	const s = obj(v);
	const crew_id = str(s.crew_id);
	if (!crew_id) return null;
	// rank is null while sub-quorum; only a finite positive number ranks.
	const rankRaw = num(s.rank, NaN);
	const rank = Number.isFinite(rankRaw) && rankRaw > 0 ? Math.floor(rankRaw) : null;
	return {
		crew_id,
		rank,
		avg: num(s.avg),
		diggers: nonneg(s.diggers),
		total_finds: nonneg(s.total_finds),
	};
}

function parseLastRace(v: unknown): LastRace | null {
	if (v == null) return null;
	const s = obj(v);
	const cycle_key = str(s.cycle_key);
	if (!cycle_key) return null;
	return {
		cycle_key,
		rank: nonneg(s.rank),
		of: nonneg(s.of),
		truffles_paid: nonneg(s.truffles_paid),
		cosmetic_hat_id: strOrNull(s.cosmetic_hat_id),
	};
}

export function parseRaceStandings(v: unknown): RaceStandings {
	const s = obj(v);
	const c = obj(s.cycle);
	return {
		cycle: {
			key: str(c.key),
			starts_at: str(c.starts_at),
			ends_at: str(c.ends_at),
		},
		season: Array.isArray(s.season) ? s.season.map(parseSeasonStanding) : [],
		mineSeason: parseMineSeason(s.mine_season),
		ranked: Array.isArray(s.ranked) ? s.ranked.map(parseRankedStanding) : [],
		unranked: Array.isArray(s.unranked)
			? s.unranked.map(parseUnrankedStanding)
			: [],
		mine: parseMyStanding(s.mine),
		last: parseLastRace(s.last),
	};
}

// ── Fetch ─────────────────────────────────────────────────────────────────────
// race_standings() always returns an object when live; rpc() → null only when
// the function is missing (migration unpushed) or a transport error — either way
// the caller renders the feature dark. So: null here === "feature dark".
export async function fetchRaceStandings(): Promise<RaceStandings | null> {
	const raw = await rpc<Record<string, unknown>>("race_standings");
	if (!raw) return null;
	return parseRaceStandings(raw);
}

// ── Per-crew member ledger — who in a Sounder is pulling their weight ──────────
// race_crew_detail(p_crew_id) breaks one crew into its diggers: each member's
// finds THIS weekly cycle and cumulative season finds, ordered finds DESC. Backs
// the roster contribution counts on the home card and the expandable member
// breakdown under each dig-off board row.
//
// GRACEFUL FALLBACK: same story as race_standings — the RPC may not be pushed
// when this code first runs, or the crew may be unknown; either way it resolves
// null and the caller renders the feature dark (no member ledger, roster looks
// exactly as before).
export interface CrewMemberLine {
	user_id: string;
	username: string;
	/** Finds this weekly cycle. */
	finds: number;
	/** Cumulative finds across the season. */
	season_finds: number;
}
export interface RaceCrewDetail {
	cycle_key: string;
	crew_id: string;
	name: string;
	members: CrewMemberLine[];
}

function parseCrewMemberLine(v: unknown): CrewMemberLine | null {
	const s = obj(v);
	const user_id = str(s.user_id);
	// A line without a digger is noise — drop it.
	if (!user_id) return null;
	return {
		user_id,
		username: str(s.username, "a pig"),
		finds: nonneg(s.finds),
		season_finds: nonneg(s.season_finds),
	};
}

export function parseRaceCrewDetail(raw: unknown): RaceCrewDetail | null {
	if (raw == null || typeof raw !== "object") return null;
	const s = obj(raw);
	const crew_id = str(s.crew_id);
	// Unknown crew (server returns null) → no crew_id → feature dark.
	if (!crew_id) return null;
	const members = Array.isArray(s.members)
		? (s.members
				.map(parseCrewMemberLine)
				.filter((m): m is CrewMemberLine => m != null))
		: [];
	return {
		cycle_key: str(s.cycle_key),
		crew_id,
		name: str(s.name, "a Sounder"),
		members,
	};
}

export async function fetchRaceCrewDetail(
	crewId: string
): Promise<RaceCrewDetail | null> {
	const raw = await rpc<Record<string, unknown>>("race_crew_detail", {
		p_crew_id: crewId,
	});
	if (!raw) return null;
	return parseRaceCrewDetail(raw);
}

// ── Cycle math — a pure client mirror of the server's cycle window ─────────────
// A weekly cycle starts at the most recent Monday 00:00 UTC ≤ now and ends at the
// next Monday 00:00 UTC (7 days). UTC only, so DST never enters into it. Unit-
// tested against every weekday boundary.
const DAY_MS = 86_400_000;
// getUTCDay(): Sun=0 … Sat=6. The weekly race anchors on Monday (1).
function utcMidnight(ms: number): number {
	const d = new Date(ms);
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
function cycleKeyOf(ms: number): string {
	const d = new Date(ms);
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${y}${m}${day}`;
}

export interface RaceCycle {
	/** 'YYYYMMDD' of the start day (UTC). */
	key: string;
	startsAtMs: number;
	endsAtMs: number;
}

export function raceCycle(nowMs: number = Date.now()): RaceCycle {
	const midnight = utcMidnight(nowMs);
	// Walk back to the most recent Monday (≤ now's day).
	let start = midnight;
	for (let i = 0; i < 7; i++) {
		if (new Date(start).getUTCDay() === 1) break;
		start -= DAY_MS;
	}
	const end = start + 7 * DAY_MS;
	return { key: cycleKeyOf(start), startsAtMs: start, endsAtMs: end };
}

/** The weekday a cycle ENDS on — always Monday now that cycles are weekly. */
export function cycleEndWeekday(_endsAtMs?: number): "Monday" {
	return "Monday";
}

// ── Pure display helpers (exported for tests + every race surface) ─────────────

/** The score, per digging snout — one decimal, trailing ".0" dropped ("8", "8.3"). */
export function perSnoutLabel(avg: number): string {
	const n = Number.isFinite(avg) ? Math.max(0, avg) : 0;
	const r = Math.round(n * 10) / 10;
	return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** "7h" / "45m" until the race ends; "any moment" at/after the bell. */
export function formatRaceCountdown(
	endsAt: string | number | null | undefined,
	nowMs: number = Date.now()
): string {
	if (endsAt == null) return "";
	const end = typeof endsAt === "number" ? endsAt : new Date(endsAt).getTime();
	if (!Number.isFinite(end)) return "";
	const left = end - nowMs;
	if (left <= 0) return "any moment";
	const h = Math.floor(left / 3600000);
	const m = Math.floor((left % 3600000) / 60000);
	return h >= 1 ? `${h}h` : `${Math.max(1, m)}m`;
}

// ── The pinned-row selector — the standings-list spec ──────────────────────────
// Returns the exact rows to render:
//   • the top `visible` ranked rows;
//   • if my crew is ranked WITHIN them → highlighted in place (no pin);
//   • if my crew is ranked BELOW them  → a {separator} then my true-rank row,
//     appended so I always see where I stand;
//   • sub-quorum crews render as a grayed section below (mine included, marked
//     highlighted so the recruit line attaches to it).
// Pure + heavily unit-tested (in-top, overflow, unranked, crewless, ties).

export type StandingsRow =
	| {
			kind: "ranked";
			rank: number;
			crew_id: string;
			name: string;
			avg: number;
			diggers: number;
			total_finds: number;
			roster_size: number;
			highlighted: boolean;
	  }
	| { kind: "separator" }
	| {
			kind: "unranked";
			crew_id: string;
			name: string;
			avg: number;
			diggers: number;
			total_finds: number;
			roster_size: number;
			highlighted: boolean;
	  };

export interface StandingsView {
	/** Ranked rows (top `visible`), plus an optional separator + pinned my-row. */
	rows: StandingsRow[];
	/** Grayed sub-quorum crews, mine highlighted. */
	unranked: StandingsRow[];
}

function rankedRow(s: RankedStanding, highlighted: boolean): StandingsRow {
	return { kind: "ranked", ...s, highlighted };
}
function unrankedRow(s: UnrankedStanding, highlighted: boolean): StandingsRow {
	return { kind: "unranked", ...s, highlighted };
}

export function standingsRows(
	standings: RaceStandings,
	myCrewId: string | null,
	visible = 5
): StandingsView {
	const ranked = standings.ranked;
	const top = ranked.slice(0, Math.max(0, visible));
	const rows: StandingsRow[] = top.map((s) =>
		rankedRow(s, !!myCrewId && s.crew_id === myCrewId)
	);

	// Is my crew ranked, and did it fall below the visible slice? If so, pin it.
	if (myCrewId) {
		const inTop = top.some((s) => s.crew_id === myCrewId);
		if (!inTop) {
			const mineRanked = ranked.find((s) => s.crew_id === myCrewId);
			if (mineRanked) {
				rows.push({ kind: "separator" });
				rows.push(rankedRow(mineRanked, true));
			} else if (standings.mine && standings.mine.rank != null) {
				// Ranked per `mine` but absent from the (truncated) ranked array —
				// synthesize the pin from `mine` so I still see my standing.
				rows.push({ kind: "separator" });
				rows.push({
					kind: "ranked",
					rank: standings.mine.rank,
					crew_id: standings.mine.crew_id,
					name: "Your Sounder",
					avg: standings.mine.avg,
					diggers: standings.mine.diggers,
					total_finds: standings.mine.total_finds,
					roster_size: 0,
					highlighted: true,
				});
			}
		}
	}

	const unranked: StandingsRow[] = standings.unranked.map((s) =>
		unrankedRow(s, !!myCrewId && s.crew_id === myCrewId)
	);

	return { rows, unranked };
}

// ── The SEASON board selector — cumulative finds, the headline ranking ─────────
// Same pinned-row grammar as `standingsRows`, minus the sub-quorum split:
//   • the top `visible` rows, my crew highlighted in place if it's up there;
//   • otherwise a {separator} then my true-rank row (from the season array, or
//     synthesized from `mineSeason` when my row was truncated out).
// Every crew with ≥1 find ranks — there is no unranked section here.

export type SeasonStandingsRow =
	| {
			kind: "ranked";
			rank: number;
			crew_id: string;
			name: string;
			total_finds: number;
			diggers: number;
			roster_size: number;
			highlighted: boolean;
	  }
	| { kind: "separator" };

export function standingsRowsSeason(
	season: SeasonStanding[],
	mineSeason: MineSeason | null,
	myCrewId: string | null,
	visible = 5
): SeasonStandingsRow[] {
	const top = season.slice(0, Math.max(0, visible));
	const rows: SeasonStandingsRow[] = top.map((s) => ({
		kind: "ranked" as const,
		rank: s.rank,
		crew_id: s.crew_id,
		name: s.name,
		total_finds: s.total_finds,
		diggers: s.diggers,
		roster_size: s.roster_size,
		highlighted: !!myCrewId && s.crew_id === myCrewId,
	}));

	if (myCrewId) {
		const inTop = top.some((s) => s.crew_id === myCrewId);
		if (!inTop) {
			const mineFull = season.find((s) => s.crew_id === myCrewId);
			if (mineFull) {
				rows.push({ kind: "separator" });
				rows.push({ kind: "ranked", ...mineFull, highlighted: true });
			} else if (mineSeason && mineSeason.rank > 0) {
				// Ranked per `mineSeason` but truncated out of the array — synthesize
				// the pin so I always see where I stand.
				rows.push({ kind: "separator" });
				rows.push({
					kind: "ranked",
					rank: mineSeason.rank,
					crew_id: myCrewId,
					name: "Your Sounder",
					total_finds: mineSeason.total_finds,
					diggers: 0,
					roster_size: 0,
					highlighted: true,
				});
			}
		}
	}

	return rows;
}

// ── The FULL-FIELD selectors — no top-N, no pin, no separators ─────────────────
// The full-standings page renders every crew in rank order and paginates client-
// side, with my own row pinned in its own sticky card outside the list. So these
// return the whole field flat, mine only flagged for the in-place highlight.

/** Every season row, mine flagged — the full-field page (no top-N, no pin). */
export function allSeasonRows(
	season: SeasonStanding[],
	myCrewId: string | null
): SeasonStandingsRow[] {
	return season.map((s) => ({
		kind: "ranked" as const,
		rank: s.rank,
		crew_id: s.crew_id,
		name: s.name,
		total_finds: s.total_finds,
		diggers: s.diggers,
		roster_size: s.roster_size,
		highlighted: !!myCrewId && s.crew_id === myCrewId,
	}));
}

/** Every weekly row, mine flagged: ranked in order, then sub-quorum grayed. */
export function allWeeklyRows(
	standings: RaceStandings,
	myCrewId: string | null
): StandingsRow[] {
	const ranked = standings.ranked.map((s) =>
		rankedRow(s, !!myCrewId && s.crew_id === myCrewId)
	);
	const unranked = standings.unranked.map((s) =>
		unrankedRow(s, !!myCrewId && s.crew_id === myCrewId)
	);
	return [...ranked, ...unranked];
}

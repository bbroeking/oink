// The Dig-Off, as a GLOBAL RACE — standings reads, cycle math, and the pure
// pinned-row selectors. Split out of utils/dig.ts (which kept the dig/feeding
// reads): that module was ~90% race material. This is the race half.
//
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

import { rpc } from "./rpc";
import { num, str, strOrNull, obj, nonneg } from "./jsonb";

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
	/** Tickles banked to the tap pool this cycle (participation + rank spoils). */
	tickles_paid: number;
	cosmetic_hat_id: string | null;
}

/** One side of the weekly spoils ladder — podium tiers + the field + floor. */
export interface PrizeLadder {
	first: number;
	second: number;
	third: number;
	/** Every ranked crew in the top half (below the podium). */
	upper: number;
	/** Every remaining ranked crew. */
	field: number;
}

/** This week's spoils, as the server pays them — the source for the prize strip. */
export interface RacePrizes {
	/** Tickles banked to the SPENDABLE tap pool (never tickles_earned). */
	tickles: PrizeLadder & {
		/** Every digging snout in a sub-quorum crew — the "everyone wins" floor. */
		participation: number;
	};
	/** Golden Truffles minted at cycle end. */
	truffles: PrizeLadder;
}

// Compiled fallback for the spoils ladder — used until the server reports its own
// `prizes` (server-config-over-constants: the numbers live server-side, this is
// only what a pre-push client ticks on). MUST match the server payout helpers in
// migration 20260767000000 (_race_tickles_for_rank / _race_truffles_for_rank).
export const DEFAULT_RACE_PRIZES: RacePrizes = {
	tickles: {
		first: 50,
		second: 30,
		third: 20,
		upper: 12,
		field: 8,
		participation: 5,
	},
	truffles: { first: 6, second: 5, third: 4, upper: 3, field: 2 },
};

export interface RaceStandings {
	cycle: RaceCycleInfo;
	/** Cumulative season board — the season-long ranking (secondary board). */
	season: SeasonStanding[];
	/** My crew's cumulative season line, or null (crewless / no finds yet). */
	mineSeason: MineSeason | null;
	ranked: RankedStanding[];
	unranked: UnrankedStanding[];
	mine: MyStanding | null;
	last: LastRace | null;
	/** This week's spoils ladder (server-authoritative; falls back to defaults). */
	prizes: RacePrizes;
}

/** One settled weekly Dig-Off table. History is scoped to this season. */
export interface RaceHistoryWeek {
	cycle: RaceCycleInfo;
	ranked: RankedStanding[];
	unranked: UnrankedStanding[];
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
	const rank =
		Number.isFinite(rankRaw) && rankRaw > 0 ? Math.floor(rankRaw) : null;
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
		tickles_paid: nonneg(s.tickles_paid),
		cosmetic_hat_id: strOrNull(s.cosmetic_hat_id),
	};
}

// One spoils ladder side — every field non-negative, missing → the compiled
// fallback so a pre-push server (no `prizes`) still renders sensible numbers.
function parsePrizeLadder(v: unknown, fb: PrizeLadder): PrizeLadder {
	if (v == null) return fb;
	const s = obj(v);
	return {
		first: nonneg(s.first) || fb.first,
		second: nonneg(s.second) || fb.second,
		third: nonneg(s.third) || fb.third,
		upper: nonneg(s.upper) || fb.upper,
		field: nonneg(s.field) || fb.field,
	};
}

function parseRacePrizes(v: unknown): RacePrizes {
	if (v == null) return DEFAULT_RACE_PRIZES;
	const s = obj(v);
	const t = parsePrizeLadder(s.tickles, DEFAULT_RACE_PRIZES.tickles);
	const partRaw = nonneg(obj(s.tickles).participation);
	return {
		tickles: {
			...t,
			participation: partRaw || DEFAULT_RACE_PRIZES.tickles.participation,
		},
		truffles: parsePrizeLadder(s.truffles, DEFAULT_RACE_PRIZES.truffles),
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
		prizes: parseRacePrizes(s.prizes),
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

export function parseRaceHistory(v: unknown): RaceHistoryWeek[] {
	if (!Array.isArray(v)) return [];
	return v
		.map((value): RaceHistoryWeek | null => {
			const s = obj(value);
			const c = obj(s.cycle);
			const key = str(c.key);
			if (!key) return null;
			return {
				cycle: {
					key,
					starts_at: str(c.starts_at),
					ends_at: str(c.ends_at),
				},
				ranked: Array.isArray(s.ranked)
					? s.ranked.map(parseRankedStanding)
					: [],
				unranked: Array.isArray(s.unranked)
					? s.unranked.map(parseUnrankedStanding)
					: [],
			};
		})
		.filter((week): week is RaceHistoryWeek => week != null);
}

/**
 * Full settled tables are a separate read so the compact season-tab card never
 * pays for history. `null` means the additive RPC has not been pushed yet.
 */
export async function fetchRaceHistory(): Promise<RaceHistoryWeek[] | null> {
	const raw = await rpc<unknown>("race_history");
	if (raw == null) return null;
	return parseRaceHistory(raw);
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
	/** No longer in the crew — their finds stayed, the row reads historical. */
	departed: boolean;
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
		departed: s.departed === true, // absent pre-push → current member
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
		? s.members
				.map(parseCrewMemberLine)
				.filter((m): m is CrewMemberLine => m != null)
		: [];
	return {
		cycle_key: str(s.cycle_key),
		crew_id,
		name: str(s.name, "a Sounder"),
		members,
	};
}

export async function fetchRaceCrewDetail(
	crewId: string,
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
	nowMs: number = Date.now(),
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
	visible = 5,
): StandingsView {
	const ranked = standings.ranked;
	const top = ranked.slice(0, Math.max(0, visible));
	const rows: StandingsRow[] = top.map((s) =>
		rankedRow(s, !!myCrewId && s.crew_id === myCrewId),
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
		unrankedRow(s, !!myCrewId && s.crew_id === myCrewId),
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
	visible = 5,
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
	myCrewId: string | null,
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
	myCrewId: string | null,
): StandingsRow[] {
	const ranked = standings.ranked.map((s) =>
		rankedRow(s, !!myCrewId && s.crew_id === myCrewId),
	);
	const unranked = standings.unranked.map((s) =>
		unrankedRow(s, !!myCrewId && s.crew_id === myCrewId),
	);
	return [...ranked, ...unranked];
}

// ── The sticky my-Sounder pin rule ─────────────────────────────────────────────
// The full-field page pins my crew in its own sticky card ONLY when my row isn't
// in the currently-revealed slice. When paging has reached my row, it highlights
// in place (rowMine) and the pin is redundant — exactly the pinned-row grammar
// standingsRows/standingsRowsSeason use on the tab (highlight-in-place vs pin).
// Pure so it can be unit-tested off the already-derived flat rows + the shown
// count. Crewless → no pin (there's nothing to point at).
export function pinNeeded(
	rows: { kind: string; crew_id?: string; highlighted?: boolean }[],
	shown: number,
	myCrewId: string | null,
): boolean {
	if (!myCrewId) return false;
	// Is my crew's row within the revealed slice? Match on crew_id (dense ranks
	// tie, so never rank-match) across the shown rows only.
	const revealed = rows.slice(0, Math.max(0, shown));
	const mineVisible = revealed.some(
		(r) => r.kind !== "separator" && r.crew_id === myCrewId,
	);
	return !mineVisible;
}

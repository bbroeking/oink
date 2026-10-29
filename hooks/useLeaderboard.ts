// The Board's fetch + pagination state, extracted from components/Leaderboard.tsx
// so the component is pure rendering. Mirrors the useCrew/useSeason idiom: the
// caller owns the scope toggle + all UI; this hook owns every server read and the
// cursor state behind them.
//
// One entry point drives four scopes off `scope`:
//   • global    — the paginated profiles board (Load-more cursor + row cap),
//                 plus the caller's own row and true rank (`you`);
//   • friends   — one bounded read (the 100-friend cap, no pagination);
//   • pairs     — both pair-board RPCs (Strongest + Enemies, each fail-soft);
//   • alignment — the two-sided alignment RPC (season-0 internal).
// It refreshes on focus and on demand (refresh()), and pages the global scope
// through loadMore() with a stable-id cursor + dedupe. The mark_all_pass_events_seen
// side-effect fires once per global load.
//
// SEAM: the hook returns data + status ONLY. Every graceful fallback (the
// null-RPC empty boards) lives here; the component maps
// `error`/`loading`/`rows` to its cozy cards, champion poster, and ranked rows.

import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router/react-navigation";
import type { TitlePlacement } from "@/constants/title_types";
import { supabase } from "@/utils/supabase";
import { rpc } from "@/utils/rpc";
import { getFriendIds } from "@/utils/friendships";
import {
	enemyLeaderboard,
	type EnemyPairRow,
	pairLeaderboard,
	type PairBondRow,
} from "@/utils/pairBonds";
import { log } from "@/utils/log";
import { fetchSatchelSwapsFor } from "@/utils/satchel";
import { boardColumn, refreshBoardColumn, type BoardColumn } from "@/utils/boardColumn";

// Page size + hard upper bound for the global leaderboard. 25 lands
// just over a single phone screen so each "Load more" is a deliberate
// reach; 100 is the highest rank that's still meaningful to the
// average player (the long tail past rank 100 is competitive noise).
const LEADERBOARD_PAGE_SIZE = 25;
export const LEADERBOARD_MAX_ROWS = 100;

export type Scope = "global" | "friends" | "pairs" | "alignment";
// The scopes a host can open the board on (alignment is season-0 internal).
export type BoardScope = Exclude<Scope, "alignment">;

export interface ActiveTitle {
	id: string;
	name: string;
	placement: TitlePlacement;
}

export interface ActiveHat {
	name: string;
}

export interface LeaderboardEntry {
	id: string;
	username: string | null;
	discriminator?: string | null;
	tickles_earned: number;
	active_hat_id: string | null;
	// Name of the equipped hat (joined through the active_hat_id FK).
	// Drives the "wears X" second line on each ranked row. Null when
	// no hat is equipped or when the hats join falls back.
	active_hat: ActiveHat | null;
	active_title: ActiveTitle | null;
	alignment_score?: number | null;
	// Permanent prestige standing. Each Wallow deepens the mud ring around the
	// pig; absent on pre-migration servers and treated as zero.
	wallow_count?: number | null;
	// Satchel swaps (finds handed to friends' pigs, gifts included) — the
	// Contend slice beside tickles. Decorated after the row load through a
	// fail-soft batched RPC (satchel_swaps_for, falling back to the one-build
	// satchel_deliveries_for alias), so a server without the Satchel simply
	// leaves it undefined. A number, never a payout (docs/satchel-spec.md).
	swaps?: number;
	/** @deprecated the old name for `swaps`; kept one build. */
	deliveries?: number;
	// Alignment-scope only: which half of the leaderboard this row
	// belongs to (Generous top vs Greedy top) + the within-side rank.
	// alignment_leaderboard RPC returns both; we used to throw them
	// away and renumber every row 1..N, which made Greedy #1 read
	// like "rank 11 overall" — confusing because it ranks across
	// two independent boards.
	align_side?: "generous" | "greedy" | null;
	align_side_rank?: number | null;
}

// PostgREST returns 1:1 joins either as a single object or as a
// length-1 array depending on the relationship's cardinality
// metadata; normalize so the UI can read .active_title?.name /
// .active_hat?.name directly.
type RawRow = Omit<LeaderboardEntry, "active_title" | "active_hat"> & {
	active_title?: ActiveTitle[] | ActiveTitle | null;
	active_hat?: ActiveHat[] | ActiveHat | null;
	// Season 2's baselined Board column (20261029190000); selected only once
	// the server ranks by it.
	season_tickles_earned?: number | null;
};
// `col` is the column the Board ranks by (utils/boardColumn). The entry's
// `tickles_earned` is the number the Board shows, so a season-scoped Board
// carries the season number there and every renderer stays as it is.
function normalize(rows: RawRow[] | null, col: BoardColumn = "tickles_earned"): LeaderboardEntry[] {
	return (rows ?? []).map(({ season_tickles_earned, ...r }) => ({
		...r,
		tickles_earned:
			col === "season_tickles_earned" ? (season_tickles_earned ?? 0) : r.tickles_earned,
		active_hat: Array.isArray(r.active_hat)
			? (r.active_hat[0] ?? null)
			: (r.active_hat ?? null),
		active_title: Array.isArray(r.active_title)
			? (r.active_title[0] ?? null)
			: (r.active_title ?? null),
	}));
}

/** The caller's own row on the global board, and the rank it holds there. */
export interface YouOnBoard {
	entry: LeaderboardEntry;
	rank: number;
}

export interface UseLeaderboard {
	/** The ranked list for the global / friends / alignment scopes. */
	rows: LeaderboardEntry[];
	/**
	 * The caller's own standing on the GLOBAL board — their row and its true
	 * rank — so the board can pin "your rank" under the list the way the Pairs
	 * board pins your strongest pair. Null on every other scope, while loading,
	 * on any failed read, and for an account the global board never shows
	 * (test or hidden): such a pig has no rank to pin. (2026-10-04)
	 */
	you: YouOnBoard | null;
	/** Strongest-pairs board (pairs scope only). */
	pairs: PairBondRow[];
	/** The caller's own best pair, pinned below when outside the top slice. */
	youPair: PairBondRow | null;
	/** Biggest-enemies board (the Enemies toggle inside pairs scope). */
	enemies: EnemyPairRow[];
	/** The caller's biggest enemy, pinned below when outside the top slice. */
	youEnemy: EnemyPairRow | null;
	/** The signed-in user's id (drives the you-row highlight). */
	myId: string | null;
	loading: boolean;
	loadingMore: boolean;
	hasMore: boolean;
	/** The global page read threw — show a retry. */
	error: boolean;
	/**
	 * True once the server ranks the Board by the season's tickles (Season 2's
	 * baseline) instead of the lifetime number. The copy says "season", not
	 * "all-time", and the lifetime receipt is not offered as the score's sum.
	 */
	seasonal: boolean;
	/** Re-fetch the current scope (focus, retry, a friendship changed). */
	refresh: () => Promise<void>;
	/** Pull the next page of the global scope (cursor + dedupe + cap). */
	loadMore: () => Promise<void>;
}

// The ranked-row projection shared by the global and friends scopes. The
// active_hat join lights up the "wears X" second line, active_title carries
// the placement-aware title, wallow_count drives the prestige frame.
const RANKED_PROFILE_SELECT =
	"id, username, discriminator, tickles_earned, wallow_count, active_hat_id, alignment_score, active_title:titles!profiles_active_title_id_fkey(id, name, placement), active_hat:hats!profiles_active_hat_id_fkey(name)";

// The ranked select for the Board's column: the season column rides along
// only when the server ranks by it (it does not exist before the migration).
function rankedSelect(col: BoardColumn): string {
	return col === "season_tickles_earned"
		? `${RANKED_PROFILE_SELECT}, season_tickles_earned`
		: RANKED_PROFILE_SELECT;
}

// The caller's own row, plus the two columns that decide whether the global
// board shows them at all.
type OwnRow = RawRow & {
	is_test?: boolean | null;
	hide_from_leaderboard?: boolean | null;
};

// Where the caller stands on the global board: their own row, and one plus the
// number of ranked pigs above them under the board's own order (tickles
// descending, id ascending on a tie) and the board's own filters. Fail-soft to
// null on any miss — a pinned rank that might be wrong is worse than none.
async function fetchYouOnGlobal(
	uid: string,
	col: BoardColumn = "tickles_earned",
): Promise<YouOnBoard | null> {
	const own = await supabase
		.from("profiles")
		.select(`${rankedSelect(col)}, is_test, hide_from_leaderboard`)
		.eq("id", uid)
		.returns<OwnRow[]>();
	const row = own.error ? null : (own.data?.[0] ?? null);
	if (!row || !row.username || row.is_test || row.hide_from_leaderboard) return null;
	const tickles =
		(col === "season_tickles_earned" ? row.season_tickles_earned : row.tickles_earned) ?? 0;
	const above = await supabase
		.from("profiles")
		.select("id", { count: "exact", head: true })
		.not("username", "is", null)
		.neq("username", "")
		.eq("is_test", false)
		.eq("hide_from_leaderboard", false)
		.or(`${col}.gt.${tickles},and(${col}.eq.${tickles},id.lt.${uid})`);
	if (above.error || typeof above.count !== "number") return null;
	const [entry] = await withSwaps(normalize([row], col));
	return entry ? { entry, rank: above.count + 1 } : null;
}

// Merge each row's swap count in. Fail-soft: no RPC, no rows, no change.
// Both field names are written for one build — an older reader of the row type
// still sees `deliveries`.
async function withSwaps(rows: LeaderboardEntry[]): Promise<LeaderboardEntry[]> {
	if (rows.length === 0) return rows;
	const by = await fetchSatchelSwapsFor(rows.map((r) => r.id));
	if (!by) return rows;
	return rows.map((r) =>
		typeof by[r.id] === "number" ? { ...r, swaps: by[r.id], deliveries: by[r.id] } : r,
	);
}

export function useLeaderboard(scope: Scope): UseLeaderboard {
	const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
	const [loading, setLoading] = useState(true);
	// A failed fetch surfaces as a cozy error card with a retry, instead of
	// silently rendering an empty board. A later successful fetch clears it.
	const [error, setError] = useState(false);
	const [myId, setMyId] = useState<string | null>(null);
	// Paginated load-more state for the global scope. Friends scope is
	// already bounded by the 100-friend cap; alignment is RPC-served
	// with a fixed per_side, so neither needs pagination.
	const [loadingMore, setLoadingMore] = useState(false);
	const [hasMore, setHasMore] = useState(false);
	// Strongest-pairs scope — the ranked pair board + the caller's own best
	// pair (the "you" row) when it falls outside the top slice. RPC-served,
	// so no pagination; the top slice is bounded server-side.
	const [pairs, setPairs] = useState<PairBondRow[]>([]);
	const [youPair, setYouPair] = useState<PairBondRow | null>(null);
	const [enemies, setEnemies] = useState<EnemyPairRow[]>([]);
	const [youEnemy, setYouEnemy] = useState<EnemyPairRow | null>(null);
	// The caller's own global standing (see `UseLeaderboard.you`).
	const [you, setYou] = useState<YouOnBoard | null>(null);
	// The column the Board ranks by (server-chosen; lifetime until Season 2).
	const [column, setColumn] = useState<BoardColumn>(boardColumn);

	// Fetches `count` rows starting at `from` from profiles, ordered
	// by tickles_earned desc.
	const fetchGlobalPage = useCallback(
		async (
			from: number,
			count: number,
			col: BoardColumn = boardColumn(),
		): Promise<LeaderboardEntry[]> => {
			// is_test filter only fires on the global scope — friends
			// list intentionally shows any account you've friended,
			// test or not. Column is NOT NULL DEFAULT false (20260548).
			const run = async () =>
				supabase
					.from("profiles")
					.select(rankedSelect(col))
					.not("username", "is", null)
					.neq("username", "")
					.eq("is_test", false)
					// Hidden accounts (demo reviewer, junk usernames) never
					// appear on the global board. Column is NOT NULL DEFAULT
					// false, so eq(false) covers every row.
					.eq("hide_from_leaderboard", false)
					.order(col, { ascending: false })
					// Unique tiebreaker so contiguous .range() pages never
					// overlap: tickles_earned alone is not unique (a fresh
					// board has everyone tied at 0), and Postgres orders tied
					// rows nondeterministically — so the row at a page boundary
					// could land in BOTH the first and second range() query,
					// yielding the same id twice → a duplicate React key. id
					// (the PK) makes the total order stable across pages.
					.order("id", { ascending: true })
					.range(from, from + count - 1)
					// Dynamic select string → PostgREST infers a parser-error
					// row shape; declare our known row type through the builder
					// so .data lands as RawRow[] without an escape-hatch cast.
					.returns<RawRow[]>();
			const result = await run();
			if (result.error) throw result.error;
			return normalize(result.data, col);
		},
		[],
	);

	const refresh = useCallback(async () => {
		setLoading(true);
		setHasMore(false);
		setError(false);
		setYou(null);
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			setMyId(user?.id ?? null);
			// Which column the Board ranks by (fail-soft: lifetime). Read once
			// per refresh so every query in it agrees.
			await refreshBoardColumn().catch(() => false);
			const col = boardColumn();
			setColumn(col);

			if (scope === "pairs") {
				// The page owns a local Strongest/Enemies toggle, so fetch both
				// bounded boards together. Switching the toggle is then instant
				// and never flashes a second loading state.
				const [pairRes, enemyRes] = await Promise.all([
					pairLeaderboard(25),
					enemyLeaderboard(25),
				]);
				// Both envelopes discriminate on `ok`, so branching on it narrows
				// the union directly — no cast needed.
				setPairs(pairRes?.ok ? pairRes.pairs : []);
				setYouPair(pairRes?.ok ? pairRes.you : null);
				setEnemies(enemyRes?.ok ? enemyRes.enemies : []);
				setYouEnemy(enemyRes?.ok ? enemyRes.you : null);
				return;
			}

			if (scope === "alignment") {
				const rows = await rpc<
					{
						user_id: string;
						username: string | null;
						active_hat_id: string | null;
						alignment_score: number;
						side: "generous" | "greedy";
						side_rank: number;
					}[]
				>("alignment_leaderboard", {
					per_side: 25,
				});
				const mapped: LeaderboardEntry[] = (rows ?? []).map((r) => ({
					id: r.user_id,
					username: r.username,
					tickles_earned: 0,
					active_hat_id: r.active_hat_id,
					// alignment_leaderboard RPC doesn't carry the hat
					// name; the "wears X" line falls back to nothing in
					// this scope. Acceptable — the alignment view leads
					// with the score, hats are secondary signal there.
					active_hat: null,
					active_title: null,
					alignment_score: r.alignment_score,
					align_side: r.side,
					align_side_rank: r.side_rank,
				}));
				setLeaderboard(mapped);
				return;
			}

			if (scope === "friends") {
				// Bounded by the 100-friend cap — fetch once, no pagination.
				const friends = await getFriendIds();
				const friendIds = [...(friends ?? []), ...(user ? [user.id] : [])];
				if (friendIds.length === 0) {
					setLeaderboard([]);
					return;
				}
				const result = await supabase
					.from("profiles")
					.select(rankedSelect(col))
					.in("id", friendIds)
					.not("username", "is", null)
					.neq("username", "")
					.order(col, { ascending: false })
					// Dynamic select string → PostgREST infers a parser-error
					// row shape; declare our known row type through the builder
					// (matches the global path) instead of casting .data.
					.returns<RawRow[]>();
				if (result.error) throw result.error;
				setLeaderboard(await withSwaps(normalize(result.data, col)));
				return;
			}

			// Global scope — paginated. Pull the first page (PAGE_SIZE +
			// 1 so the champion poster doesn't eat a slot from the rest
			// list) and seed hasMore on whether the page came back full.
			// The caller's own standing reads beside it, fail-soft: a miss
			// pins nothing and never fails the board.
			const [firstPage, mine] = await Promise.all([
				fetchGlobalPage(0, LEADERBOARD_PAGE_SIZE, col).then(withSwaps),
				user ? fetchYouOnGlobal(user.id, col).catch(() => null) : Promise.resolve(null),
			]);
			setLeaderboard(firstPage);
			setYou(mine);
			setHasMore(
				firstPage.length === LEADERBOARD_PAGE_SIZE &&
					firstPage.length < LEADERBOARD_MAX_ROWS,
			);

			rpc("mark_all_pass_events_seen").then(() => {});
		} catch (err) {
			log.error("Error fetching leaderboard:", err);
			// Both the titles-join select and its no-titles retry threw — the
			// Board couldn't load. Surface a retry instead of an empty list.
			setError(true);
		} finally {
			setLoading(false);
		}
	}, [scope, fetchGlobalPage]);

	const loadMore = useCallback(async () => {
		if (loadingMore || !hasMore) return;
		setLoadingMore(true);
		try {
			const from = leaderboard.length;
			const want = Math.min(LEADERBOARD_PAGE_SIZE, LEADERBOARD_MAX_ROWS - from);
			if (want <= 0) {
				setHasMore(false);
				return;
			}
			const next = await fetchGlobalPage(from, want, column);
			// Dedupe by id, keeping the already-shown row: even with the stable
			// id tiebreaker, a row's tickles_earned can change between the
			// first-page fetch and this one (someone tickles mid-scroll),
			// shifting a boundary row into this page's range — appending it
			// blindly would collide on key={item.id}. Guard at the source.
			setLeaderboard((prev) => {
				const seen = new Set(prev.map((r) => r.id));
				return [...prev, ...next.filter((r) => !seen.has(r.id))];
			});
			setHasMore(
				next.length === want && from + next.length < LEADERBOARD_MAX_ROWS,
			);
		} catch (err) {
			log.error("Error loading more leaderboard rows:", err);
		} finally {
			setLoadingMore(false);
		}
	}, [loadingMore, hasMore, leaderboard.length, fetchGlobalPage, column]);

	useFocusEffect(
		useCallback(() => {
			refresh();
		}, [refresh]),
	);

	return {
		rows: leaderboard,
		you,
		pairs,
		youPair,
		enemies,
		youEnemy,
		myId,
		loading,
		loadingMore,
		hasMore,
		error,
		seasonal: column === "season_tickles_earned",
		refresh,
		loadMore,
	};
}

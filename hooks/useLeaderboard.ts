// The Board's fetch + pagination state, extracted from components/Leaderboard.tsx
// so the component is pure rendering. Mirrors the useCrew/useSeason idiom: the
// caller owns the scope toggle + all UI; this hook owns every server read and the
// cursor state behind them.
//
// One entry point drives four scopes off `scope`:
//   • global    — the paginated profiles board (Load-more cursor + row cap);
//   • friends   — one bounded read (the 100-friend cap, no pagination);
//   • pairs     — the strongest-pairs RPC (fail-soft to an empty board);
//   • alignment — the two-sided alignment RPC (season-0 internal).
// It refreshes on focus and on demand (refresh()), and pages the global scope
// through loadMore() with a stable-id cursor + dedupe. The mark_all_pass_events_seen
// side-effect fires once per global load, as before.
//
// SEAM: the hook returns data + status ONLY. Every graceful fallback (the
// titles/wallows select retries, the null-RPC empty boards) lives here; the
// component maps `error`/`loading`/`rows` to its cozy cards, champion poster, and
// ranked rows. Behavior is unchanged from the inlined version.

import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import type { TitlePlacement } from "@/constants/title_types";
import { supabase } from "@/utils/supabase";
import { rpc } from "@/utils/rpc";
import { getFriendIds } from "@/utils/friendships";
import {
	pairLeaderboard,
	type PairBondRow,
	type PairLeaderboard,
} from "@/utils/pairBonds";
import { log } from "@/utils/log";

// Page size + hard upper bound for the global leaderboard. 25 lands
// just over a single phone screen so each "Load more" is a deliberate
// reach; 100 is the highest rank that's still meaningful to the
// average player (the long tail past rank 100 is competitive noise).
export const LEADERBOARD_PAGE_SIZE = 25;
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
};
function normalize(rows: RawRow[] | null): LeaderboardEntry[] {
	return (rows ?? []).map((r) => ({
		...r,
		active_hat: Array.isArray(r.active_hat)
			? (r.active_hat[0] ?? null)
			: (r.active_hat ?? null),
		active_title: Array.isArray(r.active_title)
			? (r.active_title[0] ?? null)
			: (r.active_title ?? null),
	}));
}

export interface UseLeaderboard {
	/** The ranked list for the global / friends / alignment scopes. */
	rows: LeaderboardEntry[];
	/** Strongest-pairs board (pairs scope only). */
	pairs: PairBondRow[];
	/** The caller's own best pair, pinned below when outside the top slice. */
	youPair: PairBondRow | null;
	/** The signed-in user's id (drives the you-row highlight). */
	myId: string | null;
	loading: boolean;
	loadingMore: boolean;
	hasMore: boolean;
	/** Both the titles-join select AND its no-titles retry threw — show a retry. */
	error: boolean;
	/** Re-fetch the current scope (focus, retry, a friendship changed). */
	refresh: () => Promise<void>;
	/** Pull the next page of the global scope (cursor + dedupe + cap). */
	loadMore: () => Promise<void>;
}

export function useLeaderboard(scope: Scope): UseLeaderboard {
	const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
	const [loading, setLoading] = useState(true);
	// A failed fetch (both the titles-join select AND its no-titles retry
	// threw) surfaces as a cozy error card with a retry, instead of silently
	// rendering an empty board. A later successful fetch clears it.
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

	// Fetches `count` rows starting at `from` from profiles, ordered
	// by tickles_earned desc. Falls back to the no-titles select if
	// the active_title join 400s (pre-titles-migration installs).
	const fetchGlobalPage = useCallback(
		async (from: number, count: number): Promise<LeaderboardEntry[]> => {
			// active_hat join lights up the "wears X" second-line on
			// each ranked row. The titles join is independent; if the
			// titles migration isn't deployed, retry without titles
			// but keep the hat join (its migration is much older).
			const SELECT_WITH_WALLOWS =
				"id, username, discriminator, tickles_earned, wallow_count, active_hat_id, alignment_score, active_title:titles!profiles_active_title_id_fkey(id, name, placement), active_hat:hats!profiles_active_hat_id_fkey(name)";
			const SELECT_WITH_TITLES =
				"id, username, discriminator, tickles_earned, active_hat_id, alignment_score, active_title:titles!profiles_active_title_id_fkey(id, name, placement), active_hat:hats!profiles_active_hat_id_fkey(name)";
			const SELECT_BASIC =
				"id, username, discriminator, tickles_earned, active_hat_id, alignment_score, active_hat:hats!profiles_active_hat_id_fkey(name)";
			// is_test filter only fires on the global scope — friends
			// list intentionally shows any account you've friended,
			// test or not. The 'or' wrap handles legacy rows where
			// the column is missing (pre-20260548 migration), which
			// PostgREST treats as NULL ≠ true → row included.
			const run = async (select: string) =>
				supabase
					.from("profiles")
					.select(select)
					.not("username", "is", null)
					.neq("username", "")
					.or("is_test.is.null,is_test.eq.false")
					// Hidden accounts (demo reviewer, junk usernames) never
					// appear on the global board. Column is NOT NULL DEFAULT
					// false, so eq(false) covers every row.
					.eq("hide_from_leaderboard", false)
					.order("tickles_earned", { ascending: false })
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
			// First try the prestige projection. Until its migration is pushed,
			// PostgREST rejects wallow_count; fall back to today's exact select so
			// the board stays live while the feature is dark.
			let result = await run(SELECT_WITH_WALLOWS);
			if (result.error) {
				log.warn(
					"Leaderboard Wallow field unavailable, retrying without:",
					result.error.message,
					result.error.code,
				);
				result = await run(SELECT_WITH_TITLES);
				if (result.error) {
					result = await run(SELECT_BASIC);
					if (result.error) throw result.error;
				}
			}
			return normalize(result.data);
		},
		[],
	);

	const refresh = useCallback(async () => {
		setLoading(true);
		setHasMore(false);
		setError(false);
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			setMyId(user?.id ?? null);

			if (scope === "pairs") {
				// Strongest pairs — RPC-served, both usernames + breakdown + the
				// you-row baked in. Fail-soft: a null result (unpushed migration)
				// leaves the board empty rather than throwing.
				const res = await pairLeaderboard(25);
				const ok = res && (res as PairLeaderboard).ok;
				setPairs(ok ? (res as PairLeaderboard).pairs : []);
				setYouPair(ok ? (res as PairLeaderboard).you : null);
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
				const SELECT_BASIC =
					"id, username, discriminator, tickles_earned, active_hat_id, alignment_score, active_hat:hats!profiles_active_hat_id_fkey(name)";
				const SELECT_WITH_WALLOWS =
					"id, username, discriminator, tickles_earned, wallow_count, active_hat_id, alignment_score, active_title:titles!profiles_active_title_id_fkey(id, name, placement), active_hat:hats!profiles_active_hat_id_fkey(name)";
				const SELECT_WITH_TITLES =
					"id, username, discriminator, tickles_earned, active_hat_id, alignment_score, active_title:titles!profiles_active_title_id_fkey(id, name, placement), active_hat:hats!profiles_active_hat_id_fkey(name)";
				// The titles join 400s when the titles migration isn't
				// deployed; retry without it. Untyped intermediate so
				// both selects can land in the same variable.
				const runFriends = async (sel: string) =>
					supabase
						.from("profiles")
						.select(sel)
						.in("id", friendIds)
						.not("username", "is", null)
						.neq("username", "")
						.order("tickles_earned", { ascending: false })
						// Dynamic select string → PostgREST infers a parser-error
						// row shape; declare our known row type through the builder
						// (matches the global path) instead of casting .data.
						.returns<RawRow[]>();
				let result = await runFriends(SELECT_WITH_WALLOWS);
				if (result.error) {
					result = await runFriends(SELECT_WITH_TITLES);
					if (result.error) {
						result = await runFriends(SELECT_BASIC);
						if (result.error) throw result.error;
					}
				}
				setLeaderboard(normalize(result.data));
				return;
			}

			// Global scope — paginated. Pull the first page (PAGE_SIZE +
			// 1 so the champion poster doesn't eat a slot from the rest
			// list) and seed hasMore on whether the page came back full.
			const firstPage = await fetchGlobalPage(0, LEADERBOARD_PAGE_SIZE);
			setLeaderboard(firstPage);
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
			const next = await fetchGlobalPage(from, want);
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
	}, [loadingMore, hasMore, leaderboard.length, fetchGlobalPage]);

	useFocusEffect(
		useCallback(() => {
			refresh();
		}, [refresh]),
	);

	return {
		rows: leaderboard,
		pairs,
		youPair,
		myId,
		loading,
		loadingMore,
		hasMore,
		error,
		refresh,
		loadMore,
	};
}

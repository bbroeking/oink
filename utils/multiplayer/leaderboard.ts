// The wins board's client: one typed wrapper around the `play_leaderboard`
// RPC (supabase/migrations/20261004230000_matchmade_play.sql), which returns
//   { ok, period, game, rows: [{ rank, user_id, username, pig_id, hat_id,
//     bow_id, wallow, wins }], me: { wins, rank } }
// counting WINS this UTC month and nothing else (SKILL.md 2026-10-04): no
// loss column, no zero rows, no rating on show.
//
// The migration is authored but not pushed, so a missing function is an
// expected answer ("the board opens soon"), told apart from a real failure
// by utils/rpc's rpcOutcome. The parser is defensive: a row without a
// positive win count is dropped rather than drawn as a public zero.

import type { GameId } from "@/multiplayer/types";
import { rpcOutcome } from "@/utils/rpc";

export interface WinsRow {
	rank: number;
	userId: string;
	username: string | null;
	pigId: string | null;
	hatId: string | null;
	bowId: string | null;
	wallow: number;
	wins: number;
}

export interface WinsBoard {
	/** The UTC month, "YYYY-MM". */
	period: string | null;
	game: GameId | null;
	rows: WinsRow[];
	/** The caller: wins this month (0 when none) and rank (null when off the board). */
	me: { wins: number; rank: number | null };
}

export type WinsBoardResult =
	| { ok: true; board: WinsBoard }
	/** missing: the RPC is not deployed yet. error: anything else. */
	| { ok: false; reason: "missing" | "error" };

export const WINS_BOARD_LIMIT = 50;

function record(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function count(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function text(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

function parseRow(raw: unknown): WinsRow | null {
	const r = record(raw);
	if (!r) return null;
	const userId = text(r.user_id);
	const wins = count(r.wins);
	const rank = count(r.rank);
	if (!userId || wins < 1 || rank < 1) return null;
	return {
		rank,
		userId,
		username: text(r.username),
		pigId: text(r.pig_id),
		hatId: text(r.hat_id),
		bowId: text(r.bow_id),
		wallow: count(r.wallow),
		wins,
	};
}

/** The RPC's jsonb as a WinsBoard, or null when it is not one. */
export function parseWinsBoard(raw: unknown): WinsBoard | null {
	const r = record(raw);
	if (!r || r.ok === false) return null;
	const rows = Array.isArray(r.rows) ? r.rows.map(parseRow).filter((row): row is WinsRow => row !== null) : [];
	const me = record(r.me);
	const myWins = count(me?.wins);
	const myRank = me && typeof me.rank === "number" && me.rank >= 1 && myWins > 0 ? Math.floor(me.rank) : null;
	return {
		period: text(r.period),
		game: (text(r.game) as GameId | null) ?? null,
		rows,
		me: { wins: myWins, rank: myRank },
	};
}

/** This month's board for one game (or every game, `null`). Never rejects. */
export async function fetchWinsBoard(
	game: GameId | null,
	opts: { period?: string | null; limit?: number } = {},
): Promise<WinsBoardResult> {
	const res = await rpcOutcome<unknown>("play_leaderboard", {
		p_game: game,
		p_period: opts.period ?? null,
		p_limit: opts.limit ?? WINS_BOARD_LIMIT,
	});
	if (!res.ok) return { ok: false, reason: res.kind === "missing_function" ? "missing" : "error" };
	const board = parseWinsBoard(res.data);
	return board ? { ok: true, board } : { ok: false, reason: "error" };
}

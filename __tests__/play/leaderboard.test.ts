// The wins board's client (utils/multiplayer/leaderboard.ts): the RPC's
// parameters, the parser (no zero rows, ever), and the three answers a
// screen needs: a board, "the board opens soon" (the RPC is not deployed),
// and a failure.

import { WINS_BOARD_LIMIT, fetchWinsBoard, parseWinsBoard } from "@/utils/multiplayer/leaderboard";

const mockRpcOutcome = jest.fn();
jest.mock("@/utils/rpc", () => ({ rpcOutcome: (...args: unknown[]) => mockRpcOutcome(...args) }));

const ROW = { rank: 1, user_id: "u1", username: "Clover", pig_id: "copper", hat_id: "tophat", bow_id: null, wallow: 2, wins: 5 };

describe("parseWinsBoard", () => {
	it("reads the board, the rows and the caller", () => {
		const board = parseWinsBoard({ ok: true, period: "2026-10", game: null, rows: [ROW], me: { wins: 3, rank: 4 } });
		expect(board).toEqual({
			period: "2026-10",
			game: null,
			rows: [{ rank: 1, userId: "u1", username: "Clover", pigId: "copper", hatId: "tophat", bowId: null, wallow: 2, wins: 5 }],
			me: { wins: 3, rank: 4 },
		});
	});

	it("drops a row with no wins rather than draw a public zero", () => {
		const board = parseWinsBoard({ ok: true, rows: [ROW, { ...ROW, user_id: "u2", wins: 0 }, { ...ROW, user_id: "u3", wins: "7" }], me: null });
		expect(board?.rows.map((r) => r.userId)).toEqual(["u1"]);
		expect(board?.me).toEqual({ wins: 0, rank: null });
	});

	it("a caller with no wins has no rank, whatever the wire says", () => {
		expect(parseWinsBoard({ ok: true, rows: [], me: { wins: 0, rank: 9 } })?.me).toEqual({ wins: 0, rank: null });
	});

	it("is null for anything that is not a board", () => {
		expect(parseWinsBoard(null)).toBeNull();
		expect(parseWinsBoard([])).toBeNull();
		expect(parseWinsBoard({ ok: false })).toBeNull();
	});
});

describe("fetchWinsBoard", () => {
	beforeEach(() => mockRpcOutcome.mockReset());

	it("asks for this month's board for one game, or every game", async () => {
		mockRpcOutcome.mockResolvedValue({ ok: true, data: { ok: true, rows: [ROW], me: { wins: 0, rank: null } } });
		await fetchWinsBoard("rootle");
		expect(mockRpcOutcome).toHaveBeenLastCalledWith("play_leaderboard", { p_game: "rootle", p_period: null, p_limit: WINS_BOARD_LIMIT });
		const res = await fetchWinsBoard(null);
		expect(mockRpcOutcome).toHaveBeenLastCalledWith("play_leaderboard", { p_game: null, p_period: null, p_limit: WINS_BOARD_LIMIT });
		expect(res.ok && res.board.rows).toHaveLength(1);
	});

	it("tells a missing RPC (not pushed yet) apart from a failure", async () => {
		mockRpcOutcome.mockResolvedValueOnce({ ok: false, kind: "missing_function", error: { code: "PGRST202" } });
		expect(await fetchWinsBoard(null)).toEqual({ ok: false, reason: "missing" });
		mockRpcOutcome.mockResolvedValueOnce({ ok: false, kind: "network", error: {} });
		expect(await fetchWinsBoard(null)).toEqual({ ok: false, reason: "error" });
		mockRpcOutcome.mockResolvedValueOnce({ ok: true, data: "nonsense" });
		expect(await fetchWinsBoard(null)).toEqual({ ok: false, reason: "error" });
	});
});

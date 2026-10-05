// Every error code and result reason has words, the result headlines read
// right from each seat, and no string carries an em dash or an emoji.

import * as copy from "../../utils/multiplayer/copy";
import {
	CLIENT_ERROR_COPY,
	CONNECTION_COPY,
	PROTOCOL_ERROR_COPY,
	RESULT_REASON_COPY,
	connectionCopy,
	errorCopy,
	fill,
	inviteLine,
	joinNames,
	resultCopy,
	resultHeadline,
	scoreLine,
} from "../../utils/multiplayer/copy";
import type { ProtocolErrorCode, RoomResult, RoomSnapshot } from "../../multiplayer/protocol";
import type { PlayConnectionState, PlayStopReason } from "../../utils/multiplayer/client";
import { TEST_LOOK } from "../../multiplayer/testkit";

// The same pattern the lint and lint:web gates use (.eslintrc.js EMOJI_RE).
const EMOJI = /(\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F]|\uD83E[\uDD00-\uDEFF]|[☀-☄☆-♤♦-✒✔✖-✥✨-➿])/;
const EM_DASH = "—";

const ALL_PROTOCOL_ERRORS: ProtocolErrorCode[] = [
	"not_your_turn",
	"illegal_move",
	"bad_action",
	"game_over",
	"unauthorized",
	"protocol_mismatch",
	"bad_request",
	"not_found",
	"forbidden",
	"blocked",
	"full",
	"expired",
	"busy",
	"stale",
	"rate_limited",
	"disabled",
	"game_unavailable",
	"internal",
];
const ALL_REASONS: RoomResult["reason"][] = ["complete", "forfeit", "ended_early", "server"];
const ALL_STOPS: PlayStopReason[] = ["protocol_mismatch", "disabled", "unauthorized", "signed_in_elsewhere", "signed_out"];

function strings(value: unknown, out: string[] = []): string[] {
	if (typeof value === "string") out.push(value);
	else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
	else if (value && typeof value === "object") Object.values(value).forEach((v) => strings(v, out));
	return out;
}

function expectClean(text: string) {
	expect(text.includes(EM_DASH)).toBe(false);
	expect(EMOJI.test(text)).toBe(false);
}

function table(seats: { name: string; gone?: boolean }[], result: RoomResult | null, you: number | null = 0): RoomSnapshot {
	return {
		roomId: "0000aaaa-room",
		game: "fence_the_pen",
		rulesVersion: 1,
		pace: "live",
		source: "queue",
		phase: result ? "ended" : "playing",
		seats: seats.map((s, seat) => ({ seat, userId: `u${seat}`, name: s.name, look: TEST_LOOK, connected: !s.gone, gone: !!s.gone })),
		seatCount: seats.length,
		you,
		view: null,
		activeSeats: [],
		deadline: null,
		startsAt: null,
		rev: 9,
		events: [],
		result,
		invite: null,
		rematch: null,
		host: null,
	};
}

const pigs = [{ name: "Rosie" }, { name: "Copper" }];
const done = (r: Partial<RoomResult>): RoomResult => ({ kind: "win", winners: [0], scores: [5, 4], summary: "5 pens to 4", reason: "complete", ...r });

describe("coverage", () => {
	it("has a line for every protocol error code", () => {
		expect(Object.keys(PROTOCOL_ERROR_COPY).sort()).toEqual([...ALL_PROTOCOL_ERRORS].sort());
		for (const code of ALL_PROTOCOL_ERRORS) {
			expect(errorCopy(code)).toBe(PROTOCOL_ERROR_COPY[code]);
			expect(PROTOCOL_ERROR_COPY[code].length).toBeGreaterThan(5);
		}
	});

	it("has a line for every client-side failure, and a safe default", () => {
		for (const code of ["timeout", "offline", "disconnected"] as const) expect(errorCopy(code)).toBe(CLIENT_ERROR_COPY[code]);
		expect(errorCopy(null)).toBe(PROTOCOL_ERROR_COPY.internal);
		expect(errorCopy("brand_new_code" as never)).toBe(PROTOCOL_ERROR_COPY.internal);
	});

	it("has a line for every way a table ends", () => {
		expect(Object.keys(RESULT_REASON_COPY).sort()).toEqual([...ALL_REASONS].sort());
	});

	it("has a banner for every stop reason and the moving states", () => {
		const conn = (status: PlayConnectionState["status"], reason: PlayStopReason | null = null): PlayConnectionState => ({ status, reason, attempt: 0, retryAt: null });
		for (const reason of ALL_STOPS) expect(connectionCopy(conn("stopped", reason))).toBe(CONNECTION_COPY.stopped[reason]);
		expect(connectionCopy(conn("connecting"))).toBe(CONNECTION_COPY.connecting);
		expect(connectionCopy(conn("reconnecting"))).toBe(CONNECTION_COPY.reconnecting);
		expect(connectionCopy(conn("open"))).toBeNull();
		expect(connectionCopy(conn("idle"))).toBeNull();
		expect(connectionCopy(conn("suspended"))).toBeNull();
	});
});

describe("result headlines", () => {
	it("reads a win from both seats", () => {
		const won = table(pigs, done({}));
		expect(resultCopy(won)).toEqual({ headline: "You took it", detail: "5 pens to 4" });
		expect(resultCopy({ ...won, you: 1 })).toEqual({ headline: "Rosie took it", detail: "5 pens to 4" });
		expect(resultHeadline({ ...won, you: null })).toBe("Rosie took it");
	});

	it("calls a draw a draw, and names who shared the top place", () => {
		expect(resultCopy(table(pigs, done({ kind: "draw", winners: [], summary: "4 to 4" })))?.headline).toBe("A draw");
		// Two pigs level is just a draw, whoever is looking.
		expect(resultCopy(table(pigs, done({ kind: "draw", winners: [0, 1], summary: "4 to 4" })))?.headline).toBe("A draw");
		const three = [...pigs, { name: "Pepper" }];
		const shared = done({ kind: "draw", winners: [0, 2], scores: [3, 1, 3], summary: "" });
		expect(resultCopy(table(three, shared, 0))?.headline).toBe("You shared the win");
		expect(resultCopy(table(three, shared, 2))?.headline).toBe("You shared the win");
		expect(resultCopy(table(three, shared, 1))?.headline).toBe("Rosie and Pepper shared it");
		// Every seat level is the whole table drawing.
		expect(resultCopy(table(three, done({ kind: "draw", winners: [0, 1, 2], scores: [2, 2, 2] })))?.headline).toBe("A draw");
	});

	it("speaks the scores in seat order when the game gave no summary", () => {
		const three = [{ name: "Rosie" }, { name: "Clover" }, { name: "Biscuit" }];
		const result = done({ winners: [0], scores: [54, 47, 31], summary: "" });
		expect(resultCopy(table(three, result))).toEqual({ headline: "You took it", detail: "Rosie 54 · Clover 47 · Biscuit 31" });
		expect(scoreLine(table(three, result), result)).toBe("Rosie 54 · Clover 47 · Biscuit 31");
		// The game's own line still wins when it has one.
		expect(resultCopy(table(three, { ...result, summary: "54 truffles" }))?.detail).toBe("54 truffles");
		// No scores, no line.
		expect(resultCopy(table(pigs, done({ scores: [], summary: "" })))?.detail).toBeNull();
		// A co-op table never gets a ranking out of its shared score.
		expect(resultCopy(table(pigs, done({ kind: "coop", winners: [0, 1], success: true, scores: [5, 5], summary: "" })))?.detail).toBe(
			"Every pig played their part.",
		);
	});

	it("never blames a pig at a co-op table", () => {
		const short = resultCopy(table(pigs, done({ kind: "coop", winners: [0, 1], success: false, summary: "" })));
		expect(short).toEqual({ headline: "So close, together", detail: "Every pig played their part. Next time, together." });
		expect(resultCopy(table(pigs, done({ kind: "coop", winners: [0, 1], success: true, summary: "5 truffles" })))).toEqual({
			headline: "You did it together",
			detail: "5 truffles",
		});
		expect(resultCopy(table(pigs, done({ kind: "coop", winners: [0, 1], success: undefined, summary: "" })))?.headline).toBe("What a round");
		for (const result of [short]) expect(`${result?.headline} ${result?.detail}`).not.toMatch(/Rosie|Copper/);
	});

	it("says who had to head home on a forfeit and on an early end", () => {
		const forfeit = table([{ name: "Rosie" }, { name: "Copper", gone: true }], done({ reason: "forfeit", summary: "" }));
		expect(resultCopy(forfeit)).toEqual({ headline: "You took it", detail: "Copper had to head home." });
		expect(resultCopy({ ...forfeit, you: 1 })).toEqual({ headline: "The table moved on", detail: "The table moved on without you." });
		const early = table([{ name: "Rosie" }, { name: "Copper", gone: true }], done({ kind: "no_contest", winners: [], scores: [], summary: "", reason: "ended_early" }));
		expect(resultCopy(early)).toEqual({ headline: "Ended early", detail: "Copper had to head home." });
	});

	it("calls a table where everyone idled out a doze, not a forfeit", () => {
		const idle = table(
			[{ name: "Rosie", gone: true }, { name: "Copper", gone: true }],
			done({ kind: "no_contest", winners: [], scores: [], summary: "", reason: "ended_early" }),
		);
		expect(resultCopy(idle)).toEqual({ headline: "Everyone dozed off", detail: "No result this time." });
	});

	it("puts a server stop on the table, not on a pig", () => {
		const server = table(pigs, done({ kind: "no_contest", winners: [], scores: [], summary: "", reason: "server" }));
		expect(resultCopy(server)).toEqual({ headline: "The table took a breather", detail: "No result this time." });
	});

	it("has nothing to say while the table is still going", () => {
		expect(resultCopy(table(pigs, null))).toBeNull();
		expect(resultCopy(null)).toBeNull();
	});
});

describe("helpers", () => {
	it("fills templates and joins names", () => {
		expect(fill("{name} invited you to play {game}", { name: "Copper", game: "Mud Volley" })).toBe("Copper invited you to play Mud Volley");
		expect(fill("{name} and {who}", { name: "Copper" })).toBe("Copper and {who}");
		expect(joinNames(["Copper"])).toBe("Copper");
		expect(joinNames(["Copper", "Pepper"])).toBe("Copper and Pepper");
		expect(joinNames(["Copper", "Pepper", "Bandit"])).toBe("Copper, Pepper and Bandit");
		expect(inviteLine({ from: { userId: "u", name: "Pickles", look: TEST_LOOK } }, "Rootle")).toBe("Pickles invited you to play Rootle");
	});
});

describe("taste", () => {
	it("has no em dash and no emoji in any string it exports", () => {
		const all = strings(copy);
		expect(all.length).toBeGreaterThan(60);
		for (const text of all) expectClean(text);
	});

	it("has no em dash and no emoji in any headline it builds", () => {
		const results: RoomResult[] = [
			done({}),
			done({ kind: "draw", winners: [] }),
			done({ kind: "draw", winners: [0, 1] }),
			done({ kind: "coop", success: true }),
			done({ kind: "coop", success: false }),
			done({ kind: "coop", success: undefined }),
			done({ reason: "forfeit" }),
			done({ kind: "no_contest", winners: [], reason: "ended_early" }),
			done({ kind: "no_contest", winners: [], reason: "server" }),
		];
		for (const result of results) {
			for (const you of [0, 1, null]) {
				for (const seats of [pigs, [{ name: "Rosie", gone: true }, { name: "Copper" }], [{ name: "Rosie", gone: true }, { name: "Copper", gone: true }]]) {
					const lines = resultCopy(table(seats, result, you));
					expectClean(lines?.headline ?? "");
					expectClean(lines?.detail ?? "");
				}
			}
		}
	});
});

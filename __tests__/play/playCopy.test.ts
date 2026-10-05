// The Play screens' words and the pure rules under them
// (components/play/playCopy.ts): what leaving costs, said per kind of table;
// the hub's tags, time lines and game lines; the clock's who-owes words;
// and a scan of every exported string for an em dash or an emoji.

import * as playCopy from "@/components/play/playCopy";
import {
	asyncLine,
	clockWho,
	countdownHeadline,
	defaultPace,
	elapsedWords,
	gameTags,
	gamesLine,
	leaveDialog,
	leftWords,
	monthName,
	resultWords,
	seatsLabel,
	winsWords,
	withLine,
} from "@/components/play/playCopy";
import { EMOTE_LABEL } from "@/components/play/emoteArt";
import type { RoomSnapshot, SeatInfo } from "@/multiplayer/protocol";
import { TEST_LOOK } from "@/multiplayer/testkit";

const EM_DASH = "\u2014";
const EMOJI = /[\u{1F300}-\u{1FAFF}]|[\u2600-\u2604\u2606-\u2664\u2666-\u2712\u2714\u2716-\u2725\u2728-\u27BF]/u;

function seat(n: number, name: string, over: Partial<SeatInfo> = {}): SeatInfo {
	return { seat: n, userId: `u${n}`, name, look: TEST_LOOK, connected: true, gone: false, ...over };
}

function room(over: Partial<RoomSnapshot> = {}): RoomSnapshot {
	return {
		roomId: "11111111-aaaa",
		game: "fence_the_pen",
		rulesVersion: 1,
		pace: "live",
		source: "queue",
		phase: "playing",
		seats: [seat(0, "Rosie"), seat(1, "Bandit")],
		seatCount: 2,
		you: 0,
		view: {},
		activeSeats: [0],
		deadline: null,
		startsAt: null,
		rev: 3,
		events: [],
		result: null,
		invite: null,
		rematch: null,
		host: null,
		...over,
	};
}

const COMPETITIVE = { kind: "competitive" as const, seats: { min: 2 } };
const COOP = { kind: "cooperative" as const, seats: { min: 2 } };

function allStrings(value: unknown, out: string[] = []): string[] {
	if (typeof value === "string") out.push(value);
	else if (value && typeof value === "object") for (const v of Object.values(value)) allStrings(v, out);
	return out;
}

describe("leaveDialog: what leaving costs, said before it happens", () => {
	it("a live competitive table with one other pig: that pig takes the win", () => {
		const copy = leaveDialog(room(), COMPETITIVE, false);
		expect(copy).toMatchObject({ title: "Leave the table?", body: "Bandit takes the win.", confirmLabel: "Leave", cancelLabel: "Stay" });
	});

	it("a live competitive table with several others: they play on", () => {
		const r = room({ seats: [seat(0, "Rosie"), seat(1, "Bandit"), seat(2, "Clover")], seatCount: 3 });
		expect(leaveDialog(r, COMPETITIVE, false)?.body).toBe("Bandit and Clover play on without you.");
	});

	it("a co-op table that would drop below its minimum ends for everyone", () => {
		const copy = leaveDialog(room({ game: "snout_says" }), COOP, false);
		expect(copy).toMatchObject({ title: "Leave?", body: "The game ends for everyone." });
	});

	it("a co-op table that still has enough pigs plays on", () => {
		const r = room({ game: "snout_says", seats: [seat(0, "Rosie"), seat(1, "Bandit"), seat(2, "Clover")], seatCount: 3 });
		expect(leaveDialog(r, COOP, false)?.body).toBe("Bandit and Clover play on without you.");
	});

	it("a pig who has already gone is not counted among those who play on", () => {
		const r = room({ seats: [seat(0, "Rosie"), seat(1, "Bandit"), seat(2, "Clover", { gone: true })], seatCount: 3 });
		expect(leaveDialog(r, COMPETITIVE, false)?.body).toBe("Bandit takes the win.");
	});

	it("a play-by-post table resigns, and keeps playing is the other answer", () => {
		const copy = leaveDialog(room({ pace: "async" }), COMPETITIVE, false);
		expect(copy).toMatchObject({ title: "Resign this table?", body: "Bandit takes the win.", confirmLabel: "Resign", cancelLabel: "Keep playing" });
		expect(leaveDialog(room({ pace: "async", game: "snout_says" }), COOP, false)).toMatchObject({ title: "Leave this table?", confirmLabel: "Leave" });
	});

	it("an open chair nobody has taken yet: the table packs up", () => {
		const r = room({ pace: "async", seats: [seat(0, "Rosie")], seatCount: 2 });
		expect(leaveDialog(r, COMPETITIVE, false)?.body).toBe("Nobody else has sat down yet, so the table packs up.");
	});

	it("the lobby host calls the table off; a guest just stands up", () => {
		const lobby = room({ phase: "lobby", host: 0, activeSeats: [] });
		expect(leaveDialog(lobby, COMPETITIVE, false)).toMatchObject({ title: "Call off the table?", confirmLabel: "Call it off", cancelLabel: "Keep it open" });
		expect(leaveDialog({ ...lobby, you: 1 }, COMPETITIVE, false)).toBeNull();
	});

	it("costs nothing to leave: practice, a finished table, a pig not seated", () => {
		expect(leaveDialog(room(), COMPETITIVE, true)).toBeNull();
		expect(leaveDialog(room({ phase: "ended" }), COMPETITIVE, false)).toBeNull();
		expect(leaveDialog(room({ you: null }), COMPETITIVE, false)).toBeNull();
		expect(leaveDialog(room({ seats: [seat(0, "Rosie", { gone: true }), seat(1, "Bandit")] }), COMPETITIVE, false)).toBeNull();
	});

	it("the countdown asks too: starting is already a table", () => {
		expect(leaveDialog(room({ phase: "starting" }), COMPETITIVE, false)?.body).toBe("Bandit takes the win.");
	});
});

describe("the hub's small words", () => {
	it("tags how many, how fast and co-op, and hides by post when the server turns it off", () => {
		expect(seatsLabel({ min: 2, max: 4 })).toBe("2–4 pigs");
		expect(seatsLabel({ min: 2, max: 2 })).toBe("2 pigs");
		expect(gameTags({ seats: { min: 2, max: 4 }, paces: ["live", "async"], kind: "cooperative" }, true)).toEqual(["2–4 pigs", "live", "by post", "co-op"]);
		expect(gameTags({ seats: { min: 2, max: 2 }, paces: ["live", "async"], kind: "competitive" }, false)).toEqual(["2 pigs", "live"]);
	});

	it("says time left in the hand voice, never zero minutes", () => {
		expect(leftWords(20_000)).toBe("under a minute left");
		expect(leftWords(12 * 60_000 + 5_000)).toBe("12m left");
		expect(leftWords(3 * 3_600_000 + 10 * 60_000)).toBe("3h 10m left");
		expect(leftWords(11 * 3_600_000 + 10 * 60_000)).toBe("11h left");
		expect(leftWords(0)).toBe("closing now");
	});

	it("counts a search up from seconds", () => {
		expect(elapsedWords(12_400)).toBe("12s");
		expect(elapsedWords(65_000)).toBe("1m 05s");
	});

	it("names what a search is for", () => {
		expect(gamesLine(["Rootle"], 5)).toBe("Rootle");
		expect(gamesLine(["Rootle", "Fence the Pen"], 5)).toBe("Rootle or Fence the Pen");
		expect(gamesLine(["a", "b", "c", "d", "e"], 5)).toBe("any of the five");
	});

	it("says who is at a table, or that a chair waits", () => {
		expect(withLine(["Bandit"])).toBe("with Bandit");
		expect(withLine(["Bandit", "Clover", "Pepper"])).toBe("with Bandit, Clover and Pepper");
		expect(withLine([])).toBe("an open seat, waiting for a pig");
	});

	it("never says zero wins, and spells the month", () => {
		expect(winsWords(1)).toBe("1 win");
		expect(winsWords(3)).toBe("3 wins");
		expect(monthName("2026-10")).toBe("october");
		expect(monthName("nope")).toBeNull();
		expect(defaultPace(["async"])).toBe("async");
		expect(defaultPace(["live", "async"])).toBe("live");
	});
});

describe("the table's lines", () => {
	it("the countdown says who you found", () => {
		expect(countdownHeadline(room({ source: "queue" }), false)).toBe("Found a pig!");
		expect(countdownHeadline(room({ source: "queue", seats: [seat(0, "A"), seat(1, "B"), seat(2, "C")] }), false)).toBe("Found some pigs!");
		expect(countdownHeadline(room({ source: "invite" }), false)).toBe("Everyone's here");
		expect(countdownHeadline(room({ source: "rematch" }), false)).toBe("Again!");
		expect(countdownHeadline(room({ source: "queue" }), true)).toBe("The practice pigs are ready");
	});

	it("the clock names whoever owes the move", () => {
		expect(clockWho(room({ activeSeats: [0] }))).toBe("Your move");
		expect(clockWho(room({ activeSeats: [1] }))).toBe("Bandit's move");
		expect(clockWho(room({ activeSeats: [0, 1] }))).toBe("Everyone picks");
		expect(clockWho(room({ seats: [seat(0, "Rosie"), seat(1, "Bandit"), seat(2, "Clover")], activeSeats: [1, 2] }))).toBe("Waiting for Bandit and Clover");
	});

	it("a by-post table reads as a line, not a ticking clock", () => {
		const now = 1_000_000;
		expect(asyncLine(room({ pace: "async", activeSeats: [0], deadline: now + 11 * 3_600_000 }), now)).toBe("Your move · 11h left");
		expect(asyncLine(room({ pace: "async", activeSeats: [1], deadline: now + 3_600_000 }), now)).toBe("Waiting for Bandit · we'll ping you");
		expect(asyncLine(room({ pace: "async", seats: [seat(0, "Rosie")], activeSeats: [1] }), now)).toBe(
			"Waiting for a pig to take the open seat · we'll ping you",
		);
	});
});

describe("resultWords: a table that went on without you", () => {
	const gone = [seat(0, "Rosie", { gone: true }), seat(1, "Bandit")];
	it("a forfeit you were on the wrong side of names who took it, and blames nobody", () => {
		const words = resultWords(room({ phase: "ended", seats: gone, result: { kind: "win", winners: [1], scores: [0, 0], summary: "", reason: "forfeit" } }));
		expect(words).toEqual({ headline: "Bandit took it", detail: "The table moved on without you." });
	});

	it("an early end with only you gone keeps its headline and says the same line", () => {
		const words = resultWords(room({ phase: "ended", seats: gone, result: { kind: "no_contest", winners: [], scores: [], summary: "", reason: "ended_early" } }));
		expect(words).toEqual({ headline: "Ended early", detail: "The table moved on without you." });
	});

	it("leaves every other ending in the protocol's own words", () => {
		const won = room({ phase: "ended", seats: [seat(0, "Rosie"), seat(1, "Bandit", { gone: true })], result: { kind: "win", winners: [0], scores: [1, 0], summary: "", reason: "forfeit" } });
		expect(resultWords(won)).toEqual({ headline: "You took it", detail: "Bandit had to head home." });
		const idle = room({ phase: "ended", seats: [seat(0, "Rosie", { gone: true }), seat(1, "Bandit", { gone: true })], result: { kind: "no_contest", winners: [], scores: [], summary: "", reason: "ended_early" } });
		expect(resultWords(idle)).toEqual({ headline: "Everyone dozed off", detail: "No result this time." });
	});
});

describe("every word the Play screens say", () => {
	const strings = [...allStrings(playCopy), ...allStrings(EMOTE_LABEL)];

	it("has words to scan", () => {
		expect(strings.length).toBeGreaterThan(150);
	});

	it("carries no em dash and no emoji", () => {
		for (const s of strings) {
			expect(s.includes(EM_DASH)).toBe(false);
			expect(EMOJI.test(s)).toBe(false);
		}
	});

	it("never invents a population count or a wait estimate", () => {
		for (const s of strings) {
			expect(s).not.toMatch(/\b\d+\s+(pigs?|players?)\s+(online|waiting|looking|about)\b/i);
			expect(s).not.toMatch(/\b(about|around|usually|average)\b.*\b(seconds?|minutes?)\b/i);
		}
	});
});

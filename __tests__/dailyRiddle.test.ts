// The Sheep's Riddle's rules (utils/dailyRiddle.ts):
//   • the deal is a pure function of the UTC day: the same day gives the
//     same riddle, every day of 2026 and 2027 deals, and nine answers hold
//     exactly one picture kin to all three clues
//   • clues show in order, one at a time, never past three
//   • two guesses: a hit solves, two misses fail, nothing moves after
//   • the book persists the day's play and the solved tally, and a stale,
//     corrupt or forged record starts today fresh
import { PICTURE_IDS, kinship } from "@/multiplayer/games/snout_says/deck";
import {
	RIDDLE_ANSWERS,
	RIDDLE_CLUES,
	RIDDLE_EPOCH,
	RIDDLE_GUESSES,
	dealRiddle,
	freshBook,
	guessAnswer,
	guessInBook,
	guessesLeft,
	isKinToAll,
	nextRiddleAt,
	openBook,
	revealInBook,
	revealNextClue,
	riddleFanLine,
	riddleNumber,
	riddleOutcome,
	serializeBook,
	shareLine,
	sharedTags,
	startPlay,
	utcDayKey,
	type DailyRiddle,
} from "@/utils/dailyRiddle";

const DAY_MS = 86_400_000;

function everyDay(fromIso: string, toIso: string): string[] {
	const out: string[] = [];
	for (let t = Date.parse(`${fromIso}T00:00:00Z`); t <= Date.parse(`${toIso}T00:00:00Z`); t += DAY_MS) {
		out.push(new Date(t).toISOString().slice(0, 10));
	}
	return out;
}

const TODAY = "2026-10-29";
const riddle = dealRiddle(TODAY);
const wrong = (r: DailyRiddle, n = 0) => r.answers.filter((a) => a !== r.secret)[n];

describe("the deal", () => {
	it("is the same riddle for the same day, every time", () => {
		expect(dealRiddle(TODAY)).toEqual(dealRiddle(TODAY));
		expect(dealRiddle("2027-03-14")).toEqual(dealRiddle("2027-03-14"));
	});

	it("changes from one day to the next", () => {
		const days = everyDay("2026-11-01", "2026-11-30").map(dealRiddle);
		const distinct = new Set(days.map((r) => `${r.secret}|${r.clues.join(",")}`));
		expect(distinct.size).toBeGreaterThan(25);
	});

	it("deals every day of 2026 and 2027 with exactly one answer kin to all three clues", () => {
		for (const day of everyDay("2026-01-01", "2027-12-31")) {
			const r = dealRiddle(day);
			expect(r.day).toBe(day);
			expect(r.clues).toHaveLength(RIDDLE_CLUES);
			expect(r.answers).toHaveLength(RIDDLE_ANSWERS);
			expect(new Set([...r.clues, ...r.answers]).size).toBe(RIDDLE_CLUES + RIDDLE_ANSWERS);
			for (const p of [...r.clues, ...r.answers]) expect(PICTURE_IDS).toContain(p);
			const kin = r.answers.filter((a) => isKinToAll(a, r.clues));
			expect(kin).toEqual([r.secret]);
			for (const c of r.clues) expect(kinship(c, r.secret)).toBeGreaterThan(0);
		}
	});

	it("uses clues that share two tags with the answer whenever the deck has three", () => {
		for (const r of everyDay("2026-11-01", "2026-12-31").map(dealRiddle)) {
			const strongInDeck = PICTURE_IDS.filter((p) => p !== r.secret && kinship(p, r.secret) >= 2).length;
			const strongClues = r.clues.filter((c) => kinship(c, r.secret) >= 2).length;
			expect(strongClues).toBe(Math.min(RIDDLE_CLUES, strongInDeck));
		}
	});

	it("numbers riddles from the epoch and turns over at UTC midnight", () => {
		expect(riddleNumber(RIDDLE_EPOCH)).toBe(1);
		expect(riddleNumber("2026-11-09")).toBe(12);
		expect(utcDayKey(new Date("2026-10-29T23:59:59Z"))).toBe("2026-10-29");
		expect(utcDayKey(new Date("2026-10-30T00:00:00Z"))).toBe("2026-10-30");
		expect(nextRiddleAt(new Date("2026-10-29T17:20:00Z")).toISOString()).toBe("2026-10-30T00:00:00.000Z");
	});

	it("still deals for a malformed day", () => {
		const r = dealRiddle("not-a-day");
		expect(r.answers).toHaveLength(RIDDLE_ANSWERS);
		expect(r.answers.filter((a) => isKinToAll(a, r.clues))).toEqual([r.secret]);
	});

	it("names the tags a clue and the answer share", () => {
		expect(sharedTags("pinecone", "acorn")).toEqual(["plant", "wood"]);
		expect(sharedTags("clover", "marble")).toEqual([]);
	});
});

describe("the clues", () => {
	it("start with one up and show in order, never past three", () => {
		let play = startPlay(TODAY);
		expect(play.revealed).toBe(1);
		play = revealNextClue(riddle, play);
		expect(play.revealed).toBe(2);
		play = revealNextClue(riddle, play);
		expect(play.revealed).toBe(3);
		const after = revealNextClue(riddle, play);
		expect(after).toBe(play);
	});

	it("stop showing once the riddle is over", () => {
		const solved = guessAnswer(riddle, startPlay(TODAY), riddle.secret);
		expect(revealNextClue(riddle, solved)).toBe(solved);
	});
});

describe("the guesses", () => {
	it("solve on the first guess", () => {
		const play = guessAnswer(riddle, startPlay(TODAY), riddle.secret);
		expect(riddleOutcome(riddle, play)).toBe("solved");
		expect(guessesLeft(play)).toBe(1);
	});

	it("solve on the second guess after a miss", () => {
		let play = guessAnswer(riddle, startPlay(TODAY), wrong(riddle));
		expect(riddleOutcome(riddle, play)).toBe("playing");
		expect(guessesLeft(play)).toBe(1);
		play = guessAnswer(riddle, play, riddle.secret);
		expect(riddleOutcome(riddle, play)).toBe("solved");
	});

	it("fail after two misses, and nothing moves after", () => {
		let play = guessAnswer(riddle, startPlay(TODAY), wrong(riddle, 0));
		play = guessAnswer(riddle, play, wrong(riddle, 1));
		expect(play.guesses).toHaveLength(RIDDLE_GUESSES);
		expect(riddleOutcome(riddle, play)).toBe("failed");
		expect(guessAnswer(riddle, play, riddle.secret)).toBe(play);
	});

	it("ignore a repeat, a clue, or a picture that is not one of the nine", () => {
		const once = guessAnswer(riddle, startPlay(TODAY), wrong(riddle));
		expect(guessAnswer(riddle, once, wrong(riddle))).toBe(once);
		expect(guessAnswer(riddle, once, riddle.clues[0])).toBe(once);
		const stranger = PICTURE_IDS.find((p) => !riddle.answers.includes(p) && !riddle.clues.includes(p))!;
		expect(guessAnswer(riddle, once, stranger)).toBe(once);
	});
});

describe("the book", () => {
	it("round-trips today's play so reopening keeps the result", () => {
		let book = freshBook(riddle);
		book = revealInBook(riddle, book);
		book = guessInBook(riddle, book, wrong(riddle));
		book = guessInBook(riddle, book, riddle.secret);
		const reopened = openBook(serializeBook(book), riddle);
		expect(reopened).toEqual(book);
		expect(riddleOutcome(riddle, reopened.play)).toBe("solved");
		expect(reopened.play.revealed).toBe(2);
	});

	it("keeps a failed day failed", () => {
		let book = freshBook(riddle);
		book = guessInBook(riddle, book, wrong(riddle, 0));
		book = guessInBook(riddle, book, wrong(riddle, 1));
		const reopened = openBook(serializeBook(book), riddle);
		expect(riddleOutcome(riddle, reopened.play)).toBe("failed");
	});

	it("counts a solve exactly once", () => {
		let book = freshBook(riddle, 4);
		book = guessInBook(riddle, book, riddle.secret);
		expect(book.solved).toBe(5);
		expect(guessInBook(riddle, book, wrong(riddle))).toBe(book);
		let failed = freshBook(riddle, 4);
		failed = guessInBook(riddle, failed, wrong(riddle, 0));
		failed = guessInBook(riddle, failed, wrong(riddle, 1));
		expect(failed.solved).toBe(4);
	});

	it("starts a new day fresh and carries the tally", () => {
		let book = freshBook(riddle, 2);
		book = guessInBook(riddle, book, riddle.secret);
		const tomorrow = dealRiddle("2026-10-30");
		const next = openBook(serializeBook(book), tomorrow);
		expect(next.play).toEqual(startPlay("2026-10-30"));
		expect(next.solved).toBe(3);
	});

	it("starts fresh on a missing, corrupt or forged record", () => {
		expect(openBook(null, riddle)).toEqual(freshBook(riddle));
		expect(openBook("{not json", riddle)).toEqual(freshBook(riddle));
		expect(openBook("42", riddle)).toEqual(freshBook(riddle));
		const forged = (play: unknown) => openBook(JSON.stringify({ play, solved: 7 }), riddle);
		expect(forged({ day: TODAY, revealed: 9, guesses: [] })).toEqual(freshBook(riddle, 7));
		expect(forged({ day: TODAY, revealed: 1, guesses: [wrong(riddle), wrong(riddle)] })).toEqual(freshBook(riddle, 7));
		expect(forged({ day: TODAY, revealed: 1, guesses: [riddle.secret, wrong(riddle)] })).toEqual(freshBook(riddle, 7));
		expect(forged({ day: TODAY, revealed: 1, guesses: ["unicorn"] })).toEqual(freshBook(riddle, 7));
		expect(openBook(JSON.stringify({ play: startPlay(TODAY), solved: -3 }), riddle).solved).toBe(0);
	});
});

describe("the copy", () => {
	it("writes a plain share line with no emoji or em dash", () => {
		const day = dealRiddle("2026-11-09");
		let play = revealNextClue(day, startPlay(day.day));
		play = guessAnswer(day, play, day.secret);
		expect(shareLine(day, play)).toBe("The Sheep's Riddle 12 · got it in 1 · 2 clues");
		let lost = guessAnswer(day, startPlay(day.day), wrong(day, 0));
		lost = guessAnswer(day, lost, wrong(day, 1));
		expect(shareLine(day, lost)).toBe("The Sheep's Riddle 12 · the sheep kept this one");
		for (const line of [shareLine(day, play), shareLine(day, lost)]) {
			expect(line).not.toMatch(/—|\p{Extended_Pictographic}/u);
		}
	});

	it("says where the day stands on the fan", () => {
		const fresh = startPlay(TODAY);
		expect(riddleFanLine(riddle, fresh)).toBe("three clues, nine pictures");
		const missed = guessAnswer(riddle, fresh, wrong(riddle));
		expect(riddleFanLine(riddle, missed)).toBe("one guess left");
		expect(riddleFanLine(riddle, guessAnswer(riddle, missed, riddle.secret))).toBe("got it in 2 · back tomorrow");
		expect(riddleFanLine(riddle, guessAnswer(riddle, missed, wrong(riddle, 1)))).toBe("the sheep kept it · back tomorrow");
	});
});

// Snout Says rules: the deal, the cancel rule, the free sniff, 2/1/0
// scoring, dims, guesser rotation (a departed seat included), every beat's
// timeout and clock, secrecy, determinism, the practice pigs, and whole
// tables fuzzed through the real room engine.

import {
	SNOUT_SAYS_TUNING,
	constructiveDeal,
	dealRound,
	snout_says,
	type Deal,
	type SnoutSaysAction,
	type SnoutSaysState,
	type SnoutSaysView,
} from "../../multiplayer/games/snout_says/rules";
import {
	DIG_PICTURES,
	FIND_PICTURES,
	PICTURE_IDS,
	PICTURE_KIN,
	PICTURE_TAGS,
	isPictureId,
	kinCount,
	kinship,
	type PictureId,
} from "../../multiplayer/games/snout_says/deck";
import { applyAction, applyTimeouts, createRoom, markGone, snapshotFor, startGame, type RoomState } from "../../multiplayer/engine";
import { createRng } from "../../multiplayer/rng";
import { fuzz, playOut, testCards } from "../../multiplayer/testkit";
import type { Pace, Seat, StepContext } from "../../multiplayer/types";

const NOW = 1_700_000_000_000;
const TUNE = SNOUT_SAYS_TUNING;

function ctx(seed = "ctx", present: boolean[] = [true, true, true, true], now = NOW, pace: Pace = "live"): StepContext {
	return { now, rng: createRng(seed), pace, present };
}

function fresh(seats: number, pace: Pace = "live", seed = "fresh"): SnoutSaysState {
	return snout_says.setup({ seats, pace, rng: createRng(seed) });
}

// A round with a known deal: the answer is the red berries.
const SPREAD: PictureId[] = ["river_pebble", "blue_feather", "clover", "snail_shell", "brass_button", "wool_tuft", "red_berries", "pinecone", "old_key"];
const TARGET: PictureId = "red_berries";
const TRAY: PictureId[] = ["honeycomb", "marble", "tin_whistle", "acorn", "apple", "bag", "boom", "boot", "bow", "cap", "charm", "furnishing"];

function known(seats: number, pace: Pace = "live", base?: SnoutSaysState): SnoutSaysState {
	const s = base ?? fresh(seats, pace);
	if (!s.round) throw new Error("no round");
	return { ...s, round: { ...s.round, spread: SPREAD, target: TARGET, tray: TRAY } };
}

function act(state: SnoutSaysState, seat: Seat, action: SnoutSaysAction, c: StepContext = ctx()): SnoutSaysState {
	const res = snout_says.apply(state, seat, action, c);
	if (!res.ok) throw new Error(`refused: ${res.error}`);
	return res.state;
}

function clue(state: SnoutSaysState, seat: Seat, picture: PictureId, c?: StepContext) {
	return act(state, seat, { type: "clue", picture }, c);
}

function guess(state: SnoutSaysState, seat: Seat, picture: PictureId, c?: StepContext) {
	return act(state, seat, { type: "guess", picture }, c);
}

function expectDealInvariants(deal: Deal) {
	expect(deal.spread).toHaveLength(TUNE.spread);
	expect(new Set(deal.spread).size).toBe(TUNE.spread);
	expect(deal.spread).toContain(deal.target);
	expect(deal.tray).toHaveLength(TUNE.tray);
	expect(new Set(deal.tray).size).toBe(TUNE.tray);
	expect(deal.tray.filter((p) => deal.spread.includes(p))).toEqual([]);
	expect(kinCount(deal.tray, deal.target)).toBeGreaterThanOrEqual(TUNE.kindMinimum);
	for (const p of [...deal.spread, ...deal.tray]) expect(isPictureId(p)).toBe(true);
}

function liveRoom(seats: number, pace: Pace = "live", seed = "room"): RoomState {
	const room = createRoom({ roomId: "00000000-snout", game: snout_says, pace, source: "queue", seatCount: seats, seats: testCards(seats), seed, now: NOW });
	return startGame({ ...room, phase: "starting" }, snout_says, NOW);
}

function must(res: ReturnType<typeof applyAction>): RoomState {
	if (!res.ok) throw new Error(`refused: ${res.error}`);
	return res.room;
}

function game(room: RoomState): SnoutSaysState {
	return room.game as SnoutSaysState;
}

/** Plays the round in play through the engine with each Nose's first tray
 *  picture and the Guesser's right answer, at `at`. */
function playRoundRight(room: RoomState, at: number): RoomState {
	let r = room;
	const g = game(r);
	if (!g.round) throw new Error("over");
	for (const s of g.round.noses) {
		const picture = game(r).round?.tray[s % TUNE.tray];
		if (picture && r.activeSeats.includes(s)) r = must(applyAction(r, snout_says, s, { type: "clue", picture }, at));
	}
	const target = game(r).round?.target as PictureId;
	return must(applyAction(r, snout_says, game(r).round?.guesser as Seat, { type: "guess", picture: target }, at));
}

describe("the deck", () => {
	it("is the twelve finds and the fifteen dig things, each tagged two to four times", () => {
		expect(FIND_PICTURES).toHaveLength(12);
		expect(DIG_PICTURES).toHaveLength(15);
		expect(new Set(PICTURE_IDS).size).toBe(27);
		for (const id of PICTURE_IDS) {
			const tags = PICTURE_KIN[id];
			expect(tags.length).toBeGreaterThanOrEqual(2);
			expect(tags.length).toBeLessThanOrEqual(4);
			expect(new Set(tags).size).toBe(tags.length);
			for (const t of tags) expect(PICTURE_TAGS).toContain(t);
		}
	});

	it("gives every picture at least five kin, so a kind tray always exists", () => {
		for (const id of PICTURE_IDS) {
			expect(kinCount(PICTURE_IDS, id)).toBeGreaterThanOrEqual(5);
			for (const other of PICTURE_IDS) expect(kinship(id, other)).toBe(kinship(other, id));
		}
		expect(kinCount(["apple", "red_berries"], "apple")).toBe(1);
	});
});

describe("the deal", () => {
	it("puts the answer in the spread, keeps the tray off the spread, and is always kind", () => {
		for (let i = 0; i < 2_000; i++) expectDealInvariants(dealRound(createRng(`deal-${i}`)));
	});

	it("has a constructive fallback that holds the same invariants", () => {
		for (let i = 0; i < 500; i++) expectDealInvariants(constructiveDeal(createRng(`build-${i}`)));
	});

	it("deals every round of a real table by the same rules", () => {
		let rounds = 0;
		for (let i = 0; i < 20; i++) {
			playOut(snout_says, {
				seats: 2 + (i % 3),
				seed: `dealt-${i}`,
				onRevision: (room) => {
					const r = (room.game as SnoutSaysState).round;
					if (!r) return;
					rounds++;
					expectDealInvariants({ spread: r.spread, target: r.target, tray: r.tray });
				},
			});
		}
		expect(rounds).toBeGreaterThan(100);
	});
});

describe("setup", () => {
	it("plays six rounds live and three by post, seat 0 guessing first", () => {
		const live = fresh(3);
		expect(live.rounds).toBe(6);
		expect(fresh(3, "async").rounds).toBe(3);
		expect(live.phase).toBe("clue");
		expect(live.round?.guesser).toBe(0);
		expect(live.round?.noses).toEqual([1, 2]);
		expect(snout_says.activeSeats(live)).toEqual([1, 2]);
		expect(JSON.parse(JSON.stringify(live))).toEqual(live);
	});
});

describe("the clue beat", () => {
	it("takes one tray picture from each Nose and nothing from the Guesser", () => {
		const s = known(3);
		expect(snout_says.apply(s, 0, { type: "clue", picture: "apple" }, ctx())).toEqual({ ok: false, error: "not_your_turn" });
		expect(snout_says.apply(s, 1, { type: "clue", picture: "clover" }, ctx())).toEqual({ ok: false, error: "illegal_move" });
		expect(snout_says.apply(s, 1, { type: "guess", picture: "clover" }, ctx())).toEqual({ ok: false, error: "not_your_turn" });
		const picked = clue(s, 1, "apple");
		expect(snout_says.activeSeats(picked)).toEqual([2]);
		expect(picked.phase).toBe("clue");
	});

	it("makes picks final: the same picture again is a harmless resend, another is refused", () => {
		const s = clue(known(3), 1, "apple");
		const again = snout_says.apply(s, 1, { type: "clue", picture: "apple" }, ctx());
		expect(again).toEqual({ ok: true, state: s });
		expect(snout_says.apply(s, 1, { type: "clue", picture: "honeycomb" }, ctx())).toEqual({ ok: false, error: "illegal_move" });
	});

	it("cancels a picture two Noses both showed (three pigs), and the free sniff fogs three wrong tiles", () => {
		const s = clue(clue(known(3), 1, "apple"), 2, "apple");
		const r = s.round!;
		expect(s.phase).toBe("guess");
		expect(r.said).toEqual([
			{ seat: 1, picture: "apple", cancelled: true },
			{ seat: 2, picture: "apple", cancelled: true },
		]);
		expect(r.sniffed).toHaveLength(TUNE.freeSniff);
		expect(r.sniffed).not.toContain(TARGET);
		for (const p of r.sniffed) expect(SPREAD).toContain(p);
		expect(r.dimmed).toEqual(r.sniffed);
		const v = snout_says.view(s, 0);
		expect(v.clues).toEqual([]);
		expect(v.cancelled).toEqual(["apple"]);
	});

	it("keeps both clues when two Noses differ (three pigs)", () => {
		const s = clue(clue(known(3), 1, "apple"), 2, "honeycomb");
		expect(s.round!.said?.map((c) => c.cancelled)).toEqual([false, false]);
		expect(s.round!.sniffed).toEqual([]);
		expect(snout_says.view(s, 0).clues).toEqual(["apple", "honeycomb"]);
	});

	it("cancels the pair and keeps the odd one out (four pigs)", () => {
		let s = known(4);
		s = clue(clue(clue(s, 1, "acorn"), 2, "bow"), 3, "acorn");
		const v = snout_says.view(s, 0);
		expect(v.clues).toEqual(["bow"]);
		expect(v.cancelled).toEqual(["acorn"]);
		expect(v.said).toEqual([
			{ seat: 1, picture: "acorn", cancelled: true },
			{ seat: 2, picture: "bow", cancelled: false },
			{ seat: 3, picture: "acorn", cancelled: true },
		]);
		expect(v.sniffed).toEqual([]);
	});

	it("fogs three tiles when all three Noses think alike (four pigs)", () => {
		const s = clue(clue(clue(known(4), 1, "apple"), 2, "apple"), 3, "apple");
		expect(s.round!.said?.every((c) => c.cancelled)).toBe(true);
		expect(s.round!.sniffed).toHaveLength(3);
	});

	it("never cancels the one Nose of a two-pig table", () => {
		const s = clue(known(2), 1, "apple");
		expect(s.phase).toBe("guess");
		expect(snout_says.view(s, 0).clues).toEqual(["apple"]);
	});
});

describe("the guess beat", () => {
	const ready = () => clue(known(2), 1, "apple");

	it("scores 2 for a nose that knew", () => {
		const s = guess(ready(), 0, TARGET);
		expect(s.total).toBe(2);
		expect(s.done[0]).toMatchObject({ score: 2, outcome: "knew", guesses: [TARGET] });
	});

	it("scores 1 for nearly, after a wrong tap that dims the tile for everyone", () => {
		const once = guess(ready(), 0, "clover");
		expect(once.phase).toBe("guess");
		expect(once.round!.dimmed).toEqual(["clover"]);
		for (const seat of [0, 1]) expect(snout_says.view(once, seat).dimmed).toEqual(["clover"]);
		expect(snout_says.view(once, 0).guessesLeft).toBe(1);
		const s = guess(once, 0, TARGET);
		expect(s.total).toBe(1);
		expect(s.done[0]).toMatchObject({ score: 1, outcome: "nearly" });
	});

	it("scores 0 when it got away", () => {
		const s = guess(guess(ready(), 0, "clover"), 0, "pinecone");
		expect(s.total).toBe(0);
		expect(s.done[0]).toMatchObject({ score: 0, outcome: "got_away", guesses: ["clover", "pinecone"] });
	});

	it("refuses a dimmed tile (a resent wrong tap included), a fogged tile and a picture off the spread", () => {
		const once = guess(ready(), 0, "clover");
		expect(snout_says.apply(once, 0, { type: "guess", picture: "clover" }, ctx())).toEqual({ ok: false, error: "illegal_move" });
		expect(snout_says.apply(once, 0, { type: "guess", picture: "apple" }, ctx())).toEqual({ ok: false, error: "illegal_move" });
		expect(snout_says.apply(once, 1, { type: "guess", picture: TARGET }, ctx())).toEqual({ ok: false, error: "not_your_turn" });
		const fogged = clue(clue(known(3), 1, "apple"), 2, "apple");
		const fog = fogged.round!.sniffed[0];
		expect(snout_says.apply(fogged, 0, { type: "guess", picture: fog }, ctx())).toEqual({ ok: false, error: "illegal_move" });
	});

	it("keeps the scored round as lastRound and opens the next one at once", () => {
		const s = guess(ready(), 0, TARGET, ctx("next", [true, true], NOW + 5_000));
		expect(s.phase).toBe("clue");
		expect(s.round?.index).toBe(1);
		expect(s.round?.guesser).toBe(1);
		expect(s.round?.revealUntil).toBe(NOW + 5_000 + TUNE.revealMs.live);
		const last = snout_says.view(s, 1).lastRound;
		expect(last).toMatchObject({ index: 0, target: TARGET, clues: ["apple"], cancelled: [], guesses: [TARGET], score: 2, outcome: "knew" });
	});
});

describe("guesser rotation", () => {
	function guessersOf(seats: number, pace: Pace, leave?: { seat: Seat; atStep: number }): Seat[] {
		const seen: Seat[] = [];
		playOut(snout_says, {
			seats,
			pace,
			seed: `rotate-${seats}-${pace}-${leave?.seat ?? "x"}`,
			leave,
			onRevision: (room) => {
				const r = (room.game as SnoutSaysState).round;
				if (r && seen.length === r.index) seen.push(r.guesser);
			},
		});
		return seen;
	}

	it("rotates by seat order", () => {
		expect(guessersOf(2, "live")).toEqual([0, 1, 0, 1, 0, 1]);
		expect(guessersOf(3, "live")).toEqual([0, 1, 2, 0, 1, 2]);
		expect(guessersOf(4, "live")).toEqual([0, 1, 2, 3, 0, 1]);
		expect(guessersOf(4, "async")).toEqual([0, 1, 2]);
	});

	it("skips a pig that has left the table, as Guesser and as Nose", () => {
		const seen = guessersOf(3, "live", { seat: 1, atStep: 0 });
		expect(seen).toEqual([0, 2, 0, 2, 0, 2]);
		const room = playOut(snout_says, { seats: 3, seed: "gone-nose", leave: { seat: 1, atStep: 0 } }).room;
		expect(room.phase).toBe("ended");
		expect(room.result).toMatchObject({ kind: "coop", reason: "complete" });
		for (const r of game(room).done.slice(1)) expect(r.noses).not.toContain(1);
	});

	it("passes over a departed seat when the next round opens", () => {
		const s = clue(clue(known(3), 1, "apple"), 2, "bow");
		const next = act(s, 0, { type: "guess", picture: TARGET }, ctx("rot", [true, false, true]));
		expect(next.round?.guesser).toBe(2);
		expect(next.round?.noses).toEqual([0]);
	});

	it("resolves a departed Nose's pick through the engine and plays on", () => {
		let room = liveRoom(3);
		room = markGone(room, snout_says, 2, NOW + 1_000);
		expect(room.phase).toBe("playing");
		expect(room.activeSeats).toEqual([1]);
		room = must(applyAction(room, snout_says, 1, { type: "clue", picture: game(room).round!.tray[0] }, NOW + 2_000));
		expect(game(room).phase).toBe("guess");
		expect(room.activeSeats).toEqual([0]);
	});
});

describe("timeouts and the clock", () => {
	it("closes a clue beat nobody answered on the free sniff", () => {
		let s = known(3);
		s = snout_says.onTimeout(s, 1, ctx()).state;
		expect(s.phase).toBe("clue");
		s = snout_says.onTimeout(s, 2, ctx()).state;
		expect(s.phase).toBe("guess");
		expect(s.round!.said).toEqual([]);
		expect(s.round!.sniffed).toHaveLength(3);
	});

	it("closes a clue beat with the clues that came in", () => {
		const s = snout_says.onTimeout(clue(known(3), 1, "apple"), 2, ctx()).state;
		expect(s.phase).toBe("guess");
		expect(snout_says.view(s, 0).clues).toEqual(["apple"]);
	});

	it("leaves a missed guess in the mud, or got away after a wrong tap", () => {
		const ready = clue(known(2), 1, "apple");
		expect(snout_says.onTimeout(ready, 0, ctx()).state.done[0]).toMatchObject({ score: 0, outcome: "mud" });
		const once = guess(ready, 0, "clover");
		expect(snout_says.onTimeout(once, 0, ctx()).state.done[0]).toMatchObject({ score: 0, outcome: "got_away" });
	});

	it("changes nothing for a seat that owes nothing", () => {
		const s = known(3);
		expect(snout_says.onTimeout(s, 0, ctx()).state).toBe(s);
		const picked = clue(s, 1, "apple");
		expect(snout_says.onTimeout(picked, 1, ctx()).state).toBe(picked);
	});

	it("arms 10 s beats live, pads the next clue beat by the reveal, and keeps a shared clue deadline", () => {
		let room = liveRoom(3);
		expect(room.deadline).toBe(NOW + 10_000);
		const shared = room.deadline;
		room = must(applyAction(room, snout_says, 1, { type: "clue", picture: game(room).round!.tray[0] }, NOW + 1_000));
		expect(room.deadline).toBe(shared);
		room = must(applyAction(room, snout_says, 2, { type: "clue", picture: game(room).round!.tray[1] }, NOW + 2_000));
		expect(room.activeSeats).toEqual([0]);
		expect(room.deadline).toBe(NOW + 2_000 + 10_000);
		room = must(applyAction(room, snout_says, 0, { type: "guess", picture: game(room).round!.target }, NOW + 3_000));
		expect(room.deadline).toBe(NOW + 3_000 + 3_000 + 10_000);
	});

	it("gives the Guesser back reveal time a fast table did not spend", () => {
		let room = liveRoom(2);
		room = playRoundRight(room, NOW + 1_000); // round 1 opens; its reveal runs to NOW + 4 s
		const nose = game(room).round!.noses[0];
		room = must(applyAction(room, snout_says, nose, { type: "clue", picture: game(room).round!.tray[0] }, NOW + 2_000));
		expect(game(room).round!.guessPadMs).toBe(2_000);
		expect(room.deadline).toBe(NOW + 2_000 + 10_000 + 2_000);
		// A wrong first tap spends the pad: the second guess gets a plain beat.
		const wrong = game(room).round!.spread.find((p) => p !== game(room).round!.target) as PictureId;
		room = must(applyAction(room, snout_says, game(room).round!.guesser, { type: "guess", picture: wrong }, NOW + 3_000));
		expect(room.deadline).toBe(NOW + 3_000 + 10_000);
	});

	it("runs 12 h beats by post, with no reveal padding", () => {
		let room = liveRoom(2, "async");
		expect(room.deadline).toBe(NOW + 12 * 3_600_000);
		room = playRoundRight(room, NOW + 1_000);
		expect(game(room).round?.revealUntil).toBeNull();
		expect(room.deadline).toBe(NOW + 1_000 + 12 * 3_600_000);
	});

	it("resolves every beat by the clock alone, to a finished table", () => {
		let room = liveRoom(3);
		const outcomes: (string | null)[] = [];
		for (let i = 0; i < 40 && room.phase === "playing"; i++) {
			const before = game(room).done.length;
			room = applyTimeouts(room, snout_says, room.deadline as number);
			if (game(room).done.length > before) outcomes.push(game(room).done[before].outcome);
		}
		// Every pig idles out together: the engine calls it a no contest, and
		// every round the clock did resolve read "in the mud".
		expect(room.phase).toBe("ended");
		expect(room.result).toMatchObject({ kind: "no_contest", reason: "ended_early" });
		expect(outcomes.length).toBeGreaterThan(0);
		expect(outcomes.every((o) => o === "mud")).toBe(true);
	});

	it("plays a round with no Nose left at the table straight on the free sniff", () => {
		const s = clue(clue(known(3), 1, "apple"), 2, "bow");
		const next = act(s, 0, { type: "guess", picture: TARGET }, ctx("alone", [true, false, false]));
		expect(next.round?.guesser).toBe(0);
		expect(next.round?.noses).toEqual([]);
		expect(next.phase).toBe("guess");
		expect(next.round?.sniffed).toHaveLength(3);
		expect(snout_says.activeSeats(next)).toEqual([0]);
	});
});

describe("secrecy", () => {
	it("never shows the Guesser the answer, the tray or a pick", () => {
		const s = clue(known(3), 1, "apple");
		const v = snout_says.view(s, 0);
		expect(v.role).toBe("guesser");
		expect(v.nose).toBeNull();
		const json = JSON.stringify(v);
		expect(json).not.toContain('"target"');
		expect(json).not.toContain('"tray"');
		expect(json).not.toContain("apple");
		expect(v.noses).toEqual([
			{ seat: 1, status: "picked" },
			{ seat: 2, status: "thinking" },
		]);
	});

	it("never shows one Nose another Nose's pick before the clue beat closes", () => {
		const s = clue(known(3), 1, "honeycomb");
		const theirs = snout_says.view(s, 2);
		expect(theirs.nose).toEqual({ target: TARGET, tray: TRAY, myPick: null });
		expect(theirs.said).toBeNull();
		expect(JSON.stringify({ ...theirs, nose: null })).not.toContain("honeycomb");
		expect(snout_says.view(s, 1).nose?.myPick).toBe("honeycomb");
		const closed = clue(s, 2, "apple");
		expect(snout_says.view(closed, 2).said?.map((c) => c.picture)).toEqual(["honeycomb", "apple"]);
	});

	it("lists markers that catch a leaky view", () => {
		const s = clue(known(3), 1, "honeycomb");
		const leak = (seat: Seat, extra: object) => {
			const visible = JSON.stringify({ view: { ...snout_says.view(s, seat), ...extra }, events: [] });
			return snout_says.secretsOf!(s, seat).some((m) => visible.includes(m));
		};
		expect(leak(0, {})).toBe(false);
		expect(leak(2, {})).toBe(false);
		expect(leak(0, { round: s.round })).toBe(true);
		expect(leak(0, { nose: { target: TARGET, tray: TRAY, myPick: null } })).toBe(true);
		expect(leak(0, { tray: TRAY })).toBe(true);
		expect(leak(2, { picks: s.round!.picks })).toBe(true);
		expect(leak(2, { nose: { target: TARGET, tray: TRAY, myPick: "honeycomb" } })).toBe(true);
	});

	it("keeps every snapshot free of the seed and every seat's secrets across a whole table", () => {
		const report = playOut(snout_says, { seats: 4, seed: "snapshots", timeoutRate: 0.1 });
		expect(report.leaks).toEqual([]);
		expect(JSON.stringify(snapshotFor(report.room, snout_says, 0))).not.toContain("snapshots");
	});
});

describe("determinism and shape", () => {
	it("replays a seed exactly", () => {
		const a = playOut(snout_says, { seats: 3, seed: "same", timeoutRate: 0.2 });
		const b = playOut(snout_says, { seats: 3, seed: "same", timeoutRate: 0.2 });
		expect(JSON.stringify(b.room)).toBe(JSON.stringify(a.room));
		expect(JSON.stringify(fresh(4, "live", "x"))).toBe(JSON.stringify(fresh(4, "live", "x")));
		expect(JSON.stringify(fresh(4, "live", "y"))).not.toBe(JSON.stringify(fresh(4, "live", "x")));
	});

	it("keeps state and every view plain JSON at every revision", () => {
		playOut(snout_says, {
			seats: 3,
			seed: "json",
			timeoutRate: 0.2,
			onRevision: (room) => {
				expect(JSON.parse(JSON.stringify(room.game))).toEqual(room.game);
				for (let seat = 0; seat < 3; seat++) {
					const v = snout_says.view(room.game as SnoutSaysState, seat);
					expect(JSON.parse(JSON.stringify(v))).toEqual(v);
				}
			},
		});
	});

	it("returns a shared cooperative result", () => {
		expect(snout_says.result(fresh(3))).toBeNull();
		const report = playOut(snout_says, { seats: 3, seed: "result" });
		const total = game(report.room).total;
		expect(report.room.result).toEqual({
			kind: "coop",
			winners: [0, 1, 2],
			scores: [total, total, total],
			success: total >= 6,
			summary: `${total} of 12`,
			reason: "complete",
		});
		const over: SnoutSaysState = { ...fresh(2, "async"), phase: "over", round: null, total: 3 };
		expect(snout_says.result(over)).toMatchObject({ success: true, summary: "3 of 6" });
		expect(snout_says.result({ ...over, total: 2 })).toMatchObject({ success: false, summary: "2 of 6" });
	});

	it("parses only well-formed actions", () => {
		expect(snout_says.parseAction({ type: "clue", picture: "apple" })).toEqual({ type: "clue", picture: "apple" });
		expect(snout_says.parseAction({ type: "guess", picture: "old_key", extra: 1 })).toEqual({ type: "guess", picture: "old_key" });
		for (const bad of [null, "apple", [], { type: "clue" }, { type: "clue", picture: "banana" }, { type: "emote", picture: "apple" }, { picture: "apple" }]) {
			expect(snout_says.parseAction(bad)).toBeNull();
		}
	});
});

describe("the practice pigs", () => {
	const noseView = (target: PictureId, tray: PictureId[]): SnoutSaysView => ({
		...snout_says.view(known(2), 1),
		nose: { target, tray, myPick: null },
	});

	it("shows the closest picture about 70% of the time, else the runner-up", () => {
		// The apple's one four-tag twin in this tray is the red berries.
		const tray: PictureId[] = ["red_berries", "honeycomb", "acorn", "old_key", "tin_whistle", "boot", "charm", "scroll", "marble", "pouch", "bag", "tea"];
		const view = noseView("apple", tray);
		let best = 0;
		const N = 4_000;
		for (let i = 0; i < N; i++) {
			const a = snout_says.bot(view, 1, createRng(`nose-${i}`));
			expect(a?.type).toBe("clue");
			expect(tray).toContain(a?.picture);
			if (a?.picture === "red_berries") best++;
		}
		expect(best / N).toBeGreaterThan(0.66);
		expect(best / N).toBeLessThan(0.74);
	});

	it("guesses the spread picture closest to the clues, never a dimmed one", () => {
		const s = clue(known(2), 1, "apple");
		const v = snout_says.view(s, 0);
		for (let i = 0; i < 50; i++) expect(snout_says.bot(v, 0, createRng(`g-${i}`))).toEqual({ type: "guess", picture: "red_berries" });
		const missed = snout_says.view({ ...s, round: { ...s.round!, dimmed: ["red_berries"], guesses: ["red_berries"] } }, 0);
		for (let i = 0; i < 50; i++) expect(snout_says.bot(missed, 0, createRng(`m-${i}`))?.picture).not.toBe("red_berries");
		const fogged = snout_says.view(snout_says.onTimeout(known(2), 1, ctx()).state, 0);
		for (let i = 0; i < 50; i++) {
			const p = snout_says.bot(fogged, 0, createRng(`f-${i}`))?.picture as PictureId;
			expect(SPREAD).toContain(p);
			expect(fogged.dimmed).not.toContain(p);
		}
	});

	it("does nothing when it owes nothing", () => {
		const s = known(3);
		expect(snout_says.bot(snout_says.view(s, 0), 0, createRng("a"))).toBeNull();
		const picked = clue(s, 1, "apple");
		expect(snout_says.bot(snout_says.view(picked, 1), 1, createRng("b"))).toBeNull();
		expect(snout_says.bot(snout_says.view({ ...s, phase: "over", round: null }, 1), 1, createRng("c"))).toBeNull();
	});
});

describe("whole tables", () => {
	it.each(["live", "async"] as const)("fuzzes %s tables of two to four pigs to the end, legally and without a leak", (pace) => {
		const run = fuzz(snout_says, 200, { pace, timeoutRate: 0.1 });
		expect(run.reports).toHaveLength(600);
		expect(run.unfinished).toBe(0);
		expect(run.illegal).toBe(0);
		expect(run.leaks).toBe(0);
	});

	it("finishes tables a pig walks away from", () => {
		for (const seats of [3, 4]) {
			for (let i = 0; i < 20; i++) {
				const report = playOut(snout_says, { seats, seed: `walk-${seats}-${i}`, timeoutRate: 0.1, leave: { seat: i % seats, atStep: 1 + (i % 7) } });
				expect(report.room.phase).toBe("ended");
				expect(report.illegalBotMoves).toEqual([]);
				expect(report.leaks).toEqual([]);
			}
		}
	});
});

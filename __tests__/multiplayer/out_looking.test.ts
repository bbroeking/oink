// Out Looking's rules (multiplayer/games/out_looking/rules.ts): the deal, a
// day's resolution (alone, shared, muddy, home), the growing piles, final
// picks, when a day closes, a pig that leaves, the tie-breaks, secrecy and
// determinism, then the 200-table fuzz per pace that every game must pass.

import {
	FIND_WEIGHT,
	PLACE_FINDS,
	TUNING,
	out_looking,
	weightOf,
	type FindId,
	type OlState,
	type PlaceId,
} from "../../multiplayer/games/out_looking/rules";
import { SATCHEL_FINDS } from "../../constants/satchel";
import { createRng } from "../../multiplayer/rng";
import { applyAction, applyTimeouts, createRoom, markGone, startGame, type RoomState } from "../../multiplayer/engine";
import { fuzz, playOut, testCards } from "../../multiplayer/testkit";
import type { Pace, StepContext } from "../../multiplayer/types";

const NOW = 1_700_000_000_000;

function ctx(seats: number): StepContext {
	return { now: NOW, rng: createRng("ctx"), pace: "live", present: Array.from({ length: seats }, () => true) };
}

/** A dealt table with hand-picked piles (and optionally decks), so a day's
 *  arithmetic can be checked against known tiles. */
function table(
	seats: number,
	piles: FindId[][],
	opts: { decks?: FindId[][]; offset?: number; round?: number; hearts?: number[] } = {},
): OlState {
	const base = out_looking.setup({ seats, rng: createRng(`table-${seats}`), pace: "live" });
	return {
		...base,
		places: base.places.map((place, j) => ({
			...place,
			pile: piles[j] ?? place.pile,
			deck: opts.decks?.[j] ? opts.decks[j].map((find, k) => ({ tile: `tile:${place.id}:x${k}`, find })) : place.deck,
		})),
		shareOffset: opts.offset ?? 0,
		round: opts.round ?? 1,
		hearts: opts.hearts ?? base.hearts,
	};
}

/** Every seat decides: a place index picks it, null lets the clock run out. */
function decide(state: OlState, picks: (number | null)[]) {
	let s = state;
	let events: unknown[] = [];
	picks.forEach((place, seat) => {
		if (place === null) {
			const res = out_looking.onTimeout(s, seat, ctx(state.seats));
			s = res.state;
			events = res.events ?? [];
			return;
		}
		const res = out_looking.apply(s, seat, { type: "go", place }, ctx(state.seats));
		if (!res.ok) throw new Error(`seat ${seat} could not go to ${place}: ${res.error}`);
		s = res.state;
		events = res.events ?? [];
	});
	return { state: s, events, day: s.history[s.history.length - 1] };
}

function liveRoom(seats: number, pace: Pace = "live", seed = "room-seed"): RoomState {
	const room = createRoom({ roomId: "00000000-ol-room", game: out_looking, pace, source: "queue", seatCount: seats, seats: testCards(seats), seed, now: NOW });
	return startGame({ ...room, phase: "starting" }, out_looking, NOW);
}

function act(room: RoomState, seat: number, place: number, at: number): RoomState {
	const res = applyAction(room, out_looking, seat, { type: "go", place }, at);
	if (!res.ok) throw new Error(`seat ${seat} refused: ${res.error}`);
	return res.room;
}

const game = (room: RoomState) => room.game as OlState;
const sorted = (xs: readonly string[]) => xs.slice().sort();
const placeOf = (find: FindId): PlaceId => (Object.keys(PLACE_FINDS) as PlaceId[]).find((id) => PLACE_FINDS[id].includes(find))!;

describe("the deal", () => {
	it("gives two pigs three places, four days and day-one piles of 3 · 2 · 1", () => {
		for (let i = 0; i < 12; i++) {
			const s = out_looking.setup({ seats: 2, rng: createRng(`deal2-${i}`), pace: "live" });
			expect(s.places.map((p) => p.id)).toEqual(["river", "hedge", "farmhouse"]);
			expect(s.rounds).toBe(4);
			expect(s.places.map((p) => p.pile.length).sort()).toEqual([1, 2, 3]);
		}
	});

	it("gives three and four pigs four places, five days and piles of 3 · 2 · 1 · 1", () => {
		for (const seats of [3, 4]) {
			const s = out_looking.setup({ seats, rng: createRng(`deal-${seats}`), pace: "async" });
			expect(s.places.map((p) => p.id)).toEqual(["river", "hedge", "meadow", "farmhouse"]);
			expect(s.rounds).toBe(5);
			expect(s.places.map((p) => p.pile.length).sort()).toEqual([1, 1, 2, 3]);
			expect(s.picks).toEqual(Array(seats).fill(null));
			expect(s.pouches).toEqual(Array(seats).fill([]));
		}
	});

	it("builds every place from its own nine tiles, three of each of its finds", () => {
		const s = out_looking.setup({ seats: 4, rng: createRng("nine"), pace: "live" });
		for (const place of s.places) {
			const all = [...place.pile, ...place.deck.map((t) => t.find)];
			expect(all).toHaveLength(9);
			expect(sorted(all)).toEqual(sorted(PLACE_FINDS[place.id].flatMap((f) => [f, f, f])));
		}
	});

	it("shuffles the pile sizes by seed and deals the same table for the same seed", () => {
		const bigAt = new Set<number>();
		for (let i = 0; i < 30; i++) {
			const s = out_looking.setup({ seats: 3, rng: createRng(`shuffle-${i}`), pace: "live" });
			bigAt.add(s.places.findIndex((p) => p.pile.length === 3));
		}
		expect(bigAt.size).toBeGreaterThan(1);
		const a = out_looking.setup({ seats: 3, rng: createRng("same"), pace: "live" });
		const b = out_looking.setup({ seats: 3, rng: createRng("same"), pace: "live" });
		expect(b).toEqual(a);
	});
});

describe("weights", () => {
	it("weighs each find by its Satchel rarity: common 1, uncommon 2, rare 3", () => {
		const byRarity = { common: 1, uncommon: 2, rare: 3 } as const;
		expect(Object.keys(FIND_WEIGHT)).toHaveLength(SATCHEL_FINDS.length);
		for (const find of SATCHEL_FINDS) expect(FIND_WEIGHT[find.id as FindId]).toBe(byRarity[find.rarity]);
	});

	it("splits the twelve finds across the places, with the Farmhouse richest by construction", () => {
		const all = Object.values(PLACE_FINDS).flat();
		expect(sorted(all)).toEqual(sorted(SATCHEL_FINDS.map((f) => f.id)));
		const farmhouse = weightOf(PLACE_FINDS.farmhouse);
		for (const id of ["river", "hedge", "meadow"] as const) expect(weightOf(PLACE_FINDS[id])).toBeLessThan(farmhouse);
	});
});

describe("a day resolves", () => {
	it("gives a pig alone the whole pile", () => {
		const s = table(2, [["river_pebble", "marble"], ["blue_feather"], ["brass_button"]]);
		const { state, day } = decide(s, [0, 2]);
		expect(day.outcomes).toEqual(["alone", "alone"]);
		expect(day.took).toEqual([["river_pebble", "marble"], ["brass_button"]]);
		expect(state.pouches).toEqual([["river_pebble", "marble"], ["brass_button"]]);
		expect(state.hearts).toEqual([0, 0]);
		expect(day.piles).toEqual([["river_pebble", "marble"], ["blue_feather"], ["brass_button"]]);
	});

	it("has pigs who meet take one each, oldest first, in today's line, with a heart each", () => {
		const s = table(3, [["river_pebble"], ["pinecone"], ["clover"], ["brass_button", "old_key", "tin_whistle"]], { offset: 2 });
		const { state, day } = decide(s, [3, 1, 3]);
		// Seat 2 heads today's line (offset 2), so it takes the oldest tile.
		expect(day.outcomes).toEqual(["shared", "alone", "shared"]);
		expect(day.took).toEqual([["old_key"], ["pinecone"], ["brass_button"]]);
		expect(state.hearts).toEqual([1, 0, 1]);
		expect(state.places[3].pile[0]).toBe("tin_whistle");
		expect(state.shareOffset).toBe(0);
	});

	it("rotates the line every day", () => {
		const day1 = decide(table(2, [["marble", "snail_shell"], ["pinecone"], ["brass_button"]], { offset: 0 }), [0, 0]);
		expect(day1.day.took).toEqual([["marble"], ["snail_shell"]]);
		const next: OlState = { ...day1.state, places: day1.state.places.map((p, j) => (j === 0 ? { ...p, pile: ["old_key" as FindId, "clover" as FindId] } : p)) };
		const day2 = decide(next, [0, 0]);
		expect(day2.day.took).toEqual([["clover"], ["old_key"]]);
	});

	it("still gives a third pig at a two-tile pile its heart", () => {
		const s = table(3, [["river_pebble"], ["blue_feather", "pinecone"], ["clover"], ["brass_button"]], { offset: 1 });
		const { state, day } = decide(s, [1, 1, 1]);
		expect(day.outcomes).toEqual(["shared", "shared", "shared"]);
		expect(day.took).toEqual([[], ["blue_feather"], ["pinecone"]]);
		expect(state.hearts).toEqual([1, 1, 1]);
		expect(state.pouches[0]).toEqual([]);
	});

	it("gives muddy trotters to a pig who goes alone to a place left bare after yesterday", () => {
		// Day 1 the Farmhouse is taken whole, so on day 2 it is bare; whoever
		// goes there alone comes home with nothing (and two pigs who meet there
		// still get their hearts).
		// Seats 1 and 2 meet at the three-tile Hedge, which keeps a tile, so
		// only the Farmhouse is bare tomorrow.
		const day1 = decide(table(3, [["marble"], ["pinecone", "red_berries", "blue_feather"], ["clover"], ["tin_whistle", "old_key"]]), [3, 1, 1]).state;
		expect(day1.places.map((p) => p.pile.length === 0)).toEqual([false, false, false, true]);
		const { state, day } = decide(day1, [3, 0, 2]);
		expect(day.outcomes).toEqual(["muddy", "alone", "alone"]);
		expect(day.took[0]).toEqual([]);
		expect(state.pouches[0]).toEqual(["tin_whistle", "old_key"]);
		expect(state.hearts[0]).toBe(0);
		const met = decide(day1, [3, 3, 2]).day;
		expect(met.outcomes.slice(0, 2)).toEqual(["shared", "shared"]);
		expect(met.took.slice(0, 2)).toEqual([[], []]);
	});

	it("keeps a pig with no pick at home", () => {
		const s = table(2, [["marble"], ["pinecone"], ["tin_whistle"]]);
		const { state, day } = decide(s, [2, null]);
		expect(day.picks).toEqual([2, "home"]);
		expect(day.outcomes).toEqual(["alone", "home"]);
		expect(state.pouches).toEqual([["tin_whistle"], []]);
	});
});

describe("the piles grow", () => {
	it("draws one tile onto every pile each night, except a place emptied that day", () => {
		const s = table(3, [["marble", "snail_shell"], ["pinecone", "red_berries"], ["clover"], ["old_key"]], {
			decks: [["river_pebble"], ["blue_feather"], ["honeycomb"], ["tin_whistle", "brass_button"]],
		});
		// Seat 0 takes the Farmhouse whole; seats 1 and 2 meet at the River and
		// take its last two tiles; the Hedge and the Meadow are left alone.
		const { state, day, events } = decide(s, [3, 0, 0]);
		expect(day.grew).toEqual([null, "blue_feather", "honeycomb", null]);
		expect(state.places.map((p) => p.pile)).toEqual([[], ["pinecone", "red_berries", "blue_feather"], ["clover", "honeycomb"], []]);
		expect(state.places.map((p) => p.deck.length)).toEqual([1, 0, 0, 2]);
		expect(events).toEqual([{ type: "picked", seat: 2 }, { type: "revealed", round: 1 }, { type: "grew", round: 1 }]);
	});

	it("leaves a place emptied today bare tomorrow, and regrows it the night after", () => {
		const s = table(2, [["marble"], ["pinecone"], ["old_key", "tin_whistle"]], {
			decks: [["snail_shell", "river_pebble"], ["blue_feather", "red_berries"], ["brass_button", "old_key"]],
		});
		const day1 = decide(s, [2, 0]).state;
		expect(day1.places[2].pile).toEqual([]);
		expect(out_looking.view(day1, 1).places[2]).toMatchObject({ pile: [], pileWeight: 0, deckLeft: 2 });
		// Day 2 nobody goes there: no one emptied it today, so it grows tonight.
		const day2 = decide(day1, [1, 0]);
		expect(day2.day.piles[2]).toEqual([]);
		expect(day2.day.grew[2]).toBe("brass_button");
		expect(day2.state.places[2].pile).toEqual(["brass_button"]);
	});

	it("stops growing a place whose deck is dry", () => {
		const s = table(2, [["marble", "snail_shell"], ["pinecone"], ["old_key"]], { decks: [["river_pebble"], [], ["tin_whistle"]] });
		// Both pigs at the River: it is emptied, so it rests. The Hedge is left
		// alone but its deck is dry; only the Farmhouse grows.
		const { state, day } = decide(s, [0, 0]);
		expect(day.grew).toEqual([null, null, "tin_whistle"]);
		expect(state.places[1].pile).toEqual(["pinecone"]);
		expect(out_looking.view(state, 0).places[1].deckLeft).toBe(0);
	});

	it("grows nothing after the last day, and the game ends", () => {
		const s = table(2, [["marble"], ["pinecone"], ["old_key"]], { round: TUNING.twoSeats.rounds });
		const { state, day, events } = decide(s, [0, 2]);
		expect(day.grew).toEqual([null, null, null]);
		expect(state.places.map((p) => p.pile)).toEqual([[], ["pinecone"], []]);
		expect(state.phase).toBe("ended");
		expect(state.round).toBe(TUNING.twoSeats.rounds);
		expect(out_looking.activeSeats(state)).toEqual([]);
		expect(events).toEqual([{ type: "picked", seat: 1 }, { type: "revealed", round: 4 }]);
	});

	it("in play, rests exactly the places emptied that day and never runs a deck dry", () => {
		// 3 day-one tiles + one a night for four nights is at most 7 of 9.
		for (const seats of [2, 3, 4]) {
			for (let i = 0; i < 20; i++) {
				const s = game(playOut(out_looking, { seats, seed: `rest-${seats}-${i}`, timeoutRate: 0.2 }).room);
				for (const day of s.history) {
					if (day.round >= s.rounds) continue;
					const left = day.piles.map((pile, j) => pile.length - day.picks.reduce<number>((n, p, seat) => (p === j ? n + day.took[seat].length : n), 0));
					day.grew.forEach((g, j) => expect(g === null).toBe(day.piles[j].length > 0 && left[j] === 0));
				}
				expect(s.places.every((p) => p.deck.length > 0)).toBe(true);
			}
		}
	});
});

describe("picks", () => {
	it("are final: the same place again changes nothing, another place is refused", () => {
		const s = table(3, []);
		const first = out_looking.apply(s, 0, { type: "go", place: 1 }, ctx(3));
		if (!first.ok) throw new Error("first pick refused");
		const again = out_looking.apply(first.state, 0, { type: "go", place: 1 }, ctx(3));
		expect(again).toEqual({ ok: true, state: first.state });
		expect(out_looking.apply(first.state, 0, { type: "go", place: 2 }, ctx(3))).toEqual({ ok: false, error: "illegal_move" });
		expect(out_looking.activeSeats(first.state)).toEqual([1, 2]);
	});

	it("refuses a place that is not on the table and malformed actions", () => {
		const s = table(2, []);
		expect(out_looking.apply(s, 0, { type: "go", place: 3 }, ctx(2))).toEqual({ ok: false, error: "illegal_move" });
		for (const raw of [{ type: "go", place: 4 }, { type: "go", place: -1 }, { type: "go", place: 1.5 }, { place: 1 }, { type: "stay" }, "go", null, [0]]) {
			expect(out_looking.parseAction(raw)).toBeNull();
		}
		expect(out_looking.parseAction({ type: "go", place: 2, extra: true })).toEqual({ type: "go", place: 2 });
	});

	it("are refused once the last day has resolved", () => {
		const s = decide(table(2, [["marble"], ["pinecone"], ["old_key"]], { round: 4 }), [0, 1]).state;
		expect(out_looking.apply(s, 0, { type: "go", place: 0 }, ctx(2))).toEqual({ ok: false, error: "game_over" });
		expect(out_looking.onTimeout(s, 0, ctx(2)).state).toBe(s);
	});
});

describe("the day closes", () => {
	it.each<Pace>(["live", "async"])("the moment every pig has decided (%s)", (pace) => {
		let room = liveRoom(3, pace);
		const deadline = room.deadline;
		room = act(room, 0, 1, NOW + 1_000);
		room = act(room, 1, 3, NOW + 2_000);
		expect(game(room).history).toHaveLength(0);
		expect(room.activeSeats).toEqual([2]);
		// A partner never gets extra time because another pig answered first.
		expect(room.deadline).toBe(deadline);
		room = act(room, 2, 0, NOW + 3_000);
		expect(game(room).history).toHaveLength(1);
		expect(game(room).round).toBe(2);
		expect(room.activeSeats).toEqual([0, 1, 2]);
		expect(room.events.map((e) => e.type)).toEqual(["picked", "revealed", "grew"]);
	});

	it("at the deadline, with a missing pick staying home", () => {
		let room = liveRoom(2);
		room = act(room, 0, 2, NOW + 1_000);
		room = applyTimeouts(room, out_looking, room.deadline as number);
		const day = game(room).history[0];
		expect(day.picks).toEqual([2, "home"]);
		expect(day.outcomes).toEqual(["alone", "home"]);
		expect(game(room).round).toBe(2);
		expect(room.seats[1]?.missed).toBe(1);
	});

	it("gives a live day fifteen seconds plus the six-second reveal, and an async day twenty hours", () => {
		const s = table(2, []);
		expect(out_looking.deadlineMs!(s, "live")).toBe(15_000);
		expect(out_looking.deadlineMs!(s, "async")).toBe(20 * 3_600_000);
		const after = decide(s, [0, 1]).state;
		expect(out_looking.deadlineMs!(after, "live")).toBe(21_000);
		let room = liveRoom(2);
		room = act(room, 0, 0, NOW + 1_000);
		room = act(room, 1, 1, NOW + 2_000);
		expect(room.deadline).toBe(NOW + 2_000 + 21_000);
		const ended = decide(table(2, [], { round: 4 }), [0, 1]).state;
		expect(out_looking.deadlineMs!(ended, "live")).toBeNull();
	});
});

describe("a pig that leaves", () => {
	it("stays home every day after, keeps its pouch on the tally and is never crowned", () => {
		let room = liveRoom(3);
		const heavy = table(3, [["river_pebble"], ["blue_feather"], ["clover"], ["tin_whistle", "tin_whistle", "tin_whistle", "old_key", "old_key"]]);
		room = { ...room, game: heavy };
		room = act(room, 2, 3, NOW + 1_000);
		room = act(room, 0, 1, NOW + 2_000);
		room = act(room, 1, 1, NOW + 3_000);
		expect(game(room).pouches[2]).toHaveLength(5);
		room = markGone(room, out_looking, 2, NOW + 4_000);
		expect(room.phase).toBe("playing");
		// The empty chair resolves home at once, so the day waits only on the two left.
		expect(room.activeSeats).toEqual([0, 1]);
		let t = NOW + 5_000;
		while (room.phase === "playing") {
			room = act(room, 0, 1, (t += 1_000));
			room = act(room, 1, 1, (t += 1_000));
		}
		const final = game(room);
		expect(final.history.slice(1).every((day) => day.picks[2] === "home")).toBe(true);
		expect(final.pouches[2]).toHaveLength(5);
		expect(room.result?.scores[2]).toBe(13);
		expect(room.result?.winners).not.toContain(2);
		expect(room.result?.reason).toBe("complete");
	});

	it("never stalls a table when a pig walks out mid-match", () => {
		for (let i = 0; i < 20; i++) {
			const report = playOut(out_looking, { seats: 4, seed: `leave-${i}`, timeoutRate: 0.1, leave: { seat: i % 4, atStep: 1 + (i % 7) } });
			expect(report.room.phase).toBe("ended");
			expect(report.illegalBotMoves).toEqual([]);
			expect(report.leaks).toEqual([]);
		}
	});
});

describe("the result", () => {
	function ended(pouches: FindId[][], hearts: number[]): OlState {
		const s = table(pouches.length, []);
		return { ...s, phase: "ended", round: s.rounds, picks: s.picks.map(() => null), pouches, hearts };
	}

	it("is null until the last day resolves", () => {
		expect(out_looking.result(table(2, []))).toBeNull();
	});

	it("crowns the heaviest pouch", () => {
		const r = out_looking.result(ended([["tin_whistle", "tin_whistle", "old_key", "old_key"], ["old_key", "marble", "tin_whistle"], ["honeycomb", "honeycomb", "clover", "wool_tuft"]], [0, 2, 1]));
		expect(r).toEqual({ kind: "win", winners: [0], scores: [10, 7, 6], summary: "10 to 7 to 6" });
	});

	it("breaks a tie on weight with hearts", () => {
		const r = out_looking.result(ended([["tin_whistle", "tin_whistle", "tin_whistle"], ["old_key", "old_key", "old_key", "tin_whistle"], ["marble"]], [1, 2, 0]));
		expect(r).toEqual({ kind: "win", winners: [1], scores: [9, 9, 2], summary: "9 to 9 to 2 · on hearts, 2 to 1" });
	});

	it("calls a tie on weight and hearts a draw: shared at the top, or level all the way down", () => {
		const two = out_looking.result(ended([["old_key", "marble", "tin_whistle"], ["tin_whistle", "tin_whistle", "brass_button"]], [1, 1]));
		expect(two).toEqual({ kind: "draw", winners: [0, 1], scores: [7, 7], summary: "7 to 7 · level on hearts too" });
		const three = out_looking.result(ended([["tin_whistle", "tin_whistle", "old_key"], ["old_key", "old_key", "old_key", "old_key"], ["pinecone"]], [1, 1, 0]));
		expect(three).toMatchObject({ kind: "draw", winners: [0, 1], scores: [8, 8, 1] });
	});
});

describe("secrecy", () => {
	it("never lets a rival's pick change what another seat sees", () => {
		const s = table(4, []);
		const seen = new Set<string>();
		for (let place = 0; place < 4; place++) {
			const res = out_looking.apply(s, 1, { type: "go", place }, ctx(4));
			if (!res.ok) throw new Error("pick refused");
			for (const seat of [0, 2, 3]) {
				expect(JSON.stringify(res.events)).not.toContain("place");
				seen.add(`${seat}:${JSON.stringify(out_looking.view(res.state, seat))}`);
			}
			expect(out_looking.view(res.state, 1).myPick).toBe(place);
		}
		// Four rival choices, three onlookers: still exactly three distinct views.
		expect(seen.size).toBe(3);
		const before = out_looking.view(s, 0);
		const after = out_looking.view((out_looking.apply(s, 1, { type: "go", place: 2 }, ctx(4)) as { ok: true; state: OlState }).state, 0);
		expect({ ...after, picked: before.picked }).toEqual(before);
		expect(after.picked).toEqual([false, true, false, false]);
	});

	it("never shows a deck's order, only how many tiles are left", () => {
		const s = table(3, []);
		const flipped: OlState = { ...s, places: s.places.map((p) => ({ ...p, deck: p.deck.slice().reverse() })) };
		for (let seat = 0; seat < 3; seat++) expect(out_looking.view(flipped, seat)).toEqual(out_looking.view(s, seat));
		expect(out_looking.view(s, 0).places.map((p) => p.deckLeft)).toEqual(s.places.map((p) => p.deck.length));
	});

	it("marks every secret so a leaky view would be caught", () => {
		const s = table(3, []);
		const picked = (out_looking.apply(s, 1, { type: "go", place: 3 }, ctx(3)) as { ok: true; state: OlState }).state;
		const markers = out_looking.secretsOf!(picked, 0);
		expect(markers).toContain("sealed:r1:s1");
		expect(markers.filter((m) => m.startsWith("tile:"))).toHaveLength(picked.places.reduce((n, p) => n + p.deck.length, 0));
		expect(out_looking.secretsOf!(picked, 1)).not.toContain("sealed:r1:s1");
		// A view that simply copied the state would trip every marker.
		const leaky = JSON.stringify(picked);
		expect(markers.every((m) => leaky.includes(m))).toBe(true);
		const honest = JSON.stringify(out_looking.view(picked, 0));
		expect(markers.some((m) => honest.includes(m))).toBe(false);
	});
});

describe("determinism", () => {
	it("plays the same game from the same seed, and a different one from another", () => {
		const a = playOut(out_looking, { seats: 4, seed: "replay", timeoutRate: 0.15 });
		const b = playOut(out_looking, { seats: 4, seed: "replay", timeoutRate: 0.15 });
		expect(JSON.stringify(b.room.game)).toBe(JSON.stringify(a.room.game));
		expect(b.room.log).toEqual(a.room.log);
		const c = playOut(out_looking, { seats: 4, seed: "replay-2", timeoutRate: 0.15 });
		expect(JSON.stringify(c.room.game)).not.toBe(JSON.stringify(a.room.game));
	});

	it("keeps every tile accounted for: pile + deck + pouches is nine per place, always", () => {
		for (const seats of [2, 3, 4]) {
			playOut(out_looking, {
				seats,
				seed: `conserve-${seats}`,
				timeoutRate: 0.1,
				onRevision: (room) => {
					const s = game(room);
					const held = s.pouches.flat();
					for (const place of s.places) {
						const inPouches = held.filter((f) => placeOf(f) === place.id).length;
						expect(place.pile.length + place.deck.length + inPouches).toBe(9);
					}
				},
			});
		}
	});
});

describe("the practice pig", () => {
	it("rests when it has nothing to decide", () => {
		const s = table(2, []);
		const picked = (out_looking.apply(s, 0, { type: "go", place: 1 }, ctx(2)) as { ok: true; state: OlState }).state;
		expect(out_looking.bot(out_looking.view(picked, 0), 0, createRng("b"))).toBeNull();
		const over = decide(table(2, [], { round: 4 }), [0, 1]).state;
		expect(out_looking.bot(out_looking.view(over, 1), 1, createRng("b"))).toBeNull();
	});

	it("always proposes a place on the table, in a shape the wire accepts", () => {
		for (let i = 0; i < 60; i++) {
			const seats = 2 + (i % 3);
			const s = out_looking.setup({ seats, rng: createRng(`bot-${i}`), pace: "live" });
			const move = out_looking.bot(out_looking.view(s, i % seats), i % seats, createRng(`noise-${i}`));
			expect(move).not.toBeNull();
			expect(out_looking.parseAction(move)).toEqual(move);
			expect(move!.place).toBeLessThan(s.places.length);
		}
	});

	it("leaves an empty place alone when there is anything else", () => {
		const s = table(2, [[], ["pinecone"], []]);
		for (let i = 0; i < 20; i++) expect(out_looking.bot(out_looking.view(s, 0), 0, createRng(`empty-${i}`))).toEqual({ type: "go", place: 1 });
	});
});

describe("fuzz", () => {
	it.each<Pace>(["live", "async"])("finishes 200 tables per seat count with no illegal move and no leak (%s)", (pace) => {
		const run = fuzz(out_looking, 200, { timeoutRate: 0.1, pace });
		expect(run.unfinished).toBe(0);
		expect(run.illegal).toBe(0);
		expect(run.leaks).toBe(0);
		for (const report of run.reports) {
			const s = game(report.room);
			if (report.room.result?.reason !== "complete") continue;
			expect(s.history).toHaveLength(s.rounds);
			expect(report.room.result.scores).toHaveLength(s.seats);
		}
	});

	it("finishes tables where a pig walks out, in both paces", () => {
		for (const pace of ["live", "async"] as const) {
			const run = fuzz(out_looking, 30, { timeoutRate: 0.1, pace, leave: { seat: 1, atStep: 2 } });
			expect(run.unfinished).toBe(0);
			expect(run.illegal).toBe(0);
			expect(run.leaks).toBe(0);
		}
	});
});

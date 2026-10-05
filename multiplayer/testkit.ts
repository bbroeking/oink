// Test kit: plays whole tables through the real room engine with bot pigs.
// Used by every game's jest suite (`__tests__/multiplayer/*`) and by the
// server's tests. Three properties every game must hold:
//   1. termination — a table of bots always reaches a result;
//   2. legality — the bot never proposes an action the rules reject;
//   3. secrecy — no seat's view or events ever contain a marker from
//      `secretsOf(state, seat)`, at any revision, including after timeouts.

import type { AnyGame, Pace, Seat } from "./types";
import type { PlayerCard, PigLook } from "./protocol";
import { applyAction, applyTimeouts, createRoom, eventsFor, markGone, startGame, type RoomState } from "./engine";
import { createRng } from "./rng";

export const TEST_LOOK: PigLook = {
	pigId: "rosie",
	hat: null,
	bow: null,
	glasses: null,
	mask: null,
	neck: null,
	held: null,
	aura: null,
	wallow: 0,
};

export function testCards(n: number): PlayerCard[] {
	return Array.from({ length: n }, (_, i) => ({ userId: `user-${i}`, name: `Pig ${i + 1}`, look: TEST_LOOK }));
}

export interface PlayOutOptions {
	seats: number;
	seed: string;
	pace?: Pace;
	/** Probability that a due decision is left to time out instead of the bot. */
	timeoutRate?: number;
	/** Seat that leaves at the given step index. */
	leave?: { seat: Seat; atStep: number };
	maxSteps?: number;
	/** Called after every committed revision (for custom assertions). */
	onRevision?: (room: RoomState) => void;
}

export interface PlayOutReport {
	room: RoomState;
	steps: number;
	timeouts: number;
	illegalBotMoves: { seat: Seat; error: string; rev: number }[];
	leaks: { seat: Seat; marker: string; rev: number }[];
}

/** Drives one table to its end. Never throws on game misbehaviour; it
 *  reports it, so a test can assert precisely what went wrong. */
export function playOut(game: AnyGame, opts: PlayOutOptions): PlayOutReport {
	const pace = opts.pace ?? "live";
	const decide = createRng(`${opts.seed}:decide`);
	const maxSteps = opts.maxSteps ?? 5_000;
	let now = 1_700_000_000_000;
	let room = createRoom({
		roomId: "00000000-test-room",
		game,
		pace,
		source: "queue",
		seatCount: opts.seats,
		seats: testCards(opts.seats),
		seed: opts.seed,
		now,
	});
	room = startGame({ ...room, phase: "starting" }, game, now);
	const report: PlayOutReport = { room, steps: 0, timeouts: 0, illegalBotMoves: [], leaks: [] };
	checkSecrets(game, room, report);
	opts.onRevision?.(room);

	for (let step = 0; step < maxSteps && room.phase === "playing"; step++) {
		report.steps = step + 1;
		if (opts.leave && opts.leave.atStep === step) {
			room = markGone(room, game, opts.leave.seat, now);
			checkSecrets(game, room, report);
			opts.onRevision?.(room);
			continue;
		}
		const timeoutRate = opts.timeoutRate ?? 0;
		if (room.deadline !== null && decide.chance(timeoutRate)) {
			now = room.deadline;
			room = applyTimeouts(room, game, now);
			report.timeouts++;
		} else {
			const seat = room.activeSeats[decide.int(Math.max(room.activeSeats.length, 1))];
			if (seat === undefined) break;
			now += 250;
			const view = game.view(room.game, seat);
			const action = game.bot(view, seat, createRng(`${opts.seed}:bot:${room.rev}:${seat}`));
			if (action === null) {
				// A bot with nothing to do while active is a game bug; let the
				// clock resolve it so the table still ends.
				report.illegalBotMoves.push({ seat, error: "bot_returned_null", rev: room.rev });
				if (room.deadline !== null) {
					now = room.deadline;
					room = applyTimeouts(room, game, now);
				}
			} else {
				const res = applyAction(room, game, seat, action, now);
				if (res.ok) room = res.room;
				else {
					report.illegalBotMoves.push({ seat, error: res.error, rev: room.rev });
					if (room.deadline !== null) {
						now = room.deadline;
						room = applyTimeouts(room, game, now);
					}
				}
			}
		}
		checkSecrets(game, room, report);
		opts.onRevision?.(room);
	}
	report.room = room;
	return report;
}

function checkSecrets(game: AnyGame, room: RoomState, report: PlayOutReport): void {
	if (!game.secretsOf || room.game === null) return;
	for (let seat = 0; seat < room.seats.length; seat++) {
		const markers = game.secretsOf(room.game, seat);
		if (markers.length === 0) continue;
		const visible = JSON.stringify({ view: game.view(room.game, seat), events: eventsFor(room.events, seat) });
		for (const marker of markers) {
			if (visible.includes(marker)) report.leaks.push({ seat, marker, rev: room.rev });
		}
	}
}

/** Runs `count` seeded tables per seat count and aggregates the reports. */
export function fuzz(
	game: AnyGame,
	count: number,
	extra: Omit<PlayOutOptions, "seats" | "seed"> = {},
): { reports: PlayOutReport[]; unfinished: number; illegal: number; leaks: number } {
	const reports: PlayOutReport[] = [];
	for (let seats = game.seats.min; seats <= game.seats.max; seats++) {
		for (let i = 0; i < count; i++) {
			reports.push(playOut(game, { ...extra, seats, seed: `${game.id}-${seats}-${i}` }));
		}
	}
	return {
		reports,
		unfinished: reports.filter((r) => r.room.phase !== "ended").length,
		illegal: reports.reduce((n, r) => n + r.illegalBotMoves.length, 0),
		leaks: reports.reduce((n, r) => n + r.leaks.length, 0),
	};
}

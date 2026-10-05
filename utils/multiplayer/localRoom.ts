// Practice: a table that runs on the phone. The shared room engine
// (multiplayer/engine.ts, the same file the play server runs) plays the
// rules; bot pigs from the companion roster fill the other chairs and play
// through each game's own `bot`, which only ever sees that seat's view.
//
// It speaks RoomSource (./roomSource.ts), so the match screen cannot tell it
// from a real table except by `practice === true`. The differences, all on
// purpose:
//   • every pig shows as connected, and the host cannot start anything by
//     hand (the table starts itself after the countdown);
//   • `untimed` drops the decision clock entirely: the snapshot carries no
//     deadline and nobody ever times out;
//   • a rematch is instant (the bots always say yes) and keeps the same
//     roomId; `rev` keeps climbing across rounds, so `${roomId}:${rev}` stays
//     a unique animation key;
//   • a practice pig now and then waves back at your emote.
// A game's own clock (GameDefinition.tick) runs here exactly as the server
// runs it, through the engine's applyTick. Times are on the device clock:
// compare the snapshot with `now()`.

import {
	DEFAULT_ENGINE_OPTIONS,
	applyAction,
	applyTick,
	applyTimeouts,
	beginCountdown,
	createRoom,
	seatOf,
	snapshotFor,
	startGame,
	type EngineOptions,
	type RoomState,
} from "@/multiplayer/engine";
import { getGame } from "@/multiplayer/games";
import {
	DEFAULT_TIMING,
	type Emote,
	type PigLook,
	type PlayerCard,
	type RoomSnapshot,
	type RoomSource as TableOrigin,
} from "@/multiplayer/protocol";
import { createRng, makeSeed } from "@/multiplayer/rng";
import type { AnyGame, GameId, Pace, Seat } from "@/multiplayer/types";
import { PIGS, type PigId } from "@/utils/pigs";
import type { PlayTimers } from "./client";
import type { ActResult, RoomSource } from "./roomSource";
import type { EmoteMark } from "./store";

/** Practice room ids never reach the wire; the prefix keeps them apart. */
export const PRACTICE_ROOM_PREFIX = "practice-";

export function isPracticeRoomId(roomId: string | null | undefined): boolean {
	return typeof roomId === "string" && roomId.startsWith(PRACTICE_ROOM_PREFIX);
}

/** The practice pigs: the companion roster, Rosie aside (she is usually
 *  you). Each bot wears its own pig sprite and nothing else. */
export const PRACTICE_PIG_IDS: readonly PigId[] = PIGS.map((pig) => pig.id).filter((id) => id !== "rosie");

export const PRACTICE_THINK_MS = Object.freeze({ min: 700, max: 1_600 });

const BOT_REPLY_EMOTES: readonly Emote[] = ["oink", "love", "giggle", "wow"];
const BOT_REPLY_CHANCE = 0.6;
const BOT_GG_CHANCE = 0.5;
/** Retries with a fresh rng before a stuck bot falls back to the clock. */
const BOT_ATTEMPTS = 3;

export interface PracticeOptions {
	gameId: GameId;
	/** Total chairs, you included. Clamped into the game's range; defaults
	 *  to the game's minimum. */
	seats?: number;
	/** You, as other pigs see you (see looks.ts playerCardFromProfile). */
	you: PlayerCard;
	/** No decision clock: bots still think, nobody ever times out. */
	untimed?: boolean;
	/** Defaults to live (async-only games fall back to async). */
	pace?: Pace;
}

export interface PracticeDeps {
	/** The game to play (defaults to the registry entry for gameId). */
	game?: AnyGame;
	/** Stable id for this practice table (defaults to a fresh one). */
	roomId?: string;
	now?: () => number;
	timers?: PlayTimers;
	/** Thinking delays, bot pig picks, emote replies. [0, 1). */
	random?: () => number;
	/** Room seed (defaults to a fresh one). */
	seed?: string;
	thinkMs?: { min: number; max: number };
	countdownMs?: number;
	emoteCooldownMs?: number;
	log?: (message: string, detail?: unknown) => void;
}

const defaultTimers: PlayTimers = {
	setTimeout: (fn, ms) => setTimeout(fn, ms),
	clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

function plainLook(pigId: PigId): PigLook {
	return { pigId, hat: null, bow: null, glasses: null, mask: null, neck: null, held: null, aura: null, wallow: 0 };
}

/** The bot pigs for a table: `count` companions, shuffled by the seed, never
 *  the pig the player brought. */
export function practiceBots(count: number, seed: string, avoidPigId: string | null): PlayerCard[] {
	const pool = PRACTICE_PIG_IDS.filter((id) => id !== avoidPigId);
	const picks = createRng(`${seed}:pigs`).shuffle(pool).slice(0, Math.max(0, count));
	return picks.map((pigId) => {
		const name = PIGS.find((pig) => pig.id === pigId)?.name ?? "A practice pig";
		return { userId: `bot:${pigId}`, name, look: plainLook(pigId) };
	});
}

/**
 * Open a Practice table: you in the first chair, bot pigs in the rest, the
 * countdown already running. Null when the game is unknown here (an old
 * binary asked about a newer game) or has no seat count that fits.
 */
export function createPracticeRoom(options: PracticeOptions, deps: PracticeDeps = {}): LocalRoomSource | null {
	const game = deps.game ?? getGame(options.gameId);
	if (!game || game.id !== options.gameId) return null;
	return new LocalRoomSource(options, game, deps);
}

export class LocalRoomSource implements RoomSource {
	readonly practice = true;
	readonly roomId: string;
	readonly untimed: boolean;

	private readonly game: AnyGame;
	private readonly pace: Pace;
	private readonly youId: string;
	private readonly clock: () => number;
	private readonly timers: PlayTimers;
	private readonly random: () => number;
	private readonly seed: string;
	private readonly think: { min: number; max: number };
	private readonly options: EngineOptions;
	private readonly emoteCooldownMs: number;
	private readonly log?: (message: string, detail?: unknown) => void;

	private room!: RoomState;
	private round = 0;
	/** Added to the engine's per-room rev so rev climbs across rematches. */
	private revBase = 0;
	private snapshotValue: RoomSnapshot | null = null;
	private emotesValue: Record<number, EmoteMark> = {};
	private readonly listeners = new Set<() => void>();
	private readonly armed = new Set<unknown>();
	private readonly botThinking = new Map<Seat, unknown>();
	private deadlineTimer: unknown = null;
	private tickTimer: unknown = null;
	private lastEmoteAt = Number.NEGATIVE_INFINITY;
	private disposed = false;

	constructor(options: PracticeOptions, game: AnyGame, deps: PracticeDeps = {}) {
		this.game = game;
		this.clock = deps.now ?? Date.now;
		this.timers = deps.timers ?? defaultTimers;
		this.random = deps.random ?? Math.random;
		this.seed = deps.seed ?? makeSeed((max) => Math.floor(this.random() * max));
		this.roomId = deps.roomId ?? `${PRACTICE_ROOM_PREFIX}${makeSeed((max) => Math.floor(this.random() * max), 12)}`;
		this.untimed = options.untimed === true;
		this.pace = options.pace && game.paces.includes(options.pace) ? options.pace : game.paces.includes("live") ? "live" : game.paces[0];
		this.youId = options.you.userId;
		this.think = deps.thinkMs ?? PRACTICE_THINK_MS;
		this.options = { ...DEFAULT_ENGINE_OPTIONS, countdownMs: deps.countdownMs ?? DEFAULT_TIMING.countdownMs };
		this.emoteCooldownMs = deps.emoteCooldownMs ?? DEFAULT_TIMING.emoteCooldownMs;
		this.log = deps.log;

		const seats = Math.min(game.seats.max, Math.max(game.seats.min, Math.floor(options.seats ?? game.seats.min)));
		const bots = practiceBots(seats - 1, this.seed, options.you.look?.pigId ?? null);
		this.beginRound([options.you, ...bots], "queue");
	}

	// ── RoomSource ─────────────────────────────────────────────────────────

	get snapshot(): RoomSnapshot | null {
		return this.snapshotValue;
	}

	get emotes(): Readonly<Record<number, EmoteMark>> {
		return this.emotesValue;
	}

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	now = (): number => this.clock();

	act = async (action: unknown): Promise<ActResult> => {
		if (this.disposed) return { ok: false, error: "expired" };
		const seat = seatOf(this.room, this.youId);
		if (seat === null) return { ok: false, error: "forbidden" };
		const res = applyAction(this.room, this.game, seat, action, this.clock(), this.options);
		if (!res.ok) return { ok: false, error: res.error };
		this.commit(res.room);
		return { ok: true };
	};

	emote = (emote: Emote): void => {
		if (this.disposed) return;
		const seat = seatOf(this.room, this.youId);
		if (seat === null) return;
		const now = this.clock();
		if (now - this.lastEmoteAt < this.emoteCooldownMs) return;
		this.lastEmoteAt = now;
		this.setEmote(seat, emote, now);
		const friend = this.botSeats().find((s) => !this.room.seats[s]?.gone);
		if (friend !== undefined && this.random() < BOT_REPLY_CHANCE) {
			const reply = emote === "gg" ? "gg" : BOT_REPLY_EMOTES[Math.floor(this.random() * BOT_REPLY_EMOTES.length)];
			this.arm(() => this.setEmote(friend, reply, this.clock()), this.thinkDelay());
		}
	};

	leave = async (): Promise<void> => {
		this.dispose();
	};

	rematch = async (): Promise<void> => {
		if (this.disposed || this.room.phase !== "ended") return;
		const cards = this.room.seats
			.filter((s): s is NonNullable<typeof s> => s !== null)
			.map(({ userId, name, look }) => ({ userId, name, look }));
		// Whoever moved first moves second next time (the server's rule too).
		const rotated = cards.length > 1 ? [...cards.slice(1), cards[0]] : cards;
		this.revBase = (this.snapshotValue?.rev ?? 0) + 1;
		this.clearAll();
		this.emotesValue = {};
		this.beginRound(rotated, "rematch");
	};

	/** Practice tables start themselves after the countdown. */
	start = async (): Promise<void> => {};

	/** Stop every timer. The last snapshot stays readable. */
	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.clearAll();
		this.listeners.clear();
	}

	get isDisposed(): boolean {
		return this.disposed;
	}

	// ── Rounds ─────────────────────────────────────────────────────────────

	private beginRound(cards: PlayerCard[], origin: TableOrigin): void {
		this.round++;
		const now = this.clock();
		const bots = cards.flatMap((card, i) => (card.userId === this.youId ? [] : [i]));
		const created = createRoom({
			roomId: this.roomId,
			game: this.game,
			pace: this.pace,
			source: origin,
			seatCount: cards.length,
			seats: cards,
			seed: `${this.seed}:${this.round}`,
			now,
			bots,
		});
		this.commit(beginCountdown(created, this.game, now, this.options));
		this.arm(() => {
			if (this.disposed || this.room.phase !== "starting") return;
			this.commit(startGame(this.room, this.game, this.clock(), this.options));
		}, Math.max(0, (this.room.startsAt ?? now) - now));
	}

	private commit(room: RoomState): void {
		const wasEnded = this.room?.phase === "ended";
		this.room = room;
		this.snapshotValue = this.project(room);
		this.notify();
		this.plan();
		if (!wasEnded && room.phase === "ended" && room.result?.reason === "complete") this.maybeSayGoodGame();
	}

	/** The engine's snapshot, dressed for Practice. */
	private project(room: RoomState): RoomSnapshot {
		const snapshot = snapshotFor(room, this.game, seatOf(room, this.youId));
		return {
			...snapshot,
			rev: snapshot.rev + this.revBase,
			seats: snapshot.seats.map((seat) => ({ ...seat, connected: !seat.gone })),
			deadline: this.untimed ? null : snapshot.deadline,
			host: null,
		};
	}

	/** After every revision: re-arm the decision clock and wake the bots
	 *  who now owe a move. */
	private plan(): void {
		if (this.disposed) return;
		const room = this.room;
		this.disarm(this.deadlineTimer);
		this.deadlineTimer = null;
		if (!this.untimed && room.phase === "playing" && room.deadline !== null) {
			const wait = Math.max(0, room.deadline - this.clock());
			this.deadlineTimer = this.arm(() => {
				this.deadlineTimer = null;
				this.onDeadline();
			}, wait);
		}
		// A game with its own clock (GameDefinition.tick) gets it here, as the
		// server runs it: every tick.everyMs while in play, timed or not.
		if (this.game.tick && room.phase === "playing") {
			if (this.tickTimer === null) this.armTick();
		} else if (this.tickTimer !== null) {
			this.disarm(this.tickTimer);
			this.tickTimer = null;
		}
		const owing = room.phase === "playing" ? room.activeSeats : [];
		for (const [seat, handle] of [...this.botThinking]) {
			if (!owing.includes(seat)) {
				this.disarm(handle);
				this.botThinking.delete(seat);
			}
		}
		for (const seat of owing) {
			if (!this.isBot(seat) || this.botThinking.has(seat)) continue;
			this.botThinking.set(
				seat,
				this.arm(() => this.botMove(seat), this.thinkDelay()),
			);
		}
	}

	private armTick(): void {
		// The contract caps a game clock at 10 Hz.
		const every = Math.max(100, this.game.tick?.everyMs ?? 0);
		this.tickTimer = this.arm(() => {
			this.tickTimer = null;
			if (this.disposed || this.room.phase !== "playing") return;
			const next = applyTick(this.room, this.game, this.clock(), this.options);
			if (next !== this.room) this.commit(next);
			else this.plan();
		}, every);
	}

	private onDeadline(): void {
		if (this.disposed || this.room.phase !== "playing") return;
		const next = applyTimeouts(this.room, this.game, this.clock(), this.options);
		if (next !== this.room) this.commit(next);
		else this.plan(); // woke a hair early: arm again
	}

	private botMove(seat: Seat): void {
		this.botThinking.delete(seat);
		const room = this.room;
		if (this.disposed || room.phase !== "playing" || !room.activeSeats.includes(seat)) return;
		const view = this.game.view(room.game, seat);
		for (let attempt = 0; attempt < BOT_ATTEMPTS; attempt++) {
			const action = this.game.bot(view, seat, createRng(`${room.seed}:bot:${room.rev}:${seat}:${attempt}`));
			if (action === null) break;
			const res = applyAction(room, this.game, seat, action, this.clock(), this.options);
			if (res.ok) {
				this.commit(res.room);
				return;
			}
		}
		// A bot with no legal move is a game bug; the clock resolves the
		// decision through the game's own default so the table never stalls.
		this.log?.(`[practice] ${this.game.id} bot had no legal move for seat ${seat}`);
		const at = Math.max(this.clock(), room.deadline ?? this.clock());
		const next = applyTimeouts(room, this.game, at, this.options);
		if (next !== room) this.commit(next);
	}

	private maybeSayGoodGame(): void {
		const friend = this.botSeats().find((s) => !this.room.seats[s]?.gone);
		if (friend === undefined || this.random() >= BOT_GG_CHANCE) return;
		this.arm(() => this.setEmote(friend, "gg", this.clock()), this.thinkDelay());
	}

	// ── Helpers ────────────────────────────────────────────────────────────

	private isBot(seat: Seat): boolean {
		const occupant = this.room.seats[seat];
		return !!occupant && occupant.userId !== this.youId;
	}

	private botSeats(): Seat[] {
		return this.room.seats.flatMap((s, i) => (s && s.userId !== this.youId ? [i] : []));
	}

	private thinkDelay(): number {
		const { min, max } = this.think;
		return Math.round(min + this.random() * Math.max(0, max - min));
	}

	private setEmote(seat: Seat, emote: Emote, at: number): void {
		if (this.disposed) return;
		this.emotesValue = { ...this.emotesValue, [seat]: { emote, at } };
		this.notify();
	}

	private notify(): void {
		for (const listener of [...this.listeners]) {
			try {
				listener();
			} catch (error) {
				this.log?.("[practice] listener threw", error);
			}
		}
	}

	private arm(fn: () => void, ms: number): unknown {
		const handle: unknown = this.timers.setTimeout(() => {
			this.armed.delete(handle);
			if (!this.disposed) fn();
		}, ms);
		this.armed.add(handle);
		return handle;
	}

	private disarm(handle: unknown): void {
		if (handle === null || handle === undefined) return;
		this.timers.clearTimeout(handle);
		this.armed.delete(handle);
	}

	private clearAll(): void {
		for (const handle of this.armed) this.timers.clearTimeout(handle);
		this.armed.clear();
		this.botThinking.clear();
		this.deadlineTimer = null;
		this.tickTimer = null;
	}

	/** Test seam: timers still armed. */
	get pendingTimers(): number {
		return this.armed.size;
	}
}

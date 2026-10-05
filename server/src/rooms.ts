// Tables in flight. The engine (multiplayer/engine.ts) decides everything a
// table does; this module gives it sockets, timers and a database:
//
//   every change goes through `commit`, which reconciles presence, persists
//   (play-by-push at once, before anyone hears of it; live tables debounced),
//   re-arms the timers, sends each seat its own snapshot, records the result
//   exactly once, and pings an away pig whose move it now is;
//   every piece of work on a table runs through `run`, one at a time per
//   table, so a move, a timeout and a disconnect can never interleave.
//
// Presence: a seat is `connected` while its pig has a live socket that is
// attached to the table. Live tables attach on creation and re-attach on
// reconnect; play-by-push tables attach when the pig opens them (room.join).
// Snapshots go to every seated pig with a live socket, attached or not, so
// the app's "Your games" list stays fresh without polling.

import type { AnyGame, GameId, Pace, Seat } from "../../multiplayer/types";
import type {
	Emote,
	InviteSummary,
	PlayerCard,
	RoomSnapshot,
	RoomSource,
	RoomSummary,
	Timing,
} from "../../multiplayer/protocol";
import {
	abortRoom,
	applyAction,
	applyTick,
	applyTimeouts,
	beginCountdown,
	canStart,
	createRoom,
	markGone,
	rematchSeats,
	releaseSeat,
	seatOf,
	setConnected,
	snapshotFor,
	startGame,
	summaryFor,
	voteRematch,
	type EngineOptions,
	type EngineSeat,
	type RoomState,
} from "../../multiplayer/engine";
import { makeSeed } from "../../multiplayer/rng";
import type { Clock, Timer } from "./clock";
import { COPY, NAMELESS_PIG, type PushCopy } from "./copy";
import type { Entropy } from "./entropy";
import type { Logger } from "./log";
import type { PlayerDirectory } from "./players";
import type { Notifier, PushContent } from "./push";
import { eloPair } from "./rating";
import { fail, ok, type HandlerResult, type Presence } from "./reply";
import { ratedPair, resultRows } from "./results";
import type { RatingRow, Store } from "./store/types";
import type { Tasks } from "./tasks";

/** Ended tables leave memory this long after their last change. */
const DROP_AFTER_MS = 5 * 60_000;
/** At most one "Your move" push per table per pig in this window. */
const TURN_PUSH_GAP_MS = 10 * 60_000;
const PERSIST_DEBOUNCE_MS = 250;
/** A live table read back after a restart jumps its revision past anything
 *  the old process may have sent but not yet written (the debounce). */
const REHYDRATE_REV_JUMP = 100;

export type LobbyCloseReason = "cancelled" | "expired" | "declined";

export interface ManagedRoom {
	readonly id: string;
	readonly game: AnyGame;
	state: RoomState;
	/** The invite that set this table (lobbies), if any. */
	inviteCode: string | null;
	closeReason: LobbyCloseReason | null;
	readonly timers: Map<string, Timer>;
	queue: Promise<void>;
	saveChain: Promise<void>;
	/** Revision last written to the store (-1: never). */
	storedRev: number;
	/** Has this table ever left the lobby? Lobbies that close record nothing. */
	started: boolean;
	recorded: boolean;
	/** Read back from the store at boot: re-read once before the first change,
	 *  in case the instance that wrote it was still running (Render keeps the
	 *  old instance up for about a minute after a deploy cuts over). */
	needsFreshen: boolean;
	readonly turnPushAt: Map<string, number>;
	readonly emoteAt: Map<string, number>;
	rematchRoomId: string | null;
	dropped: boolean;
}

export interface RoomListener {
	onCommit?(m: ManagedRoom, prev: RoomState): void;
	onDropped?(m: ManagedRoom): void;
}

export interface RoomHooks {
	/** Every snapshot, as it is sent (the e2e harness checks secrecy here). */
	onSnapshot?(state: RoomState, seat: Seat, snapshot: RoomSnapshot): void;
}

export interface RoomDeps {
	games: ReadonlyMap<GameId, AnyGame>;
	store: Store;
	clock: Clock;
	log: Logger;
	tasks: Tasks;
	presence: Presence;
	notifier: Notifier;
	players: PlayerDirectory;
	entropy: Entropy;
	timing: Timing;
	engine: EngineOptions;
	lobbyHostWaitMs: number;
	maxRooms: number;
	hooks?: RoomHooks;
}

export class RoomCapError extends Error {
	constructor() {
		super("the barn is full");
	}
}

/** A live table nobody can still be playing: its last change, its clock and
 *  its countdown are all further back than the reconnect grace. Deadlines
 *  count because the instance running a table keeps moving them; a table
 *  whose clock is still ticking is not stale, wherever it lives. */
export function isStaleLive(s: RoomState, now: number, graceMs: number): boolean {
	if (s.pace !== "live" || (s.phase !== "starting" && s.phase !== "playing")) return false;
	return now - Math.max(s.updatedAt, s.deadline ?? 0, s.startsAt ?? 0) > graceMs;
}

export interface CreateRoomInput {
	game: AnyGame;
	pace: Pace;
	source: RoomSource;
	seatCount: number;
	seats: (PlayerCard | null)[];
	host?: Seat | null;
	inviteCode?: string | null;
}

export class RoomManager {
	private readonly rooms = new Map<string, ManagedRoom>();
	private readonly loading = new Map<string, Promise<ManagedRoom | null>>();
	/** userId → tables that pig's socket follows. Keyed by pig, not socket,
	 *  so a superseding socket inherits them and a reconnect resumes them. */
	private readonly attachments = new Map<string, Set<string>>();
	private readonly listeners: RoomListener[] = [];
	/** After shutdown's final write nothing changes, arms or writes again:
	 *  sockets closing on the way out must not leave a later state behind. */
	private stopped = false;
	/** Filled by the invite manager: the summary a lobby snapshot carries. */
	inviteSummary: (m: ManagedRoom) => InviteSummary | null = () => null;

	constructor(private readonly deps: RoomDeps) {}

	// ── Lookup ───────────────────────────────────────────────────────────────

	get size(): number {
		return this.rooms.size;
	}

	get(roomId: string): ManagedRoom | undefined {
		return this.rooms.get(roomId);
	}

	all(): ManagedRoom[] {
		return [...this.rooms.values()];
	}

	listen(listener: RoomListener): void {
		this.listeners.push(listener);
	}

	/** The unfinished live table this pig sits at (one at a time). */
	liveTableOf(userId: string, exceptRoomId?: string): ManagedRoom | null {
		for (const m of this.rooms.values()) {
			if (m.id === exceptRoomId || m.state.pace !== "live" || m.state.phase === "ended") continue;
			const seat = seatOf(m.state, userId);
			if (seat !== null && !m.state.seats[seat]?.gone) return m;
		}
		return null;
	}

	unfinishedAsyncCount(userId: string): number {
		let n = 0;
		for (const m of this.rooms.values()) {
			if (m.state.pace !== "async" || m.state.phase === "ended") continue;
			const seat = seatOf(m.state, userId);
			if (seat !== null && !m.state.seats[seat]?.gone) n++;
		}
		return n;
	}

	/** The pig's unfinished tables, for welcome.resume and `sync`. Tables in
	 *  the store but not in memory are listed too (a live table from before a
	 *  restart, waiting to be rejoined); a stale one is retired on the way. */
	async summariesFor(userId: string): Promise<RoomSummary[]> {
		const out = new Map<string, RoomSummary>();
		for (const m of this.rooms.values()) {
			const seat = seatOf(m.state, userId);
			if (seat === null || m.state.phase === "ended" || m.state.seats[seat]?.gone) continue;
			out.set(m.id, summaryFor(m.state, seat));
		}
		try {
			const now = this.deps.clock.now();
			for (const s of await this.deps.store.listMatchesForUser(userId)) {
				if (out.has(s.roomId) || this.rooms.has(s.roomId)) continue;
				const seat = seatOf(s, userId);
				if (seat === null || s.seats[seat]?.gone) continue;
				if (isStaleLive(s, now, this.deps.timing.reconnectGraceMs)) {
					this.deps.tasks.spawn("retire stale table", () => this.load(s.roomId));
					continue;
				}
				out.set(s.roomId, summaryFor(s, seat));
			}
		} catch (err) {
			this.deps.log.warn("listing stored tables failed", { userId, err });
		}
		return [...out.values()].sort((a, b) => b.updatedAt - a.updatedAt);
	}

	// ── Attachments ──────────────────────────────────────────────────────────

	attach(userId: string, roomId: string): void {
		let set = this.attachments.get(userId);
		if (!set) this.attachments.set(userId, (set = new Set()));
		set.add(roomId);
	}

	detach(userId: string, roomId: string): void {
		const set = this.attachments.get(userId);
		if (!set) return;
		set.delete(roomId);
		if (set.size === 0) this.attachments.delete(userId);
	}

	isAttached(userId: string, roomId: string): boolean {
		return this.attachments.get(userId)?.has(roomId) ?? false;
	}

	private attachedRooms(userId: string): ManagedRoom[] {
		return [...(this.attachments.get(userId) ?? [])].flatMap((id) => {
			const m = this.rooms.get(id);
			return m ? [m] : [];
		});
	}

	// ── Creation ─────────────────────────────────────────────────────────────

	/** A new table in the lobby phase. The caller seats, starts and commits it. */
	create(input: CreateRoomInput): ManagedRoom {
		if (this.rooms.size >= this.deps.maxRooms) throw new RoomCapError();
		const state = createRoom({
			roomId: this.deps.entropy.uuid(),
			game: input.game,
			pace: input.pace,
			source: input.source,
			seatCount: input.seatCount,
			seats: input.seats,
			seed: makeSeed((n) => this.deps.entropy.int(n)),
			now: this.deps.clock.now(),
			host: input.host ?? null,
		});
		const m = this.register(state, input.game, false);
		m.inviteCode = input.inviteCode ?? null;
		m.storedRev = -1;
		return m;
	}

	private register(state: RoomState, game: AnyGame, needsFreshen: boolean): ManagedRoom {
		const m: ManagedRoom = {
			id: state.roomId,
			game,
			state,
			inviteCode: null,
			closeReason: null,
			timers: new Map(),
			queue: Promise.resolve(),
			saveChain: Promise.resolve(),
			storedRev: state.rev,
			started: state.phase !== "lobby",
			recorded: state.phase === "ended",
			needsFreshen,
			turnPushAt: new Map(),
			emoteAt: new Map(),
			rematchRoomId: null,
			dropped: false,
		};
		this.rooms.set(m.id, m);
		return m;
	}

	// ── Serialised work ──────────────────────────────────────────────────────

	/** Runs `fn` after every earlier piece of work on this table. */
	run<T>(m: ManagedRoom, fn: () => Promise<T> | T): Promise<T> {
		const next = m.queue.then(async () => {
			if (m.needsFreshen) await this.freshen(m);
			return fn();
		});
		m.queue = next.then(
			() => undefined,
			() => undefined,
		);
		return next;
	}

	/** Makes `proposed` the table's state. Call inside `run`. */
	async commit(m: ManagedRoom, proposed: RoomState): Promise<void> {
		if (m.dropped || this.stopped) return;
		const prev = m.state;
		const next = this.withPresence(m, proposed);
		if (next === prev) return;
		m.state = next;
		if (next.phase === "starting" || next.phase === "playing") m.started = true;

		// Play-by-push: written before anyone hears of the change, so the
		// store is never behind a snapshot a pig holds. Live: debounced,
		// except at phase changes.
		const immediate = next.pace === "async" || next.phase !== prev.phase || next.phase === "ended";
		if (immediate) await this.persistNow(m);
		else this.persistSoon(m);

		this.rearm(m);
		this.broadcast(m, prev);
		if (next.phase === "ended" && !m.recorded) await this.finish(m);
		this.notifyTurns(m, prev);
		for (const listener of this.listeners) {
			try {
				listener.onCommit?.(m, prev);
			} catch (err) {
				this.deps.log.error("room listener failed", { roomId: m.id, err });
			}
		}
	}

	// ── Phase helpers (inside `run`) ─────────────────────────────────────────

	/** A full lobby starts: play-by-push at once; live after the countdown,
	 *  once every pig is at the table. A host who stepped away gets one push
	 *  and `lobbyHostWaitMs` to come back before the table folds. */
	async maybeStartLobby(m: ManagedRoom): Promise<void> {
		const s = m.state;
		if (s.phase !== "lobby" || !canStart(s, m.game, false)) return;
		const now = this.deps.clock.now();
		if (s.pace === "async") {
			await this.commit(m, startGame(s, m.game, now, this.deps.engine));
			return;
		}
		const away = s.seats.filter((x): x is EngineSeat => !!x && !x.connected);
		if (away.length === 0) {
			this.clearTimer(m, "hostWait");
			await this.commit(m, beginCountdown(s, m.game, now, this.deps.engine));
			return;
		}
		if (m.timers.has("hostWait")) return;
		this.scheduleTimer(m, "hostWait", this.deps.lobbyHostWaitMs, () => this.hostWaitLapsed(m));
		const hostId = s.host !== null ? s.seats[s.host]?.userId : undefined;
		const guest = [...s.seats].reverse().find((x) => x && x.connected && x.userId !== hostId);
		const offline = away.map((x) => x.userId).filter((u) => !this.deps.presence.isOnline(u));
		this.deps.notifier.notify(offline, {
			...COPY.hostAtTable(guest?.name ?? NAMELESS_PIG, m.game.title),
			...this.pushFrame(m, { ttlMs: this.deps.lobbyHostWaitMs, thread: "invites" }),
		});
	}

	/** The host starts with fewer than every chair (down to the minimum).
	 *  Also how a party table gathered from the queue sets off. */
	async startEarly(m: ManagedRoom): Promise<boolean> {
		const s = m.state;
		if (!canStart(s, m.game, true)) return false;
		const now = this.deps.clock.now();
		let next = beginCountdown(s, m.game, now, this.deps.engine);
		if (s.pace === "async") next = startGame(next, m.game, now, this.deps.engine);
		await this.commit(m, next);
		return true;
	}

	/** A lobby that will never start (cancelled, expired, every invitee said
	 *  no, the host never came back). Nothing was played, so nothing is
	 *  recorded; the seated pigs get one last snapshot. */
	async closeLobby(m: ManagedRoom, reason: LobbyCloseReason): Promise<void> {
		const s = m.state;
		if (s.phase !== "lobby") return;
		m.closeReason = reason;
		await this.commit(m, {
			...s,
			phase: "ended",
			rev: s.rev + 1,
			events: [{ type: "closed", reason }],
			activeSeats: [],
			deadline: null,
			startsAt: null,
			updatedAt: this.deps.clock.now(),
			result: { kind: "no_contest", winners: [], scores: [], summary: "", reason: "ended_early" },
		});
	}

	scheduleTimer(m: ManagedRoom, name: string, delayMs: number, fn: () => Promise<void> | void): void {
		this.clearTimer(m, name);
		if (m.dropped || this.stopped) return;
		const timer = this.deps.clock.after(Math.max(0, delayMs), () => {
			if (m.timers.get(name) !== timer) return;
			m.timers.delete(name);
			this.deps.tasks.spawn(`room ${name}`, () => this.run(m, fn));
		});
		m.timers.set(name, timer);
	}

	clearTimer(m: ManagedRoom, name: string): void {
		const timer = m.timers.get(name);
		if (!timer) return;
		timer.cancel();
		m.timers.delete(name);
	}

	/** Counts a push just sent for these pigs against the "Your move" gap,
	 *  so "A pig took your seat" is not chased by a second buzz. */
	markTurnPushed(m: ManagedRoom, userIds: string[]): void {
		const now = this.deps.clock.now();
		for (const id of userIds) m.turnPushAt.set(id, now);
	}

	/** Push fields shared by every table push. */
	pushFrame(
		m: ManagedRoom,
		opts: { ttlMs: number | null; thread: "play" | "invites" },
	): Omit<PushContent, "title" | "body"> {
		const data: Record<string, unknown> = { screen: "play", room: m.id, foreground: "alert" };
		if (m.inviteCode) data.invite = m.inviteCode;
		return {
			data,
			sound: "default",
			priority: "high",
			threadId: opts.thread,
			collapseId: m.inviteCode && opts.thread === "invites" ? `invite_${m.inviteCode}` : `room_${m.id}`,
			...(opts.ttlMs !== null ? { ttl: Math.max(60, Math.ceil(opts.ttlMs / 1000)) } : {}),
		};
	}

	// ── Sessions ─────────────────────────────────────────────────────────────

	/** A pig's socket authenticated (fresh, reconnecting, or superseding).
	 *  Live tables in play and lobbies re-attach on their own; every attached
	 *  table sends a fresh snapshot. */
	async onUserOnline(userId: string): Promise<void> {
		for (const m of this.rooms.values()) {
			const s = m.state;
			const seat = seatOf(s, userId);
			if (seat === null || s.seats[seat]?.gone) continue;
			const liveInPlay = s.pace === "live" && (s.phase === "starting" || s.phase === "playing");
			if (s.phase === "lobby" || liveInPlay) this.attach(userId, m.id);
		}
		for (const m of this.attachedRooms(userId)) {
			await this.run(m, async () => {
				const before = m.state.rev;
				await this.commit(m, m.state);
				if (m.state.phase === "lobby") await this.maybeStartLobby(m);
				if (m.state.rev === before) this.sendSnapshot(m, userId);
			});
		}
	}

	/** A pig's last socket closed. Live tables in play keep the pig attached
	 *  (the reconnect grace runs); a live lobby releases a guest's chair; the
	 *  host's lobby waits; everything else lets go. */
	async onUserOffline(userId: string): Promise<void> {
		for (const m of this.attachedRooms(userId)) {
			await this.run(m, async () => {
				const s = m.state;
				const seat = seatOf(s, userId);
				if (seat === null) {
					this.detach(userId, m.id);
					return;
				}
				if (s.phase === "lobby") {
					if (s.pace === "live" && s.host !== seat) {
						this.detach(userId, m.id);
						await this.commit(m, releaseSeat(s, seat, this.deps.clock.now()));
						return;
					}
					if (s.pace === "async") this.detach(userId, m.id);
					await this.commit(m, s);
					return;
				}
				const liveInPlay = s.pace === "live" && (s.phase === "starting" || s.phase === "playing");
				if (!liveInPlay) this.detach(userId, m.id);
				await this.commit(m, s);
			});
		}
	}

	/** `sync`: a fresh snapshot of every table this pig follows. */
	resend(userId: string): void {
		for (const m of this.attachedRooms(userId)) this.sendSnapshot(m, userId);
	}

	// ── Requests ─────────────────────────────────────────────────────────────

	async handleJoin(userId: string, roomId: string): Promise<HandlerResult> {
		const m = this.rooms.get(roomId) ?? (await this.load(roomId));
		if (!m) {
			this.deps.presence.send(userId, { t: "room.gone", roomId, reason: "not_found" });
			return fail("not_found");
		}
		return this.run(m, async () => {
			const seat = seatOf(m.state, userId);
			if (seat === null) {
				this.deps.presence.send(userId, { t: "room.gone", roomId, reason: "not_found" });
				return fail("not_found");
			}
			const before = m.state.rev;
			if (!m.state.seats[seat]?.gone) this.attach(userId, m.id);
			await this.commit(m, m.state);
			if (m.state.phase === "lobby") await this.maybeStartLobby(m);
			if (m.state.rev === before) this.sendSnapshot(m, userId);
			return ok({ roomId: m.id });
		});
	}

	/** The engine alone decides legality; the client's `rev` is informational
	 *  (a stale rev is not an error: the move is judged against the truth). */
	async handleAction(userId: string, roomId: string, action: unknown): Promise<HandlerResult> {
		const m = this.rooms.get(roomId) ?? (await this.load(roomId));
		if (!m) return fail("not_found");
		return this.run(m, async () => {
			const seat = seatOf(m.state, userId);
			if (seat === null) return fail("not_found");
			if (!m.state.seats[seat]?.gone) this.attach(userId, m.id);
			const base = this.withPresence(m, m.state);
			const res = applyAction(base, m.game, seat, action, this.deps.clock.now(), this.deps.engine);
			if (!res.ok) {
				if (base !== m.state) await this.commit(m, base);
				return fail(res.error);
			}
			await this.commit(m, res.room);
			return ok();
		});
	}

	/** Leave: a live or play-by-push table is a resignation (markGone); a
	 *  lobby guest backs out; a lobby host folds the table. */
	async handleLeave(userId: string, roomId: string): Promise<HandlerResult> {
		const m = this.rooms.get(roomId) ?? (await this.load(roomId));
		if (!m) {
			this.deps.presence.send(userId, { t: "room.gone", roomId, reason: "not_found" });
			return ok();
		}
		return this.run(m, async () => {
			const s = m.state;
			const seat = seatOf(s, userId);
			this.detach(userId, m.id);
			if (seat !== null) {
				const now = this.deps.clock.now();
				if (s.phase === "lobby") {
					if (s.host === seat) await this.closeLobby(m, "cancelled");
					else await this.commit(m, releaseSeat(s, seat, now));
				} else if (!s.seats[seat]?.gone) {
					await this.commit(m, markGone(s, m.game, seat, now, this.deps.engine));
				}
			}
			this.deps.presence.send(userId, { t: "room.gone", roomId: m.id, reason: "left" });
			return ok();
		});
	}

	handleEmote(userId: string, roomId: string, emote: Emote): HandlerResult {
		const m = this.rooms.get(roomId);
		if (!m) return fail("not_found");
		const s = m.state;
		const seat = seatOf(s, userId);
		if (seat === null) return fail("not_found");
		if (s.seats[seat]?.gone) return fail("forbidden");
		const now = this.deps.clock.now();
		const last = m.emoteAt.get(userId);
		if (last !== undefined && now - last < this.deps.timing.emoteCooldownMs) return fail("rate_limited");
		m.emoteAt.set(userId, now);
		for (const occ of s.seats) {
			if (!occ || occ.gone || !this.deps.presence.isOnline(occ.userId)) continue;
			this.deps.presence.send(occ.userId, { t: "room.emote", roomId: m.id, seat, emote, at: now });
		}
		return ok();
	}

	async handleRematch(userId: string, roomId: string): Promise<HandlerResult> {
		const m = this.rooms.get(roomId) ?? (await this.load(roomId));
		if (!m) return fail("not_found");
		const result = await this.run(m, async (): Promise<HandlerResult> => {
			const s = m.state;
			const seat = seatOf(s, userId);
			if (seat === null) return fail("not_found");
			if (m.rematchRoomId) return ok({ roomId: m.rematchRoomId });
			if (s.pace === "live" && this.liveTableOf(userId, m.id)) return fail("busy");
			const vote = voteRematch(s, seat, this.deps.clock.now(), this.deps.engine);
			if (!vote.ok) return fail(vote.error);
			await this.commit(m, vote.room);
			if (!vote.ready) return ok();
			const cards = rematchSeats(m.state);
			if (cards.length < m.game.seats.min || cards.length > m.game.seats.max) return ok();
			let next: ManagedRoom;
			try {
				next = this.create({ game: m.game, pace: s.pace, source: "rematch", seatCount: cards.length, seats: cards });
			} catch (err) {
				if (err instanceof RoomCapError) return fail("busy", "The barn is full right now");
				throw err;
			}
			m.rematchRoomId = next.id;
			for (const card of cards) {
				if (s.pace === "live" || this.isAttached(card.userId, m.id)) this.attach(card.userId, next.id);
			}
			await this.run(next, async () => {
				const now = this.deps.clock.now();
				let st = beginCountdown(next.state, next.game, now, this.deps.engine);
				if (st.pace === "async") st = startGame(st, next.game, now, this.deps.engine);
				await this.commit(next, st);
			});
			return ok({ roomId: next.id });
		});
		// A pig who votes after the rematch formed is walked to the new table.
		const formed = result.ok ? (result.data as { roomId?: string } | undefined)?.roomId : undefined;
		if (formed && formed !== roomId) {
			const next = this.rooms.get(formed);
			if (next && !this.isAttached(userId, formed)) await this.handleJoin(userId, formed);
		}
		return result;
	}

	async handleStart(userId: string, roomId: string): Promise<HandlerResult> {
		const m = this.rooms.get(roomId);
		if (!m) return fail("not_found");
		return this.run(m, async () => {
			const s = m.state;
			const seat = seatOf(s, userId);
			if (seat === null) return fail("not_found");
			if (s.phase !== "lobby") return fail("expired", "That table has already started");
			if (s.host !== seat) return fail("forbidden", "Only the pig who set the table can start it");
			if (!(await this.startEarly(m))) return fail("bad_request", "A few more pigs are needed first");
			return ok();
		});
	}

	// ── Loading, boot, shutdown ──────────────────────────────────────────────

	/** A table from memory, or read back from the store: a live table from
	 *  before a restart resumes inside the reconnect grace (every pig gets the
	 *  grace to come back) and is retired as a no contest after it. */
	async load(roomId: string): Promise<ManagedRoom | null> {
		const held = this.rooms.get(roomId);
		if (held) return held;
		const inflight = this.loading.get(roomId);
		if (inflight) return inflight;
		const loading = this.loadFromStore(roomId).finally(() => this.loading.delete(roomId));
		this.loading.set(roomId, loading);
		return loading;
	}

	private async loadFromStore(roomId: string): Promise<ManagedRoom | null> {
		let stored: RoomState | null;
		try {
			stored = await this.deps.store.loadMatch(roomId);
		} catch (err) {
			this.deps.log.error("loading a table failed", { roomId, err });
			return null;
		}
		if (!stored) return null;
		const held = this.rooms.get(roomId);
		if (held) return held;
		const now = this.deps.clock.now();
		const game = this.deps.games.get(stored.gameId);
		if (!game || stored.rulesVersion !== game.rulesVersion) {
			await this.retire(stored, now);
			return null;
		}
		const m = this.register(this.awayFromEveryone(stored), game, false);
		if (stored.pace === "live" && (stored.phase === "starting" || stored.phase === "playing")) {
			if (isStaleLive(stored, now, this.deps.timing.reconnectGraceMs)) {
				await this.run(m, () => this.commit(m, abortRoom(m.state, now)));
				return m;
			}
			m.state = { ...m.state, rev: m.state.rev + REHYDRATE_REV_JUMP };
		}
		this.rearm(m);
		return m;
	}

	/** Boot: bring back every play-by-push table and invite lobby, retire live
	 *  tables nobody can still be playing, and leave fresh live tables in the
	 *  store until a pig rejoins (another instance may still be running them). */
	async rehydrate(): Promise<{ resumed: number; retired: number; deferred: number }> {
		const counts = { resumed: 0, retired: 0, deferred: 0 };
		let states: RoomState[];
		try {
			states = await this.deps.store.listOpenMatches();
		} catch (err) {
			this.deps.log.error("reading open tables at boot failed", { err });
			return counts;
		}
		const now = this.deps.clock.now();
		for (const s of states) {
			if (this.rooms.has(s.roomId)) continue;
			const game = this.deps.games.get(s.gameId);
			if (!game || s.rulesVersion !== game.rulesVersion) {
				await this.retire(s, now);
				counts.retired++;
				continue;
			}
			if (s.pace === "live" && (s.phase === "starting" || s.phase === "playing")) {
				if (!isStaleLive(s, now, this.deps.timing.reconnectGraceMs)) {
					counts.deferred++;
					continue;
				}
				const m = this.register(this.awayFromEveryone(s), game, false);
				await this.run(m, () => this.commit(m, abortRoom(m.state, now)));
				counts.retired++;
				continue;
			}
			if (s.phase === "lobby" && s.source !== "invite") {
				// A party table that was gathering from the queue: those pigs
				// have long since been told to search again.
				await this.retire(s, now);
				counts.retired++;
				continue;
			}
			const m = this.register(this.awayFromEveryone(s), game, true);
			this.rearm(m);
			counts.resumed++;
		}
		return counts;
	}

	/** Writes every table now (shutdown). */
	async flushAll(): Promise<void> {
		await Promise.all(
			[...this.rooms.values()].map(async (m) => {
				this.clearTimer(m, "persist");
				await this.save(m);
			}),
		);
	}

	stop(): void {
		this.stopped = true;
		for (const m of this.rooms.values()) {
			for (const timer of m.timers.values()) timer.cancel();
			m.timers.clear();
		}
	}

	// ── Internals ────────────────────────────────────────────────────────────

	private awayFromEveryone(s: RoomState): RoomState {
		return { ...s, seats: s.seats.map((x) => (x ? { ...x, connected: false } : x)) };
	}

	/** A table this server cannot run (its game is gone, or its rules moved
	 *  on): written off as a no contest without loading it. */
	private async retire(s: RoomState, now: number): Promise<void> {
		this.deps.log.warn("retiring a table this server cannot run", {
			roomId: s.roomId,
			game: s.gameId,
			rulesVersion: s.rulesVersion,
			phase: s.phase,
		});
		try {
			await this.deps.store.saveMatch(abortRoom(s, now));
		} catch (err) {
			this.deps.log.error("retiring a table failed", { roomId: s.roomId, err });
		}
	}

	private async freshen(m: ManagedRoom): Promise<void> {
		m.needsFreshen = false;
		let stored: RoomState | null = null;
		try {
			stored = await this.deps.store.loadMatch(m.id);
		} catch (err) {
			this.deps.log.warn("re-reading a table failed; keeping the boot copy", { roomId: m.id, err });
			return;
		}
		if (!stored || stored.rev <= m.storedRev) return;
		this.deps.log.info("a newer copy of a table was written elsewhere; adopting it", {
			roomId: m.id,
			rev: stored.rev,
			had: m.storedRev,
		});
		m.state = { ...this.awayFromEveryone(stored), rev: Math.max(stored.rev, m.state.rev) + 1 };
		m.storedRev = stored.rev;
		m.started = m.started || stored.phase !== "lobby";
		m.recorded = m.recorded || stored.phase === "ended";
		this.rearm(m);
	}

	/** Every seat's `connected` set from the truth: a live socket that is
	 *  attached to this table. */
	private withPresence(m: ManagedRoom, state: RoomState): RoomState {
		let next = state;
		const now = this.deps.clock.now();
		state.seats.forEach((occ, seat) => {
			if (!occ || occ.gone) return;
			const want = this.deps.presence.isOnline(occ.userId) && this.isAttached(occ.userId, m.id);
			if (occ.connected !== want) next = setConnected(next, seat, want, now);
		});
		return next;
	}

	private snapshot(m: ManagedRoom, seat: Seat): RoomSnapshot {
		const snap = snapshotFor(m.state, m.game, seat);
		if (m.state.phase === "lobby") snap.invite = this.inviteSummary(m);
		this.deps.hooks?.onSnapshot?.(m.state, seat, snap);
		return snap;
	}

	private sendSnapshot(m: ManagedRoom, userId: string): void {
		const seat = seatOf(m.state, userId);
		if (seat === null) return;
		try {
			this.deps.presence.send(userId, { t: "room.state", room: this.snapshot(m, seat) });
		} catch (err) {
			this.deps.log.error("building a snapshot failed", { roomId: m.id, seat, err });
		}
	}

	private broadcast(m: ManagedRoom, prev: RoomState): void {
		const wasPresent = new Set(prev.seats.flatMap((x) => (x && !x.gone ? [x.userId] : [])));
		m.state.seats.forEach((occ, seat) => {
			if (!occ || (occ.gone && !wasPresent.has(occ.userId))) return;
			if (!this.deps.presence.isOnline(occ.userId)) return;
			try {
				this.deps.presence.send(occ.userId, { t: "room.state", room: this.snapshot(m, seat) });
			} catch (err) {
				this.deps.log.error("building a snapshot failed", { roomId: m.id, seat, err });
			}
		});
	}

	/** Re-arms every timer the current state calls for. */
	private rearm(m: ManagedRoom): void {
		if (m.dropped) return;
		const s = m.state;
		const now = this.deps.clock.now();
		const { tick } = m.game;

		if (s.phase === "playing" && s.deadline !== null) {
			this.scheduleTimer(m, "deadline", s.deadline - now, () => this.deadlinePassed(m));
		} else this.clearTimer(m, "deadline");

		if (s.phase === "playing" && tick) {
			if (!m.timers.has("tick")) this.scheduleTimer(m, "tick", tick.everyMs, () => this.ticked(m));
		} else this.clearTimer(m, "tick");

		if (s.phase === "starting" && s.startsAt !== null) {
			this.scheduleTimer(m, "start", s.startsAt - now, () => this.countdownDone(m));
		} else this.clearTimer(m, "start");

		// Reconnect grace: a live table in play holds an away pig's chair for
		// reconnectGraceMs, then lets them go.
		const away = new Set<string>();
		if (s.pace === "live" && (s.phase === "starting" || s.phase === "playing")) {
			for (const occ of s.seats) if (occ && !occ.gone && !occ.connected) away.add(occ.userId);
		}
		for (const name of [...m.timers.keys()]) {
			if (name.startsWith("grace:") && !away.has(name.slice("grace:".length))) this.clearTimer(m, name);
		}
		for (const userId of away) {
			if (!m.timers.has(`grace:${userId}`)) {
				this.scheduleTimer(m, `grace:${userId}`, this.deps.timing.reconnectGraceMs, () => this.graceLapsed(m, userId));
			}
		}

		if (s.phase !== "lobby") {
			this.clearTimer(m, "hostWait");
			this.clearTimer(m, "gather");
		}
		if (s.phase === "ended") {
			this.clearTimer(m, "openSeat");
			const linger = Math.max(DROP_AFTER_MS, s.rematch ? s.rematch.until - now : 0);
			this.scheduleTimer(m, "drop", linger, () => this.drop(m));
		}
	}

	private async deadlinePassed(m: ManagedRoom): Promise<void> {
		const s = m.state;
		if (s.phase !== "playing" || s.deadline === null) return;
		const now = this.deps.clock.now();
		const next = now < s.deadline ? s : applyTimeouts(s, m.game, now, this.deps.engine);
		if (next === s) {
			this.rearm(m);
			return;
		}
		await this.commit(m, next);
	}

	private async ticked(m: ManagedRoom): Promise<void> {
		const s = m.state;
		if (s.phase !== "playing" || !m.game.tick) return;
		const next = applyTick(s, m.game, this.deps.clock.now(), this.deps.engine);
		if (next !== s) await this.commit(m, next);
		this.rearm(m);
	}

	private async countdownDone(m: ManagedRoom): Promise<void> {
		const s = m.state;
		if (s.phase !== "starting") return;
		const now = this.deps.clock.now();
		if (s.startsAt !== null && now < s.startsAt) {
			this.rearm(m);
			return;
		}
		await this.commit(m, startGame(s, m.game, now, this.deps.engine));
	}

	private async graceLapsed(m: ManagedRoom, userId: string): Promise<void> {
		const s = m.state;
		const seat = seatOf(s, userId);
		const occ = seat === null ? null : s.seats[seat];
		if (seat === null || !occ || occ.gone || occ.connected) return;
		if (s.phase !== "starting" && s.phase !== "playing") return;
		this.detach(userId, m.id);
		await this.commit(m, markGone(s, m.game, seat, this.deps.clock.now(), this.deps.engine));
	}

	private async hostWaitLapsed(m: ManagedRoom): Promise<void> {
		if (m.state.phase === "lobby") await this.closeLobby(m, "expired");
	}

	private drop(m: ManagedRoom): void {
		if (m.state.phase !== "ended" || m.dropped) return;
		if (m.timers.has("persist") || m.storedRev !== m.state.rev) this.deps.tasks.spawn("persist", () => this.save(m));
		m.dropped = true;
		for (const timer of m.timers.values()) timer.cancel();
		m.timers.clear();
		this.rooms.delete(m.id);
		for (const [userId, set] of this.attachments) {
			set.delete(m.id);
			if (set.size === 0) this.attachments.delete(userId);
		}
		for (const listener of this.listeners) listener.onDropped?.(m);
	}

	private persistSoon(m: ManagedRoom): void {
		if (this.stopped || m.timers.has("persist")) return;
		const timer = this.deps.clock.after(PERSIST_DEBOUNCE_MS, () => {
			if (m.timers.get("persist") !== timer) return;
			m.timers.delete("persist");
			this.deps.tasks.spawn("persist", () => this.save(m));
		});
		m.timers.set("persist", timer);
	}

	private async persistNow(m: ManagedRoom): Promise<void> {
		this.clearTimer(m, "persist");
		await this.save(m);
	}

	/** Writes the table's current state; writes for one table never overlap,
	 *  so an older revision can never land after a newer one. */
	private save(m: ManagedRoom): Promise<void> {
		const write = m.saveChain.then(async () => {
			const state = m.state;
			if (state.rev === m.storedRev) return;
			try {
				await this.deps.store.saveMatch(state);
				m.storedRev = state.rev;
			} catch (err) {
				this.deps.log.error("saving a table failed", { roomId: m.id, rev: state.rev, err });
			}
		});
		m.saveChain = write;
		return write;
	}

	/** The end of a table: play_results once, then hidden ratings. */
	private async finish(m: ManagedRoom): Promise<void> {
		m.recorded = true;
		if (!m.started) return;
		const now = this.deps.clock.now();
		const rows = resultRows(m.state, m.game, now);
		if (rows.length > 0) {
			try {
				await this.deps.store.recordResult(rows);
			} catch (err) {
				this.deps.log.error("recording a result failed", { roomId: m.id, err });
			}
		}
		const pair = ratedPair(m.state, m.game);
		if (!pair) return;
		try {
			const [ra, rb] = await Promise.all([
				this.deps.players.ratingRecord(pair.a.userId, m.game.id),
				this.deps.players.ratingRecord(pair.b.userId, m.game.id),
			]);
			const [na, nb] = eloPair(ra.rating, rb.rating, pair.scoreA);
			const ratings: RatingRow[] = [
				{ userId: pair.a.userId, game: m.game.id, rating: na, games: ra.games + 1, updatedAt: now },
				{ userId: pair.b.userId, game: m.game.id, rating: nb, games: rb.games + 1, updatedAt: now },
			];
			this.deps.players.applyRatings(ratings);
			await this.deps.store.saveRatings(ratings);
		} catch (err) {
			this.deps.log.error("updating ratings failed", { roomId: m.id, err });
		}
	}

	/** Play-by-push: a pig who now owes a move and is not at this table (no
	 *  socket, or a socket elsewhere in the app) gets one "Your move", at most
	 *  one per table per ten minutes. */
	private notifyTurns(m: ManagedRoom, prev: RoomState): void {
		const s = m.state;
		if (s.pace !== "async" || s.phase !== "playing") return;
		const owedBefore = new Set(
			prev.phase === "playing" ? prev.activeSeats.flatMap((i) => (prev.seats[i] ? [prev.seats[i]!.userId] : [])) : [],
		);
		const now = this.deps.clock.now();
		const due: string[] = [];
		for (const seat of s.activeSeats) {
			const occ = s.seats[seat];
			if (!occ || occ.gone || occ.connected || owedBefore.has(occ.userId)) continue;
			const last = m.turnPushAt.get(occ.userId);
			if (last !== undefined && now - last < TURN_PUSH_GAP_MS) continue;
			m.turnPushAt.set(occ.userId, now);
			due.push(occ.userId);
		}
		if (due.length === 0) return;
		const copy: PushCopy = COPY.yourMove(m.game.title);
		this.deps.notifier.notify(due, {
			...copy,
			...this.pushFrame(m, { ttlMs: s.deadline !== null ? s.deadline - now : null, thread: "play" }),
		});
	}
}

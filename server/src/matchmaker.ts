// Finding a table.
//
// Live: pigs wait in one queue, each listing the games they would play.
// A pig is paired with the longest-waiting compatible pig: sharing a game,
// no block either way, and not the pig they just played (inside three
// minutes) unless both have waited twenty seconds. Among pigs who have
// waited under ten seconds the closest hidden rating wins; a pig who has
// waited ten seconds or more is simply next. The game is the first one in
// the waiting pig's list that the newcomer also listed. Two-seat games
// count down straight away; party games gather for PARTY_GATHER_MS, pulling
// in any other compatible pig who listed that game, then set off with
// whoever came (open chairs drop).
//
// By post (async): there is no wait. A pig takes the oldest open chair at a
// compatible table, or sits down at a fresh table that starts at once (they
// can make the first move) and keeps its other chairs open for up to
// ASYNC_OPEN_SEAT_TTL_MS, after which it is called off as a no contest.

import type { AnyGame, GameId, Pace } from "../../multiplayer/types";
import type { QueueState, Timing } from "../../multiplayer/protocol";
import {
	abortRoom,
	beginCountdown,
	presentSeats,
	seatOf,
	startGame,
	takeSeat,
	type EngineOptions,
	type RoomState,
} from "../../multiplayer/engine";
import type { Clock, Timer } from "./clock";
import { COPY } from "./copy";
import type { Entropy } from "./entropy";
import type { Logger } from "./log";
import type { PlayerDirectory } from "./players";
import type { Notifier } from "./push";
import { fail, ok, type HandlerResult, type Presence } from "./reply";
import { RoomCapError, type ManagedRoom, type RoomManager } from "./rooms";
import type { Settings } from "./settings";
import type { Tasks } from "./tasks";

const VETERAN_MS = 10_000;
const RECENT_MS = 3 * 60_000;
const RECENT_PATIENCE_MS = 20_000;
const SWEEP_MS = 1_000;
export const MAX_ASYNC_TABLES = 10;

interface QueueEntry {
	userId: string;
	games: GameId[];
	since: number;
}

export interface MatchmakerDeps {
	games: ReadonlyMap<GameId, AnyGame>;
	rooms: RoomManager;
	players: PlayerDirectory;
	settings: Settings;
	presence: Presence;
	notifier: Notifier;
	clock: Clock;
	log: Logger;
	tasks: Tasks;
	entropy: Entropy;
	timing: Timing;
	engine: EngineOptions;
	partyGatherMs: number;
	asyncOpenSeatTtlMs: number;
}

export class Matchmaker {
	private readonly waiting = new Map<string, QueueEntry>();
	/** Party tables pulling in queued pigs, with the entries that formed
	 *  them (so a table that never fills can send its pigs back to wait). */
	private readonly gathering = new Map<string, QueueEntry[]>();
	/** Play-by-push tables with a chair open, by room id → created at. */
	private readonly openSeats = new Map<string, number>();
	/** The pigs each pig last sat with, and when that table ended. */
	private readonly recent = new Map<string, { opponents: Set<string>; at: number }>();
	private sweepTimer: Timer | null = null;
	private stopped = false;

	constructor(private readonly deps: MatchmakerDeps) {
		deps.rooms.listen({
			onCommit: (m, prev) => this.roomChanged(m, prev),
			onDropped: (m) => {
				this.gathering.delete(m.id);
				this.openSeats.delete(m.id);
			},
		});
		deps.settings.onChange(() => this.settingsChanged());
	}

	stateFor(userId: string): QueueState {
		const entry = this.waiting.get(userId);
		return entry
			? { state: "searching", games: entry.games, pace: "live", since: entry.since }
			: { state: "idle", games: [], pace: "live", since: null };
	}

	get waitingCount(): number {
		return this.waiting.size;
	}

	async join(userId: string, games: GameId[], pace: Pace): Promise<HandlerResult> {
		if (this.stopped) return fail("disabled", "The barn is tidying up. Try again in a moment");
		const playable = games.filter((id) => this.deps.settings.isGameEnabled(id) && this.game(id)?.paces.includes(pace));
		if (playable.length === 0) return fail("game_unavailable");
		if (!this.deps.players.get(userId)) return fail("unauthorized");
		return pace === "live" ? this.joinLive(userId, playable) : this.joinAsync(userId, playable);
	}

	/** Leaves the live queue. True if the pig was waiting. */
	leave(userId: string, notify = true): boolean {
		const had = this.waiting.delete(userId);
		if (had && notify) this.sendState(userId);
		return had;
	}

	/** Shutdown: nobody new is matched; everyone waiting is told. */
	stop(): void {
		this.stopped = true;
		this.sweepTimer?.cancel();
		this.sweepTimer = null;
		for (const userId of [...this.waiting.keys()]) this.leave(userId);
	}

	/** Boot: play-by-push tables read back with a chair still open rejoin the
	 *  pool, keeping their original deadline for finding a pig. */
	adoptOpenSeats(): number {
		let n = 0;
		for (const m of this.deps.rooms.all()) {
			const s = m.state;
			if (s.pace === "async" && s.source === "queue" && s.phase === "playing" && s.seats.includes(null)) {
				this.addOpenSeat(m);
				n++;
			}
		}
		return n;
	}

	// ── Live ─────────────────────────────────────────────────────────────────

	private async joinLive(userId: string, games: GameId[]): Promise<HandlerResult> {
		if (this.deps.rooms.liveTableOf(userId)) return fail("busy", "You are already at a table");
		this.waiting.delete(userId);
		const entry: QueueEntry = { userId, games, since: this.deps.clock.now() };

		if (await this.tryGather(entry)) {
			this.sendState(userId);
			return ok();
		}
		const pick = this.pickPartner(entry, [...this.waiting.values()], "joiner");
		if (pick) {
			this.waiting.delete(pick.partner.userId);
			this.sendState(pick.partner.userId);
			this.sendState(userId);
			await this.makeTable(pick.partner, entry, pick.game);
			return ok();
		}
		this.waiting.set(userId, entry);
		this.sendState(userId);
		this.ensureSweep();
		return ok();
	}

	/** The best partner for `subject` in `pool`, or null. `subject` is either
	 *  the newcomer ("joiner") or, in a sweep, a pig already waiting. */
	private pickPartner(
		subject: QueueEntry,
		pool: QueueEntry[],
		role: "joiner" | "waiting",
	): { partner: QueueEntry; game: GameId } | null {
		const now = this.deps.clock.now();
		// The game: the first in the waiting pig's list the other also listed.
		const gameWith = (other: QueueEntry): GameId | undefined =>
			role === "joiner"
				? other.games.find((g) => subject.games.includes(g))
				: subject.games.find((g) => other.games.includes(g));
		const candidates = pool
			.filter((e) => e.userId !== subject.userId && gameWith(e) !== undefined && this.compatible(subject, e, now))
			.sort((a, b) => a.since - b.since);
		if (candidates.length === 0) return null;
		const veteran = candidates.find((e) => now - e.since >= VETERAN_MS);
		if (veteran) return { partner: veteran, game: gameWith(veteran) as GameId };
		let best = candidates[0];
		let bestGap = Number.POSITIVE_INFINITY;
		for (const e of candidates) {
			const game = gameWith(e) as GameId;
			const gap = Math.abs(this.deps.players.rating(subject.userId, game) - this.deps.players.rating(e.userId, game));
			if (gap < bestGap) {
				best = e;
				bestGap = gap;
			}
		}
		return { partner: best, game: gameWith(best) as GameId };
	}

	private compatible(a: QueueEntry, b: QueueEntry, now: number): boolean {
		if (a.userId === b.userId || this.deps.players.blockedEither(a.userId, b.userId)) return false;
		if (this.playedRecently(a.userId, b.userId, now)) {
			return now - a.since >= RECENT_PATIENCE_MS && now - b.since >= RECENT_PATIENCE_MS;
		}
		return true;
	}

	private playedRecently(a: string, b: string, now: number): boolean {
		const ra = this.recent.get(a);
		const rb = this.recent.get(b);
		return (
			(!!ra && now - ra.at < RECENT_MS && ra.opponents.has(b)) || (!!rb && now - rb.at < RECENT_MS && rb.opponents.has(a))
		);
	}

	/** May this pig sit at this table? No block with anyone at it. */
	private fitsTable(userId: string, s: RoomState): boolean {
		return s.seats.every((occ) => !occ || occ.gone || (occ.userId !== userId && !this.deps.players.blockedEither(userId, occ.userId)));
	}

	private ensureSweep(): void {
		if (this.stopped || this.sweepTimer || this.waiting.size < 2) return;
		this.sweepTimer = this.deps.clock.after(SWEEP_MS, () => {
			this.sweepTimer = null;
			this.deps.tasks.spawn("matchmaking sweep", () => this.sweep());
		});
	}

	/** Pairs that only became possible with time (the recent-opponent rule,
	 *  the veteran rule). Oldest pig first. */
	private async sweep(): Promise<void> {
		if (this.stopped) return;
		const entries = [...this.waiting.values()].sort((a, b) => a.since - b.since);
		for (const entry of entries) {
			if (!this.waiting.has(entry.userId)) continue;
			const pool = [...this.waiting.values()].filter((e) => e.userId !== entry.userId);
			const pick = this.pickPartner(entry, pool, "waiting");
			if (!pick) continue;
			this.waiting.delete(entry.userId);
			this.waiting.delete(pick.partner.userId);
			this.sendState(entry.userId);
			this.sendState(pick.partner.userId);
			await this.makeTable(entry, pick.partner, pick.game);
		}
		this.ensureSweep();
	}

	/** Seats the pair: a two-seat game counts down at once (seat order by
	 *  coin flip); a party game opens a gathering table. */
	private async makeTable(waiting: QueueEntry, joiner: QueueEntry, gameId: GameId): Promise<void> {
		const game = this.game(gameId);
		const a = this.deps.players.get(waiting.userId)?.card;
		const b = this.deps.players.get(joiner.userId)?.card;
		if (!game || !a || !b) {
			// One of them vanished between pairing and seating: the other waits on.
			for (const e of [waiting, joiner]) if (this.deps.players.get(e.userId) && this.deps.presence.isOnline(e.userId)) this.requeue(e);
			return;
		}
		const party = game.seats.max > 2;
		const cards = this.deps.entropy.int(2) === 0 ? [a, b] : [b, a];
		let m: ManagedRoom;
		try {
			m = this.deps.rooms.create({
				game,
				pace: "live",
				source: "queue",
				seatCount: party ? game.seats.max : 2,
				seats: party ? [...cards, ...Array.from({ length: game.seats.max - 2 }, () => null)] : cards,
			});
		} catch (err) {
			if (!(err instanceof RoomCapError)) throw err;
			this.deps.log.warn("room cap reached; pigs keep waiting", { game: gameId });
			this.requeue(waiting);
			this.requeue(joiner);
			return;
		}
		for (const card of cards) this.deps.rooms.attach(card.userId, m.id);
		if (!party) {
			await this.deps.rooms.run(m, () =>
				this.deps.rooms.commit(m, beginCountdown(m.state, game, this.deps.clock.now(), this.deps.engine)),
			);
			return;
		}
		this.gathering.set(m.id, [waiting, joiner]);
		await this.deps.rooms.run(m, () => this.deps.rooms.commit(m, m.state));
		// Pull in anyone already waiting who listed this game.
		for (const e of [...this.waiting.values()].sort((x, y) => x.since - y.since)) {
			if (m.state.phase !== "lobby" || !m.state.seats.includes(null)) break;
			if (!e.games.includes(gameId)) continue;
			if (await this.seatAtGathering(m, e)) {
				this.waiting.delete(e.userId);
				this.sendState(e.userId);
			}
		}
		if (m.state.phase === "lobby") {
			this.deps.rooms.scheduleTimer(m, "gather", this.deps.partyGatherMs, () => this.endGather(m));
		}
	}

	/** A newcomer joins a party table that is still gathering, if any fits. */
	private async tryGather(entry: QueueEntry): Promise<boolean> {
		for (const roomId of this.gathering.keys()) {
			const m = this.deps.rooms.get(roomId);
			if (!m || m.state.phase !== "lobby" || !entry.games.includes(m.state.gameId)) continue;
			if (await this.seatAtGathering(m, entry)) return true;
		}
		return false;
	}

	private async seatAtGathering(m: ManagedRoom, entry: QueueEntry): Promise<boolean> {
		const card = this.deps.players.get(entry.userId)?.card;
		if (!card) return false;
		return this.deps.rooms.run(m, async () => {
			const s = m.state;
			if (s.phase !== "lobby" || !this.fitsTable(entry.userId, s)) return false;
			const taken = takeSeat(s, m.game, card, this.deps.clock.now());
			if (!taken.ok) return false;
			this.gathering.get(m.id)?.push(entry);
			this.deps.rooms.attach(entry.userId, m.id);
			await this.deps.rooms.commit(m, taken.room);
			await this.deps.rooms.maybeStartLobby(m);
			return true;
		});
	}

	/** The gather window closed: set off with whoever came, or fold the table
	 *  and send its pigs back to wait (keeping their place in line). */
	private async endGather(m: ManagedRoom): Promise<void> {
		const entries = this.gathering.get(m.id) ?? [];
		this.gathering.delete(m.id);
		if (m.state.phase !== "lobby") return;
		if (await this.deps.rooms.startEarly(m)) return;
		const stayed = presentSeats(m.state).map((i) => m.state.seats[i]?.userId);
		await this.deps.rooms.closeLobby(m, "expired");
		for (const entry of entries) {
			if (stayed.includes(entry.userId) && this.deps.presence.isOnline(entry.userId)) {
				this.deps.rooms.detach(entry.userId, m.id);
				this.requeue(entry);
			}
		}
	}

	private requeue(entry: QueueEntry): void {
		if (this.stopped) return;
		this.waiting.set(entry.userId, entry);
		this.sendState(entry.userId);
		this.ensureSweep();
	}

	// ── By post ──────────────────────────────────────────────────────────────

	private async joinAsync(userId: string, games: GameId[]): Promise<HandlerResult> {
		if (this.deps.rooms.unfinishedAsyncCount(userId) >= MAX_ASYNC_TABLES) {
			return fail("busy", "Ten tables by post at once is plenty");
		}
		const card = this.deps.players.get(userId)?.card;
		if (!card) return fail("unauthorized");
		this.leave(userId);

		const candidates = [...this.openSeats.entries()]
			.sort((a, b) => a[1] - b[1])
			.flatMap(([id]) => {
				const m = this.deps.rooms.get(id);
				return m && games.includes(m.state.gameId) ? [m] : [];
			});
		for (const m of candidates) {
			const waitingPigs = await this.deps.rooms.run(m, async () => {
				const s = m.state;
				if (s.phase !== "playing" || !s.seats.includes(null) || seatOf(s, userId) !== null) return null;
				if (!this.fitsTable(userId, s)) return null;
				const taken = takeSeat(s, m.game, card, this.deps.clock.now());
				if (!taken.ok) return null;
				// The pigs already seated who are not at the table right now.
				const away = s.seats.flatMap((occ) => (occ && !occ.gone && !occ.connected ? [occ.userId] : []));
				this.deps.rooms.attach(userId, m.id);
				// Counted before the commit, so the seat-taken push below is
				// not chased by a "Your move" for the same table.
				this.deps.rooms.markTurnPushed(m, away);
				await this.deps.rooms.commit(m, taken.room);
				return away;
			});
			if (waitingPigs === null) continue;
			this.deps.notifier.notify(waitingPigs, {
				...COPY.seatTaken(m.game.title),
				...this.deps.rooms.pushFrame(m, {
					ttlMs: m.state.deadline !== null ? m.state.deadline - this.deps.clock.now() : null,
					thread: "play",
				}),
			});
			this.sendState(userId);
			return ok({ roomId: m.id });
		}

		const game = this.game(games[0]) as AnyGame;
		const seatCount = game.seats.min;
		let m: ManagedRoom;
		try {
			m = this.deps.rooms.create({
				game,
				pace: "async",
				source: "queue",
				seatCount,
				seats: [card, ...Array.from({ length: seatCount - 1 }, () => null)],
			});
		} catch (err) {
			if (err instanceof RoomCapError) return fail("busy", "The barn is full right now");
			throw err;
		}
		this.deps.rooms.attach(userId, m.id);
		await this.deps.rooms.run(m, () =>
			this.deps.rooms.commit(m, startGame(m.state, game, this.deps.clock.now(), this.deps.engine)),
		);
		this.addOpenSeat(m);
		this.sendState(userId);
		return ok({ roomId: m.id });
	}

	private addOpenSeat(m: ManagedRoom): void {
		const createdAt = m.state.createdAt;
		this.openSeats.set(m.id, createdAt);
		const left = createdAt + this.deps.asyncOpenSeatTtlMs - this.deps.clock.now();
		this.deps.rooms.scheduleTimer(m, "openSeat", left, async () => {
			this.openSeats.delete(m.id);
			const s = m.state;
			if (s.phase !== "ended" && s.seats.includes(null)) {
				await this.deps.rooms.commit(m, abortRoom(s, this.deps.clock.now()));
			}
		});
	}

	// ── Bookkeeping ──────────────────────────────────────────────────────────

	private roomChanged(m: ManagedRoom, prev: RoomState): void {
		const s = m.state;
		if (this.gathering.has(m.id) && s.phase !== "lobby") this.gathering.delete(m.id);
		if (this.openSeats.has(m.id) && (s.phase === "ended" || !s.seats.includes(null))) {
			this.openSeats.delete(m.id);
			this.deps.rooms.clearTimer(m, "openSeat");
		}
		// Remember who sat together, for the recent-opponent rule.
		if (s.phase === "ended" && prev.phase !== "ended" && s.pace === "live" && m.started) {
			const now = this.deps.clock.now();
			const ids = s.seats.flatMap((occ) => (occ ? [occ.userId] : []));
			for (const id of ids) this.recent.set(id, { opponents: new Set(ids.filter((x) => x !== id)), at: now });
			if (this.recent.size > 50_000) {
				for (const [id, r] of this.recent) if (now - r.at > RECENT_MS) this.recent.delete(id);
			}
		}
	}

	private settingsChanged(): void {
		for (const entry of [...this.waiting.values()]) {
			const still = entry.games.filter((id) => this.deps.settings.isGameEnabled(id));
			if (still.length === entry.games.length) continue;
			if (still.length === 0) this.leave(entry.userId);
			else {
				entry.games = still;
				this.sendState(entry.userId);
			}
		}
	}

	private sendState(userId: string): void {
		this.deps.presence.send(userId, { t: "queue.state", queue: this.stateFor(userId) });
	}

	private game(id: GameId): AnyGame | undefined {
		return this.deps.games.get(id);
	}
}

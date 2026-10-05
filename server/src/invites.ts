// Invites: a lobby table plus a code.
//
//   direct → named friends or Sounder mates (pushed; only they may see it);
//   link   → anyone holding the URL;
//   crew   → the inviter's Sounder (pushed to each member; first pigs to
//            tap take the chairs).
//
// A pig with a live socket hears about an invite in-app (`invite.state`)
// instead of by push. Blocks hold everywhere: a blocked pig cannot see,
// accept or be sent an invite, and to them it simply does not exist.

import type { AnyGame, GameId, Pace } from "../../multiplayer/types";
import type { InviteKind, InviteStatus, InviteSummary, PlayerCard, Timing } from "../../multiplayer/protocol";
import { filledSeats, seatOf, takeSeat, type RoomState } from "../../multiplayer/engine";
import { inviteSchemeUrl, inviteUrl, makeInviteCode } from "../../multiplayer/links";
import type { Clock, Timer } from "./clock";
import { COPY } from "./copy";
import type { Entropy } from "./entropy";
import type { Logger } from "./log";
import type { Matchmaker } from "./matchmaker";
import { MAX_ASYNC_TABLES } from "./matchmaker";
import type { PlayerDirectory } from "./players";
import type { Notifier } from "./push";
import { SlidingWindow } from "./ratelimit";
import { fail, ok, type HandlerResult, type Presence } from "./reply";
import { RoomCapError, type ManagedRoom, type RoomManager } from "./rooms";
import type { Settings } from "./settings";
import type { InviteRecord, Store } from "./store/types";
import type { Tasks } from "./tasks";

const CREATES_PER_WINDOW = 10;
const CREATE_WINDOW_MS = 10 * 60_000;
const MAX_OPEN_INVITES = 3;
/** How long a settled invite stays answerable (a late tap still finds it). */
const FORGET_AFTER_MS = 30 * 60_000;

interface InviteEntry {
	record: InviteRecord;
	from: PlayerCard;
	timer: Timer | null;
	/** Read back at boot: re-read once before the first change (see rooms.ts). */
	needsFreshen: boolean;
}

export interface PublicInvite {
	code: string;
	game: GameId;
	title: string;
	from: { name: string };
	status: InviteStatus;
	expiresAt: number;
}

export interface InviteDeps {
	games: ReadonlyMap<GameId, AnyGame>;
	rooms: RoomManager;
	matchmaker: Matchmaker;
	players: PlayerDirectory;
	settings: Settings;
	presence: Presence;
	notifier: Notifier;
	store: Store;
	clock: Clock;
	log: Logger;
	tasks: Tasks;
	entropy: Entropy;
	timing: Timing;
}

type CreateRequest = { game: GameId; kind: InviteKind; to?: string[]; pace: Pace };

export class InviteManager {
	private readonly invites = new Map<string, InviteEntry>();
	private readonly byRoom = new Map<string, string>();
	private readonly creates: SlidingWindow;

	constructor(private readonly deps: InviteDeps) {
		this.creates = new SlidingWindow(CREATES_PER_WINDOW, CREATE_WINDOW_MS, () => deps.clock.now());
		deps.rooms.inviteSummary = (m) => {
			const code = m.inviteCode ?? this.byRoom.get(m.id);
			const entry = code ? this.invites.get(code) : undefined;
			return entry ? this.summary(entry) : null;
		};
		deps.rooms.listen({ onCommit: (m, prev) => this.roomChanged(m, prev) });
	}

	// ── Views ────────────────────────────────────────────────────────────────

	summary(entry: InviteEntry): InviteSummary {
		const r = entry.record;
		const m = r.roomId ? this.deps.rooms.get(r.roomId) : undefined;
		return {
			code: r.code,
			url: inviteUrl(r.code),
			game: r.game,
			pace: r.pace,
			kind: r.kind,
			from: entry.from,
			to: r.toUsers,
			status: this.statusNow(r),
			roomId: r.roomId,
			seatsTaken: m ? filledSeats(m.state).length : 1 + r.acceptedBy.length,
			seatsMax: r.seatsMax,
			expiresAt: r.expiresAt,
		};
	}

	/** Open invites this pig sent or received (welcome.resume). */
	openFor(userId: string): InviteSummary[] {
		const out: InviteSummary[] = [];
		for (const entry of this.invites.values()) {
			const r = entry.record;
			if (!this.isLive(r)) continue;
			const sent = r.fromUser === userId;
			const received = !sent && this.permitted(entry, userId) && r.kind !== "link" && !r.declinedBy.includes(userId);
			if (sent || received) out.push(this.summary(entry));
		}
		return out;
	}

	async publicPreview(code: string): Promise<PublicInvite | null> {
		const entry = await this.find(code);
		if (!entry) return null;
		const r = entry.record;
		return {
			code: r.code,
			game: r.game,
			title: this.deps.games.get(r.game)?.title ?? r.game,
			from: { name: entry.from.name },
			status: this.statusNow(r),
			expiresAt: r.expiresAt,
		};
	}

	// ── Requests ─────────────────────────────────────────────────────────────

	async create(userId: string, req: CreateRequest): Promise<HandlerResult> {
		const game = this.deps.games.get(req.game);
		if (!game || !this.deps.settings.isGameEnabled(req.game) || !game.paces.includes(req.pace)) {
			return fail("game_unavailable");
		}
		const me = this.deps.players.get(userId);
		if (!me) return fail("unauthorized");
		const open = [...this.invites.values()].filter((e) => e.record.fromUser === userId && this.isLive(e.record)).length;
		if (open >= MAX_OPEN_INVITES) return fail("rate_limited", "Three open invites at once is plenty");
		if (req.pace === "live" && this.deps.rooms.liveTableOf(userId)) return fail("busy", "You are already at a table");
		if (req.pace === "async" && this.deps.rooms.unfinishedAsyncCount(userId) >= MAX_ASYNC_TABLES) {
			return fail("busy", "Ten tables by post at once is plenty");
		}

		const social = await this.deps.players.refreshSocial(userId);
		let targets: string[] = [];
		let crewId: string | null = null;
		if (req.kind === "direct") {
			for (const to of req.to ?? []) {
				if (to === userId) return fail("bad_request", "You are already at your own table");
				if (this.deps.players.blockedEither(userId, to)) return fail("blocked");
				if (!social.friends.includes(to) && !social.crewmates.includes(to)) {
					return fail("forbidden", "Invite friends or Sounder mates by name");
				}
			}
			targets = req.to ?? [];
		} else if (req.kind === "crew") {
			if (!social.crewId || social.crewmates.length === 0) return fail("forbidden", "Your Sounder needs another pig first");
			crewId = social.crewId;
			targets = social.crewmates.filter((id) => !this.deps.players.blockedEither(userId, id));
		}
		if (!this.creates.hit(userId)) return fail("rate_limited", "That is a lot of invites. Try again in a few minutes");

		const seatCount =
			req.kind === "direct"
				? Math.max(game.seats.min, Math.min(game.seats.max, 1 + targets.length))
				: game.seats.max;
		const code = await this.freshCode();
		if (!code) return fail("internal");
		if (req.pace === "live") this.deps.matchmaker.leave(userId);

		let m: ManagedRoom;
		try {
			m = this.deps.rooms.create({
				game,
				pace: req.pace,
				source: "invite",
				seatCount,
				seats: [me.card, ...Array.from({ length: seatCount - 1 }, () => null)],
				host: 0,
				inviteCode: code,
			});
		} catch (err) {
			if (err instanceof RoomCapError) return fail("busy", "The barn is full right now");
			throw err;
		}
		const now = this.deps.clock.now();
		const entry: InviteEntry = {
			record: {
				code,
				game: req.game,
				pace: req.pace,
				kind: req.kind,
				fromUser: userId,
				toUsers: req.kind === "direct" ? targets : [],
				crewId,
				roomId: m.id,
				status: "open",
				seatsMax: seatCount,
				acceptedBy: [],
				declinedBy: [],
				createdAt: now,
				updatedAt: now,
				// A live invite is about to be played; one by post waits a day
				// for its pigs, whatever its kind.
				expiresAt: now + (req.pace === "async" ? this.deps.timing.asyncInviteTtlMs : this.deps.timing.inviteTtlMs[req.kind]),
			},
			from: me.card,
			timer: null,
			needsFreshen: false,
		};
		this.remember(entry);
		await this.save(entry);
		this.deps.rooms.attach(userId, m.id);
		await this.deps.rooms.run(m, () => this.deps.rooms.commit(m, m.state));

		const summary = this.summary(entry);
		this.deps.presence.send(userId, { t: "invite.state", invite: summary });
		if (targets.length > 0) {
			const online = targets.filter((id) => this.deps.presence.isOnline(id));
			for (const id of online) this.deps.presence.send(id, { t: "invite.state", invite: summary });
			const copy =
				req.kind === "crew" ? COPY.crewInvite(me.card.name, game.title) : COPY.directInvite(me.card.name, game.title);
			this.deps.notifier.notify(
				targets.filter((id) => !online.includes(id)),
				{
					...copy,
					data: { screen: "play", invite: code, url: inviteSchemeUrl(code), foreground: "alert" },
					sound: "default",
					priority: "high",
					ttl: Math.max(60, Math.ceil((entry.record.expiresAt - now) / 1000)),
					categoryId: "match_invite",
					collapseId: `invite_${code}`,
					threadId: "invites",
				},
			);
		}
		return ok(summary);
	}

	async preview(userId: string, code: string): Promise<HandlerResult> {
		const entry = await this.find(code);
		if (!entry) return fail("not_found");
		await this.deps.players.refreshSocial(userId);
		if (!this.permitted(entry, userId) || this.blockedAtTable(entry, userId)) return fail("not_found");
		const summary = this.summary(entry);
		this.deps.presence.send(userId, { t: "invite.state", invite: summary });
		return ok(summary);
	}

	async accept(userId: string, code: string): Promise<HandlerResult> {
		const entry = await this.find(code);
		if (!entry) return fail("not_found");
		await this.deps.players.refreshSocial(userId);
		if (!this.permitted(entry, userId)) return fail("not_found");
		await this.freshen(entry);
		const r = entry.record;
		const m = r.roomId ? await this.deps.rooms.load(r.roomId) : null;
		if (!m) return fail("expired");
		// Already at this table (the host, or a second tap): walk them back to it.
		if (seatOf(m.state, userId) !== null) return this.deps.rooms.handleJoin(userId, m.id);
		const status = this.statusNow(r);
		if (status === "full" || status === "accepted") return fail("full");
		if (status !== "open") return fail("expired");
		if (this.blockedAtTable(entry, userId)) return fail("blocked");
		if (r.pace === "live" && this.deps.rooms.liveTableOf(userId, m.id)) return fail("busy", "You are already at a table");
		if (r.pace === "async" && this.deps.rooms.unfinishedAsyncCount(userId) >= MAX_ASYNC_TABLES) {
			return fail("busy", "Ten tables by post at once is plenty");
		}
		const card = this.deps.players.get(userId)?.card;
		if (!card) return fail("unauthorized");
		this.deps.matchmaker.leave(userId);

		return this.deps.rooms.run(m, async (): Promise<HandlerResult> => {
			const s = m.state;
			if (s.phase !== "lobby") return fail("full");
			const taken = takeSeat(s, m.game, card, this.deps.clock.now());
			if (!taken.ok) return fail(taken.error);
			if (!r.acceptedBy.includes(userId)) r.acceptedBy = [...r.acceptedBy, userId];
			this.deps.rooms.attach(userId, m.id);
			await this.deps.rooms.commit(m, taken.room);
			await this.deps.rooms.maybeStartLobby(m);
			return ok({ roomId: m.id, invite: this.summary(entry) });
		});
	}

	/** Direct invitees only. When every one of them has said no, the table
	 *  folds and the host hears it in-app (never by push: a no is not news
	 *  worth buzzing a phone for). */
	async decline(userId: string, code: string): Promise<HandlerResult> {
		const entry = await this.find(code);
		if (!entry) return fail("not_found");
		const r = entry.record;
		if (r.kind !== "direct" || !r.toUsers.includes(userId)) return fail("forbidden");
		await this.freshen(entry);
		if (!this.isLive(r)) return ok();
		const m = r.roomId ? this.deps.rooms.get(r.roomId) : undefined;
		if (m && seatOf(m.state, userId) !== null) return fail("forbidden", "Leave the table instead");
		if (!r.declinedBy.includes(userId)) r.declinedBy = [...r.declinedBy, userId];
		r.updatedAt = this.deps.clock.now();
		if (r.toUsers.every((id) => r.declinedBy.includes(id))) {
			r.status = "declined";
			await this.save(entry);
			if (m) await this.deps.rooms.run(m, () => this.deps.rooms.closeLobby(m, "declined"));
			this.tellEveryone(entry);
			this.forgetLater(entry);
		} else {
			await this.save(entry);
			this.deps.presence.send(r.fromUser, { t: "invite.state", invite: this.summary(entry) });
		}
		return ok();
	}

	async cancel(userId: string, code: string): Promise<HandlerResult> {
		const entry = await this.find(code);
		if (!entry) return fail("not_found");
		const r = entry.record;
		if (r.fromUser !== userId) return fail("forbidden");
		await this.freshen(entry);
		const m = r.roomId ? await this.deps.rooms.load(r.roomId) : null;
		if (m && m.state.phase !== "lobby" && m.state.phase !== "ended") return fail("expired", "That table has already started");
		if (!this.isLive(r)) return ok();
		r.status = "cancelled";
		r.updatedAt = this.deps.clock.now();
		await this.save(entry);
		if (m) await this.deps.rooms.run(m, () => this.deps.rooms.closeLobby(m, "cancelled"));
		this.tellEveryone(entry);
		this.forgetLater(entry);
		return ok();
	}

	// ── Boot ─────────────────────────────────────────────────────────────────

	/** Re-links open invites to the lobbies rooms.rehydrate() brought back,
	 *  and folds any lobby whose invite did not survive. */
	async rehydrate(): Promise<number> {
		const now = this.deps.clock.now();
		let records: InviteRecord[] = [];
		try {
			records = await this.deps.store.listOpenInvites(now);
		} catch (err) {
			this.deps.log.error("reading open invites at boot failed", { err });
		}
		let linked = 0;
		for (const record of records) {
			if (this.invites.has(record.code)) continue;
			const m = record.roomId ? this.deps.rooms.get(record.roomId) : undefined;
			const entry: InviteEntry = { record, from: await this.deps.players.card(record.fromUser), timer: null, needsFreshen: true };
			this.remember(entry);
			if (!m || m.state.phase !== "lobby") continue;
			m.inviteCode = record.code;
			linked++;
		}
		for (const m of this.deps.rooms.all()) {
			if (m.state.phase === "lobby" && m.state.source === "invite" && !this.byRoom.has(m.id)) {
				this.deps.tasks.spawn("fold orphan lobby", () => this.deps.rooms.run(m, () => this.deps.rooms.closeLobby(m, "expired")));
			}
		}
		return linked;
	}

	stop(): void {
		for (const entry of this.invites.values()) entry.timer?.cancel();
	}

	// ── Internals ────────────────────────────────────────────────────────────

	/** Status, with the clock applied (an open invite past its time is expired). */
	private statusNow(r: InviteRecord): InviteStatus {
		return r.status === "open" && this.deps.clock.now() >= r.expiresAt ? "expired" : r.status;
	}

	/** Still waiting on pigs: open, or full while its lobby waits on the host. */
	private isLive(r: InviteRecord): boolean {
		const status = this.statusNow(r);
		if (status === "open") return true;
		if (status !== "full" && status !== "accepted") return false;
		const m = r.roomId ? this.deps.rooms.get(r.roomId) : undefined;
		return !!m && m.state.phase === "lobby" && this.deps.clock.now() < r.expiresAt;
	}

	/** Who may see (and take) this invite. */
	private permitted(entry: InviteEntry, userId: string): boolean {
		const r = entry.record;
		if (userId === r.fromUser) return true;
		if (this.deps.players.blockedEither(userId, r.fromUser)) return false;
		if (r.kind === "direct") return r.toUsers.includes(userId);
		if (r.kind === "crew") return r.crewId !== null && this.deps.players.social(userId).crewId === r.crewId;
		return true;
	}

	private blockedAtTable(entry: InviteEntry, userId: string): boolean {
		const m = entry.record.roomId ? this.deps.rooms.get(entry.record.roomId) : undefined;
		if (!m) return this.deps.players.blockedEither(userId, entry.record.fromUser);
		return m.state.seats.some((occ) => occ && occ.userId !== userId && this.deps.players.blockedEither(userId, occ.userId));
	}

	private async find(code: string): Promise<InviteEntry | null> {
		const held = this.invites.get(code);
		if (held) return held;
		let record: InviteRecord | null = null;
		try {
			record = await this.deps.store.loadInvite(code);
		} catch (err) {
			this.deps.log.error("loading an invite failed", { code, err });
			return null;
		}
		if (!record) return null;
		const raced = this.invites.get(code);
		if (raced) return raced;
		const entry: InviteEntry = { record, from: await this.deps.players.card(record.fromUser), timer: null, needsFreshen: false };
		this.remember(entry);
		const m = record.roomId ? await this.deps.rooms.load(record.roomId) : null;
		if (m && m.state.phase === "lobby") m.inviteCode = record.code;
		return entry;
	}

	/** Boot copies re-read the store once before their first change. */
	private async freshen(entry: InviteEntry): Promise<void> {
		if (!entry.needsFreshen) return;
		entry.needsFreshen = false;
		try {
			const stored = await this.deps.store.loadInvite(entry.record.code);
			if (stored && stored.updatedAt > entry.record.updatedAt) {
				entry.record = { ...stored, declinedBy: entry.record.declinedBy };
			}
		} catch (err) {
			this.deps.log.warn("re-reading an invite failed", { code: entry.record.code, err });
		}
	}

	private remember(entry: InviteEntry): void {
		const r = entry.record;
		this.invites.set(r.code, entry);
		if (r.roomId) this.byRoom.set(r.roomId, r.code);
		entry.timer?.cancel();
		const now = this.deps.clock.now();
		if (this.isLive(r)) {
			entry.timer = this.deps.clock.after(r.expiresAt - now, () => {
				entry.timer = null;
				this.deps.tasks.spawn("invite expiry", () => this.expire(entry));
			});
		} else this.forgetLater(entry);
	}

	private async expire(entry: InviteEntry): Promise<void> {
		const r = entry.record;
		const m = r.roomId ? this.deps.rooms.get(r.roomId) : undefined;
		const waiting = r.status === "open" || ((r.status === "full" || r.status === "accepted") && m?.state.phase === "lobby");
		if (waiting) {
			r.status = "expired";
			r.updatedAt = this.deps.clock.now();
			await this.save(entry);
			if (m) await this.deps.rooms.run(m, () => this.deps.rooms.closeLobby(m, "expired"));
			this.tellEveryone(entry);
		}
		this.forgetLater(entry);
	}

	private forgetLater(entry: InviteEntry): void {
		entry.timer?.cancel();
		entry.timer = this.deps.clock.after(FORGET_AFTER_MS, () => {
			const r = entry.record;
			if (this.invites.get(r.code) !== entry || this.isLive(r)) return;
			this.invites.delete(r.code);
			if (r.roomId && this.byRoom.get(r.roomId) === r.code) this.byRoom.delete(r.roomId);
		});
	}

	/** Keeps an invite's status in step with its table. */
	private roomChanged(m: ManagedRoom, prev: RoomState): void {
		const code = m.inviteCode ?? this.byRoom.get(m.id);
		const entry = code ? this.invites.get(code) : undefined;
		if (!entry) return;
		const r = entry.record;
		const s = m.state;
		const filled = (st: RoomState) => st.seats.filter(Boolean).length;
		const settled: InviteStatus = r.kind === "direct" ? "accepted" : "full";
		let status = r.status;
		if (s.phase === "lobby") {
			const full = !s.seats.includes(null);
			if (status === "open" && full) status = settled;
			else if ((status === "full" || status === "accepted") && !full) status = "open";
		} else if (prev.phase === "lobby" && s.phase === "ended") {
			if (status === "open" || status === "full" || status === "accepted") status = m.closeReason ?? "cancelled";
		} else if (prev.phase === "lobby") {
			status = settled;
		}
		if (status === r.status && filled(s) === filled(prev)) return;
		r.status = status;
		r.updatedAt = this.deps.clock.now();
		this.deps.tasks.spawn("save invite", () => this.save(entry));
		this.tellEveryone(entry);
		if (!this.isLive(r)) this.forgetLater(entry);
	}

	/** invite.state to everyone it concerns who is online right now. */
	private tellEveryone(entry: InviteEntry): void {
		const r = entry.record;
		const m = r.roomId ? this.deps.rooms.get(r.roomId) : undefined;
		const audience = new Set<string>([r.fromUser, ...r.toUsers, ...r.acceptedBy]);
		if (m) for (const occ of m.state.seats) if (occ) audience.add(occ.userId);
		if (r.kind === "crew") for (const id of this.deps.players.social(r.fromUser).crewmates) audience.add(id);
		const summary = this.summary(entry);
		for (const id of audience) {
			if (this.deps.presence.isOnline(id) && !this.deps.players.blockedEither(id, r.fromUser)) {
				this.deps.presence.send(id, { t: "invite.state", invite: summary });
			}
		}
	}

	private async save(entry: InviteEntry): Promise<void> {
		try {
			await this.deps.store.saveInvite(entry.record);
		} catch (err) {
			this.deps.log.error("saving an invite failed", { code: entry.record.code, err });
		}
	}

	private async freshCode(): Promise<string | null> {
		for (let attempt = 0; attempt < 6; attempt++) {
			const code = makeInviteCode((n) => this.deps.entropy.int(n));
			if (this.invites.has(code)) continue;
			try {
				if (await this.deps.store.loadInvite(code)) continue;
			} catch {
				// A store hiccup: an 8-character code colliding is vanishingly rare.
			}
			return code;
		}
		return null;
	}
}

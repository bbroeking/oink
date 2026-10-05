// The in-memory store: tests, the e2e harness, local dev, and the per-table
// fallback when a play_* table is missing in Supabase. Everything is
// deep-copied in and out, like a real database, so a caller that mutates a
// returned object can never reach into the store. With STORE_FILE set it
// also writes itself to disk (debounced, atomic rename), so a local server
// can be restarted mid play-by-push game.

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { clearTimeout as nodeClearTimeout, setTimeout as nodeSetTimeout } from "node:timers";
import type { GameId } from "../../../multiplayer/types";
import type { PigLook } from "../../../multiplayer/protocol";
import type { RoomState } from "../../../multiplayer/engine";
import type {
	InviteRecord,
	PlayerRecord,
	RatingRecord,
	RatingRow,
	ResultRow,
	SocialGraph,
	Store,
	StoredSettings,
} from "./types";

export const DEFAULT_LOOK: PigLook = {
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

interface MemoryData {
	players: Record<string, PlayerRecord>;
	pushTokens: Record<string, string>;
	friendships: [string, string][];
	blocks: [string, string][];
	crews: Record<string, string[]>;
	ratings: Record<string, RatingRecord>;
	invites: Record<string, InviteRecord>;
	matches: Record<string, RoomState>;
	results: Record<string, ResultRow>;
	settings: StoredSettings;
}

function emptyData(): MemoryData {
	return {
		players: {},
		pushTokens: {},
		friendships: [],
		blocks: [],
		crews: {},
		ratings: {},
		invites: {},
		matches: {},
		results: {},
		// Locally the flag is on: the gate is exercised by tests that turn it off.
		settings: { multiplayerEnabled: true, games: {} },
	};
}

const copy = <T>(value: T): T => structuredClone(value);

export interface SeedPlayer {
	userId: string;
	username?: string | null;
	look?: Partial<PigLook>;
	isTest?: boolean;
	featureOverrides?: Record<string, unknown>;
	pushToken?: string | null;
}

export class MemoryStore implements Store {
	readonly kind = "memory" as const;
	private data: MemoryData;
	private saveTimer: ReturnType<typeof nodeSetTimeout> | null = null;

	constructor(private readonly file: string | null = null) {
		this.data = emptyData();
		if (file && existsSync(file)) {
			this.data = { ...emptyData(), ...(JSON.parse(readFileSync(file, "utf8")) as Partial<MemoryData>) };
		}
	}

	// ── Seeding (tests, e2e, local dev) ──────────────────────────────────────

	seedPlayer(p: SeedPlayer): this {
		this.data.players[p.userId] = {
			userId: p.userId,
			username: p.username === undefined ? p.userId.slice(0, 8) : p.username,
			look: { ...DEFAULT_LOOK, ...p.look },
			isTest: p.isTest ?? false,
			featureOverrides: p.featureOverrides ?? {},
			hideFromLeaderboard: false,
		};
		if (p.pushToken) this.data.pushTokens[p.userId] = p.pushToken;
		this.changed();
		return this;
	}

	seedFriends(a: string, b: string): this {
		this.data.friendships.push([a, b]);
		this.changed();
		return this;
	}

	seedBlock(blocker: string, blocked: string): this {
		this.data.blocks.push([blocker, blocked]);
		this.changed();
		return this;
	}

	unblock(blocker: string, blocked: string): this {
		this.data.blocks = this.data.blocks.filter(([x, y]) => !(x === blocker && y === blocked));
		this.changed();
		return this;
	}

	seedCrew(crewId: string, members: string[]): this {
		this.data.crews[crewId] = members.slice();
		this.changed();
		return this;
	}

	setSettings(settings: Partial<StoredSettings>): this {
		this.data.settings = { ...this.data.settings, ...settings };
		this.changed();
		return this;
	}

	setRating(userId: string, game: GameId, rating: number, games = 0): this {
		this.data.ratings[`${userId}|${game}`] = { rating, games };
		this.changed();
		return this;
	}

	// ── Inspection (tests) ───────────────────────────────────────────────────

	allResults(): ResultRow[] {
		return copy(Object.values(this.data.results));
	}

	ratingOf(userId: string, game: GameId): RatingRecord | null {
		return copy(this.data.ratings[`${userId}|${game}`] ?? null);
	}

	peekMatch(roomId: string): RoomState | null {
		return copy(this.data.matches[roomId] ?? null);
	}

	peekInvite(code: string): InviteRecord | null {
		return copy(this.data.invites[code] ?? null);
	}

	// ── Store ────────────────────────────────────────────────────────────────

	async loadPlayer(userId: string): Promise<PlayerRecord | null> {
		return copy(this.data.players[userId] ?? null);
	}

	async loadSocialGraph(userId: string): Promise<SocialGraph> {
		const friends = this.data.friendships.flatMap(([a, b]) => (a === userId ? [b] : b === userId ? [a] : []));
		const blocked = this.data.blocks.flatMap(([a, b]) => (a === userId ? [b] : []));
		const blockedBy = this.data.blocks.flatMap(([a, b]) => (b === userId ? [a] : []));
		const crew = Object.entries(this.data.crews).find(([, members]) => members.includes(userId));
		return {
			friends: [...new Set(friends)],
			blocked: [...new Set(blocked)],
			blockedBy: [...new Set(blockedBy)],
			crewId: crew ? crew[0] : null,
			crewmates: crew ? crew[1].filter((m) => m !== userId) : [],
		};
	}

	async loadRatings(userId: string): Promise<Partial<Record<GameId, RatingRecord>>> {
		const out: Partial<Record<GameId, RatingRecord>> = {};
		for (const [key, value] of Object.entries(this.data.ratings)) {
			const [user, game] = key.split("|");
			if (user === userId) out[game as GameId] = copy(value);
		}
		return out;
	}

	async saveRatings(rows: RatingRow[]): Promise<void> {
		for (const row of rows) this.data.ratings[`${row.userId}|${row.game}`] = { rating: row.rating, games: row.games };
		this.changed();
	}

	async getPushTokens(userIds: string[]): Promise<Map<string, string>> {
		const out = new Map<string, string>();
		for (const id of userIds) {
			const token = this.data.pushTokens[id];
			if (token) out.set(id, token);
		}
		return out;
	}

	async getSettings(): Promise<StoredSettings> {
		return copy(this.data.settings);
	}

	async saveInvite(invite: InviteRecord): Promise<void> {
		this.data.invites[invite.code] = copy(invite);
		this.changed();
	}

	async loadInvite(code: string): Promise<InviteRecord | null> {
		return copy(this.data.invites[code] ?? null);
	}

	async listOpenInvites(now: number): Promise<InviteRecord[]> {
		return copy(
			Object.values(this.data.invites).filter(
				(i) => i.expiresAt > now && (i.status === "open" || i.status === "full" || i.status === "accepted"),
			),
		);
	}

	async saveMatch(state: RoomState): Promise<void> {
		this.data.matches[state.roomId] = copy(state);
		this.changed();
	}

	async loadMatch(roomId: string): Promise<RoomState | null> {
		return copy(this.data.matches[roomId] ?? null);
	}

	async listOpenMatches(): Promise<RoomState[]> {
		return copy(Object.values(this.data.matches).filter((m) => m.phase !== "ended"));
	}

	async listMatchesForUser(userId: string): Promise<RoomState[]> {
		return copy(
			Object.values(this.data.matches).filter(
				(m) => m.phase !== "ended" && m.seats.some((s) => s?.userId === userId),
			),
		);
	}

	async recordResult(rows: ResultRow[]): Promise<void> {
		for (const row of rows) {
			const key = `${row.matchId}|${row.userId}`;
			// ON CONFLICT DO NOTHING, as in Postgres: the first write stands.
			if (!this.data.results[key]) this.data.results[key] = copy(row);
		}
		this.changed();
	}

	async close(): Promise<void> {
		this.flush();
	}

	/** Writes STORE_FILE now (no-op without one). */
	flush(): void {
		if (this.saveTimer) nodeClearTimeout(this.saveTimer);
		this.saveTimer = null;
		if (!this.file) return;
		const tmp = `${this.file}.tmp`;
		writeFileSync(tmp, JSON.stringify(this.data));
		renameSync(tmp, this.file);
	}

	private changed(): void {
		if (!this.file || this.saveTimer) return;
		this.saveTimer = nodeSetTimeout(() => this.flush(), 200);
		this.saveTimer.unref();
	}
}

// Production store: supabase-js with the secret (service role) key, which
// bypasses RLS, so this module is the only writer of the play_* tables.
//
// Dark-launch safety: the play_* tables arrive in a migration that may not be
// pushed yet. A missing table (Postgres 42P01, or PostgREST PGRST205 "not in
// the schema cache") is logged once and that table falls back to memory for
// the life of the process, so the server still runs matches end to end; the
// next restart after the migration lands picks the real table up.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { GameId, Pace } from "../../../multiplayer/types";
import type { InviteKind, InviteStatus } from "../../../multiplayer/protocol";
import type { RoomState } from "../../../multiplayer/engine";
import type { Logger } from "../log";
import { MemoryStore, DEFAULT_LOOK } from "./memory";
import {
	EMPTY_SOCIAL,
	type InviteRecord,
	type PlayerRecord,
	type RatingRecord,
	type RatingRow,
	type ResultRow,
	type SocialGraph,
	type Store,
	type StoredSettings,
} from "./types";

type PlayTable = "play_invites" | "play_matches" | "play_results" | "play_ratings";

interface PgError {
	code?: string;
	message?: string;
}

export class StoreError extends Error {
	constructor(
		readonly op: string,
		readonly code: string | undefined,
		message: string | undefined,
	) {
		super(`${op} failed${code ? ` (${code})` : ""}: ${message ?? "unknown error"}`);
	}
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value: string): boolean => UUID_RE.test(value);
const iso = (ms: number): string => new Date(ms).toISOString();
const ms = (value: string | null | undefined): number => (value ? Date.parse(value) : 0);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const PROFILE_COLUMNS =
	"id, username, active_pig_id, active_hat_id, active_bow_id, active_glasses_id, active_mask_id, active_neck_id, active_held_id, active_aura_id, wallow_count, is_test, feature_overrides, hide_from_leaderboard";

interface ProfileRow {
	id: string;
	username: string | null;
	active_pig_id: string | null;
	active_hat_id: string | null;
	active_bow_id: string | null;
	active_glasses_id: string | null;
	active_mask_id: string | null;
	active_neck_id: string | null;
	active_held_id: string | null;
	active_aura_id: string | null;
	wallow_count: number | null;
	is_test: boolean | null;
	feature_overrides: unknown;
	hide_from_leaderboard: boolean | null;
}

interface InviteRow {
	code: string;
	game: string;
	pace: Pace;
	kind: InviteKind;
	from_user: string;
	to_users: string[] | null;
	crew_id: string | null;
	room_id: string | null;
	status: InviteStatus;
	seats_max: number;
	accepted_by: string[] | null;
	created_at: string;
	updated_at: string;
	expires_at: string;
}

function inviteToRow(r: InviteRecord): InviteRow {
	return {
		code: r.code,
		game: r.game,
		pace: r.pace,
		kind: r.kind,
		from_user: r.fromUser,
		to_users: r.toUsers,
		crew_id: r.crewId,
		room_id: r.roomId,
		status: r.status,
		seats_max: r.seatsMax,
		accepted_by: r.acceptedBy,
		created_at: iso(r.createdAt),
		updated_at: iso(r.updatedAt),
		expires_at: iso(r.expiresAt),
	};
}

function inviteFromRow(row: InviteRow): InviteRecord {
	return {
		code: row.code,
		game: row.game as GameId,
		pace: row.pace,
		kind: row.kind,
		fromUser: row.from_user,
		toUsers: row.to_users ?? [],
		crewId: row.crew_id,
		roomId: row.room_id,
		status: row.status,
		seatsMax: row.seats_max,
		acceptedBy: row.accepted_by ?? [],
		declinedBy: [],
		createdAt: ms(row.created_at),
		updatedAt: ms(row.updated_at),
		expiresAt: ms(row.expires_at),
	};
}

function matchToRow(s: RoomState) {
	return {
		id: s.roomId,
		game: s.gameId,
		rules_version: s.rulesVersion,
		pace: s.pace,
		source: s.source,
		phase: s.phase,
		seat_users: s.seats.flatMap((seat) => (seat ? [seat.userId] : [])),
		state: s,
		result: s.result,
		created_at: iso(s.createdAt),
		updated_at: iso(s.updatedAt),
		ended_at: s.phase === "ended" ? iso(s.updatedAt) : null,
	};
}

function resultToRow(r: ResultRow) {
	return {
		match_id: r.matchId,
		user_id: r.userId,
		game: r.game,
		seat: r.seat,
		outcome: r.outcome,
		score: r.score,
		reason: r.reason,
		opponents: r.opponents,
		period: r.period,
		ended_at: iso(r.endedAt),
	};
}

export interface SupabaseStoreOptions {
	url: string;
	key: string;
	log: Logger;
	fetch?: typeof fetch;
}

export class SupabaseStore implements Store {
	readonly kind = "supabase" as const;
	private readonly db: SupabaseClient;
	private readonly log: Logger;
	private readonly fallback = new MemoryStore();
	private readonly missing = new Set<PlayTable>();

	constructor(opts: SupabaseStoreOptions) {
		this.log = opts.log;
		this.db = createClient(opts.url, opts.key, {
			auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
			global: {
				headers: { "x-client-info": "ttp-play-server" },
				...(opts.fetch ? { fetch: opts.fetch } : {}),
			},
		});
	}

	/** Tables currently served from memory (for /healthz and tests). */
	get missingTables(): PlayTable[] {
		return [...this.missing];
	}

	// ── Players ──────────────────────────────────────────────────────────────

	async loadPlayer(userId: string): Promise<PlayerRecord | null> {
		if (!isUuid(userId)) return null;
		const { data, error } = await this.db.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle();
		if (error) throw new StoreError("loadPlayer", error.code, error.message);
		if (!data) return null;
		const row = data as unknown as ProfileRow;
		return {
			userId: row.id,
			username: row.username,
			look: {
				pigId: row.active_pig_id ?? DEFAULT_LOOK.pigId,
				hat: row.active_hat_id,
				bow: row.active_bow_id,
				glasses: row.active_glasses_id,
				mask: row.active_mask_id,
				neck: row.active_neck_id,
				held: row.active_held_id,
				aura: row.active_aura_id,
				wallow: row.wallow_count ?? 0,
			},
			isTest: row.is_test === true,
			featureOverrides: isRecord(row.feature_overrides) ? row.feature_overrides : {},
			hideFromLeaderboard: row.hide_from_leaderboard === true,
		};
	}

	async loadSocialGraph(userId: string): Promise<SocialGraph> {
		if (!isUuid(userId)) return { ...EMPTY_SOCIAL };
		// userId is a validated UUID, so it is safe inside a PostgREST filter.
		const [friends, blocks, crew] = await Promise.all([
			this.db
				.from("friendships")
				.select("requester_id, receiver_id")
				.eq("status", "accepted")
				.or(`requester_id.eq.${userId},receiver_id.eq.${userId}`),
			this.db.from("user_blocks").select("blocker_id, blocked_id").or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`),
			this.db.from("crew_members").select("crew_id").eq("user_id", userId).limit(1),
		]);
		for (const res of [friends, blocks, crew]) {
			if (res.error) throw new StoreError("loadSocialGraph", res.error.code, res.error.message);
		}
		const friendRows = (friends.data ?? []) as { requester_id: string; receiver_id: string }[];
		const blockRows = (blocks.data ?? []) as { blocker_id: string; blocked_id: string }[];
		const crewId = ((crew.data ?? []) as { crew_id: string }[])[0]?.crew_id ?? null;
		let crewmates: string[] = [];
		if (crewId) {
			const members = await this.db.from("crew_members").select("user_id").eq("crew_id", crewId);
			if (members.error) throw new StoreError("loadSocialGraph", members.error.code, members.error.message);
			crewmates = ((members.data ?? []) as { user_id: string }[]).map((m) => m.user_id).filter((id) => id !== userId);
		}
		return {
			friends: [...new Set(friendRows.map((f) => (f.requester_id === userId ? f.receiver_id : f.requester_id)))],
			blocked: blockRows.filter((b) => b.blocker_id === userId).map((b) => b.blocked_id),
			blockedBy: blockRows.filter((b) => b.blocked_id === userId).map((b) => b.blocker_id),
			crewId,
			crewmates,
		};
	}

	async getPushTokens(userIds: string[]): Promise<Map<string, string>> {
		const ids = [...new Set(userIds.filter(isUuid))];
		const out = new Map<string, string>();
		if (ids.length === 0) return out;
		const { data, error } = await this.db.from("profiles").select("id, expo_push_token").in("id", ids);
		if (error) throw new StoreError("getPushTokens", error.code, error.message);
		for (const row of (data ?? []) as { id: string; expo_push_token: string | null }[]) {
			if (row.expo_push_token) out.set(row.id, row.expo_push_token);
		}
		return out;
	}

	async getSettings(): Promise<StoredSettings> {
		const [config, settings] = await Promise.all([
			this.db.from("app_config").select("enabled").eq("key", "multiplayer").maybeSingle(),
			this.db.from("app_settings").select("value").eq("key", "multiplayer").maybeSingle(),
		]);
		if (config.error) throw new StoreError("getSettings", config.error.code, config.error.message);
		if (settings.error) throw new StoreError("getSettings", settings.error.code, settings.error.message);
		const value = (settings.data as { value?: unknown } | null)?.value;
		const games: Record<string, boolean> = {};
		if (isRecord(value) && isRecord(value.games)) {
			for (const [id, on] of Object.entries(value.games)) if (typeof on === "boolean") games[id] = on;
		}
		return { multiplayerEnabled: (config.data as { enabled?: unknown } | null)?.enabled === true, games };
	}

	// ── Ratings ──────────────────────────────────────────────────────────────

	async loadRatings(userId: string): Promise<Partial<Record<GameId, RatingRecord>>> {
		if (this.missing.has("play_ratings") || !isUuid(userId)) return this.fallback.loadRatings(userId);
		const { data, error } = await this.db.from("play_ratings").select("game, rating, games").eq("user_id", userId);
		if (this.isMissing("play_ratings", error)) return this.fallback.loadRatings(userId);
		if (error) throw new StoreError("loadRatings", error.code, error.message);
		const out: Partial<Record<GameId, RatingRecord>> = {};
		for (const row of (data ?? []) as { game: string; rating: number; games: number }[]) {
			out[row.game as GameId] = { rating: row.rating, games: row.games };
		}
		return out;
	}

	async saveRatings(rows: RatingRow[]): Promise<void> {
		if (rows.length === 0) return;
		if (this.missing.has("play_ratings")) return this.fallback.saveRatings(rows);
		const { error } = await this.db.from("play_ratings").upsert(
			rows.map((r) => ({ user_id: r.userId, game: r.game, rating: r.rating, games: r.games, updated_at: iso(r.updatedAt) })),
			{ onConflict: "user_id,game" },
		);
		if (this.isMissing("play_ratings", error)) return this.fallback.saveRatings(rows);
		if (error) throw new StoreError("saveRatings", error.code, error.message);
	}

	// ── Invites ──────────────────────────────────────────────────────────────

	async saveInvite(invite: InviteRecord): Promise<void> {
		if (this.missing.has("play_invites")) return this.fallback.saveInvite(invite);
		const { error } = await this.db.from("play_invites").upsert(inviteToRow(invite), { onConflict: "code" });
		if (this.isMissing("play_invites", error)) return this.fallback.saveInvite(invite);
		if (error) throw new StoreError("saveInvite", error.code, error.message);
	}

	async loadInvite(code: string): Promise<InviteRecord | null> {
		if (this.missing.has("play_invites")) return this.fallback.loadInvite(code);
		const { data, error } = await this.db.from("play_invites").select("*").eq("code", code).maybeSingle();
		if (this.isMissing("play_invites", error)) return this.fallback.loadInvite(code);
		if (error) throw new StoreError("loadInvite", error.code, error.message);
		return data ? inviteFromRow(data as InviteRow) : null;
	}

	async listOpenInvites(now: number): Promise<InviteRecord[]> {
		if (this.missing.has("play_invites")) return this.fallback.listOpenInvites(now);
		const { data, error } = await this.db
			.from("play_invites")
			.select("*")
			.in("status", ["open", "full", "accepted"])
			.gt("expires_at", iso(now));
		if (this.isMissing("play_invites", error)) return this.fallback.listOpenInvites(now);
		if (error) throw new StoreError("listOpenInvites", error.code, error.message);
		return ((data ?? []) as InviteRow[]).map(inviteFromRow);
	}

	// ── Matches ──────────────────────────────────────────────────────────────

	async saveMatch(state: RoomState): Promise<void> {
		if (this.missing.has("play_matches")) return this.fallback.saveMatch(state);
		const { error } = await this.db.from("play_matches").upsert(matchToRow(state), { onConflict: "id" });
		if (this.isMissing("play_matches", error)) return this.fallback.saveMatch(state);
		if (error) throw new StoreError("saveMatch", error.code, error.message);
	}

	async loadMatch(roomId: string): Promise<RoomState | null> {
		if (this.missing.has("play_matches") || !isUuid(roomId)) return this.fallback.loadMatch(roomId);
		const { data, error } = await this.db.from("play_matches").select("state").eq("id", roomId).maybeSingle();
		if (this.isMissing("play_matches", error)) return this.fallback.loadMatch(roomId);
		if (error) throw new StoreError("loadMatch", error.code, error.message);
		return ((data as { state?: RoomState } | null)?.state ?? null) as RoomState | null;
	}

	async listOpenMatches(): Promise<RoomState[]> {
		if (this.missing.has("play_matches")) return this.fallback.listOpenMatches();
		const out: RoomState[] = [];
		const page = 1_000;
		for (let from = 0; ; from += page) {
			const { data, error } = await this.db
				.from("play_matches")
				.select("state")
				.neq("phase", "ended")
				.order("updated_at", { ascending: true })
				.range(from, from + page - 1);
			if (this.isMissing("play_matches", error)) return this.fallback.listOpenMatches();
			if (error) throw new StoreError("listOpenMatches", error.code, error.message);
			const rows = (data ?? []) as { state: RoomState }[];
			out.push(...rows.map((r) => r.state));
			if (rows.length < page) break;
		}
		return out;
	}

	async listMatchesForUser(userId: string): Promise<RoomState[]> {
		if (this.missing.has("play_matches") || !isUuid(userId)) return this.fallback.listMatchesForUser(userId);
		const { data, error } = await this.db
			.from("play_matches")
			.select("state")
			.contains("seat_users", [userId])
			.neq("phase", "ended")
			.order("updated_at", { ascending: false })
			.limit(50);
		if (this.isMissing("play_matches", error)) return this.fallback.listMatchesForUser(userId);
		if (error) throw new StoreError("listMatchesForUser", error.code, error.message);
		return ((data ?? []) as { state: RoomState }[]).map((r) => r.state);
	}

	// ── Results ──────────────────────────────────────────────────────────────

	async recordResult(rows: ResultRow[]): Promise<void> {
		if (rows.length === 0) return;
		if (this.missing.has("play_results")) return this.fallback.recordResult(rows);
		const { error } = await this.db
			.from("play_results")
			.upsert(rows.map(resultToRow), { onConflict: "match_id,user_id", ignoreDuplicates: true });
		if (this.isMissing("play_results", error)) return this.fallback.recordResult(rows);
		if (error) throw new StoreError("recordResult", error.code, error.message);
	}

	// ── Internals ────────────────────────────────────────────────────────────

	/** True (and logged once) when `error` says the table does not exist. */
	private isMissing(table: PlayTable, error: PgError | null): boolean {
		if (!error || (error.code !== "42P01" && error.code !== "PGRST205")) return false;
		if (!this.missing.has(table)) {
			this.missing.add(table);
			this.log.warn("play table missing in Supabase; holding it in memory until the migration is pushed", {
				table,
				code: error.code,
			});
		}
		return true;
	}
}

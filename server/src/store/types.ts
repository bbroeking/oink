// What the play server keeps and reads, independent of where. MemoryStore
// backs tests, the e2e harness and local dev; SupabaseStore backs production
// (supabase/migrations/20261004230000_matchmade_play.sql for the play_*
// tables, the existing profiles / friendships / user_blocks / crew_members /
// app_config / app_settings for everything else).

import type { GameId, Pace } from "../../../multiplayer/types";
import type { InviteKind, InviteStatus, PigLook, RoomResult } from "../../../multiplayer/protocol";
import type { RoomState } from "../../../multiplayer/engine";

export interface PlayerRecord {
	userId: string;
	username: string | null;
	look: PigLook;
	isTest: boolean;
	featureOverrides: Record<string, unknown>;
	hideFromLeaderboard: boolean;
}

export interface SocialGraph {
	/** Accepted friendships, either direction. */
	friends: string[];
	/** Pigs this player blocked. */
	blocked: string[];
	/** Pigs who blocked this player. */
	blockedBy: string[];
	/** The player's Sounder, if any, and its other members. */
	crewId: string | null;
	crewmates: string[];
}

export const EMPTY_SOCIAL: SocialGraph = { friends: [], blocked: [], blockedBy: [], crewId: null, crewmates: [] };

export interface RatingRecord {
	rating: number;
	games: number;
}

export interface RatingRow extends RatingRecord {
	userId: string;
	game: GameId;
	updatedAt: number;
}

/** The two dark-launch switches: app_config.multiplayer.enabled and the
 *  per-game map in app_settings.multiplayer.value.games (absent = on). */
export interface StoredSettings {
	multiplayerEnabled: boolean;
	games: Record<string, boolean>;
}

export interface InviteRecord {
	code: string;
	game: GameId;
	pace: Pace;
	kind: InviteKind;
	fromUser: string;
	toUsers: string[];
	crewId: string | null;
	roomId: string | null;
	status: InviteStatus;
	seatsMax: number;
	acceptedBy: string[];
	/** Direct invitees who said no. Held in memory only (play_invites has no
	 *  column for it); a restart forgets a decline at worst. */
	declinedBy: string[];
	createdAt: number;
	updatedAt: number;
	expiresAt: number;
}

export type Outcome = "win" | "draw" | "loss" | "coop_success" | "coop_short" | "shared" | "no_contest";

export interface ResultRow {
	matchId: string;
	userId: string;
	game: GameId;
	seat: number;
	outcome: Outcome;
	score: number | null;
	reason: RoomResult["reason"];
	opponents: string[];
	/** UTC month the table ended in, "YYYY-MM": the wins board's reset line. */
	period: string;
	endedAt: number;
}

export interface Store {
	readonly kind: "memory" | "supabase";
	loadPlayer(userId: string): Promise<PlayerRecord | null>;
	loadSocialGraph(userId: string): Promise<SocialGraph>;
	loadRatings(userId: string): Promise<Partial<Record<GameId, RatingRecord>>>;
	saveRatings(rows: RatingRow[]): Promise<void>;
	/** Expo push tokens for whichever of these pigs have one. */
	getPushTokens(userIds: string[]): Promise<Map<string, string>>;
	getSettings(): Promise<StoredSettings>;
	saveInvite(invite: InviteRecord): Promise<void>;
	loadInvite(code: string): Promise<InviteRecord | null>;
	/** Invites that may still matter: open, or full and unexpired. */
	listOpenInvites(now: number): Promise<InviteRecord[]>;
	/** Upserts the full engine state (seed included: service role only). */
	saveMatch(state: RoomState): Promise<void>;
	loadMatch(roomId: string): Promise<RoomState | null>;
	/** Every table not yet ended. */
	listOpenMatches(): Promise<RoomState[]>;
	/** The tables not yet ended where this pig holds a seat. */
	listMatchesForUser(userId: string): Promise<RoomState[]>;
	/** Idempotent on (match, user): a second write of the same row is a no-op. */
	recordResult(rows: ResultRow[]): Promise<void>;
	close?(): Promise<void>;
}

/** UTC "YYYY-MM" for an epoch ms. */
export function periodOf(at: number): string {
	return new Date(at).toISOString().slice(0, 7);
}

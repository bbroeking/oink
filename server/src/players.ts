// The pigs the server knows right now: the card others see at a table, the
// dark-launch gate, the social graph (friends, Sounder, blocks both ways)
// and the hidden ratings. Loaded on auth; the social graph is re-read before
// any invite check, because a block made a minute ago must hold.

import type { GameId } from "../../multiplayer/types";
import type { PlayerCard } from "../../multiplayer/protocol";
import type { AccessMode } from "./config";
import { NAMELESS_PIG } from "./copy";
import type { Clock } from "./clock";
import type { Logger } from "./log";
import { RATING_START } from "./rating";
import type { Settings } from "./settings";
import { DEFAULT_LOOK } from "./store/memory";
import { EMPTY_SOCIAL, type RatingRecord, type RatingRow, type SocialGraph, type Store } from "./store/types";

export interface Player {
	userId: string;
	card: PlayerCard;
	isTest: boolean;
	featureOverrides: Record<string, unknown>;
	social: SocialGraph;
	ratings: Partial<Record<GameId, RatingRecord>>;
	loadedAt: number;
}

const CACHE_LIMIT = 20_000;

export class PlayerDirectory {
	private readonly players = new Map<string, Player>();

	constructor(
		private readonly deps: { store: Store; settings: Settings; clock: Clock; log: Logger; access: AccessMode },
	) {}

	/** Loads (or reloads) a pig on sign-in. A pig the store has never seen
	 *  still gets a card: the dev token's name, else "a pig". */
	async load(userId: string, hint: { name?: string } = {}): Promise<Player> {
		const [record, social, ratings] = await Promise.all([
			this.deps.store.loadPlayer(userId),
			this.deps.store.loadSocialGraph(userId),
			this.deps.store.loadRatings(userId).catch((err: unknown) => {
				this.deps.log.warn("ratings unavailable; pairing without them", { userId, err });
				return {};
			}),
		]);
		const player: Player = {
			userId,
			card: {
				userId,
				name: record?.username?.trim() || hint.name || NAMELESS_PIG,
				look: record?.look ?? { ...DEFAULT_LOOK },
			},
			isTest: record?.isTest ?? false,
			featureOverrides: record?.featureOverrides ?? {},
			social,
			ratings,
			loadedAt: this.deps.clock.now(),
		};
		this.remember(player);
		return player;
	}

	get(userId: string): Player | undefined {
		return this.players.get(userId);
	}

	/** The dark-launch gate: a per-pig override wins over the global flag. */
	isAllowed(player: Player): boolean {
		if (this.deps.access === "all") return true;
		const override = player.featureOverrides.multiplayer;
		return typeof override === "boolean" ? override : this.deps.settings.multiplayerEnabled;
	}

	async refreshSocial(userId: string): Promise<SocialGraph> {
		const social = await this.deps.store.loadSocialGraph(userId);
		const player = this.players.get(userId);
		if (player) player.social = social;
		return social;
	}

	social(userId: string): SocialGraph {
		return this.players.get(userId)?.social ?? EMPTY_SOCIAL;
	}

	/** True when either pig has blocked the other, by whichever graphs are
	 *  loaded (each graph carries both directions, so one is enough). */
	blockedEither(a: string, b: string): boolean {
		const ga = this.players.get(a)?.social;
		const gb = this.players.get(b)?.social;
		return (
			!!ga?.blocked.includes(b) ||
			!!ga?.blockedBy.includes(b) ||
			!!gb?.blocked.includes(a) ||
			!!gb?.blockedBy.includes(a)
		);
	}

	/** A card for any pig, loading it if needed (an inviter after a restart). */
	async card(userId: string): Promise<PlayerCard> {
		const cached = this.players.get(userId);
		if (cached) return cached.card;
		try {
			const record = await this.deps.store.loadPlayer(userId);
			return { userId, name: record?.username?.trim() || NAMELESS_PIG, look: record?.look ?? { ...DEFAULT_LOOK } };
		} catch (err) {
			this.deps.log.warn("card lookup failed", { userId, err });
			return { userId, name: NAMELESS_PIG, look: { ...DEFAULT_LOOK } };
		}
	}

	rating(userId: string, game: GameId): number {
		return this.players.get(userId)?.ratings[game]?.rating ?? RATING_START;
	}

	/** A pig's rating record for a game, read from the store when the pig is
	 *  not loaded (the other seat of a play-by-push table is usually away). */
	async ratingRecord(userId: string, game: GameId): Promise<RatingRecord> {
		const cached = this.players.get(userId)?.ratings[game];
		if (cached) return cached;
		try {
			const all = await this.deps.store.loadRatings(userId);
			return all[game] ?? { rating: RATING_START, games: 0 };
		} catch {
			return { rating: RATING_START, games: 0 };
		}
	}

	applyRatings(rows: RatingRow[]): void {
		for (const row of rows) {
			const player = this.players.get(row.userId);
			if (player) player.ratings[row.game] = { rating: row.rating, games: row.games };
		}
	}

	private remember(player: Player): void {
		this.players.delete(player.userId);
		this.players.set(player.userId, player);
		if (this.players.size > CACHE_LIMIT) {
			const oldest = this.players.keys().next().value;
			if (oldest !== undefined) this.players.delete(oldest);
		}
	}
}

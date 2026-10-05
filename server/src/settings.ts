// The live switches, polled: app_config.multiplayer (the global gate, which
// players.ts combines with each pig's feature_overrides) and
// app_settings.multiplayer.value.games (per-game on/off, absent = on). A
// failed poll keeps the last good values: a database blip must not switch
// games off mid-evening.
//
// The catalog lists every game the server runs, switched-off ones included
// (enabled: false), so a resumed table of a paused game still renders. A
// placeholder game (rulesVersion 0, multiplayer/games/stub.ts) is off in
// production unless app_settings turns it on by name: nothing ships a stub.

import type { AnyGame, GameId } from "../../multiplayer/types";
import type { CatalogEntry } from "../../multiplayer/protocol";
import type { Clock, Timer } from "./clock";
import type { Logger } from "./log";
import type { Store, StoredSettings } from "./store/types";

export class Settings {
	private current: StoredSettings = { multiplayerEnabled: false, games: {} };
	private timer: Timer | null = null;
	private readonly listeners: (() => void)[] = [];

	constructor(
		private readonly deps: {
			store: Store;
			games: ReadonlyMap<GameId, AnyGame>;
			clock: Clock;
			log: Logger;
			production: boolean;
			pollMs?: number;
		},
	) {}

	async start(): Promise<void> {
		await this.refresh();
		this.schedule();
	}

	stop(): void {
		this.timer?.cancel();
		this.timer = null;
	}

	onChange(fn: () => void): void {
		this.listeners.push(fn);
	}

	async refresh(): Promise<void> {
		try {
			const next = await this.deps.store.getSettings();
			const changed = JSON.stringify(next) !== JSON.stringify(this.current);
			this.current = next;
			if (changed) for (const fn of this.listeners) fn();
		} catch (err) {
			this.deps.log.warn("settings poll failed; keeping the last values", { err });
		}
	}

	get multiplayerEnabled(): boolean {
		return this.current.multiplayerEnabled;
	}

	isGameEnabled(id: GameId): boolean {
		const game = this.deps.games.get(id);
		if (!game) return false;
		const override = this.current.games[id];
		if (typeof override === "boolean") return override;
		return game.rulesVersion > 0 || !this.deps.production;
	}

	enabledGameIds(): GameId[] {
		return [...this.deps.games.keys()].filter((id) => this.isGameEnabled(id));
	}

	catalog(): CatalogEntry[] {
		return [...this.deps.games.values()].map((g) => ({
			id: g.id,
			title: g.title,
			tagline: g.tagline,
			kind: g.kind,
			seats: { ...g.seats },
			paces: [...g.paces],
			rulesVersion: g.rulesVersion,
			enabled: this.isGameEnabled(g.id),
		}));
	}

	private schedule(): void {
		this.timer = this.deps.clock.after(this.deps.pollMs ?? 60_000, () => {
			void this.refresh().finally(() => {
				if (this.timer) this.schedule();
			});
		});
	}
}

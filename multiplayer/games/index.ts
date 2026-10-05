// The game registry: every matchmade game the server runs and the app can
// draw. Adding a game = one rules module under ./<id>/rules.ts, one line here,
// one board under components/play/games/<id>/ (registered in
// components/play/gameUi.ts), and its art in components/play/playArt.ts.
// The server's welcome catalog is built from this list (minus anything
// switched off in app_settings.multiplayer.games).

import type { AnyGame, GameId } from "../types";
import { rootle } from "./rootle/rules";
import { fence_the_pen } from "./fence_the_pen/rules";
import { mud_volley } from "./mud_volley/rules";
import { snout_says } from "./snout_says/rules";
import { out_looking } from "./out_looking/rules";

export const GAMES: Record<GameId, AnyGame> = {
	rootle,
	fence_the_pen,
	mud_volley,
	snout_says,
	out_looking,
};

export const GAME_IDS: GameId[] = Object.keys(GAMES) as GameId[];

export function getGame(id: string): AnyGame | null {
	return Object.hasOwn(GAMES, id) ? GAMES[id as GameId] : null;
}

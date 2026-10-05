// GameId → the game's board and how-to. The match screen, Practice and the
// Play hub look games up here; the rules live in multiplayer/games/.

import type { GameId } from "@/multiplayer/types";
import type { GameUI } from "./types";
import { rootleUi } from "./games/rootle";
import { fenceThePenUi } from "./games/fence_the_pen";
import { mudVolleyUi } from "./games/mud_volley";
import { snoutSaysUi } from "./games/snout_says";
import { outLookingUi } from "./games/out_looking";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GAME_UI: Record<GameId, GameUI<any>> = {
	rootle: rootleUi,
	fence_the_pen: fenceThePenUi,
	mud_volley: mudVolleyUi,
	snout_says: snoutSaysUi,
	out_looking: outLookingUi,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function gameUi(id: GameId): GameUI<any> {
	return GAME_UI[id];
}

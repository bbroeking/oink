// The seat line is the result sheet's score line too (ResultSheet reads
// GameUI.seatStatus). A departure ends a room mid-turn, before the game's own
// view says it is over, so every game must read the room's phase: an ended
// table shows the final tally or nothing, never a live "rolling…" under the
// pig who took it (seen on the simulator, 2026-10-04).

import { beginCountdown, createRoom, markGone, snapshotFor, startGame } from "../../multiplayer/engine";
import { GAMES } from "../../multiplayer/games";
import type { AnyGame, GameId } from "../../multiplayer/types";
import { testCards } from "../../multiplayer/testkit";
import { gameUi } from "../../components/play/gameUi";

// jest hoists these above the imports. The ui barrel reaches utils/log
// (Sentry starts an interval) and the boards reach haptics and supabase.
jest.mock("../../utils/log", () => ({ log: { error: jest.fn(), info: jest.fn(), warn: jest.fn() } }));
jest.mock("../../utils/supabase", () => ({ supabase: {} }));
jest.mock("expo-haptics", () => ({
	impactAsync: jest.fn(async () => {}),
	notificationAsync: jest.fn(async () => {}),
	selectionAsync: jest.fn(async () => {}),
	ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
	NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

const NOW = 1_800_000_000_000;
// Words a seat line only says while the table is live.
const LIVE = /…|rolling|last turn|thinking|guess|locked in|sealed/i;

function startedTable(game: AnyGame) {
	const seats = game.seats.min;
	const room = createRoom({
		roomId: `00000000-${game.id}`,
		game,
		pace: "live",
		source: "queue",
		seatCount: seats,
		seats: testCards(seats),
		seed: "ended-seat-status",
		now: NOW,
	});
	return startGame(beginCountdown(room, game, NOW), game, NOW + 3_000);
}

describe("seat lines on a table a departure ended", () => {
	const ids = Object.keys(GAMES) as GameId[];

	it("covers all five games", () => {
		expect(ids.sort()).toEqual(["fence_the_pen", "mud_volley", "out_looking", "rootle", "snout_says"]);
	});

	it.each(ids)("%s: no live line once the room has ended", (id) => {
		const game = GAMES[id] as AnyGame;
		const ui = gameUi(id);
		const playing = startedTable(game);
		expect(playing.phase).toBe("playing");
		// The last seat heads home mid-game; everyone else is still at the table.
		const leaver = playing.seats.length - 1;
		const ended = markGone(playing, game, leaver, NOW + 5_000);
		expect(ended.phase).toBe("ended");
		for (let seat = 0; seat < ended.seats.length; seat++) {
			const snap = snapshotFor(ended, game, seat);
			expect(snap.view).not.toBeNull();
			const line = ui.seatStatus?.(snap.view, seat, snap) ?? null;
			if (line !== null) expect(line).not.toMatch(LIVE);
		}
	});

	it("rootle: the pig whose turn it was reads its tally, not rolling", () => {
		const game = GAMES.rootle as AnyGame;
		const ended = markGone(startedTable(game), game, 1, NOW + 5_000);
		const snap = snapshotFor(ended, game, 0);
		// Seat 0 held the turn when seat 1 left; with nothing banked, nothing.
		expect(gameUi("rootle").seatStatus?.(snap.view, 0, snap)).toBeNull();
		// While the table was live, the same seat said it was rolling.
		const live = snapshotFor(startedTable(game), game, 0);
		expect(gameUi("rootle").seatStatus?.(live.view, 0, live)).toBe("rolling…");
	});
});

// The React glue: the provider follows the flag, Practice runs through
// usePlay().startPractice → useRoom, and useServerClock ticks on a table's
// own clock. (The connection policy itself is pinned in runtime.test.ts.)

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import type { Seat } from "@/multiplayer/types";
import {
	MultiplayerProvider,
	usePlay,
	usePlayCatalog,
	usePlayEnabled,
	useRoom,
	useServerClock,
	type UsePlay,
	type UseRoom,
} from "@/hooks/useMultiplayer";

let mockFlag = { visible: true, loaded: true };
jest.mock("@/hooks/useFeatureFlags", () => ({
	useFeatureFlagState: () => mockFlag,
}));
jest.mock("@/utils/supabase", () => ({
	supabase: {
		auth: {
			getSession: () => Promise.resolve({ data: { session: { user: { id: "user-me" }, access_token: "t" } } }),
			onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
			refreshSession: () => Promise.resolve({ data: { session: null }, error: null }),
		},
		from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { username: "Rosie" } }) }) }) }),
	},
}));
jest.mock("@/utils/rpc", () => ({ rpc: () => Promise.resolve(null) }));
jest.mock("expo-notifications", () => ({ setNotificationCategoryAsync: jest.fn(() => Promise.resolve({})) }));
jest.mock("@/utils/log", () => ({ log: { info: () => {}, warn: () => {}, error: () => {} } }));

// A practice table needs a game the registry knows; swap the registry for a
// toy Nim so this suite does not depend on the real games' state.
type MockNimState = { sticks: number; turn: number; winner: number | null };
jest.mock("@/multiplayer/games", () => {
	const nim = {
		id: "fence_the_pen",
		title: "Nim",
		tagline: "Take the last stick.",
		rulesVersion: 1,
		seats: { min: 2, max: 2 },
		kind: "competitive",
		paces: ["live"],
		decisionMs: { live: 10_000 },
		setup: () => ({ sticks: 5, turn: 0, winner: null }),
		activeSeats: (s: MockNimState) => (s.winner === null ? [s.turn] : []),
		apply: (s: MockNimState, seat: number, a: { n: number }) => {
			const sticks = s.sticks - a.n;
			return { ok: true, state: { sticks, turn: sticks === 0 ? s.turn : 1 - s.turn, winner: sticks === 0 ? seat : null } };
		},
		onTimeout: (s: MockNimState, seat: number) => {
			const sticks = s.sticks - 1;
			return { state: { sticks, turn: sticks === 0 ? seat : 1 - seat, winner: sticks === 0 ? seat : null } };
		},
		view: (s: MockNimState) => s,
		result: (s: MockNimState) => (s.winner === null ? null : { kind: "win", winners: [s.winner], scores: [0, 0], summary: "" }),
		bot: (v: MockNimState, seat: number) => (v.turn === seat && v.winner === null ? { type: "take", n: 1 } : null),
		parseAction: (raw: { type?: string; n?: number }) => (raw && raw.type === "take" && (raw.n === 1 || raw.n === 2) ? raw : null),
	};
	return {
		GAMES: { fence_the_pen: nim },
		GAME_IDS: ["fence_the_pen"],
		getGame: (id: string) => (id === "fence_the_pen" ? nim : null),
	};
});

type Captured = { play?: UsePlay; room?: UseRoom; enabled?: boolean; now?: number; catalog?: ReturnType<typeof usePlayCatalog> };

function Probe({ roomId, onRender }: { roomId: string | null; onRender: (seen: Captured) => void }) {
	const play = usePlay();
	const enabled = usePlayEnabled();
	const room = useRoom(roomId);
	const now = useServerClock(100, room.source);
	const catalog = usePlayCatalog();
	onRender({ play, enabled, room, now, catalog });
	return null;
}

/** A sink the probe reports every render into. */
function capture(): { captured: Captured; onRender: (seen: Captured) => void } {
	const captured: Captured = {};
	return { captured, onRender: (seen) => Object.assign(captured, seen) };
}

const flush = async () => {
	for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe("useMultiplayer", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		mockFlag = { visible: true, loaded: true };
	});
	afterEach(() => {
		jest.useRealTimers();
	});

	it("reports the flag and lists Practice games from the app's own registry", async () => {
		const { captured, onRender } = capture();
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(
				<MultiplayerProvider>
					<Probe roomId={null} onRender={onRender} />
				</MultiplayerProvider>,
			);
			await flush();
		});
		expect(captured.enabled).toBe(true);
		expect(captured.catalog?.practiceGames.map((g) => g.id)).toEqual(["fence_the_pen"]);
		expect(captured.catalog?.catalog).toEqual([]); // nothing from the server yet
		expect(captured.play?.connection.status).toBe("idle"); // nothing asked for a socket
		act(() => renderer.unmount());

		mockFlag = { visible: false, loaded: true };
		const { captured: off, onRender: onRenderOff } = capture();
		await act(async () => {
			renderer = TestRenderer.create(
				<MultiplayerProvider>
					<Probe roomId={null} onRender={onRenderOff} />
				</MultiplayerProvider>,
			);
			await flush();
		});
		expect(off.enabled).toBe(false);
		await act(async () => {
			const res = await off.play!.startPractice({ gameId: "fence_the_pen" });
			expect(res).toEqual({ ok: false, error: "disabled" });
		});
		act(() => renderer.unmount());
	});

	it("runs a Practice table through startPractice and useRoom", async () => {
		const { captured, onRender } = capture();
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(
				<MultiplayerProvider>
					<Probe roomId={null} onRender={onRender} />
				</MultiplayerProvider>,
			);
			await flush();
		});
		let roomId = "";
		await act(async () => {
			const res = await captured.play!.startPractice({ gameId: "fence_the_pen" });
			if (!res.ok) throw new Error(`practice failed: ${res.error}`);
			roomId = res.roomId;
		});
		expect(roomId.startsWith("practice-")).toBe(true);

		await act(async () => {
			renderer.update(
				<MultiplayerProvider>
					<Probe roomId={roomId} onRender={onRender} />
				</MultiplayerProvider>,
			);
			await flush();
		});
		expect(captured.room?.practice).toBe(true);
		expect(captured.room?.snapshot?.phase).toBe("starting");
		expect(captured.room?.snapshot?.seats[0].name).toBe("Rosie");

		// The countdown, then my move, then the practice pig's.
		await act(async () => {
			jest.advanceTimersByTime(3_000);
		});
		expect(captured.room?.snapshot?.phase).toBe("playing");
		expect(captured.room?.snapshot?.activeSeats).toEqual([0 as Seat]);
		await act(async () => {
			const res = await captured.room!.source!.act({ type: "take", n: 1 });
			expect(res).toEqual({ ok: true });
		});
		expect(captured.room?.snapshot?.activeSeats).toEqual([1]);
		await act(async () => {
			jest.advanceTimersByTime(1_600);
		});
		expect(captured.room?.snapshot?.activeSeats).toEqual([0]);

		// useServerClock ticks on the table's own clock.
		const before = captured.now as number;
		await act(async () => {
			jest.advanceTimersByTime(500);
		});
		expect(captured.now as number).toBeGreaterThan(before);

		await act(async () => {
			await captured.room!.source!.leave();
		});
		// The screen still holding the table keeps its last snapshot.
		expect(captured.room?.snapshot?.phase).toBe("playing");
		act(() => renderer.unmount());
	});
});


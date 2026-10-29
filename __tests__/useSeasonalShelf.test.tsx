import React from "react";
import TestRenderer, { act } from "react-test-renderer";

const mockRpc = jest.fn();
jest.mock("@/utils/rpc", () => ({
	rpc: (...args: unknown[]) => mockRpc(...args),
}));
jest.mock("expo-router/react-navigation", () => ({
	useFocusEffect: (effect: () => void) => require("react").useEffect(effect, [effect]),
}));

import { stallVisible, useSeasonalShelf, type UseSeasonalShelf } from "@/hooks/useSeasonalShelf";
import { DAY_MS } from "@/utils/shelfCountdown";

function Probe({ onCommit }: { onCommit: (v: UseSeasonalShelf) => void }) {
	const value = useSeasonalShelf();
	React.useLayoutEffect(() => {
		onCommit(value);
	});
	return null;
}

async function mount() {
	let latest!: UseSeasonalShelf;
	let renderer!: TestRenderer.ReactTestRenderer;
	await act(async () => {
		renderer = TestRenderer.create(<Probe onCommit={(v) => (latest = v)} />);
	});
	return {
		get value() {
			return latest;
		},
		unmount: () => act(() => renderer.unmount()),
	};
}

const payload = (over: Record<string, unknown> = {}) => {
	const now = Date.now();
	return {
		key: "halloween_2026",
		title: "Spooky Snouts",
		kicker: null,
		opens_at: new Date(now - DAY_MS).toISOString(),
		closes_at: new Date(now + 6 * DAY_MS).toISOString(),
		status: "open",
		backdrop_hat_id: null,
		theme: {},
		now: new Date(now).toISOString(),
		item_count: 3,
		owned_count: 0,
		items: [
			// Shipped art: drawn.
			{ id: "skull_mask", name: "Skull Mask", cost: 450, category: "mask", shelf_lane: "returning", owned: false },
			{ id: "moonbrew_witch_hat", name: "Moonbrew Witch Hat", cost: 1600, category: "hat", shelf_lane: "new", owned: false },
			// No art in this binary: hidden.
			{ id: "not_in_this_binary", name: "Future Hat", cost: 300, category: "hat", shelf_lane: "new", owned: false },
		],
		...over,
	};
};

describe("useSeasonalShelf", () => {
	beforeEach(() => mockRpc.mockReset());

	it("falls back to no stall when the server has none (or no function)", async () => {
		mockRpc.mockResolvedValue(null);
		const h = await mount();
		expect(mockRpc).toHaveBeenCalledWith("seasonal_shelf");
		expect(h.value.loading).toBe(false);
		expect(h.value.shelf).toBeNull();
		expect(h.value.phase).toBeNull();
		expect(h.value.items).toEqual([]);
		expect(stallVisible(h.value.phase)).toBe(false);
		h.unmount();
	});

	it("reads an open stall and hides pieces whose art is missing", async () => {
		mockRpc.mockResolvedValue(payload());
		const h = await mount();
		expect(h.value.shelf?.key).toBe("halloween_2026");
		expect(h.value.phase).toBe("open");
		expect(stallVisible(h.value.phase)).toBe(true);
		expect(h.value.items.map((i) => i.id)).toEqual(["skull_mask", "moonbrew_witch_hat"]);
		h.unmount();
	});

	it("boards a closed stall and drops one past its three days", async () => {
		const now = Date.now();
		mockRpc.mockResolvedValue(
			payload({
				status: "boarded",
				opens_at: new Date(now - 10 * DAY_MS).toISOString(),
				closes_at: new Date(now - DAY_MS).toISOString(),
			}),
		);
		const boarded = await mount();
		expect(boarded.value.phase).toBe("boarded");
		boarded.unmount();

		mockRpc.mockResolvedValue(
			payload({
				opens_at: new Date(now - 20 * DAY_MS).toISOString(),
				closes_at: new Date(now - 4 * DAY_MS).toISOString(),
			}),
		);
		const gone = await mount();
		expect(gone.value.phase).toBe("gone");
		expect(stallVisible(gone.value.phase)).toBe(false);
		gone.unmount();
	});

	it("corrects a fast device clock with the server's now", async () => {
		const realNow = Date.now();
		// The server says it is 2 days earlier than the device thinks.
		mockRpc.mockResolvedValue(payload({ now: new Date(realNow - 2 * DAY_MS).toISOString() }));
		const h = await mount();
		expect(Math.abs(h.value.now - (realNow - 2 * DAY_MS))).toBeLessThan(5_000);
		h.unmount();
	});

	it("marks a bought piece owned without a refetch", async () => {
		mockRpc.mockResolvedValue(payload());
		const h = await mount();
		act(() => h.value.markOwned("moonbrew_witch_hat"));
		expect(h.value.shelf?.items.find((i) => i.id === "moonbrew_witch_hat")?.owned).toBe(true);
		expect(mockRpc).toHaveBeenCalledTimes(1);
		h.unmount();
	});
});

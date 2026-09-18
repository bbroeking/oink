// The Ghost Sheep Trader's yard hook (hooks/useTrader):
//   • a server without the feature → not available, not present, nothing drawn
//   • present follows the server's answer; the read stamps readAt
//   • the arrival callback fires ONCE, only on a not-here → here flip the yard
//     witnesses, never on the first read
//   • the timer re-asks at the next edge (arrival when he is on his way)
//   • a sale moves the visit's count and hands the caller the bag; a not_here
//     refusal re-reads so the row and the sheet agree
//   • the dev summon installs the answered status
import React, { useEffect } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useTrader, type UseTrader } from "@/hooks/useTrader";
import { rpcAction } from "@/utils/rpc";

jest.mock("expo-router/react-navigation", () => ({
	useFocusEffect: (effect: () => void | (() => void)) =>
		// eslint-disable-next-line @typescript-eslint/no-require-imports -- a mock factory loads React after Jest hoisting
		require("react").useEffect(effect, [effect]),
}));
jest.mock("@/utils/rpc", () => ({ rpc: jest.fn(async () => null), rpcAction: jest.fn() }));

const NOW = "2026-05-01T12:00:00.000Z";
const VISIT = {
	id: 7,
	day: "2026-05-01",
	arrives_at: "2026-05-01T12:30:00.000Z",
	leaves_at: "2026-05-01T18:30:00.000Z",
	want_find_id: null,
	sold: 0,
	tickles: 0,
	finds_left: 6,
};
const AWAY = { ok: true, present: false, now: NOW, visit: VISIT, prices: { common: 3, uncommon: 8, rare: 20 }, want_multiplier: 2, finds_per_visit: 6, met: false, sales: 0 };
const HERE = { ...AWAY, present: true, now: "2026-05-01T12:31:00.000Z", visit: { ...VISIT, want_find_id: "blue_feather" } };

function Harness({ onArrive, out }: { onArrive?: () => void; out: { current: UseTrader | null } }) {
	const t = useTrader({ onArrive });
	useEffect(() => {
		out.current = t;
	});
	return null;
}

describe("useTrader", () => {
	const rpc = jest.mocked(rpcAction);
	let tree: TestRenderer.ReactTestRenderer;
	const out: { current: UseTrader | null } = { current: null };

	beforeEach(() => {
		jest.clearAllMocks();
		jest.useFakeTimers();
		jest.setSystemTime(Date.parse(NOW));
	});
	afterEach(() => {
		act(() => tree?.unmount());
		jest.useRealTimers();
	});

	const mount = async (onArrive?: () => void) => {
		await act(async () => {
			tree = TestRenderer.create(<Harness onArrive={onArrive} out={out} />);
		});
	};

	it("draws nothing on a server without the feature", async () => {
		rpc.mockResolvedValue({ ok: false, reason: "network" } as never);
		await mount();
		expect(out.current?.available).toBe(false);
		expect(out.current?.present).toBe(false);
	});

	it("is present when the server says so, and stamps the read", async () => {
		rpc.mockResolvedValue(HERE as never);
		await mount();
		expect(rpc).toHaveBeenCalledWith("trader_status", undefined);
		expect(out.current?.available).toBe(true);
		expect(out.current?.present).toBe(true);
		expect(out.current?.readAt).toBe(Date.parse(NOW));
		expect(out.current?.status.visit?.wantFindId).toBe("blue_feather");
	});

	it("fires the arrival once, on the flip the yard witnesses — never on the first read", async () => {
		const onArrive = jest.fn();
		rpc.mockResolvedValueOnce(AWAY as never);
		await mount(onArrive);
		expect(out.current?.present).toBe(false);
		expect(onArrive).not.toHaveBeenCalled();

		// The timer aims at his arrival (30 min + 1 s past the server's clock).
		rpc.mockResolvedValue(HERE as never);
		await act(async () => {
			jest.advanceTimersByTime(30 * 60_000 + 1000);
		});
		expect(rpc).toHaveBeenCalledTimes(2);
		expect(out.current?.present).toBe(true);
		expect(onArrive).toHaveBeenCalledTimes(1);

		// Still here on the next read: no second arrival.
		await act(async () => {
			await out.current?.refresh();
		});
		expect(onArrive).toHaveBeenCalledTimes(1);
	});

	it("a first read that finds him here is not an arrival", async () => {
		const onArrive = jest.fn();
		rpc.mockResolvedValue(HERE as never);
		await mount(onArrive);
		expect(out.current?.present).toBe(true);
		expect(onArrive).not.toHaveBeenCalled();
	});

	it("a sale moves the visit's count and hands back the bag", async () => {
		rpc.mockImplementation(async (name) => {
			if (name === "trader_status") return HERE as never;
			if (name === "trade_with_trader")
				return {
					ok: true,
					replay: false,
					find_id: "river_pebble",
					tickles: 3,
					was_want: false,
					before: 100,
					after: 103,
					finds_left: 5,
					visit_tickles: 3,
					bag: [{ id: 2, find_id: "blue_feather", source: "dig" }],
				} as never;
			return { ok: false, reason: "unknown" } as never;
		});
		await mount();
		let r: Awaited<ReturnType<UseTrader["sell"]>> | undefined;
		await act(async () => {
			r = await out.current?.sell(1);
		});
		expect(r?.ok).toBe(true);
		expect(rpc).toHaveBeenCalledWith(
			"trade_with_trader",
			expect.objectContaining({ p_item_id: 1, p_nonce: expect.stringMatching(/^[0-9a-f-]{36}$/) }),
		);
		if (r?.ok) expect(r.bag).toEqual([{ id: 2, find_id: "blue_feather", source: "dig" }]);
		expect(out.current?.status.visit?.findsLeft).toBe(5);
		expect(out.current?.status.visit?.sold).toBe(1);
		expect(out.current?.status.met).toBe(true);
	});

	it("a not_here refusal re-reads so the row and the sheet agree", async () => {
		rpc.mockImplementation(async (name) => {
			if (name === "trader_status") return AWAY as never;
			return { ok: false, reason: "not_here", arrives_at: VISIT.arrives_at } as never;
		});
		await mount();
		// (mounted with AWAY; pretend a stale sheet tried anyway)
		let r: Awaited<ReturnType<UseTrader["sell"]>> | undefined;
		await act(async () => {
			r = await out.current?.sell(1);
		});
		expect(r?.ok).toBe(false);
		if (r && !r.ok) expect(r.arrivesAt).toBe(VISIT.arrives_at);
		expect(rpc.mock.calls.filter(([n]) => n === "trader_status")).toHaveLength(2);
	});

	it("the dev summon installs the answered status", async () => {
		rpc.mockImplementation(async (name) => {
			if (name === "trader_status") return AWAY as never;
			if (name === "dev_summon_trader") return HERE as never;
			return { ok: false, reason: "unknown" } as never;
		});
		await mount();
		expect(out.current?.present).toBe(false);
		let ok: boolean | undefined;
		await act(async () => {
			ok = await out.current?.summon();
		});
		expect(ok).toBe(true);
		expect(out.current?.present).toBe(true);
	});

	it("the dev summon reports a refusal", async () => {
		rpc.mockImplementation(async (name) => {
			if (name === "trader_status") return AWAY as never;
			return { ok: false, reason: "network" } as never;
		});
		await mount();
		let ok: boolean | undefined;
		await act(async () => {
			ok = await out.current?.summon();
		});
		expect(ok).toBe(false);
		expect(out.current?.present).toBe(false);
	});
});

import React from "react";
import TestRenderer, { act } from "react-test-renderer";

const mockRpc = jest.fn();
jest.mock("@/utils/rpc", () => ({
	rpc: (...args: unknown[]) => mockRpc(...args),
}));
jest.mock("@/utils/supabase", () => ({
	supabase: {
		auth: { getUser: jest.fn() },
		from: jest.fn(),
	},
}));
jest.mock("@/utils/log", () => ({
	log: { error: jest.fn() },
}));

import { useHomeStats, type UseHomeStats } from "../hooks/useHomeStats";

function Probe({
	valueRef,
}: {
	valueRef: React.MutableRefObject<UseHomeStats | null>;
}) {
	const value = useHomeStats();
	React.useEffect(() => {
		valueRef.current = value;
	}, [value, valueRef]);
	return null;
}

const HOME_STATS_RESPONSE = {
	ok: true,
	counter: 100,
	tickles_earned: 120,
	balance: 10,
	cap: 25,
	next_regen_seconds: 900,
	regen_seconds: 3600,
	happiness: 50,
	active_hat_id: null,
	active_hat: null,
	active_glasses_id: null,
	active_glasses: null,
	active_mask_id: null,
	active_mask: null,
	active_neck_id: null,
	active_neck: null,
	active_aura_id: null,
	active_aura: null,
	active_background_id: null,
	active_background: null,
	active_held_id: null,
	active_held: null,
	active_tickle_particle_id: null,
	active_tickle_particle: null,
	current_tier: 1,
	total_tiers: 30,
};

describe("home-stats reconciliation performance", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		mockRpc.mockReset().mockResolvedValue(HOME_STATS_RESPONSE);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	test("twenty rapid reconciliation requests produce one home_stats read", async () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		const valueRef = { current: null } as React.MutableRefObject<UseHomeStats | null>;
		await act(async () => {
			renderer = TestRenderer.create(<Probe valueRef={valueRef} />);
		});

		act(() => {
			for (let i = 0; i < 20; i += 1) valueRef.current!.scheduleRefresh();
		});
		expect(mockRpc).not.toHaveBeenCalled();

		await act(async () => {
			jest.advanceTimersByTime(500);
			await Promise.resolve();
		});
		expect(mockRpc).toHaveBeenCalledTimes(1);
		expect(mockRpc).toHaveBeenCalledWith("home_stats");
		act(() => renderer.unmount());
	});
});

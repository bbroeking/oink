// rpc<T>() wraps supabase.rpc with cast + error logging. The cast
// happens silently (TS only) so tests just verify behavior of the
// three branches: success, null-data, and error.

const mockRpc = jest.fn();
const mockError = jest.fn();
const mockWarn = jest.fn();
jest.mock("../utils/supabase", () => ({
	supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
jest.mock("../utils/log", () => ({
	log: {
		error: (...args: unknown[]) => mockError(...args),
		warn: (...args: unknown[]) => mockWarn(...args),
	},
}));

import { rpc, rpcAction, rpcOutcome } from "../utils/rpc";

describe("rpc", () => {
	beforeEach(() => {
		mockRpc.mockReset();
		mockError.mockReset();
		mockWarn.mockReset();
	});

	test("returns cast data on success", async () => {
		mockRpc.mockResolvedValue({ data: { ok: true, cleared: 2 }, error: null });
		const r = await rpc<{ ok: boolean; cleared: number }>("foo");
		expect(r).toEqual({ ok: true, cleared: 2 });
		expect(mockError).not.toHaveBeenCalled();
	});

	test("returns null when data is null", async () => {
		mockRpc.mockResolvedValue({ data: null, error: null });
		expect(await rpc<{ x: number }>("foo")).toBeNull();
		expect(mockError).not.toHaveBeenCalled();
	});

	test("returns null AND logs on error", async () => {
		mockRpc.mockResolvedValue({
			data: null,
			error: { message: "permission denied" },
		});
		expect(await rpc<{ x: number }>("foo")).toBeNull();
		expect(mockError).toHaveBeenCalledWith("[rpc:foo]", "permission denied");
		expect(mockWarn).not.toHaveBeenCalled();
	});

	test("transient network failure warns (not errors) and returns null", async () => {
		mockRpc.mockResolvedValue({
			data: null,
			error: { message: "Network request failed" },
		});
		expect(await rpc<{ x: number }>("bounty_ready_count")).toBeNull();
		expect(mockWarn).toHaveBeenCalledWith(
			"[rpc:bounty_ready_count]",
			"Network request failed",
			"(transient network)"
		);
		expect(mockError).not.toHaveBeenCalled();
	});

	test("fetch TypeError warns (not errors)", async () => {
		mockRpc.mockResolvedValue({
			data: null,
			error: { name: "TypeError", message: "Failed to fetch" },
		});
		expect(await rpc("foo")).toBeNull();
		expect(mockWarn).toHaveBeenCalled();
		expect(mockError).not.toHaveBeenCalled();
	});

	test("passes params through to supabase.rpc", async () => {
		mockRpc.mockResolvedValue({ data: null, error: null });
		await rpc("send_blessing", { p_target: "abc" });
		expect(mockRpc).toHaveBeenCalledWith("send_blessing", { p_target: "abc" });
	});

	test("omits params when not provided", async () => {
		mockRpc.mockResolvedValue({ data: null, error: null });
		await rpc("my_active_effects");
		expect(mockRpc).toHaveBeenCalledWith("my_active_effects", undefined);
	});
});

describe("rpcOutcome — typed failures", () => {
	beforeEach(() => {
		mockRpc.mockReset();
		mockError.mockReset();
		mockWarn.mockReset();
	});

	test("returns data without collapsing a successful null", async () => {
		mockRpc.mockResolvedValue({ data: null, error: null });
		expect(await rpcOutcome("foo")).toEqual({ ok: true, data: null });
	});

	test("classifies PGRST202 as a missing function", async () => {
		const error = { code: "PGRST202", message: "Could not find the function" };
		mockRpc.mockResolvedValue({ data: null, error });
		expect(await rpcOutcome("equip_cosmetic")).toEqual({
			ok: false,
			kind: "missing_function",
			error,
		});
	});

	test("distinguishes network and other RPC failures", async () => {
		const networkError = { name: "TypeError", message: "Failed to fetch" };
		mockRpc.mockResolvedValueOnce({ data: null, error: networkError });
		expect(await rpcOutcome("foo")).toMatchObject({ ok: false, kind: "network" });

		const rpcError = { code: "42501", message: "permission denied" };
		mockRpc.mockResolvedValueOnce({ data: null, error: rpcError });
		expect(await rpcOutcome("foo")).toMatchObject({ ok: false, kind: "rpc_error" });
	});
});

describe("rpcAction — failure-shape normalization", () => {
	beforeEach(() => {
		mockRpc.mockReset();
		mockError.mockReset();
		mockWarn.mockReset();
	});

	test("ok:true passes the payload through", async () => {
		mockRpc.mockResolvedValue({ data: { ok: true, taps_left: 3 }, error: null });
		const r = await rpcAction<{ taps_left: number }>("tickle_at_barn");
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.taps_left).toBe(3);
	});

	test("legacy { ok:false, error } normalizes to reason", async () => {
		mockRpc.mockResolvedValue({ data: { ok: false, error: "cooldown" }, error: null });
		const r = await rpcAction("tickle_at_barn");
		expect(r).toMatchObject({ ok: false, reason: "cooldown" });
	});

	test("{ ok:false, reason } stays reason", async () => {
		mockRpc.mockResolvedValue({ data: { ok: false, reason: "daily_cap" }, error: null });
		const r = await rpcAction("send_blessing");
		expect(r).toMatchObject({ ok: false, reason: "daily_cap" });
	});

	test("failure payload (e.g. next_at) is preserved alongside reason", async () => {
		mockRpc.mockResolvedValue({
			data: { ok: false, error: "cooldown", next_at: "2026-06-07T12:00:00Z" },
			error: null,
		});
		const r = await rpcAction<{ next_at: string }>("tickle_at_barn");
		expect(r).toMatchObject({ ok: false, reason: "cooldown", next_at: "2026-06-07T12:00:00Z" });
	});

	test("transport error → reason 'network' + logs", async () => {
		mockRpc.mockResolvedValue({ data: null, error: { message: "boom" } });
		const r = await rpcAction("send_blessing");
		expect(r).toEqual({ ok: false, reason: "network" });
		expect(mockError).toHaveBeenCalledWith("[rpc:send_blessing]", "boom");
		expect(mockWarn).not.toHaveBeenCalled();
	});

	test("transient network failure → reason 'network' but warns (no red box)", async () => {
		mockRpc.mockResolvedValue({
			data: null,
			error: { message: "Network request failed" },
		});
		const r = await rpcAction("bounty_ready_count");
		expect(r).toEqual({ ok: false, reason: "network" });
		expect(mockWarn).toHaveBeenCalled();
		expect(mockError).not.toHaveBeenCalled();
	});

	test("null data → reason 'no_data'", async () => {
		mockRpc.mockResolvedValue({ data: null, error: null });
		expect(await rpcAction("send_blessing")).toEqual({ ok: false, reason: "no_data" });
	});
});

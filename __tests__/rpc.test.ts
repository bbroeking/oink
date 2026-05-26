// rpc<T>() wraps supabase.rpc with cast + error logging. The cast
// happens silently (TS only) so tests just verify behavior of the
// three branches: success, null-data, and error.

const mockRpc = jest.fn();
const mockError = jest.fn();
jest.mock("../utils/supabase", () => ({
	supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
jest.mock("../utils/log", () => ({
	log: { error: (...args: unknown[]) => mockError(...args) },
}));

import { rpc } from "../utils/rpc";

describe("rpc", () => {
	beforeEach(() => {
		mockRpc.mockReset();
		mockError.mockReset();
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

// The Den feedback wrapper — confirms submitFeedback calls the right RPC
// with the right param shape and collapses the rpcAction envelope. Same
// testing style as friendships.test.ts: mock supabase at the boundary,
// exercise the pure module.

const mockRpc = jest.fn();
jest.mock("../utils/supabase", () => ({
	supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
jest.mock("../utils/log", () => ({
	log: { error: jest.fn(), warn: jest.fn() },
}));

import { submitFeedback } from "../utils/feedback";

describe("submitFeedback", () => {
	beforeEach(() => mockRpc.mockReset());

	test("calls submit_feedback with p_kind + p_body", async () => {
		mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
		await submitFeedback("idea", "a bigger mud pit");
		expect(mockRpc).toHaveBeenCalledWith("submit_feedback", {
			p_kind: "idea",
			p_body: "a bigger mud pit",
		});
	});

	test("passes the chosen kind through verbatim", async () => {
		mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
		await submitFeedback("bug", "the barn ate my tap");
		expect(mockRpc.mock.calls[0][1]).toEqual({
			p_kind: "bug",
			p_body: "the barn ate my tap",
		});
	});

	test("returns ok:true on success", async () => {
		mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
		const r = await submitFeedback("love", "love this game");
		expect(r.ok).toBe(true);
	});

	test("surfaces the 'resting' refusal reason", async () => {
		mockRpc.mockResolvedValue({
			data: { ok: false, reason: "resting" },
			error: null,
		});
		const r = await submitFeedback("idea", "one too many");
		expect(r).toEqual({ ok: false, reason: "resting" });
	});

	test("collapses a null (feature-dark / unpushed migration) to a refusal", async () => {
		// rpc returns null on a missing function → rpcAction → no_data refusal.
		mockRpc.mockResolvedValue({ data: null, error: null });
		const r = await submitFeedback("idea", "whisper into the dark");
		expect(r.ok).toBe(false);
	});
});

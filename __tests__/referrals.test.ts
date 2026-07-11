// Referrals module — covers the error→copy mapping, the code-format
// regex, the URL parser, the clipboard parser, the share message
// builder, and confirms each typed wrapper calls the right RPC with
// the right param shape. Same testing style as friendships.test.ts.

const mockRpc = jest.fn();
jest.mock("../utils/supabase", () => ({
	supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
jest.mock("../utils/log", () => ({
	log: { error: jest.fn() },
}));

import {
	REFERRAL_CODE_PATTERN,
	REFERRAL_URL_HOST,
	PENDING_REFERRAL_CODE_KEY,
	referralErrorMessage,
	parseReferralCodeFromUrl,
	parseReferralCodeFromClipboard,
	shareMessageForCode,
	redeemReferralCode,
	myReferralSummary,
} from "../utils/referrals";

describe("REFERRAL_CODE_PATTERN", () => {
	test("matches a well-formed code", () => {
		expect(REFERRAL_CODE_PATTERN.test("ROSIE-K3T9")).toBe(true);
	});

	test("matches an X-padded short prefix", () => {
		expect(REFERRAL_CODE_PATTERN.test("BRXXX-V8M2")).toBe(true);
	});

	test("matches an all-numeric suffix", () => {
		expect(REFERRAL_CODE_PATTERN.test("PIGGY-1234")).toBe(true);
	});

	test("rejects lowercase", () => {
		expect(REFERRAL_CODE_PATTERN.test("rosie-k3t9")).toBe(false);
	});

	test("rejects a short suffix", () => {
		expect(REFERRAL_CODE_PATTERN.test("ROSIE-K3T")).toBe(false);
	});

	test("rejects a long suffix", () => {
		expect(REFERRAL_CODE_PATTERN.test("ROSIE-K3T9X")).toBe(false);
	});

	test("rejects a short prefix", () => {
		expect(REFERRAL_CODE_PATTERN.test("ROSI-K3T9")).toBe(false);
	});

	test("rejects digits in the prefix", () => {
		expect(REFERRAL_CODE_PATTERN.test("ROSI3-K3T9")).toBe(false);
	});

	test("rejects free-form text", () => {
		expect(REFERRAL_CODE_PATTERN.test("random-text")).toBe(false);
	});

	test("rejects empty string", () => {
		expect(REFERRAL_CODE_PATTERN.test("")).toBe(false);
	});
});

describe("referralErrorMessage", () => {
	test("code_not_found → 'Not a real code…'", () => {
		expect(referralErrorMessage("code_not_found")).toContain("Not a real code");
	});

	test("self_referral → 'You can't use your own code'", () => {
		expect(referralErrorMessage("self_referral")).toContain("your own code");
	});

	test("already_redeemed → 'Already used'", () => {
		expect(referralErrorMessage("already_redeemed")).toContain("Already used");
	});

	test("too_old → welcome-window copy", () => {
		expect(referralErrorMessage("too_old")).toContain("welcome window");
	});

	test("too_active → welcome-window copy", () => {
		expect(referralErrorMessage("too_active")).toContain("new players only");
	});

	test("unauthenticated → sign-in copy", () => {
		expect(referralErrorMessage("unauthenticated")).toContain("Sign in");
	});

	test("every documented reason maps to non-empty copy", () => {
		const reasons = [
			"code_not_found",
			"self_referral",
			"already_redeemed",
			"too_old",
			"too_active",
			"unauthenticated",
		];
		for (const r of reasons) {
			expect(referralErrorMessage(r).length).toBeGreaterThan(0);
		}
	});

	test("unknown reason → falls back to the reason string", () => {
		expect(referralErrorMessage("rate_limited")).toBe("rate_limited");
	});

	test("undefined reason → generic fallback", () => {
		expect(referralErrorMessage(undefined)).toBe("Couldn't apply that code.");
	});
});

describe("parseReferralCodeFromUrl", () => {
	test("extracts from a well-formed /i/ invite URL", () => {
		expect(
			parseReferralCodeFromUrl(`https://${REFERRAL_URL_HOST}/i/ROSIE-K3T9`)
		).toBe("ROSIE-K3T9");
	});

	test("still extracts from the legacy /r/ URL", () => {
		expect(
			parseReferralCodeFromUrl(`https://${REFERRAL_URL_HOST}/r/ROSIE-K3T9`)
		).toBe("ROSIE-K3T9");
	});

	test("uppercases a lowercase tail", () => {
		expect(
			parseReferralCodeFromUrl(`https://${REFERRAL_URL_HOST}/i/rosie-k3t9`)
		).toBe("ROSIE-K3T9");
	});

	test("tolerates a trailing slash", () => {
		expect(
			parseReferralCodeFromUrl(`https://${REFERRAL_URL_HOST}/i/ROSIE-K3T9/`)
		).toBe("ROSIE-K3T9");
	});

	test("tolerates a query string", () => {
		expect(
			parseReferralCodeFromUrl(
				`https://${REFERRAL_URL_HOST}/i/ROSIE-K3T9?utm_source=ig`
			)
		).toBe("ROSIE-K3T9");
	});

	test("rejects a malformed code in a valid URL shape", () => {
		expect(
			parseReferralCodeFromUrl(`https://${REFERRAL_URL_HOST}/i/notacode`)
		).toBeNull();
	});

	test("rejects the wrong host", () => {
		expect(
			parseReferralCodeFromUrl("https://example.com/i/ROSIE-K3T9")
		).toBeNull();
	});

	test("rejects the wrong path prefix", () => {
		expect(
			parseReferralCodeFromUrl(`https://${REFERRAL_URL_HOST}/share/ROSIE-K3T9`)
		).toBeNull();
	});

	test("rejects null / empty input", () => {
		expect(parseReferralCodeFromUrl(null)).toBeNull();
		expect(parseReferralCodeFromUrl("")).toBeNull();
	});

	test("rejects unparseable garbage", () => {
		expect(parseReferralCodeFromUrl("not a url at all")).toBeNull();
	});
});

describe("parseReferralCodeFromClipboard", () => {
	test("returns the code when the clipboard exactly matches", () => {
		expect(parseReferralCodeFromClipboard("ROSIE-K3T9")).toBe("ROSIE-K3T9");
	});

	test("uppercases and trims surrounding whitespace", () => {
		expect(parseReferralCodeFromClipboard("  rosie-k3t9 \n")).toBe("ROSIE-K3T9");
	});

	test("returns null when the clipboard carries extra text", () => {
		expect(
			parseReferralCodeFromClipboard("My code is ROSIE-K3T9, check it out")
		).toBeNull();
	});

	test("returns null on bad format", () => {
		expect(parseReferralCodeFromClipboard("ROSIE-K3T")).toBeNull();
	});

	test("returns null on null / undefined / empty", () => {
		expect(parseReferralCodeFromClipboard(null)).toBeNull();
		expect(parseReferralCodeFromClipboard(undefined)).toBeNull();
		expect(parseReferralCodeFromClipboard("")).toBeNull();
	});
});

describe("shareMessageForCode", () => {
	test("includes the code and the /i/ invite URL", () => {
		const msg = shareMessageForCode("ROSIE-K3T9");
		expect(msg).toContain("ROSIE-K3T9");
		expect(msg).toContain(`https://${REFERRAL_URL_HOST}/i/ROSIE-K3T9`);
	});

	test("opens with the come-tickle hook", () => {
		expect(shareMessageForCode("ROSIE-K3T9")).toMatch(/^Come tickle a pig/);
	});
});

describe("constants", () => {
	test("PENDING_REFERRAL_CODE_KEY is a stable string", () => {
		// Locked because app/_layout.tsx and the onboarding step both
		// reach for the same AsyncStorage slot.
		expect(PENDING_REFERRAL_CODE_KEY).toBe("pending_referral_code");
	});
});

describe("typed wrappers", () => {
	beforeEach(() => {
		mockRpc.mockReset();
		mockRpc.mockResolvedValue({ data: null, error: null });
	});

	test("redeemReferralCode passes the p_code param", async () => {
		await redeemReferralCode("ROSIE-K3T9");
		expect(mockRpc).toHaveBeenCalledWith("redeem_referral_code", {
			p_code: "ROSIE-K3T9",
		});
	});

	test("myReferralSummary calls the right RPC with no params", async () => {
		await myReferralSummary();
		expect(mockRpc).toHaveBeenCalledWith("my_referral_summary", undefined);
	});

	test("returns null when supabase yields an error", async () => {
		mockRpc.mockResolvedValueOnce({
			data: null,
			error: { message: "boom" },
		});
		expect(await myReferralSummary()).toBeNull();
	});

	test("returns parsed data on success", async () => {
		mockRpc.mockResolvedValueOnce({
			data: {
				ok: true,
				code: "ROSIE-K3T9",
				referrals_completed: 1,
				referrals_pending: 2,
				next_milestone_at: 3,
			},
			error: null,
		});
		const r = await myReferralSummary();
		expect(r).toEqual({
			ok: true,
			code: "ROSIE-K3T9",
			referrals_completed: 1,
			referrals_pending: 2,
			next_milestone_at: 3,
		});
	});
});

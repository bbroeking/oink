// Unit tests for the Golden-Ticket redemption pure helpers
// (utils/redemption.ts). Normalization MUST mirror the server chokepoint in
// supabase/migrations/20260732000000_qr_redemption.sql:
//   norm := upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'))

import {
	normalizeRedemptionCode,
	formatRedemptionCode,
	parseRedemptionPayload,
	parseTradingCardPayload,
	redemptionErrorMessage,
	REDEMPTION_CODE_PATTERN,
	TICKLE_THE_PIG_APP_STORE_URL,
} from "../utils/redemption";
import fs from "fs";
import path from "path";

describe("normalizeRedemptionCode", () => {
	it("uppercases and strips dashes (typed poster form → stored form)", () => {
		expect(normalizeRedemptionCode("pig-4kf2-9xqm")).toBe("PIG4KF29XQM");
	});
	it("strips any non-alphanumerics (spaces, punctuation)", () => {
		expect(normalizeRedemptionCode("  pig 4kf2.9xqm ")).toBe("PIG4KF29XQM");
	});
	it("is idempotent on an already-normalized code", () => {
		expect(normalizeRedemptionCode("PIG4KF29XQM")).toBe("PIG4KF29XQM");
	});
	it("matches the SQL transform exactly for mixed input", () => {
		// upper(regexp_replace('Pig_4Kf2/9xQm', '[^A-Za-z0-9]', '', 'g'))
		expect(normalizeRedemptionCode("Pig_4Kf2/9xQm")).toBe("PIG4KF29XQM");
	});
});

describe("formatRedemptionCode", () => {
	it("re-adds display dashes to a normalized code", () => {
		expect(formatRedemptionCode("PIG4KF29XQM")).toBe("PIG-4KF2-9XQM");
	});
	it("normalizes-then-formats a dashed input", () => {
		expect(formatRedemptionCode("pig-4kf2-9xqm")).toBe("PIG-4KF2-9XQM");
	});
	it("returns the input unchanged when it isn't the PIG shape", () => {
		expect(formatRedemptionCode("HELLO")).toBe("HELLO");
	});
});

describe("parseRedemptionPayload", () => {
	it("extracts the last segment of a /redeem/ universal link (normalized)", () => {
		expect(
			parseRedemptionPayload("https://ticklethepig.com/redeem/PIG-4KF2-9XQM")
		).toBe("PIG4KF29XQM");
	});
	it("tolerates a trailing slash on the URL", () => {
		expect(
			parseRedemptionPayload("https://ticklethepig.com/redeem/PIG-4KF2-9XQM/")
		).toBe("PIG4KF29XQM");
	});
	it("tolerates query strings and fragments", () => {
		expect(
			parseRedemptionPayload("https://ticklethepig.com/redeem/pig-4kf2-9xqm?utm=x#y")
		).toBe("PIG4KF29XQM");
	});
	it("accepts the custom scheme deep link too", () => {
		expect(
			parseRedemptionPayload("ticklethepig://redeem/PIG-4KF2-9XQM")
		).toBe("PIG4KF29XQM");
	});
	it("treats a bare typed code as the code (normalized)", () => {
		expect(parseRedemptionPayload("pig-4kf2-9xqm")).toBe("PIG4KF29XQM");
	});
	it("treats a non-/redeem/ URL body as a bare code (strips to alnum)", () => {
		// Not a /redeem/ path → whole string treated as a code, non-alnum stripped.
		expect(parseRedemptionPayload("https://example.com/foo")).toBe(
			"HTTPSEXAMPLECOMFOO"
		);
	});
	it("returns null for empty / whitespace / nullish input", () => {
		expect(parseRedemptionPayload("")).toBeNull();
		expect(parseRedemptionPayload("   ")).toBeNull();
		expect(parseRedemptionPayload(null)).toBeNull();
		expect(parseRedemptionPayload(undefined)).toBeNull();
	});
});

describe("REDEMPTION_CODE_PATTERN", () => {
	it("accepts a well-formed Crockford dashed code", () => {
		expect(REDEMPTION_CODE_PATTERN.test("PIG-4KF2-9XQM")).toBe(true);
	});
	it("rejects ambiguous Crockford chars (I/L/O/U/0/1)", () => {
		expect(REDEMPTION_CODE_PATTERN.test("PIG-I000-LOU1")).toBe(false);
	});
	it("rejects the un-dashed / wrong-length forms", () => {
		expect(REDEMPTION_CODE_PATTERN.test("PIG4KF29XQM")).toBe(false);
		expect(REDEMPTION_CODE_PATTERN.test("PIG-4KF2")).toBe(false);
	});
});

describe("parseTradingCardPayload", () => {
	it("classifies the canonical App Store card", () => {
		expect(parseTradingCardPayload(TICKLE_THE_PIG_APP_STORE_URL)).toEqual({
			kind: "app_store",
			url: TICKLE_THE_PIG_APP_STORE_URL,
		});
	});

	it("classifies a Golden Ticket URL", () => {
		expect(
			parseTradingCardPayload(
				"https://ticklethepig.com/redeem/PIG-4KF2-9XQM"
			)
		).toEqual({ kind: "redemption", code: "PIG4KF29XQM" });
	});

	it("classifies a typed Golden Ticket", () => {
		expect(parseTradingCardPayload("pig-4kf2-9xqm")).toEqual({
			kind: "redemption",
			code: "PIG4KF29XQM",
		});
	});

	it("ignores unrelated URLs and other App Store listings", () => {
		expect(parseTradingCardPayload("https://example.com/PIG-4KF2-9XQM")).toBeNull();
		expect(
			parseTradingCardPayload("https://apps.apple.com/us/app/other/id123")
		).toBeNull();
	});
});

describe("redemptionErrorMessage", () => {
	it("maps each known refusal reason to distinct copy", () => {
		const reasons = [
			"unknown",
			"expired",
			"exhausted",
			"already_redeemed",
			"not_signed_in",
			"bad_grant",
			"pouch_full",
			"item_sold_out",
		];
		const msgs = reasons.map(redemptionErrorMessage);
		expect(new Set(msgs).size).toBe(reasons.length); // all distinct
		msgs.forEach((m) => expect(m.length).toBeGreaterThan(0));
	});
	it("falls back to the gentle retry copy for network/no_data/unknown-reason", () => {
		const fallback = "Couldn't check the code — try again in a bit.";
		expect(redemptionErrorMessage("network")).toBe(fallback);
		expect(redemptionErrorMessage("no_data")).toBe(fallback);
		expect(redemptionErrorMessage(undefined)).toBe(fallback);
		expect(redemptionErrorMessage("some_new_reason")).toBe(fallback);
	});
});

describe("Release Party Crown campaign", () => {
	it("extends the exact Crown code through the end of September 1", () => {
		const sql = fs.readFileSync(
			path.join(
				__dirname,
				"..",
				"supabase",
				"migrations",
				"20260777000000_extend_release_party_crown.sql"
			),
			"utf8"
		);
		expect(sql).toMatch(/code\s*=\s*'PIGGXF8ST7N'/);
		expect(sql).toMatch(/2026-09-02 00:00:00-04/);
	});
});

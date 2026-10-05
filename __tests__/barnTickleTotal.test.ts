import fs from "node:fs";
import path from "node:path";
import { formatBarnTickleTotal } from "../utils/tickleDisplay";

describe("Barn Tickle total", () => {
	it.each([
		[0, "0"],
		[9_999, "9,999"],
		[10_000, "10,000"],
		[999_999, "999,999"],
		[1_000_000, "1M"],
		[1_250_000, "1.3M"],
		[12_500_000, "13M"],
	])("formats %i as %s", (value, expected) => {
		expect(formatBarnTickleTotal(value, "en-US")).toBe(expected);
	});

	it("keeps the earned stamp's numeral on one line in one role", () => {
		const stamp = fs.readFileSync(
			path.join(__dirname, "..", "components", "EarnedStamp.tsx"),
			"utf8",
		);
		expect(stamp).toContain("numberOfLines={1}");
		expect(stamp).not.toContain("adjustsFontSizeToFit");
		expect(stamp).not.toContain("minimumFontScale");
		expect(stamp).toContain("formatBarnTickleTotal(total)");
		const barn = fs.readFileSync(
			path.join(__dirname, "..", "components", "Barn.tsx"),
			"utf8",
		);
		// The stamp is told when the bank is still loading, so it never shows a
		// "0" that fills in under the thumb (polish 2026-10-04).
		expect(barn).toContain("<EarnedStamp total={stats.ticklesEarned} loaded={statsLoaded} />");
	});

	it("leaves the exact lifetime value on the Me surface", () => {
		const account = fs.readFileSync(
			path.join(__dirname, "..", "components", "Account.tsx"),
			"utf8",
		);
		// The exact figure, through one local since the Me pass (2026-10-04):
		// the count is computed once and every Me surface prints it in full.
		const local = account.match(
			/const (\w+) = lifetimeTickles\(\s*ticklesLifetimeBase,\s*ticklesEarned\s*\);/,
		);
		const inline =
			/lifetimeTickles\(\s*ticklesLifetimeBase,\s*ticklesEarned\s*\)\.toLocaleString\(\)/.test(account);
		expect(inline || (local !== null && account.includes(`${local[1]}.toLocaleString()`))).toBe(true);
		expect(account).not.toContain("formatBarnTickleTotal");
	});
});

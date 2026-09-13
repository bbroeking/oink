import fs from "node:fs";
import path from "node:path";
import {
	barnTickleTicketFontSize,
	formatBarnTickleTotal,
} from "../utils/tickleDisplay";

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

	it("keeps the Barn numeral on one line with a readable shrink floor", () => {
		const source = fs.readFileSync(
			path.join(__dirname, "..", "components", "Barn.tsx"),
			"utf8",
		);
		expect(source).toContain("numberOfLines={1}");
		expect(source).not.toContain("adjustsFontSizeToFit");
		expect(source).not.toContain("minimumFontScale");
		expect(source).toContain("value={formatBarnTickleTotal(stats.ticklesEarned)}");
		expect(barnTickleTicketFontSize("9,999")).toBe(30);
		expect(barnTickleTicketFontSize("10,000")).toBe(24);
		expect(barnTickleTicketFontSize("999,999")).toBe(20);
		expect(barnTickleTicketFontSize("1.3M")).toBe(30);
	});

	it("leaves the exact lifetime value on the Me surface", () => {
		const account = fs.readFileSync(
			path.join(__dirname, "..", "components", "Account.tsx"),
			"utf8",
		);
		expect(account).toMatch(
			/lifetimeTickles\(\s*ticklesLifetimeBase,\s*ticklesEarned\s*\)\.toLocaleString\(\)/,
		);
		expect(account).not.toContain("formatBarnTickleTotal");
	});
});

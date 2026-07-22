import {
	formatHM,
	formatCountdownHM,
	formatDurationCompact,
	formatClockMS,
	remainingMs,
} from "@/utils/duration";

// Boundary cases per formatter: 0, sub-minute, exactly one hour, past a day.
// Each surface renders a DELIBERATELY different string from the same input —
// these lock the differences the consolidation must preserve.

describe("formatHM", () => {
	it("floors to whole minutes, no hour under 60m", () => {
		expect(formatHM(0)).toBe("0m");
		expect(formatHM(59_000)).toBe("0m"); // <1m floors to 0m
		expect(formatHM(119_000)).toBe("1m"); // 1m59s floors to 1m
	});
	it("rolls up to hours and always shows the minute part", () => {
		expect(formatHM(3_600_000)).toBe("1h 0m"); // exactly 1h
		expect(formatHM(3_900_000)).toBe("1h 5m");
		expect(formatHM(90_000_000)).toBe("25h 0m"); // >1d, no day rollover
	});
	it("minMinute clamps the sub-minute tail up instead of 0m", () => {
		expect(formatHM(30_000, { minMinute: 1 })).toBe("1m");
		expect(formatHM(3_630_000, { minMinute: 1 })).toBe("1h 0m"); // clamp only when h===0
	});
});

describe("formatCountdownHM", () => {
	it("is formatHM over a seconds span", () => {
		expect(formatCountdownHM(0)).toBe("0m");
		expect(formatCountdownHM(59)).toBe("0m");
		expect(formatCountdownHM(3600)).toBe("1h 0m");
		expect(formatCountdownHM(90_000)).toBe("25h 0m"); // >1d
	});
});

describe("formatDurationCompact", () => {
	it("clamps up to 1m and rounds minutes", () => {
		expect(formatDurationCompact(0)).toBe("1m"); // min 60s
		expect(formatDurationCompact(30)).toBe("1m");
		expect(formatDurationCompact(90)).toBe("2m"); // rounds, not floors
	});
	it("collapses an exact hour and rounds the minute remainder", () => {
		expect(formatDurationCompact(3600)).toBe("1h"); // no trailing 0m
		expect(formatDurationCompact(3900)).toBe("1h 5m");
		expect(formatDurationCompact(7200)).toBe("2h");
		expect(formatDurationCompact(90_000)).toBe("25h"); // >1d, exact hour collapses
	});
});

describe("formatClockMS", () => {
	it("shows bare seconds under a minute", () => {
		expect(formatClockMS(0)).toBe("0s");
		expect(formatClockMS(30)).toBe("30s");
		expect(formatClockMS(59)).toBe("59s");
	});
	it("shows m + zero-padded s, no hour rollover", () => {
		expect(formatClockMS(60)).toBe("1m 00s");
		expect(formatClockMS(90)).toBe("1m 30s");
		expect(formatClockMS(3600)).toBe("60m 00s"); // no hour rollover by design
		expect(formatClockMS(3661)).toBe("61m 01s");
	});
});

describe("remainingMs", () => {
	it("is the signed span from now to the ISO instant", () => {
		const future = new Date(Date.now() + 60_000).toISOString();
		const past = new Date(Date.now() - 60_000).toISOString();
		expect(remainingMs(future)).toBeGreaterThan(0);
		expect(remainingMs(future)).toBeLessThanOrEqual(60_000);
		expect(remainingMs(past)).toBeLessThan(0);
	});
});

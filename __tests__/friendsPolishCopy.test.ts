// Copy the 2026-10-04 Friends polish pass pinned: one vocabulary for today's
// ritual allowance (the list, the explain sheet and the profile sheet all
// count it the same way), a feed that never prints a raw server id, and swap
// lines a person would say.
jest.mock("@/utils/supabase", () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));
jest.mock("@/utils/rpc", () => ({ rpc: jest.fn(async () => null), rpcAction: jest.fn() }));
jest.mock("expo-router/react-navigation", () => ({ useFocusEffect: jest.fn() }));
jest.mock("expo-haptics", () => ({
	notificationAsync: jest.fn().mockResolvedValue(undefined),
	NotificationFeedbackType: { Success: "success" },
}));

import { allowanceLine, countWord } from "@/hooks/useRitualDoor";
import { ritualFeedLine, swapFeedLine } from "@/components/Inbox";
import { BLESSING_META, CURSE_META } from "@/utils/rituals";
import type { SatchelSwapRow } from "@/utils/satchel";

describe("today's allowance, in the list's words", () => {
	test("counts in words, glimmer for blessings and truffle for curses", () => {
		expect(allowanceLine("bless", 3)).toBe("Three glimmer left");
		expect(allowanceLine("curse", 3, { lowercase: true })).toBe("three truffle left");
	});

	test("zero is 'No'/'no', never a numeral", () => {
		expect(allowanceLine("bless", 0)).toBe("No glimmer left");
		expect(allowanceLine("curse", 0, { lowercase: true })).toBe("no truffle left");
	});

	test("past ten the numeral is the shorter read", () => {
		expect(countWord(10)).toBe("Ten");
		expect(countWord(13)).toBe("13");
	});
});

describe("the Inbox's ritual lines", () => {
	test("a live kind names the ritual and what it does", () => {
		const m = BLESSING_META.sunday_best;
		expect(ritualFeedLine("bless", "FunnelWalker", "sunday_best")).toBe(
			`FunnelWalker blessed you · ${m.name} · ${m.blurb}`
		);
		const c = CURSE_META.old_timey;
		expect(ritualFeedLine("curse", "Bob", "old_timey")).toBe(
			`Bob cursed you · ${c.name} · ${c.blurb}`
		);
	});

	test("a retired kind keeps its name and drops the retired mechanic", () => {
		// "warm_tea" leaked as raw copy in the 2026-10-04 captures.
		expect(ritualFeedLine("bless", "FunnelWalker", "warm_tea")).toBe(
			"FunnelWalker blessed you · Warm Tea"
		);
	});

	test("an unknown kind says nothing, never the raw id", () => {
		const line = ritualFeedLine("curse", "Someone", "mystery_kind");
		expect(line).toBe("Someone cursed you");
		expect(line).not.toContain("mystery_kind");
	});
});

describe("the Inbox's swap lines", () => {
	const row = (over: Partial<SatchelSwapRow>): SatchelSwapRow =>
		({
			id: 1,
			direction: "given",
			partner_username: "DemoHelper1",
			gave_find_id: "old_key",
			took_find_id: null,
			created_at: "2026-10-01T00:00:00Z",
			...over,
		}) as unknown as SatchelSwapRow;

	test("a hand-off both ways is 'gave … and took …'", () => {
		const given = swapFeedLine(row({ took_find_id: "river_pebble" }));
		expect(given).toMatch(/^you gave DemoHelper1's pig the .+ and took the .+$/);
		expect(given).not.toContain("swapped DemoHelper1's pig");
		const received = swapFeedLine(row({ direction: "received", took_find_id: "river_pebble" }));
		expect(received).toMatch(/^DemoHelper1 gave your pig the .+ it was hoping for and took the .+$/);
	});

	test("a gift reads as a gift", () => {
		expect(swapFeedLine(row({}))).toMatch(/^you gave DemoHelper1's pig the /);
		expect(swapFeedLine(row({ direction: "received" }))).toMatch(
			/^DemoHelper1 brought your pig the /
		);
	});
});

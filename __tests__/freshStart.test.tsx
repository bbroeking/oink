// The one-time "fresh start" note for a season that began with a reset (The
// Feast): the server names which of the pig's buckets the flip zeroed
// (my_season_reset), the card names only those, says what came along, and
// never shows for Season 1 or an answer about another season.
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { readFileSync } from "fs";
import { join } from "path";

jest.mock("@/components/ui/Icon", () => ({
	Icon: () => null,
}));

import {
	FRESH_START_KEEPS,
	freshStartLine,
	freshStartSeenKey,
	parseFreshStart,
} from "@/hooks/useFreshStart";
import { FreshStartCard } from "@/components/season1/almanac/FreshStartCard";
import { seasonTheme } from "@/utils/seasonTheme";

function textOf(root: TestRenderer.ReactTestInstance): string {
	return root
		.findAll((n) => typeof n.props.children === "string")
		.map((n) => n.props.children as string)
		.join(" | ");
}

describe("parseFreshStart", () => {
	it("keeps the known kinds for this season, in a fixed order", () => {
		expect(
			parseFreshStart({ ok: true, season_id: "snout_season_2", kinds: ["tickle_bank", "satchel", "snouts"] }, "snout_season_2"),
		).toEqual(["snouts", "tickle_bank", "satchel"]);
		expect(
			parseFreshStart({ season_id: "snout_season_2", kinds: ["satchel", "board", 7] }, "snout_season_2"),
		).toEqual(["satchel"]);
	});

	it("is empty for another season, a malformed answer, or nothing at all", () => {
		expect(parseFreshStart({ season_id: "snout_season_1", kinds: ["snouts"] }, "snout_season_2")).toEqual([]);
		for (const bad of [null, undefined, "x", [], {}, { season_id: "snout_season_2" }, { season_id: "snout_season_2", kinds: "snouts" }]) {
			expect(parseFreshStart(bad, "snout_season_2")).toEqual([]);
		}
	});
});

describe("freshStartLine", () => {
	it("names only what reset, with the right verb", () => {
		expect(freshStartLine("The Feast", ["snouts", "tickle_bank", "satchel"])).toBe(
			"The Feast starts every pig fresh, so your snouts, tickle bank and Satchel begin again at zero.",
		);
		expect(freshStartLine("The Feast", ["snouts"])).toBe(
			"The Feast starts every pig fresh, so your snouts begin again at zero.",
		);
		expect(freshStartLine("The Feast", ["satchel"])).toBe(
			"The Feast starts every pig fresh, so your Satchel begins again at zero.",
		);
		expect(freshStartLine("The Feast", ["tickle_bank", "snouts"])).toBe(
			"The Feast starts every pig fresh, so your snouts and tickle bank begin again at zero.",
		);
		expect(freshStartLine("The Feast", [])).toBe("");
	});

	it("never carries an em dash", () => {
		for (const s of [freshStartLine("The Feast", ["snouts", "tickle_bank", "satchel"]), FRESH_START_KEEPS]) {
			expect(s).not.toContain("—");
		}
	});

	it("stamps per season and per pig", () => {
		expect(freshStartSeenKey("snout_season_2", "u1")).toBe("fresh_start_seen:snout_season_2:u1");
	});
});

describe("the theme decides who announces a fresh start", () => {
	it("only The Feast does; Season 1 and unknown ids never do", () => {
		expect(seasonTheme("snout_season_2").announcesFreshStart).toBe(true);
		expect(seasonTheme("snout_season_1").announcesFreshStart).toBe(false);
		expect(seasonTheme("snout_season_9").announcesFreshStart).toBe(false);
	});
});

describe("FreshStartCard", () => {
	it("renders the line, what came along, and one button that dismisses", () => {
		const onDismiss = jest.fn();
		let r!: TestRenderer.ReactTestRenderer;
		act(() => {
			r = TestRenderer.create(
				<FreshStartCard seasonTitle="The Feast" kinds={["snouts", "satchel"]} onDismiss={onDismiss} />,
			);
		});
		const text = textOf(r.root);
		expect(text).toContain("The Feast starts every pig fresh, so your snouts and Satchel begin again at zero.");
		expect(text).toContain(FRESH_START_KEEPS);
		const btn = r.root.find((n) => n.props.accessibilityLabel === "Pull up a chair" && typeof n.props.onPress === "function");
		act(() => btn.props.onPress());
		expect(onDismiss).toHaveBeenCalledTimes(1);
		act(() => r.unmount());
	});

	it("renders nothing when nothing reset", () => {
		let r!: TestRenderer.ReactTestRenderer;
		act(() => {
			r = TestRenderer.create(<FreshStartCard seasonTitle="The Feast" kinds={[]} onDismiss={jest.fn()} />);
		});
		expect(r.toJSON()).toBeNull();
		act(() => r.unmount());
	});

	it("is mounted on the Feed tab from the hook, keyed to the active season", () => {
		const src = readFileSync(join(__dirname, "..", "app/(tabs)/season.tsx"), "utf8");
		expect(src).toContain("useFreshStart(");
		expect(src).toContain('selectedTab === "feed" && freshStart.kinds ? (');
	});
});

// Pure-logic tests for the Season-2 Sounder walkthrough stepper state mapper
// (components/season2/stepState.ts): which step the player is on given crew +
// war state, the completed-stamp view, and the war-strip helpers.

import {
	sounderStepFor,
	sounderStepView,
	warDay,
	ropeLeanLine,
} from "../components/season2/stepState";
import type { CrewState } from "../utils/mudWars";

const base: CrewState = {
	crew: null,
	members: [],
	invitesIn: [],
	invitesOut: [],
	inWar: false,
	warId: null,
};

const CREW = { id: "c1", name: "The Mud Maulers", leader_id: "u1", is_bot: false };
const member = (id: string) => ({
	user_id: id,
	username: id,
	role: "member" as const,
	active_title: null,
});

describe("sounderStepFor", () => {
	it("no crew → create", () => {
		expect(sounderStepFor(base)).toBe("create");
	});

	it("crew of 1 → invite", () => {
		expect(
			sounderStepFor({ ...base, crew: CREW, members: [member("u1")] })
		).toBe("invite");
	});

	it("crew of 2+ → march", () => {
		expect(
			sounderStepFor({
				...base,
				crew: CREW,
				members: [member("u1"), member("u2")],
			})
		).toBe("march");
	});

	it("crew at full cap → march (not invite)", () => {
		expect(
			sounderStepFor({
				...base,
				crew: CREW,
				members: ["u1", "u2", "u3", "u4", "u5"].map(member),
			})
		).toBe("march");
	});

	it("in a war → war, even with a roster of one", () => {
		expect(
			sounderStepFor({
				...base,
				crew: CREW,
				members: [member("u1")],
				inWar: true,
				warId: "w1",
			})
		).toBe("war");
	});

	it("inWar without a warId does NOT collapse to the war strip", () => {
		// Defensive: the strip needs a war to link to; stale inWar flags fall
		// back to the roster-driven step.
		expect(
			sounderStepFor({
				...base,
				crew: CREW,
				members: [member("u1")],
				inWar: true,
				warId: null,
			})
		).toBe("invite");
	});
});

describe("sounderStepView", () => {
	it("create → nothing done", () => {
		expect(sounderStepView(base)).toEqual({ current: "create", done: [] });
	});

	it("invite → create stamped", () => {
		expect(
			sounderStepView({ ...base, crew: CREW, members: [member("u1")] })
		).toEqual({ current: "invite", done: ["create"] });
	});

	it("march → create + invite stamped", () => {
		expect(
			sounderStepView({
				...base,
				crew: CREW,
				members: [member("u1"), member("u2")],
			})
		).toEqual({ current: "march", done: ["create", "invite"] });
	});

	it("war → all three stamped", () => {
		expect(
			sounderStepView({
				...base,
				crew: CREW,
				members: [member("u1"), member("u2")],
				inWar: true,
				warId: "w1",
			})
		).toEqual({ current: "war", done: ["create", "invite", "march"] });
	});
});

describe("warDay", () => {
	it("no end date → day 1", () => {
		expect(warDay(null, 7)).toBe(1);
	});

	it("6 days left of 7 → day 1; last day → day 7", () => {
		const days = (n: number) =>
			new Date(Date.now() + n * 86400000).toISOString();
		expect(warDay(days(6.5), 7)).toBe(1);
		expect(warDay(days(0.5), 7)).toBe(7);
	});

	it("clamps past-end wars to the final day", () => {
		const yesterday = new Date(Date.now() - 86400000).toISOString();
		expect(warDay(yesterday, 7)).toBe(7);
	});
});

describe("ropeLeanLine", () => {
	it("is defined for every band", () => {
		for (const v of [null, undefined, 0, 0.05, 0.4, 0.8, -0.4, -0.9]) {
			expect(typeof ropeLeanLine(v)).toBe("string");
			expect(ropeLeanLine(v).length).toBeGreaterThan(0);
		}
	});

	it("dead-even under the 0.08 band", () => {
		expect(ropeLeanLine(0.05)).toMatch(/even/i);
	});

	it("distinguishes leading, trailing, and rout proximity", () => {
		expect(ropeLeanLine(0.4)).not.toEqual(ropeLeanLine(-0.4));
		expect(ropeLeanLine(0.8)).toMatch(/rout/i);
		expect(ropeLeanLine(-0.9)).toMatch(/rout|rally/i);
	});
});

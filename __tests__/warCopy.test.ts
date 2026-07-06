// Pure-logic tests for the Mud Scuffle copy + action mapping
// (components/mudwar/warCopy.ts) and the __DEV__ war-state override harness
// (components/mudwar/devWarState.ts). Covers the state → rendering mapping:
// leading/trailing/tied rope copy, action availability (budget spent vs
// available), bot-opponent naming, and war-over states.

import type { WarState, WarSide } from "../utils/mudWars";
import { BOT_CREW_NAME } from "../constants/mudFights";
import {
	opponentName,
	myName,
	ropeState,
	warActions,
	isHoldPhase,
	warOutcome,
	resolvedCopy,
	scoreboardCopy,
	drainLine,
	siegeDay,
	termLine,
	warTotalDays,
	frontValueLabel,
	isRhythmRecap,
	recapOutcomeSentence,
	commitMarkerLine,
	frontBoardLead,
	weeklyModifierExplainer,
} from "../components/mudwar/warCopy";
import {
	applyWarOverride,
	mockWarState,
	endsAtForDay,
	splitUiOverride,
	MOCK_MY_CREW_ID,
	MOCK_THEM_CREW_ID,
} from "../components/mudwar/devWarState";

// ── Fixtures ─────────────────────────────────────────────────────────────────

function side(
	name: string | null,
	perCapita: number,
	opts: { id?: string; isBot?: boolean; active?: number } = {}
): WarSide {
	return {
		crew: name ? { id: opts.id ?? "c", name, is_bot: opts.isBot ?? false } : null,
		members: [],
		total: perCapita,
		active: opts.active ?? 1,
		perCapita,
		quorumMet: true,
	};
}

function makeWar(over: Partial<WarState> = {}): WarState {
	return {
		warId: "w1",
		status: "active",
		endsAt: null,
		isBotWar: false,
		winnerCrew: null,
		iAmChallenger: true,
		myRemainingToday: 10,
		myThrowsRemaining: 5,
		mine: side("The Mud Maulers", 5, { id: "mine" }),
		them: side("Trough Loyalists", 3, { id: "them" }),
		...over,
	};
}

// ── opponentName / myName ────────────────────────────────────────────────────

describe("opponentName", () => {
	it("uses the opponent crew's name", () => {
		expect(opponentName(makeWar())).toBe("Trough Loyalists");
	});
	it("falls back to The Mudlarks for a nameless bot war", () => {
		const w = makeWar({ them: side(null, 3), isBotWar: true });
		expect(opponentName(w)).toBe(BOT_CREW_NAME);
		expect(opponentName(w)).toBe("The Mudlarks");
	});
	it("falls back to a generic Sounder for a nameless non-bot war", () => {
		const w = makeWar({ them: side(null, 3), isBotWar: false });
		expect(opponentName(w)).toBe("the other Sounder");
	});
	it("names your own crew, with a fallback", () => {
		expect(myName(makeWar())).toBe("The Mud Maulers");
		expect(myName(makeWar({ mine: side(null, 5) }))).toBe("Your Sounder");
	});
});

// ── ropeState — leading / trailing / tied ────────────────────────────────────

describe("ropeState", () => {
	it("leading frames the lead as joy won back, keeping the plain 'by N per pig'", () => {
		const r = ropeState(makeWar({ mine: side("A", 5), them: side("B", 3) }));
		expect(r.standing).toBe("leading");
		expect(r.margin).toBe(2);
		expect(r.line).toBe("Your herd's won back more joy — you lead by 2 per pig.");
	});

	it("trailing frames it as their herd reclaiming more joy", () => {
		const r = ropeState(makeWar({ mine: side("A", 3), them: side("B", 5) }));
		expect(r.standing).toBe("trailing");
		expect(r.margin).toBe(2);
		expect(r.line).toBe(
			"Their herd's won back more joy — they lead by 2 per pig."
		);
	});

	it("tied reads dead even, framed as pulling joy back", () => {
		const r = ropeState(makeWar({ mine: side("A", 4), them: side("B", 4) }));
		expect(r.standing).toBe("even");
		expect(r.margin).toBe(0);
		expect(r.line).toMatch(/even/i);
		expect(r.line).toMatch(/joy/i);
	});

	it("never frames the scuffle as pigs fighting pigs — no 'mud' in the standing", () => {
		for (const [m, t] of [
			[5, 3],
			[3, 5],
			[4, 4],
		] as const) {
			expect(ropeState(makeWar({ mine: side("A", m), them: side("B", t) })).line)
				.not.toMatch(/mud/i);
		}
	});

	it("flags a near-rout when leading hard and frames it as pulling joy back", () => {
		const r = ropeState(
			makeWar({ mine: side("A", 8), them: side("B", 1), ropeNorm: 0.8 })
		);
		expect(r.standing).toBe("leading");
		expect(r.nearRout).toBe(true);
		expect(r.line).toMatch(/joy back fast/i);
	});

	it("flags a near-rout when trailing hard and calls for a rally", () => {
		const r = ropeState(
			makeWar({ mine: side("A", 1), them: side("B", 8), ropeNorm: -0.9 })
		);
		expect(r.standing).toBe("trailing");
		expect(r.nearRout).toBe(true);
		expect(r.line).toMatch(/rout|rally/i);
	});

	it("rounds a fractional per-pig margin to a whole number", () => {
		const r = ropeState(makeWar({ mine: side("A", 2.4), them: side("B", 2) }));
		expect(r.standing).toBe("even"); // 0.4 rounds to 0
	});
});

// ── warActions — availability by budget / phase ──────────────────────────────

describe("warActions", () => {
	it("always offers Dig and See the bog on a plain active war", () => {
		const keys = warActions(makeWar()).map((a) => a.key);
		expect(keys).toEqual(["dig", "bog"]);
	});

	it("Dig is enabled until you've dug this feeding", () => {
		const [dig] = warActions(makeWar(), { dugThisWindow: false });
		expect(dig.enabled).toBe(true);
		expect(dig.label).toBe("Dig the patch");
	});

	it("a spent dig disables with a hand-voice reason naming the next feeding", () => {
		const [dig] = warActions(makeWar(), {
			dugThisWindow: true,
			feedingCountdown: "2h",
		});
		expect(dig.enabled).toBe(false);
		expect(dig.label).toBe("Dug this feeding");
		expect(dig.reason).toContain("2h");
	});

	it("adds Hold the line only in a rhythm war's Hold phase", () => {
		const plain = warActions(makeWar()).map((a) => a.key);
		expect(plain).not.toContain("hold");

		const hold = makeWar({ rhythmEnabled: true, phase: "war" });
		const keys = warActions(hold, { runsRemaining: 2 }).map((a) => a.key);
		expect(keys).toContain("hold");
	});

	it("Hold the line disables when runs are spent", () => {
		const hold = makeWar({ rhythmEnabled: true, phase: "war" });
		const spent = warActions(hold, { runsRemaining: 0 }).find(
			(a) => a.key === "hold"
		)!;
		expect(spent.enabled).toBe(false);
		expect(spent.reason).toMatch(/today/i);

		const open = warActions(hold, { runsRemaining: 1 }).find(
			(a) => a.key === "hold"
		)!;
		expect(open.enabled).toBe(true);
	});

	it("See the bog is always present and enabled", () => {
		const bog = warActions(makeWar()).find((a) => a.key === "bog")!;
		expect(bog.enabled).toBe(true);
		expect(bog.focus).toBe("bog");
	});

	it("isHoldPhase is true only for a rhythm war reporting the war phase", () => {
		expect(isHoldPhase(makeWar())).toBe(false);
		expect(isHoldPhase(makeWar({ rhythmEnabled: true, phase: "build" }))).toBe(false);
		expect(isHoldPhase(makeWar({ rhythmEnabled: true, phase: "war" }))).toBe(true);
	});
});

// ── war-over states ──────────────────────────────────────────────────────────

describe("warOutcome + resolvedCopy", () => {
	it("win frames the winner as carrying more joy home", () => {
		const w = makeWar({ status: "resolved", winnerCrew: "mine" });
		expect(warOutcome(w)).toBe("win");
		expect(resolvedCopy(w).title).toMatch(/carried more home/i);
		expect(resolvedCopy(w).body).toMatch(/joy/i);
	});

	it("loss frames them as carrying more home, and keeps the loser's carve", () => {
		const w = makeWar({ status: "resolved", winnerCrew: "them" });
		expect(warOutcome(w)).toBe("loss");
		expect(resolvedCopy(w).title).toMatch(/carried more home/i);
		expect(resolvedCopy(w).body).toMatch(/kept every truffle you rooted/i);
	});

	it("draw when there is no winner", () => {
		const w = makeWar({ status: "resolved", winnerCrew: null });
		expect(warOutcome(w)).toBe("draw");
		expect(resolvedCopy(w).title).toMatch(/stalemate/i);
	});

	it("names The Mudlarks in a resolved bot win", () => {
		const w = makeWar({
			status: "resolved",
			winnerCrew: "mine",
			isBotWar: true,
			them: side(null, 3),
		});
		expect(resolvedCopy(w).body).toContain(BOT_CREW_NAME);
	});
});

// ── scoreboard + drain copy — the joy-reclaim reframe ────────────────────────

describe("scoreboardCopy + drainLine", () => {
	it("labels the two tallies as herds reclaiming joy, never 'mud'", () => {
		const s = scoreboardCopy();
		expect(s.caption).toMatch(/joy reclaimed/i);
		expect(s.caption).toMatch(/per pig/i);
		expect(s.mine).toBe("your herd");
		expect(s.theirs).toBe("their herd");
		expect(`${s.caption} ${s.mine} ${s.theirs}`).not.toMatch(/mud/i);
	});

	it("drainLine makes both herds' effort weaken him explicit", () => {
		const line = drainLine(42);
		expect(line).toContain("42");
		expect(line).toMatch(/either herd/i);
		expect(line).toMatch(/weakens him/i);
		expect(line).not.toMatch(/tickles/i);
	});
});

// ── siegeDay / termLine ──────────────────────────────────────────────────────

describe("siegeDay + termLine", () => {
	const now = Date.UTC(2026, 6, 6, 12, 0, 0);
	const inDays = (n: number) => new Date(now + n * 86_400_000).toISOString();

	it("no end date → day 1", () => {
		expect(siegeDay(null, 7, now)).toBe(1);
	});

	it("6.5 days left of 7 → day 1; 0.5 left → day 7", () => {
		expect(siegeDay(inDays(6.5), 7, now)).toBe(1);
		expect(siegeDay(inDays(0.5), 7, now)).toBe(7);
	});

	it("clamps a past-end war to the final day", () => {
		expect(siegeDay(inDays(-1), 7, now)).toBe(7);
	});

	it("termLine reads 'Day N of M · <countdown> left'", () => {
		const w = makeWar({ frontsEnabled: true, endsAt: inDays(6.5) });
		expect(termLine(w, "2h 10m", now)).toBe("Day 1 of 7 · 2h 10m left");
	});

	it("warTotalDays is 7 with fronts, 5 without", () => {
		expect(warTotalDays(makeWar({ frontsEnabled: true }))).toBe(7);
		expect(warTotalDays(makeWar({ frontsEnabled: false }))).toBe(5);
	});
});

// ── Dev harness — the override merge ─────────────────────────────────────────

describe("devWarState override merge", () => {
	const now = Date.UTC(2026, 6, 6, 12, 0, 0);

	it("synthesizes a mock war when mock is on and there's no base", () => {
		const w = applyWarOverride(null, null, true, now);
		expect(w).not.toBeNull();
		expect(opponentName(w!)).toBe("Trough Loyalists");
		expect(w!.status).toBe("active");
	});

	it("returns null (→ NoWar) with no base and mock off", () => {
		expect(applyWarOverride(null, null, false, now)).toBeNull();
	});

	it("passes the real war through untouched with no overrides", () => {
		const base = makeWar();
		expect(applyWarOverride(base, null, false, now)).toBe(base);
	});

	it("overrides the opponent name", () => {
		const w = applyWarOverride(makeWar(), { opponentName: "Bog Standard" }, false, now);
		expect(opponentName(w!)).toBe("Bog Standard");
	});

	it("overrides per-pig scores and reflows the rope copy", () => {
		const w = applyWarOverride(
			makeWar(),
			{ myPerCapita: 2, themPerCapita: 9 },
			false,
			now
		);
		expect(ropeState(w!).line).toBe(
			"Their herd's won back more joy — they lead by 7 per pig."
		);
	});

	it("maps a target day onto endsAt so siegeDay reads it back", () => {
		const w = applyWarOverride(makeWar({ frontsEnabled: true }), { day: 4 }, false, now);
		expect(siegeDay(w!.endsAt, 7, now)).toBe(4);
	});

	it("maps won=true onto my crew as the winner", () => {
		const w = applyWarOverride(
			makeWar(),
			{ status: "resolved", won: true },
			false,
			now
		);
		expect(w!.status).toBe("resolved");
		expect(warOutcome(w!)).toBe("win");
	});

	it("maps won=false onto the opponent as the winner", () => {
		const w = applyWarOverride(makeWar(), { won: false }, false, now);
		expect(warOutcome(w!)).toBe("loss");
	});

	it("mockWarState is a coherent active war", () => {
		const m = mockWarState(now);
		expect(m.mine.crew?.id).toBe(MOCK_MY_CREW_ID);
		expect(m.them.crew?.id).toBe(MOCK_THEM_CREW_ID);
		expect(m.status).toBe("active");
		expect(siegeDay(m.endsAt, warTotalDays(m), now)).toBe(3);
	});

	it("endsAtForDay round-trips through siegeDay for every day", () => {
		for (let d = 1; d <= 7; d++) {
			expect(siegeDay(endsAtForDay(d, 7, now), 7, now)).toBe(d);
		}
	});

	it("splitUiOverride separates UI-local fields from WarState fields", () => {
		const { war, ui } = splitUiOverride({
			opponentName: "X",
			runsRemaining: 1,
			dugThisWindow: true,
		});
		expect(war).toEqual({ opponentName: "X" });
		expect(ui).toEqual({ runsRemaining: 1, dugThisWindow: true });
	});
});

// ── The area board, in plain words (FrontBoard copy) ─────────────────────────

describe("frontValueLabel", () => {
	it("speaks the value as rope-pulls", () => {
		expect(frontValueLabel(5)).toBe("worth 5 rope-pulls");
		expect(frontValueLabel(3)).toBe("worth 3 rope-pulls");
	});
	it("singularizes one rope-pull", () => {
		expect(frontValueLabel(1)).toBe("worth 1 rope-pull");
	});
});

describe("recapOutcomeSentence", () => {
	const rhythmRow = (mineHeld: boolean) => ({
		front_key: "reed",
		value: 5,
		mineMud: 8,
		themMud: 6,
		mineHeld,
		themHeld: false,
		attackingMe: "hard" as const,
		iDeployed: "easy" as const,
	});
	const frontsRow = (winner: "mine" | "them" | "none") => ({
		front_key: "wallow",
		value: 4,
		mineMud: 7,
		themMud: 3,
		winner,
	});

	it("type-guards the two recap shapes", () => {
		expect(isRhythmRecap(rhythmRow(true))).toBe(true);
		expect(isRhythmRecap(frontsRow("mine"))).toBe(false);
	});

	it("rhythm: held reads as a full held sentence naming the wave", () => {
		const s = recapOutcomeSentence(rhythmRow(true));
		expect(s).toContain("You held");
		expect(s).toContain("Hard wave");
		expect(s).toContain("broke against you");
	});

	it("rhythm: fell reads as their wave breaking through, not bare 'fell'", () => {
		const s = recapOutcomeSentence(rhythmRow(false));
		expect(s).toBe("Their Hard wave broke through at Reed Marsh.");
	});

	it("fronts: a win names the area and both mud counts", () => {
		expect(recapOutcomeSentence(frontsRow("mine"))).toBe(
			"You held Hog Wallow — 7 mud to their 3."
		);
	});

	it("fronts: a loss reads as them taking the area", () => {
		expect(recapOutcomeSentence(frontsRow("them"))).toBe(
			"They took Hog Wallow — 3 mud to your 7."
		);
	});

	it("fronts: no winner reads as no one holding it", () => {
		const s = recapOutcomeSentence(frontsRow("none"));
		expect(s).toContain("No one held Hog Wallow");
	});
});

describe("commitMarkerLine", () => {
	it("unlocked build pick says where the mud will land", () => {
		expect(commitMarkerLine(false, false)).toBe(
			"your pick — your mud will land here"
		);
	});
	it("unlocked hold pick says the runs will defend here", () => {
		expect(commitMarkerLine(false, true)).toBe(
			"your pick — your runs will defend here"
		);
	});
	it("locked build says the mud lands here, locked in", () => {
		expect(commitMarkerLine(true, false)).toBe(
			"your mud lands here — locked in for today"
		);
	});
	it("locked hold says you're holding here", () => {
		expect(commitMarkerLine(true, true)).toBe(
			"you're holding here — your runs defend this area"
		);
	});
});

describe("frontBoardLead", () => {
	it("build phase explains what picking an area does with your digs", () => {
		const s = frontBoardLead(false);
		expect(s).toContain("Pick an area");
		expect(s).toContain("rope");
	});
	it("hold phase explains the runs defend the picked area", () => {
		const s = frontBoardLead(true);
		expect(s).toContain("defend");
		expect(s).toContain("rope");
	});
});

describe("weeklyModifierExplainer", () => {
	it("explains each named modifier in one line", () => {
		expect(weeklyModifierExplainer("marquee_double")).toContain("double");
		expect(weeklyModifierExplainer("fogged_gold")).toContain("fog");
		expect(weeklyModifierExplainer("warboss_week")).toContain("warboss");
	});
	it("is empty for none/unknown so no stray line renders", () => {
		expect(weeklyModifierExplainer("none")).toBe("");
		expect(weeklyModifierExplainer("something_new")).toBe("");
	});
});

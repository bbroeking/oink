// Pure-logic tests for the Mud Scuffle copy + action mapping
// (components/mudwar/warCopy.ts) and the __DEV__ war-state override harness
// (components/mudwar/devWarState.ts). Covers the state → rendering mapping:
// leading/trailing/tied rope copy, action availability (budget spent vs
// available), bot-opponent naming, and war-over states.

import type { WarState, WarSide } from "../utils/mudWars";
import { BOT_CREW_NAME, WAR_LENGTH_DAYS } from "../constants/mudFights";
import {
	opponentName,
	myName,
	lobbyCopy,
	rivalActivityLine,
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
	participationState,
	participationNote,
	memberBreakdown,
	activeCount,
	theirBreakdown,
	syntheticPaceLine,
	rivalHiddenNote,
	pointMetaLine,
	scoreboardTapHint,
	scoringLinkLabel,
	devDataTagLabel,
	scoringRules,
} from "../components/mudwar/warCopy";
import type { WarSideMember } from "../utils/mudWars";
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

// ── lobbyCopy — the Start-a-Mud-Scuffle card ─────────────────────────────────

describe("lobbyCopy", () => {
	it("tracks WAR_LENGTH_DAYS in the day-count copy", () => {
		const c = lobbyCopy();
		const days = `${WAR_LENGTH_DAYS} days`;
		expect(c.body).toContain(days);
		expect(c.bullets[0].badge).toBe(String(WAR_LENGTH_DAYS));
		expect(c.bullets[0].line).toContain(days);
	});
	it("needs a two-pig quorum and auto-matches", () => {
		const c = lobbyCopy();
		expect(c.bullets[1].badge).toBe("2+");
		expect(c.cta).toMatch(/auto-match/i);
	});
	it("the ribbon bullet is a glyph, not a number", () => {
		const b = lobbyCopy().bullets[2];
		expect(b.badgeGlyph).toBeTruthy();
		expect(b.badge).toBeUndefined();
	});
});

// ── rivalActivityLine — the standings-mini rival voice ───────────────────────

describe("rivalActivityLine", () => {
	it("reads nobody active yet at zero / null", () => {
		expect(rivalActivityLine(0)).toBe("nobody active yet");
		expect(rivalActivityLine(null)).toBe("nobody active yet");
	});
	it("counts pigs in the mud, singular vs plural", () => {
		expect(rivalActivityLine(1)).toBe("1 pig in the mud");
		expect(rivalActivityLine(3)).toBe("3 pigs in the mud");
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

	it("maps won=null onto an explicit draw (no winner)", () => {
		const w = applyWarOverride(
			makeWar(),
			{ status: "resolved", won: null },
			false,
			now
		);
		expect(w!.status).toBe("resolved");
		expect(w!.winnerCrew).toBeNull();
		expect(warOutcome(w!)).toBe("draw");
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

// ── Scoreboard transparency — who's behind the number, and is it real ────────

function member(
	user_id: string,
	username: string | null,
	slings: number
): WarSideMember {
	return { user_id, username, slings };
}

describe("participationState + participationNote", () => {
	it("a pig that has dug is active", () => {
		expect(participationState(member("u1", "Rosie", 3))).toBe("active");
	});
	it("a pig with zero mud is quiet", () => {
		expect(participationState(member("u2", "Pip", 0))).toBe("quiet");
	});
	it("the quiet note is gift-framed, never shaming", () => {
		expect(participationNote("quiet")).toBe("hasn't reached the bog yet");
		expect(participationNote("quiet")).not.toMatch(/lazy|fail|no|zero/i);
		expect(participationNote("active")).toBe("dug in");
	});
});

describe("memberBreakdown", () => {
	const members = [
		member("me", "Rosie", 9),
		member("boss", "Clover", 5),
		member("q", "Pip", 0),
		member("anon", null, 2),
	];

	it("maps each member to a row with points and participation", () => {
		const rows = memberBreakdown(members, "me", "boss");
		expect(rows).toHaveLength(4);
		expect(rows[0]).toMatchObject({
			userId: "me",
			name: "Rosie",
			points: 9,
			state: "active",
			isYou: true,
			isLeader: false,
		});
	});

	it("marks the leader and preserves the server's slings-desc order", () => {
		const rows = memberBreakdown(members, "me", "boss");
		expect(rows[1]).toMatchObject({ name: "Clover", isLeader: true });
		expect(rows.map((r) => r.points)).toEqual([9, 5, 0, 2]);
	});

	it("flags the quiet pig with the gift-framed note", () => {
		const rows = memberBreakdown(members);
		const quiet = rows.find((r) => r.userId === "q")!;
		expect(quiet.state).toBe("quiet");
		expect(quiet.note).toBe("hasn't reached the bog yet");
	});

	it("names a nameless pig 'a quiet pig' instead of leaving it blank", () => {
		const rows = memberBreakdown(members);
		expect(rows.find((r) => r.userId === "anon")!.name).toBe("a quiet pig");
	});

	it("no user id → no 'you' / 'leader' flags", () => {
		const rows = memberBreakdown(members);
		expect(rows.every((r) => !r.isYou && !r.isLeader)).toBe(true);
	});
});

describe("activeCount", () => {
	it("counts only pigs who have dug", () => {
		expect(
			activeCount([member("a", "A", 3), member("b", "B", 0), member("c", "C", 1)])
		).toBe(2);
	});
	it("is 0 for an all-quiet herd", () => {
		expect(activeCount([member("a", "A", 0)])).toBe(0);
	});
});

describe("theirBreakdown", () => {
	function them(perCapita: number, active: number | null, total = perCapita): WarSide {
		return {
			crew: { id: "them", name: "Trough Loyalists", is_bot: false },
			members: [member("x", "Secret", 5)], // war_side may carry rows; we NEVER expose them
			total,
			active,
			perCapita,
			quorumMet: true,
		};
	}

	it("a house war shows a LABELED synthetic pace, never fake pig names", () => {
		const b = theirBreakdown(makeWar({ isBotWar: true, them: them(24, null, 24) }));
		expect(b.kind).toBe("synthetic");
		if (b.kind === "synthetic") {
			expect(b.label).toBe(syntheticPaceLine());
			expect(b.total).toBe(24);
			expect(b.label).toContain(BOT_CREW_NAME);
			expect(b.label).toMatch(/no pigs behind it/i);
			expect(b.label).not.toContain("Secret");
		}
	});

	it("a real rival stays fogged — a pace and a count, no individuals", () => {
		const b = theirBreakdown(makeWar({ isBotWar: false, them: them(5, 3) }));
		expect(b.kind).toBe("hidden");
		if (b.kind === "hidden") {
			expect(b.activeCount).toBe(3);
			expect(b.perCapita).toBe(5);
			expect(b.note).toBe(rivalHiddenNote());
			expect(b.note).not.toContain("Secret");
		}
	});

	it("the double-blind never leaks an opponent member name", () => {
		const b = theirBreakdown(makeWar({ isBotWar: false, them: them(5, 3) }));
		expect(JSON.stringify(b)).not.toContain("Secret");
	});
});

describe("scoreboard transparency copy", () => {
	it("the synthetic pace names the house and denies pigs behind it", () => {
		expect(syntheticPaceLine()).toContain(BOT_CREW_NAME);
		expect(syntheticPaceLine()).toMatch(/steady pace/i);
		expect(syntheticPaceLine()).toMatch(/no pigs behind it/i);
	});
	it("the rival note frames the double-blind (pace, not pigs)", () => {
		expect(rivalHiddenNote()).toMatch(/hidden/i);
		expect(rivalHiddenNote()).toMatch(/pace/i);
	});
	it("the per-point legend says a point is one scoop of joy", () => {
		expect(pointMetaLine()).toMatch(/one scoop of joy/i);
		expect(pointMetaLine()).toMatch(/truffle/i);
	});
	it("the tap hint and links are plain and cozy", () => {
		expect(scoreboardTapHint()).toMatch(/tap/i);
		expect(scoringLinkLabel()).toBe("how the scoring works ›");
		expect(devDataTagLabel()).toBe("dev data");
	});
});

describe("scoringRules", () => {
	const rules = scoringRules();
	const all = rules.map((r) => `${r.title} ${r.line}`).join(" ");

	it("covers each mechanic the founder asked for", () => {
		expect(all).toMatch(/scoop/i);            // a point per scoop (slings ×1 / dig → mud)
		expect(all).toMatch(/truffle|goblin/i);   // both scoring gestures
		expect(all).toMatch(/day/i);              // daily caps
		expect(all).toMatch(/two pigs/i);         // quorum
		expect(all).toMatch(/per pig/i);          // per-pig averaging
		expect(all).toMatch(/rope/i);             // …into the rope
	});

	it("stays in the cozy voice — no engine jargon", () => {
		expect(all).not.toMatch(/slings|per-capita|percapita|quorum|notch/i);
	});

	it("defaults (S1 plain totals) to the one-scoop sentence, no Hold copy", () => {
		const plain = scoringRules().map((r) => `${r.title} ${r.line}`).join(" ");
		expect(plain).toMatch(/every scoop counts once/i);
		expect(plain).toMatch(/whoever scoops more joy pulls the rope/i);
		expect(plain).not.toMatch(/on the beat in the hold/i);
		expect(plain).not.toMatch(/goblin/i);
	});

	it("surfaces the Hold clause only for a legacy fronts war", () => {
		const fronts = scoringRules(true).map((r) => `${r.title} ${r.line}`).join(" ");
		expect(fronts).toMatch(/on the beat in the hold/i);
	});
});

// The Season Almanac — the verb tab strip's pure state (which tab opens first
// per hero surface, which cells wear the sun, the one value each prints) and
// each panel rendering its key rows from fixture data.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), navigate: jest.fn() } }));
jest.mock("expo-router/react-navigation", () => ({
	useFocusEffect: (effect: () => void | (() => void)) => {
		const R = require("react");
		R.useEffect(effect, [effect]);
	},
	useIsFocused: () => true,
}));
jest.mock("expo-haptics", () => ({
	selectionAsync: jest.fn().mockResolvedValue(undefined),
	notificationAsync: jest.fn().mockResolvedValue(undefined),
	NotificationFeedbackType: { Success: "success" },
}));
jest.mock("@sentry/react-native", () => ({
	captureException: jest.fn(),
	captureMessage: jest.fn(),
	addBreadcrumb: jest.fn(),
}));
jest.mock("@/hooks/useMotionPolicy", () => ({
	MOTION_DURATION: { feedback: 120, state: 220, modal: 300, celebration: 450, crossfade: 150 },
	useMotionPolicy: () => ({
		reduceMotion: true,
		allowDecorativeMotion: false,
		largeTransition: "crossfade",
		duration: (_standard: number, reduced = 150) => reduced,
	}),
}));
jest.mock("@/utils/rpc", () => ({ rpc: jest.fn(async () => null), rpcAction: jest.fn(async () => ({ ok: true })) }));
jest.mock("@/utils/supabase", () => ({
	supabase: { auth: { getSession: jest.fn(async () => ({ data: { session: null } })) } },
}));
jest.mock("@/utils/pushNotifications", () => ({
	getFeedingPushPreference: jest.fn(async () => false),
	setFeedingPushPreference: jest.fn(async () => "enabled"),
	ensurePushPermission: jest.fn(async () => true),
	getDevicePushPermission: jest.fn(async () => "granted"),
}));
jest.mock("@/hooks/useRosterHats", () => ({
	useRosterProfiles: () => new Map(),
}));
jest.mock("@/hooks/useCrew", () => ({
	useJoinableCrews: () => ({
		crews: [{ id: "c9", name: "The Trufflers", memberCount: 5, leaderName: "Pepper" }],
		loading: false,
		refresh: jest.fn(),
	}),
}));
jest.mock("@/components/FriendInvitePicker", () => ({ FriendInvitePicker: () => null }));
jest.mock("@/components/JoinableSounders", () => {
	const R = require("react");
	const { Text } = require("react-native");
	return {
		JoinableSounders: ({ crews }: { crews: { name: string }[] }) =>
			R.createElement(Text, null, crews.map((c) => c.name).join(", ")),
	};
});
jest.mock("@/components/mudwar/ReclaimSlam", () => {
	const R = require("react");
	return { ReclaimSlam: R.forwardRef(() => null) };
});
jest.mock("@/components/ui/PrestigeAvatar", () => ({ PrestigeAvatar: () => null }));
jest.mock("@/components/ui/PigPortrait", () => ({ PigPortrait: () => null }));

import {
	ALMANAC_TABS,
	almanacInitialTab,
	almanacTodo,
	almanacValues,
	barnRewardsAhead,
	countWord,
	ordinal,
	passLadderWindow,
	raceGapLine,
	seasonDay,
	xpToNextTier,
	type AlmanacFacts,
} from "@/components/season1/almanac/almanacState";
import { HERO_SURFACES, seasonHeroSurface, seasonPrimaryAction } from "@/utils/seasonHero";
import { VerbTabStrip } from "@/components/season1/almanac/VerbTabStrip";
import { FeedPanel } from "@/components/season1/almanac/FeedPanel";
import { HerdPanel, herdSentence } from "@/components/season1/almanac/HerdPanel";
import { RacePanel } from "@/components/season1/almanac/RacePanel";
import { PassPanel } from "@/components/season1/almanac/PassPanel";
import { REWARD_KIND_TONE } from "@/components/season1/almanac/LadderRow";
import { rewardKind } from "@/utils/rewardArt";
import { MONDAY_DRAW_TUNING, type MondayDrawState } from "@/utils/mondayDraw";
import type { HerdFeeding } from "@/components/season1/almanac/useHerdFeeding";
import type { RaceRun } from "@/components/season1/almanac/useRaceRun";
import type { FeedingCta } from "@/components/mudwar/useFeedingCta";
import type { UseCrew } from "@/hooks/useCrew";
import type { RaceStandings } from "@/utils/race";
import type { TierRow, TiersByNumber } from "@/utils/seasonPass";

// ── helpers ──────────────────────────────────────────────────────────────────

function textOf(tree: TestRenderer.ReactTestInstance): string {
	const out: string[] = [];
	function walk(n: TestRenderer.ReactTestInstance | string) {
		if (typeof n === "string") {
			out.push(n);
			return;
		}
		for (const c of n.children ?? []) walk(c);
	}
	walk(tree);
	return out.join("");
}

async function render(node: React.ReactElement) {
	let r!: TestRenderer.ReactTestRenderer;
	await act(async () => {
		r = TestRenderer.create(node);
	});
	return r;
}

const baseFacts: AlmanacFacts = {
	inCrew: true,
	phaseOpen: false,
	dugThisWindow: false,
	countdown: "2h 59m",
	dugCount: 4,
	herdSize: 6,
	raceRank: 3,
	raceRun: false,
	currentTier: 4,
	readyTierCount: 0,
};

function cta(over: Partial<FeedingCta> = {}): FeedingCta {
	return {
		dugThisWindow: false,
		noCrew: false,
		phaseOpen: false,
		countdown: "2h 59m",
		note: null,
		start: jest.fn(async () => {}),
		openPractice: jest.fn(),
		modal: null,
		...over,
	};
}

function herd(over: Partial<HerdFeeding> = {}): HerdFeeding {
	const members = [
		{ user_id: "u1", username: "Rosie", me: true, dug: true, layerLine: null, finds: 3 },
		{ user_id: "u2", username: "Pepper", me: false, dug: true, layerLine: "woke at the root", finds: 5 },
		{ user_id: "u3", username: "Bandit", me: false, dug: true, layerLine: null, finds: 1 },
		{ user_id: "u4", username: "Pickles", me: false, dug: true, layerLine: null, finds: 2 },
		{ user_id: "u5", username: "Copper", me: false, dug: false, layerLine: null, finds: 0 },
		{ user_id: "u6", username: "Biscuit", me: false, dug: false, layerLine: null, finds: 0 },
	];
	return {
		members,
		profiles: new Map(),
		dugCount: 4,
		meDug: true,
		loading: false,
		feeding: null,
		detail: null,
		...over,
	};
}

function crewHook(crewed = true): UseCrew {
	return {
		crew: {
			crew: crewed ? ({ id: "c1", name: "Muddy Snouts" } as never) : null,
			members: [],
			invitesIn: [],
			invitesOut: [],
			joinRequestsIn: [],
			joinRequestsOut: [],
			lifetime_finds: 212,
			milestones_claimed: [],
		},
		loading: false,
		refresh: jest.fn(async () => {}),
		create: jest.fn(async () => ({ ok: true, crew_id: "c1", name: "Muddy Snouts" })) as never,
		invite: jest.fn() as never,
		inviteWithRecruiting: jest.fn() as never,
		accept: jest.fn() as never,
		decline: jest.fn() as never,
		cancel: jest.fn() as never,
		requestJoin: jest.fn() as never,
		cancelRequest: jest.fn() as never,
		acceptRequest: jest.fn() as never,
		declineRequest: jest.fn() as never,
		leave: jest.fn() as never,
	};
}

const draw: MondayDrawState = {
	week: "20260914",
	eligible: true,
	drawn: false,
	amount: null,
	tier: null,
	mondaysSinceRare: 4,
	herdBottomHalf: false,
	nextRareOddsOneIn: 3,
	tuning: MONDAY_DRAW_TUNING,
};

const standings: RaceStandings = {
	cycle: { key: "20260914", starts_at: "2026-09-14T00:00:00Z", ends_at: "2026-09-21T00:00:00Z" },
	season: [],
	mineSeason: null,
	ranked: [
		{ rank: 1, crew_id: "a", name: "Bog Rats", avg: 7, diggers: 6, total_finds: 41, roster_size: 6 },
		{ rank: 2, crew_id: "b", name: "The Trufflers", avg: 6, diggers: 6, total_finds: 39, roster_size: 6 },
		{ rank: 3, crew_id: "c1", name: "Muddy Snouts", avg: 6, diggers: 6, total_finds: 37, roster_size: 6 },
		{ rank: 4, crew_id: "d", name: "Sty High", avg: 5, diggers: 6, total_finds: 30, roster_size: 6 },
		{ rank: 5, crew_id: "e", name: "Root Rustlers", avg: 4, diggers: 6, total_finds: 22, roster_size: 6 },
	],
	unranked: [],
	mine: { crew_id: "c1", rank: 3, avg: 6, diggers: 6, total_finds: 37 },
	last: null,
	prizes: {
		tickles: { first: 500, second: 300, third: 200, upper: 100, field: 50, participation: 25 },
		truffles: { first: 6, second: 5, third: 4, upper: 3, field: 2 },
	},
};

function raceRun(over: Partial<RaceRun> = {}): RaceRun {
	return {
		race: { state: standings, loading: false, featureDark: false, refresh: jest.fn(async () => {}) },
		run: null,
		finals: null,
		rank: 3,
		dismissRun: jest.fn(),
		...over,
	};
}

const tierRow = (tier: number, reward_type: string, display_label: string, extra: Partial<TierRow> = {}): TierRow => ({
	tier,
	track: "free",
	reward_type,
	reward_value: null,
	display_label,
	...extra,
});
const tiers: TiersByNumber = {
	1: { free: tierRow(1, "tickles", "25 tickles") },
	2: { free: tierRow(2, "tickles", "25 tickles") },
	3: { free: tierRow(3, "title", "Mud Rookie") },
	4: { free: tierRow(4, "mystery_box", "Mystery Hat Box") },
	5: { free: tierRow(5, "habitat", "Firefly Lantern", { reward_value: { hat_id: "firefly_lantern" } as never }) },
	6: { free: tierRow(6, "tickles", "50 tickles") },
	7: { free: tierRow(7, "habitat", "Patchwork Rug") },
	9: { free: tierRow(9, "habitat", "Hay Bale") },
};

// ── the strip's state ────────────────────────────────────────────────────────

describe("almanac state", () => {
	test("the one-hero rule picks the tab that opens first", () => {
		expect(almanacInitialTab("feeding")).toBe("feed");
		expect(almanacInitialTab("claim")).toBe("pass");
		expect(almanacInitialTab("sounder")).toBe("herd");
		expect(almanacInitialTab("hunger")).toBe("feed");
		// Every hero surface maps to a real tab.
		for (const h of HERO_SURFACES) expect(ALMANAC_TABS).toContain(almanacInitialTab(h));
		// …and through the real derivation: an open, untaken dig opens Feed; a
		// ready claim opens Pass; no herd opens Herd; nothing to do opens Feed.
		const via = (o: Parameters<typeof seasonPrimaryAction>[0]) =>
			almanacInitialTab(seasonHeroSurface(seasonPrimaryAction(o)));
		expect(via({ digAvailable: true, readyTierCount: 2, inCrew: true })).toBe("feed");
		expect(via({ digAvailable: false, readyTierCount: 2, inCrew: true })).toBe("pass");
		expect(via({ digAvailable: false, readyTierCount: 0, inCrew: false })).toBe("herd");
		expect(via({ digAvailable: false, readyTierCount: 0, inCrew: true })).toBe("feed");
	});

	test("gold means act-now: Feed while open + untaken, Pass while a claim waits, Race until the purse is drawn", () => {
		expect(almanacTodo(baseFacts)).toEqual({ feed: false, herd: false, race: false, pass: false });
		expect(almanacTodo({ ...baseFacts, phaseOpen: true }).feed).toBe(true);
		expect(almanacTodo({ ...baseFacts, phaseOpen: true, dugThisWindow: true }).feed).toBe(false);
		expect(almanacTodo({ ...baseFacts, phaseOpen: true, inCrew: false }).feed).toBe(false);
		expect(almanacTodo({ ...baseFacts, readyTierCount: 2 }).pass).toBe(true);
		expect(almanacTodo({ ...baseFacts, mondayDraw: { eligible: true, drawn: false } }).race).toBe(true);
		expect(almanacTodo({ ...baseFacts, mondayDraw: { eligible: true, drawn: true } }).race).toBe(false);
		expect(almanacTodo({ ...baseFacts, mondayDraw: { eligible: false, drawn: false } }).race).toBe(false);
		// Two golds can coexist — the strip is a row of doors, not the one hero.
		const both = almanacTodo({ ...baseFacts, phaseOpen: true, readyTierCount: 2 });
		expect(both.feed && both.pass).toBe(true);
	});

	test("each cell prints one nowrap value", () => {
		expect(almanacValues(baseFacts)).toEqual({ feed: "2h 59m", herd: "4 of 6", race: "3rd", pass: "Tier 4" });
		// Open: still the countdown (now closes-in) — the sun says "dig", not a verb.
		expect(almanacValues({ ...baseFacts, phaseOpen: true, countdown: "5h 12m" }).feed).toBe("5h 12m");
		expect(almanacValues({ ...baseFacts, phaseOpen: true, dugThisWindow: true }).feed).toBe("Dug");
		expect(almanacValues({ ...baseFacts, readyTierCount: 2 }).pass).toBe("2 ready");
		expect(almanacValues({ ...baseFacts, raceRun: true }).race).toBe("Run");
		expect(almanacValues({ ...baseFacts, raceRank: null }).race).toBe("—");
		const herdless = almanacValues({ ...baseFacts, inCrew: false, phaseOpen: true });
		expect(herdless).toEqual({ feed: "2h 59m", herd: "Join", race: "—", pass: "Tier 4" });
	});

	test("ordinals and count words", () => {
		expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(ordinal)).toEqual([
			"1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st",
		]);
		expect(countWord(2)).toBe("two");
		expect(countWord(12)).toBe("12");
	});

	test("day N of 60 clamps into the season", () => {
		const s = "2026-08-13T00:00:00Z";
		const e = "2026-10-12T00:00:00Z";
		expect(seasonDay(s, e, Date.parse("2026-09-15T12:00:00Z"))).toEqual({ day: 34, total: 60 });
		expect(seasonDay(s, e, Date.parse("2026-08-01T12:00:00Z"))).toEqual({ day: 1, total: 60 });
		expect(seasonDay(s, e, Date.parse("2026-12-01T12:00:00Z"))).toEqual({ day: 60, total: 60 });
		expect(seasonDay("bad", e, 0)).toEqual({ day: 1, total: 1 });
	});

	test("the ladder window: ready rungs, then what's next, then the last claimed to fill", () => {
		const claimed = new Set(["1:free", "2:free", "3:free"]);
		// Tier 4 reached, 4 + 5 ready, 6 next: 36 XP to tier 6 at 100/tier with 464 xp.
		const w = passLadderWindow(tiers, "free", claimed, 5, 464, 100);
		expect(w.map((r) => [r.tier, r.state, r.xpAway])).toEqual([
			[4, "ready", 0],
			[5, "ready", 0],
			[6, "locked", 36],
		]);
		expect(xpToNextTier(464, 100, 5, 26)).toBe(36);
		expect(xpToNextTier(2600, 100, 26, 26)).toBe(0);
		// Nothing ready: the last claimed rung leads, then the next two.
		const quiet = passLadderWindow(tiers, "free", new Set(["1:free", "2:free", "3:free", "4:free"]), 4, 350, 100);
		expect(quiet.map((r) => [r.tier, r.state])).toEqual([
			[4, "claimed"],
			[5, "locked"],
			[6, "locked"],
		]);
		expect(barnRewardsAhead(tiers, "free", new Set(["5:free"]))).toBe(2);
	});

	test("the race gap line counts in words and never shames", () => {
		expect(raceGapLine(standings.ranked, "c1")).toBe("two behind");
		expect(raceGapLine(standings.ranked, "a")).toBe("out in front");
		expect(raceGapLine(standings.ranked, "zzz")).toBeNull();
		expect(raceGapLine(standings.ranked, null)).toBeNull();
	});

	test("every reward kind the resolver names has a pill tone", () => {
		for (const type of ["habitat", "hat", "mystery_box", "tickles", "snouts", "title", "golden_truffle", "pig_skin"]) {
			const kind = rewardKind({ reward_type: type, reward_value: null });
			expect(REWARD_KIND_TONE[kind]).toBeDefined();
		}
		expect(REWARD_KIND_TONE.barn).toBe("sage");
	});

	test("the herd sentence counts, never names", () => {
		expect(herdSentence(4, 6, false, 6)).toBe("Four snouts dug last time — six is a full herd.");
		expect(herdSentence(6, 6, true, 6)).toBe("Every snout dug so far — a full herd.");
		expect(herdSentence(6, 6, true, 8)).toBe("Every snout dug so far — eight is a full herd.");
		expect(herdSentence(0, 6, false, 6)).toBe("The patch is quiet last time — six is a full herd.");
		expect(herdSentence(1, 6, true, 6)).toBe("One snout dug so far — six is a full herd.");
	});
});

// ── the strip ────────────────────────────────────────────────────────────────

describe("VerbTabStrip", () => {
	test("renders four cells with their values and marks the selected one", async () => {
		const onSelect = jest.fn();
		const r = await render(
			<VerbTabStrip
				values={almanacValues({ ...baseFacts, readyTierCount: 2 })}
				todo={almanacTodo({ ...baseFacts, readyTierCount: 2 })}
				selected="feed"
				onSelect={onSelect}
				passProgress={0.64}
			/>
		);
		const text = textOf(r.root);
		for (const v of ["Feed", "2h 59m", "Herd", "4 of 6", "Race", "3rd", "Pass", "2 ready"]) {
			expect(text).toContain(v);
		}
		const tabs = r.root.findAll(
			(n) => typeof n.type === "string" && n.props.accessibilityRole === "tab"
		);
		expect(tabs).toHaveLength(4);
		expect(tabs[0].props.accessibilityState).toEqual({ selected: true, disabled: false });
		expect(tabs[3].props.accessibilityState).toEqual({ selected: false, disabled: false });
		// The press lives on the Sticker (a Pressable); the host View reads its state.
		await act(async () => {
			r.root.findByProps({ testID: "almanac-tab-pass" }).props.onPress();
		});
		expect(onSelect).toHaveBeenCalledWith("pass");
		act(() => r.unmount());
	});
});

// ── the panels ───────────────────────────────────────────────────────────────

describe("FeedPanel", () => {
	test("guarded: opens-in title, the meter, the remind CTA, last feeding's herd", async () => {
		const r = await render(
			<FeedPanel
				cta={cta()}
				stageIndex={3}
				seasonDays={60}
				herd={herd({ dugCount: 4, meDug: false })}
				inCrew
				onOinkHerd={jest.fn()}
				onGoHerd={jest.fn()}
			/>
		);
		const text = textOf(r.root);
		expect(text).toContain("Opens in 2h 59m");
		expect(text).toContain("Remind me when it opens");
		expect(text).toContain("Last feeding");
		expect(text).toContain("4 of 6 dug");
		expect(text).toContain("Every find starves him a little — the herd wants him Famished by day 60.");
		expect(text).toContain("Peckish");
		expect(text).toContain("Pepper woke at the root — visit their Barn.");
		act(() => r.unmount());
	});

	test("open: the patch is open + the dig CTA calls the shared start", async () => {
		const c = cta({ phaseOpen: true, countdown: "5h 12m" });
		const r = await render(
			<FeedPanel
				cta={c}
				stageIndex={3}
				seasonDays={60}
				herd={herd({ meDug: false, dugCount: 2 })}
				inCrew
				onOinkHerd={jest.fn()}
				onGoHerd={jest.fn()}
			/>
		);
		const text = textOf(r.root);
		expect(text).toContain("The patch is open");
		expect(text).toContain("This feeding");
		const dig = r.root.find((n) => n.props.accessibilityLabel === "Dig the Truffle Patch");
		await act(async () => {
			dig.props.onPress();
		});
		expect(c.start).toHaveBeenCalled();
		act(() => r.unmount());
	});

	test("dug: Rosie dug + the oink CTA names the seats still open", async () => {
		const onOink = jest.fn();
		const r = await render(
			<FeedPanel
				cta={cta({ phaseOpen: true, dugThisWindow: true, countdown: "5h 12m" })}
				stageIndex={3}
				seasonDays={60}
				herd={herd({ dugCount: 3 })}
				inCrew
				onOinkHerd={onOink}
				onGoHerd={jest.fn()}
			/>
		);
		expect(textOf(r.root)).toContain("Rosie dug.");
		expect(textOf(r.root)).toContain("Oink at the herd — 3 seats still open");
		act(() => r.unmount());
	});
});

describe("HerdPanel", () => {
	test("crewed: the herd's name, one row per snout, one gold oink", async () => {
		const r = await render(
			<HerdPanel crewHook={crewHook()} cta={cta()} herd={herd()} onOinkHerd={jest.fn()} onOpenMember={jest.fn()} />
		);
		const text = textOf(r.root);
		expect(text).toContain("Muddy Snouts");
		expect(text).toContain("6 snouts · 212 finds together");
		expect(text).toContain("Four snouts dug last time — eight is a full herd.");
		for (const name of ["Rosie · you", "Pepper", "Bandit", "Pickles", "Copper", "Biscuit"]) {
			expect(text).toContain(name);
		}
		expect(text).toContain("dug 3 finds");
		expect(text).toContain("dug · woke at the root · visit their Barn");
		expect(text).toContain("next feeding in 2h 59m");
		expect(text).toContain("Oink at the herd — next feeding in 2h 59m");
		// No per-pig nudge anywhere.
		expect(text.toLowerCase()).not.toContain("nudge");
		act(() => r.unmount());
	});

	test("herdless: Rosie digs with a herd, start one, and the open herds", async () => {
		const r = await render(
			<HerdPanel crewHook={crewHook(false)} cta={cta()} herd={herd({ members: [], dugCount: 0 })} onOinkHerd={jest.fn()} />
		);
		const text = textOf(r.root);
		expect(text).toContain("Rosie digs with a herd.");
		expect(text).toContain("Start one with a friend");
		expect(text).toContain("Herds with a seat open");
		expect(text).toContain("The Trufflers");
		act(() => r.unmount());
	});

	test("mid-onboarding: frames the step card the owner hands in", async () => {
		const { Text } = require("react-native");
		const r = await render(
			<HerdPanel
				crewHook={crewHook(false)}
				cta={cta()}
				herd={herd({ members: [], dugCount: 0 })}
				onOinkHerd={jest.fn()}
				stepCard={<Text>the step card</Text>}
			/>
		);
		expect(textOf(r.root)).toContain("the step card");
		expect(textOf(r.root)).not.toContain("Start one with a friend");
		act(() => r.unmount());
	});
});

describe("RacePanel", () => {
	test("live: top four with my herd pinned, the spoils, the gap CTA — and no draw row until it's wired", async () => {
		const r = await render(<RacePanel raceRun={raceRun()} myCrewId="c1" onOinkHerd={jest.fn()} onGoHerd={jest.fn()} />);
		const text = textOf(r.root);
		expect(text).toContain("The race");
		expect(text).toContain("all 5 herds ›");
		for (const n of ["Bog Rats", "The Trufflers", "Muddy Snouts · you", "Sty High"]) expect(text).toContain(n);
		expect(text).not.toContain("Root Rustlers");
		expect(text).toContain("Barn Bunting");
		expect(text).toContain("Gold Bunting");
		expect(text).toContain("Oink at the herd — two behind");
		expect(r.root.findAllByProps({ testID: "race-monday-draw-row" })).toHaveLength(0);
		act(() => r.unmount());
	});

	test("the spoils take the server's furnishing ids when it names them", async () => {
		const named: RaceStandings = {
			...standings,
			prizes: { ...standings.prizes, furnishings: { allWhoDug: "firefly_lantern", first: "hay_bale" } },
		};
		const r = await render(
			<RacePanel
				raceRun={raceRun({ race: { state: named, loading: false, featureDark: false, refresh: jest.fn(async () => {}) } })}
				myCrewId="c1"
				onOinkHerd={jest.fn()}
				onGoHerd={jest.fn()}
			/>
		);
		const text = textOf(r.root);
		expect(text).toContain("Firefly Lantern");
		expect(text).toContain("Hay Bale");
		expect(text).not.toContain("Barn Bunting");
		act(() => r.unmount());
	});

	test("the Monday draw row renders only when the draw is threaded", async () => {
		const open = jest.fn();
		const r = await render(
			<RacePanel
				raceRun={raceRun()}
				myCrewId="c1"
				onOinkHerd={jest.fn()}
				onGoHerd={jest.fn()}
				mondayDraw={draw}
				onOpenMondayDraw={open}
			/>
		);
		const text = textOf(r.root);
		expect(text).toContain("Your Monday tickle draw");
		expect(text).toContain("four Mondays since a rare · 1 in 3 for rare or better");
		act(() => r.unmount());
	});

	test("a drawn purse's row is the receipt — the amount pocketed, never a purse still waiting", async () => {
		const drawn: MondayDrawState = { ...draw, drawn: true, amount: 60, tier: "good", mondaysSinceRare: 1, nextRareOddsOneIn: 8 };
		const r = await render(
			<RacePanel
				raceRun={raceRun()}
				myCrewId="c1"
				onOinkHerd={jest.fn()}
				onGoHerd={jest.fn()}
				mondayDraw={drawn}
				onOpenMondayDraw={jest.fn()}
			/>
		);
		const text = textOf(r.root);
		expect(text).toContain("Your Monday purse, drawn");
		expect(text).toContain("60 tickles pocketed · 1 in 8 for rare or better next Monday");
		expect(text).not.toContain("since a rare");
		expect(r.root.findAllByProps({ testID: "race-monday-draw-cta" })).toHaveLength(0);
		act(() => r.unmount());
	});

	test("Monday: the race is run, last week's finals, the spoils ladder and the purse CTA", async () => {
		const open = jest.fn();
		const r = await render(
			<RacePanel
				raceRun={raceRun({
					run: { cycle_key: "20260907", rank: 2, of: 5, truffles_paid: 5, tickles_paid: 300, cosmetic_hat_id: null },
				})}
				myCrewId="c1"
				onOinkHerd={jest.fn()}
				onGoHerd={jest.fn()}
				mondayDraw={draw}
				onOpenMondayDraw={open}
			/>
		);
		const text = textOf(r.root);
		expect(text).toContain("The race is run");
		expect(text).toContain("last week's finals");
		expect(text).toContain("you took 2nd of 5");
		expect(text).toContain("Barn Bunting · in your Barn");
		expect(text).toContain("Gold Bunting · Bog Rats' this week");
		expect(text).toContain("Draw your Monday purse");
		// The spoils row is a door to the Barn, never a claim.
		expect(text).not.toContain("Claim");
		await act(async () => {
			r.root.findByProps({ testID: "race-spoils-door" }).props.onPress();
		});
		expect(require("expo-router").router.push).toHaveBeenCalledWith("/barn-interior");
		const drawCta = r.root.findByProps({ testID: "race-monday-draw-cta" });
		await act(async () => {
			drawCta.props.onPress();
		});
		expect(open).toHaveBeenCalled();
		act(() => r.unmount());
	});

	test("herdless: a door to the Herd panel", async () => {
		const go = jest.fn();
		const r = await render(<RacePanel raceRun={raceRun()} myCrewId={null} onOinkHerd={jest.fn()} onGoHerd={go} />);
		expect(textOf(r.root)).toContain("Rosie races with a herd.");
		act(() => r.unmount());
	});
});

describe("PassPanel", () => {
	const quests = [
		{ code: "lucky_hog", slot_code: "lucky_hog", rerolled: false, name: "Lucky Hog", description: "dig 3 feedings", goal: 3, progress: 3, reward_snouts: 100, claimed: false },
		{ code: "well_wished", slot_code: "well_wished", rerolled: false, name: "Well-Wished", description: "bless 3 friends", goal: 3, progress: 1, reward_snouts: 100, claimed: false },
	];

	test("three rungs with pills, the XP-to-next line, the track door and this week's quests", async () => {
		const onClaim = jest.fn();
		const onClaimHabitat = jest.fn();
		const onClaimQuest = jest.fn();
		const r = await render(
			<PassPanel
				xp={464}
				xpPerTier={100}
				currentTier={5}
				totalTiers={26}
				tiersByNumber={tiers}
				claimedSet={new Set(["1:free", "2:free", "3:free"])}
				track="free"
				busy={false}
				onClaim={onClaim}
				onClaimHabitat={onClaimHabitat}
				onOpenTrack={jest.fn()}
				quests={quests}
				onClaimQuest={onClaimQuest}
			/>
		);
		const text = textOf(r.root);
		expect(text).toContain("The ladder");
		expect(text).toContain("36 XP to tier 6");
		expect(text).toContain("TIER 4");
		expect(text).toContain("Mystery Hat Box");
		expect(text).toContain("mystery");
		expect(text).toContain("TIER 5");
		expect(text).toContain("Firefly Lantern");
		expect(text).toContain("barn");
		expect(text).toContain("TIER 6");
		expect(text).toContain("50 tickles");
		expect(text).toContain("36 XP away");
		expect(text).toContain("See all 26 tiers · 3 more for the Barn");
		expect(text).toContain("This week's quests");
		expect(text).toContain("Lucky Hog");
		expect(text).toContain("Claim 100");
		expect(text).toContain("Well-Wished");
		expect(text).toContain("1 of 3");

		// A wearable rung claims through the ordinary claim; a Barn rung through
		// the owner's furnishing claim.
		await act(async () => {
			r.root.findByProps({ testID: "ladder-claim-4" }).props.onPress();
		});
		expect(onClaim).toHaveBeenCalledWith(4, "free");
		await act(async () => {
			r.root.findByProps({ testID: "ladder-claim-5" }).props.onPress();
		});
		expect(onClaimHabitat).toHaveBeenCalledWith(5);
		expect(onClaim).toHaveBeenCalledTimes(1);
		await act(async () => {
			r.root.findByProps({ testID: "quest-claim-lucky_hog" }).props.onPress();
		});
		expect(onClaimQuest).toHaveBeenCalledWith("lucky_hog");
		act(() => r.unmount());
	});

	test("without a furnishing claim sheet, a Barn rung falls back to the ordinary claim", async () => {
		const onClaim = jest.fn();
		const r = await render(
			<PassPanel
				xp={464}
				xpPerTier={100}
				currentTier={5}
				totalTiers={26}
				tiersByNumber={tiers}
				claimedSet={new Set(["1:free", "2:free", "3:free", "4:free"])}
				track="free"
				busy={false}
				onClaim={onClaim}
				onOpenTrack={jest.fn()}
				quests={null}
				onClaimQuest={jest.fn()}
			/>
		);
		await act(async () => {
			r.root.findByProps({ testID: "ladder-claim-5" }).props.onPress();
		});
		expect(onClaim).toHaveBeenCalledWith(5, "free");
		expect(textOf(r.root)).not.toContain("This week's quests");
		act(() => r.unmount());
	});
});

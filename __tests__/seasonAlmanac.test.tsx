// The Season Almanac — the verb tab strip's pure state (which tab opens first
// per hero surface, which cells wear the sun, the one value each prints) and
// each panel rendering its key rows from fixture data.
//
// Rewritten 2026-09-21 with the page (docs/design/2026-09-21-season-page-rewrite.md
// §1): four cells became three — Feed · Draw · Pass — and the Herd and Race
// panels left with the herd race. The Draw cell's own copy is pinned by
// __tests__/drawPanel.test.tsx, next to the panel that prints it.

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
jest.mock("@/components/mudwar/ReclaimSlam", () => {
	const R = require("react");
	return { ReclaimSlam: R.forwardRef(() => null) };
});
jest.mock("@/components/ui/PrestigeAvatar", () => ({ PrestigeAvatar: () => null }));
jest.mock("@/components/ui/PigPortrait", () => ({ PigPortrait: () => null }));

import {
	ALMANAC_TABS,
	ALMANAC_TAB_LABEL,
	almanacInitialTab,
	almanacTodo,
	almanacValues,
	barnRewardsAhead,
	passLadderWindow,
	seasonDay,
	xpToNextTier,
	type AlmanacFacts,
} from "@/components/season1/almanac/almanacState";
import { HERO_SURFACES, seasonHeroSurface, seasonPrimaryAction } from "@/utils/seasonHero";
import { VerbTabStrip } from "@/components/season1/almanac/VerbTabStrip";
import { FeedPanel } from "@/components/season1/almanac/FeedPanel";
import { PassPanel } from "@/components/season1/almanac/PassPanel";
import { REWARD_KIND_TONE } from "@/components/season1/almanac/LadderRow";
import { rewardKind } from "@/utils/rewardArt";
import { MONDAY_DRAW_TUNING, type MondayDrawState } from "@/utils/mondayDraw";
import type { FeedingCta } from "@/components/mudwar/useFeedingCta";
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

function draw(over: Partial<MondayDrawState> = {}): MondayDrawState {
	return {
		week: "20260914",
		eligible: false,
		drawn: false,
		amount: null,
		tier: null,
		balls: 0,
		cap: 21,
		rolls: null,
		purseOddsOneIn: null,
		runningWeek: "20260921",
		runningBalls: 3,
		runningCap: 21,
		runningOddsOneIn: 3,
		nextTurnAt: null,
		tuning: MONDAY_DRAW_TUNING,
		...over,
	};
}

const baseFacts: AlmanacFacts = {
	phaseOpen: false,
	dugThisWindow: false,
	countdown: "2h 59m",
	draw: draw(),
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
	test("the strip is three verbs and nothing else", () => {
		expect(ALMANAC_TABS).toEqual(["feed", "draw", "pass"]);
		expect(ALMANAC_TABS.map((t) => ALMANAC_TAB_LABEL[t])).toEqual(["Feed", "Draw", "Pass"]);
	});

	test("the one-hero rule picks the tab that opens first", () => {
		expect(almanacInitialTab("feeding")).toBe("feed");
		expect(almanacInitialTab("claim")).toBe("pass");
		expect(almanacInitialTab("draw")).toBe("draw");
		expect(almanacInitialTab("hunger")).toBe("feed");
		// Every hero surface maps to a real tab.
		for (const h of HERO_SURFACES) expect(ALMANAC_TABS).toContain(almanacInitialTab(h));
		// …and through the real derivation: an open, untaken dig opens Feed; a
		// ready claim opens Pass; an undrawn purse opens Draw; nothing to do
		// opens Feed.
		const via = (o: Parameters<typeof seasonPrimaryAction>[0]) =>
			almanacInitialTab(seasonHeroSurface(seasonPrimaryAction(o)));
		expect(via({ digAvailable: true, readyTierCount: 2, drawReady: true })).toBe("feed");
		expect(via({ digAvailable: false, readyTierCount: 2, drawReady: true })).toBe("pass");
		expect(via({ digAvailable: false, readyTierCount: 0, drawReady: true })).toBe("draw");
		expect(via({ digAvailable: false, readyTierCount: 0, drawReady: false })).toBe("feed");
	});

	test("gold means act-now: Feed while open + untaken, Draw until the purse is drawn, Pass while a claim waits", () => {
		expect(almanacTodo(baseFacts)).toEqual({ feed: false, draw: false, pass: false });
		expect(almanacTodo({ ...baseFacts, phaseOpen: true }).feed).toBe(true);
		expect(almanacTodo({ ...baseFacts, phaseOpen: true, dugThisWindow: true }).feed).toBe(false);
		expect(almanacTodo({ ...baseFacts, readyTierCount: 2 }).pass).toBe(true);
		expect(almanacTodo({ ...baseFacts, draw: draw({ eligible: true, drawn: false }) }).draw).toBe(true);
		expect(almanacTodo({ ...baseFacts, draw: draw({ eligible: true, drawn: true }) }).draw).toBe(false);
		expect(almanacTodo({ ...baseFacts, draw: draw({ eligible: false }) }).draw).toBe(false);
		// Nothing read yet is never gold.
		expect(almanacTodo({ ...baseFacts, draw: null }).draw).toBe(false);
		// Two golds can coexist — the strip is a row of doors, not the one hero.
		const both = almanacTodo({ ...baseFacts, phaseOpen: true, readyTierCount: 2 });
		expect(both.feed && both.pass).toBe(true);
	});

	test("each cell prints one nowrap value", () => {
		expect(almanacValues(baseFacts)).toEqual({ feed: "2h 59m", draw: "3 balls", pass: "Tier 4" });
		// Open: still the countdown (now closes-in) — the sun says "dig", not a verb.
		expect(almanacValues({ ...baseFacts, phaseOpen: true, countdown: "5h 12m" }).feed).toBe("5h 12m");
		expect(almanacValues({ ...baseFacts, phaseOpen: true, dugThisWindow: true }).feed).toBe("Dug");
		expect(almanacValues({ ...baseFacts, readyTierCount: 2 }).pass).toBe("2 ready");
		// The Draw cell: a waiting purse, a pocketed one, this week's own count.
		expect(almanacValues({ ...baseFacts, draw: draw({ eligible: true }) }).draw).toBe("Ready");
		expect(
			almanacValues({ ...baseFacts, draw: draw({ eligible: true, drawn: true, amount: 60 }) }).draw
		).toBe("Drawn · 60");
		expect(almanacValues({ ...baseFacts, draw: draw({ runningBalls: 1 }) }).draw).toBe("1 ball");
		expect(almanacValues({ ...baseFacts, draw: null }).draw).toBe("—");
	});

	test("nothing on the strip names another pig, a herd or a standing", () => {
		const printed = Object.values(almanacValues({ ...baseFacts, draw: draw({ eligible: true }) }))
			.concat(ALMANAC_TABS.map((t) => ALMANAC_TAB_LABEL[t]))
			.join(" ")
			.toLowerCase();
		for (const word of ["herd", "sounder", "race", "rank", "1st", "of 6"]) {
			expect(printed).not.toContain(word);
		}
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

	test("every reward kind the resolver names has a pill tone", () => {
		for (const type of ["habitat", "hat", "mystery_box", "tickles", "snouts", "title", "golden_truffle", "pig_skin"]) {
			const kind = rewardKind({ reward_type: type, reward_value: null });
			expect(REWARD_KIND_TONE[kind]).toBeDefined();
		}
		expect(REWARD_KIND_TONE.barn).toBe("sage");
	});
});

// ── the strip ────────────────────────────────────────────────────────────────

describe("VerbTabStrip", () => {
	test("renders three cells with their values and marks the selected one", async () => {
		const onSelect = jest.fn();
		const facts = { ...baseFacts, readyTierCount: 2 };
		const r = await render(
			<VerbTabStrip
				values={almanacValues(facts)}
				todo={almanacTodo(facts)}
				selected="feed"
				onSelect={onSelect}
				passProgress={0.64}
			/>
		);
		const text = textOf(r.root);
		for (const v of ["Feed", "2h 59m", "Draw", "3 balls", "Pass", "2 ready"]) {
			expect(text).toContain(v);
		}
		expect(text).not.toContain("Herd");
		expect(text).not.toContain("Race");
		const tabs = r.root.findAll(
			(n) => typeof n.type === "string" && n.props.accessibilityRole === "tab"
		);
		expect(tabs).toHaveLength(3);
		expect(tabs[0].props.accessibilityState).toEqual({ selected: true, disabled: false });
		expect(tabs[2].props.accessibilityState).toEqual({ selected: false, disabled: false });
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
	test("guarded: opens-in title, the meter, the remind CTA, this week's balls", async () => {
		const r = await render(
			<FeedPanel cta={cta()} stageIndex={3} seasonDays={60} draw={draw()} />
		);
		const text = textOf(r.root);
		expect(text).toContain("Opens in 2h 59m");
		expect(text).toContain("Remind me when it opens");
		expect(text).toContain("Every find starves him a little — the herd wants him Famished by day 60.");
		expect(text).toContain("Peckish");
		// The ball counter, without the dig-now promise: the patch is shut.
		expect(text).toContain("3 balls this week");
		expect(text).not.toContain("+1 if you dig now");
		// The this-feeding herd row left with the race.
		expect(text).not.toContain("Last feeding");
		expect(text).not.toContain("Oink at the herd");
		act(() => r.unmount());
	});

	test("open: the patch is open, the dig CTA calls the shared start, and the ball promises a +1", async () => {
		const c = cta({ phaseOpen: true, countdown: "5h 12m" });
		const r = await render(
			<FeedPanel cta={c} stageIndex={3} seasonDays={60} draw={draw()} />
		);
		const text = textOf(r.root);
		expect(text).toContain("The patch is open");
		expect(text).toContain("3 balls this week · +1 if you dig now");
		const dig = r.root.find((n) => n.props.accessibilityLabel === "Dig the Truffle Patch");
		await act(async () => {
			dig.props.onPress();
		});
		expect(c.start).toHaveBeenCalled();
		act(() => r.unmount());
	});

	test("dug: Rosie dug, and the +1 promise is spent", async () => {
		const r = await render(
			<FeedPanel
				cta={cta({ phaseOpen: true, dugThisWindow: true, countdown: "5h 12m" })}
				stageIndex={3}
				seasonDays={60}
				draw={draw({ runningBalls: 4 })}
			/>
		);
		const text = textOf(r.root);
		expect(text).toContain("Rosie dug.");
		expect(text).toContain("4 balls this week");
		expect(text).not.toContain("+1 if you dig now");
		act(() => r.unmount());
	});

	test("dug with the patch already shut: the kicker names the NEXT feeding, and so does the reminder", async () => {
		const r = await render(
			<FeedPanel
				cta={cta({ phaseOpen: false, dugThisWindow: true, countdown: "3h 5m" })}
				stageIndex={3}
				seasonDays={60}
				draw={draw()}
			/>
		);
		const text = textOf(r.root);
		expect(text).toContain("next feeding in 3h 5m");
		expect(text).toContain("Rosie dug.");
		// The patch is shut, so the reminder is for the patch opening.
		expect(text).toContain("Remind me when it opens");
		act(() => r.unmount());
	});

	test("dug while the patch is still open: the reminder names the next feeding, never 'when it opens'", async () => {
		const r = await render(
			<FeedPanel
				cta={cta({ phaseOpen: true, dugThisWindow: true, countdown: "1h 2m" })}
				stageIndex={3}
				seasonDays={60}
				draw={draw()}
			/>
		);
		const text = textOf(r.root);
		expect(text).toContain("feeding open · 1h 2m left");
		expect(text).toContain("Remind me next feeding");
		expect(text).not.toContain("Remind me when it opens");
		act(() => r.unmount());
	});

	test("before the drum answers, the panel simply omits the counter", async () => {
		const r = await render(
			<FeedPanel cta={cta()} stageIndex={3} seasonDays={60} draw={null} />
		);
		expect(r.root.findAllByProps({ testID: "feed-ball-counter" })).toHaveLength(0);
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

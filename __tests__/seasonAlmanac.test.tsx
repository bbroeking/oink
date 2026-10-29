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
import { TAB_LIST_ROLE, TAB_ROLE } from "@/components/ui/tabRoles";
import { FeedPanel } from "@/components/season1/almanac/FeedPanel";
import { PassPanel } from "@/components/season1/almanac/PassPanel";
import { REWARD_KIND_TONE } from "@/components/season1/almanac/LadderRow";
import { rewardKind } from "@/utils/rewardArt";
import { MONDAY_DRAW_TUNING, type MondayDrawState } from "@/utils/mondayDraw";
import type { FeedingCta } from "@/components/mudwar/useFeedingCta";
import type { TierRow, TiersByNumber } from "@/utils/seasonPass";
import { WHIMSY } from "@/constants/theme";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SeasonGuideModal } from "@/components/season1/SeasonGuideModal";
import { SeasonInfoModal } from "@/components/season1/SeasonInfoModal";
import { SeasonStory } from "@/components/season1/SeasonStory";
import { seasonTheme } from "@/utils/seasonTheme";

// ── helpers ──────────────────────────────────────────────────────────────────

const GUIDE_METRICS = {
	frame: { x: 0, y: 0, width: 402, height: 874 },
	insets: { top: 62, left: 0, right: 0, bottom: 34 },
};

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

	test("act-now (the badge): Feed while open + untaken, Draw until the purse is drawn, Pass while a claim waits", () => {
		expect(almanacTodo(baseFacts)).toEqual({ feed: false, draw: false, pass: false });
		expect(almanacTodo({ ...baseFacts, phaseOpen: true }).feed).toBe(true);
		expect(almanacTodo({ ...baseFacts, phaseOpen: true, dugThisWindow: true }).feed).toBe(false);
		expect(almanacTodo({ ...baseFacts, readyTierCount: 2 }).pass).toBe(true);
		expect(almanacTodo({ ...baseFacts, draw: draw({ eligible: true, drawn: false }) }).draw).toBe(true);
		expect(almanacTodo({ ...baseFacts, draw: draw({ eligible: true, drawn: true }) }).draw).toBe(false);
		expect(almanacTodo({ ...baseFacts, draw: draw({ eligible: false }) }).draw).toBe(false);
		// Nothing read yet is never gold.
		expect(almanacTodo({ ...baseFacts, draw: null }).draw).toBe(false);
		// Two badges can coexist — the strip is a row of doors, not the one hero.
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
		).toBe("Drawn");
		expect(almanacValues({ ...baseFacts, draw: draw({ runningBalls: 1 }) }).draw).toBe("1 ball");
		expect(almanacValues({ ...baseFacts, draw: null }).draw).toBe("–");
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
			(n) => typeof n.type === "string" && n.props.accessibilityRole === TAB_ROLE
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

	test("VoiceOver hears tabs on iOS: buttons with selected state inside a tab-bar container (after/042)", async () => {
		// React Native gives role "tab" no iOS trait, so a cell read as a bare
		// element; the tab bar's own fix (2026-10-04) is the shape here too.
		const facts = { ...baseFacts, readyTierCount: 0 };
		const r = await render(
			<VerbTabStrip
				values={almanacValues(facts)}
				todo={almanacTodo(facts)}
				selected="draw"
				onSelect={jest.fn()}
				testID="almanac-strip"
			/>
		);
		expect(TAB_ROLE).toBe("button");
		expect(TAB_LIST_ROLE).toBe("tabbar");
		const strip = r.root.findAll(
			(n) => typeof n.type === "string" && n.props.testID === "almanac-strip"
		)[0];
		expect(strip.props.accessibilityRole).toBe("tabbar");
		const cells = strip.findAll(
			(n) => typeof n.type === "string" && n.props.accessibilityRole === "button"
		);
		expect(cells.map((c) => c.props.testID)).toEqual([
			"almanac-tab-feed",
			"almanac-tab-draw",
			"almanac-tab-pass",
		]);
		expect(cells.map((c) => c.props.accessibilityState.selected)).toEqual([false, true, false]);
		expect(r.root.findAll((n) => n.props.accessibilityRole === "tab")).toHaveLength(0);
		act(() => r.unmount());
	});

	test("selection and act-now are two signals: the sun says open, the badge says act", async () => {
		// The 2026-10-04 capture: a selected Pass cell and a ready Draw cell both
		// wore the sun, so nobody could tell which panel was open.
		const facts = { ...baseFacts, readyTierCount: 1, draw: draw({ eligible: true }) };
		const r = await render(
			<VerbTabStrip
				values={almanacValues(facts)}
				todo={almanacTodo(facts)}
				selected="pass"
				onSelect={jest.fn()}
				passProgress={0.4}
			/>
		);
		const fill = (tab: string) => {
			const host = r.root.findAll(
				(n) => typeof n.type === "string" && n.props.testID === `almanac-tab-${tab}`
			)[0];
			const flat = Object.assign({}, ...[host.props.style].flat(Infinity).filter(Boolean));
			return flat.backgroundColor;
		};
		const badge = (tab: string) =>
			r.root.findAll((n) => typeof n.type === "string" && n.props.testID === `almanac-todo-${tab}`).length;
		// Only the open panel's cell wears the sun…
		expect(fill("pass")).toBe(WHIMSY.sun);
		expect(fill("draw")).toBe(WHIMSY.paper);
		expect(fill("feed")).toBe(WHIMSY.paper);
		// …and act-now is the badge, on the selected cell and an unselected one alike.
		expect(badge("pass")).toBe(1);
		expect(badge("draw")).toBe(1);
		expect(badge("feed")).toBe(0);
		// VoiceOver hears the act-now too, not just the value.
		const label = (tab: string) =>
			r.root.findAll((n) => typeof n.type === "string" && n.props.accessibilityRole === TAB_ROLE)
				.find((n) => n.props.testID === `almanac-tab-${tab}`)?.props.accessibilityLabel;
		expect(label("draw")).toBe("Draw: Ready, draw now");
		expect(label("feed")).toBe("Feed: 2h 59m");
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
		expect(text).toContain("Every truffle dug back starves him a little. The herd wants him Famished by day 60.");
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

// ── polish pass 2026-10-04 ───────────────────────────────────────────────────

describe("SeasonGuideModal", () => {
	test("closes with a Close, says where its button lands, and holds no Sounder door", async () => {
		const r = await render(
			<SafeAreaProvider initialMetrics={GUIDE_METRICS}>
				<SeasonGuideModal visible onDismiss={jest.fn()} />
			</SafeAreaProvider>
		);
		const labels = r.root
			.findAll((n) => typeof n.type === "string" && typeof n.props.accessibilityLabel === "string")
			.map((n) => n.props.accessibilityLabel as string);
		expect(labels).toContain("Close");
		expect(labels).toContain("Back to the season");
		// The × used to be read out as "To the patch" — a close named for a place
		// it never went.
		expect(labels).not.toContain("To the patch");
		// The × is the scaffold's pinned close, outside the scroller: on the long
		// guide it used to scroll away with the words (capture 051).
		const close = r.root.findAll(
			(n) => typeof n.type === "string" && n.props.accessibilityLabel === "Close"
		)[0];
		let insideScroller = false;
		for (let n: TestRenderer.ReactTestInstance | null = close; n; n = n.parent) {
			if ((n.type as unknown) === "RCTScrollView") insideScroller = true;
		}
		expect(insideScroller).toBe(false);
		// …and the body really does scroll in one: the steps are in the scroller.
		const step = r.root.findAll(
			(n) => typeof n.type === "string" && n.props.accessibilityLabel === "Dig every feeding"
		)[0];
		let stepScrolls = false;
		for (let n: TestRenderer.ReactTestInstance | null = step; n; n = n.parent) {
			if ((n.type as unknown) === "RCTScrollView") stepScrolls = true;
		}
		expect(stepScrolls).toBe(true);
		const text = textOf(r.root);
		// The Sounder keeps no door on the Season page (2026-09-21 §1).
		expect(text).not.toMatch(/leave your sounder/i);
		// The dig that ships: things tied off are yours; truffles drain him.
		expect(text).not.toContain("Every truffle is yours to keep");
		expect(text).not.toMatch(/dig and blessing/);
		act(() => r.unmount());
	});
});

describe("the Season page's chrome (source guards)", () => {
	const fs = require("node:fs") as typeof import("node:fs");
	const path = require("node:path") as typeof import("node:path");
	const src = fs.readFileSync(path.join(__dirname, "..", "app", "(tabs)", "season.tsx"), "utf8");

	test("the pinned crown states its ceiling, so at accessibility sizes it stays a band", () => {
		// The ax-large capture: an uncapped crown wrapped to five lines and left
		// the panel a sliver. Crown and strip cells both stop at the chrome cap.
		expect(src).toMatch(/<PageHeader\s+variant="tab"\s+maxFontSizeMultiplier=\{CHROME_TYPE_CAP\}/);
		expect(src).toMatch(/\{crown\}\s+\{strip\}/);
	});

	test("the pinned strip owns its scroll edge with the app's one rule", () => {
		expect(src).toContain("const panelEdge = useScrollEdge();");
		expect(src).toMatch(/onScroll=\{panelEdge\.onScroll\}/);
		expect(src).toMatch(/<ScrollEdge\s+visible=\{panelEdge\.edgeVisible\}\s+overlay="top"/);
	});

	test("every dashed rule sets its colour on all sides (iOS draws nothing otherwise)", () => {
		for (const rel of [
			["app", "(tabs)", "season.tsx"],
			["components", "season1", "almanac", "PassPanel.tsx"],
			["components", "mudwar", "SnoutDeepSheets.tsx"],
		]) {
			const file = fs.readFileSync(path.join(__dirname, "..", ...rel), "utf8");
			for (const block of file.match(/\{[^{}]*borderStyle: "dashed"[^{}]*\}/g) ?? []) {
				if (/border(Top|Left|Right|Bottom)Color/.test(block)) {
					expect(block).toMatch(/borderColor:/);
				}
				expect(block).not.toMatch(/border(Top|Left|Right|Bottom)Color/);
			}
		}
	});

	test("the safe area is the context's, not React Native's deprecated view", () => {
		expect(src).toContain('import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";');
		expect(src).not.toMatch(/^\s*SafeAreaView,$/m);
	});

	test("the page holds no Sounder door and no crew fetch", () => {
		expect(src).not.toMatch(/useCrew|onLeave=|handleLeave/);
	});

	test("the whole ladder asks for Slop Club once, and honestly when no store is behind it", () => {
		expect(src).toContain("<PremiumLockedBanner canJoin={IAP_ENABLED} onUnlock={onUnlockPremium} />");
		expect(src).toContain("const showVip = !premium && !prestigeMode && !premiumBanner;");
		expect(src).not.toContain("Coming Soon");
		// One ready tier claims from its own row; the bar is for sweeping two or more.
		expect(src).toContain("{readyTiers.length >= 2 && (");
	});
});

// The season's fiction is read by season id (utils/seasonTheme.ts): the same
// panels and sheets speak The Great Hunger for snout_season_1 and The Feast
// for snout_season_2, and an unknown id keeps Season 1's words.
describe("the season's fiction, by season id", () => {
	const S1 = seasonTheme("snout_season_1");
	const S2 = seasonTheme("snout_season_2");

	test("Feed panel: Season 1 is the Hungerer (also the default), Season 2 the Larder with Rosie happy", async () => {
		for (const theme of [undefined, S1, seasonTheme("snout_season_9")]) {
			const r = await render(
				<FeedPanel cta={cta()} stageIndex={3} seasonDays={60} draw={draw()} theme={theme} />
			);
			const text = textOf(r.root);
			expect(text).toContain("Every truffle dug back starves him a little. The herd wants him Famished by day 60.");
			expect(text).toContain("Peckish");
			const meter = r.root.find((n) => n.props.testID === "feed-stage-meter" && typeof n.props.accessibilityLabel === "string");
			expect(meter.props.accessibilityLabel).toBe("The Hungerer is Peckish. 2 stages to Famished.");
			expect(r.root.findAll((n) => n.props.source === S1.heroArt).length).toBeGreaterThan(0);
			act(() => r.unmount());
		}

		const r = await render(
			<FeedPanel cta={cta()} stageIndex={3} seasonDays={56} draw={draw()} theme={S2} />
		);
		const text = textOf(r.root);
		expect(text).toContain(S2.meterLine(56));
		expect(text).toContain("Bursting");
		expect(text).not.toContain("starves him");
		expect(text).not.toContain("Peckish");
		const meter = r.root.find((n) => n.props.testID === "feed-stage-meter" && typeof n.props.accessibilityLabel === "string");
		expect(meter.props.accessibilityLabel).toBe("The Larder is Full. 2 stages to Bursting.");
		expect(r.root.findAll((n) => n.props.source === S2.heroArt).length).toBeGreaterThan(0);
		expect(r.root.findAll((n) => n.props.source === S1.heroArt)).toHaveLength(0);
		act(() => r.unmount());
	});

	test("the story strip tells each season's beats", async () => {
		const s1 = await render(<SeasonStory />);
		expect(textOf(s1.root)).toContain("the theft");
		expect(textOf(s1.root)).toContain("The Great Hungerer crept in one night");
		act(() => s1.unmount());

		const s2 = await render(<SeasonStory theme={S2} />);
		const text = textOf(s2.root);
		expect(text).toContain("the long table");
		expect(text).toContain("the larder");
		expect(text).not.toContain("the theft");
		act(() => s2.unmount());
	});

	test("the story sheet and the guide wear the season's name, steps and ladder", async () => {
		const info = await render(
			<SafeAreaProvider initialMetrics={GUIDE_METRICS}>
				<SeasonInfoModal topic="story" onDismiss={jest.fn()} theme={S2} />
			</SafeAreaProvider>
		);
		expect(textOf(info.root)).toContain("The Season of the Feast");
		expect(textOf(info.root)).not.toContain("The Season of the Hunger");
		act(() => info.unmount());

		const s1Guide = await render(
			<SafeAreaProvider initialMetrics={GUIDE_METRICS}>
				<SeasonGuideModal visible onDismiss={jest.fn()} />
			</SafeAreaProvider>
		);
		const s1Text = textOf(s1Guide.root);
		expect(s1Text).toContain("The Season of the Hunger");
		expect(s1Text).toContain("Starve the Hungerer");
		expect(s1Text).toContain("steal back the tickles ★");
		expect(s1Text).toContain(S1.ladderFoot);
		act(() => s1Guide.unmount());

		const s2Guide = await render(
			<SafeAreaProvider initialMetrics={GUIDE_METRICS}>
				<SeasonGuideModal visible onDismiss={jest.fn()} theme={S2} />
			</SafeAreaProvider>
		);
		const s2Text = textOf(s2Guide.root);
		expect(s2Text).toContain("The Season of the Feast");
		expect(s2Text).toContain("Fill the Larder");
		expect(s2Text).toContain("fill the larder ★");
		expect(s2Text).toContain("Bare");
		expect(s2Text).toContain("Bursting");
		expect(s2Text).not.toContain("Starve the Hungerer");
		expect(s2Text).not.toContain("Gorged");
		act(() => s2Guide.unmount());
	});

	test("the Season tab reads its title, kicker and sprite from the theme, never a literal", () => {
		const fs = require("node:fs") as typeof import("node:fs");
		const path = require("node:path") as typeof import("node:path");
		const src = fs.readFileSync(path.join(__dirname, "..", "app", "(tabs)", "season.tsx"), "utf8");
		expect(src).toContain("const theme = seasonTheme(season.id);");
		expect(src).toContain("title={s1 ? theme.title : \"Goblins vs Angels\"}");
		expect(src).not.toContain("\"The Great Hunger\"");
		expect(src).not.toContain("the Hungerer is ${stageName}");
		// The Hunger tale replays only for a season that owns it.
		expect(src).toContain("{s1 && theme.hasIntroCinematic && (");
	});
});

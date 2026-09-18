// The Pen, rendered — the errand board over the errand state. The pure state
// (components/pen/penState): the card's one action by state and the board
// cap. The hook (hooks/usePigErrands): an optimistic send that walks the pig
// out on the tap and back on a refusal. The view (components/PigPenView):
// the recall dialog's copy, and the homecoming opening once per `back` row.
// Rendered under Reduce Motion: the paddock's idle loop never settles under
// react-test-renderer's act(). The heavy children (the paddock's PigStages,
// the send sheet's native Modal, the homecoming's RewardReturn) are stubbed:
// what is under test is the wiring, not their drawing.
jest.mock("../utils/log", () => ({ log: { error: jest.fn(), info: jest.fn(), warn: jest.fn() } }));
jest.mock("../utils/rpc", () => ({ rpcAction: jest.fn(), rpc: jest.fn() }));
jest.mock("expo-haptics", () => ({
	selectionAsync: jest.fn(() => Promise.resolve()),
	notificationAsync: jest.fn(() => Promise.resolve()),
	impactAsync: jest.fn(() => Promise.resolve()),
	NotificationFeedbackType: { Success: "success" },
	ImpactFeedbackStyle: { Light: "light" },
}));
jest.mock("expo-router/react-navigation", () => ({
	// eslint-disable-next-line @typescript-eslint/no-require-imports -- a mock factory loads React after Jest hoisting
	useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, [effect]),
}));
jest.mock("../utils/fieldGuide", () => ({ observeFieldGuide: jest.fn() }));
jest.mock("../components/PurchaseToast", () => ({ showPurchaseToast: jest.fn() }));
jest.mock("../components/pen/Paddock", () => ({
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	Paddock: ({ note }: { note: string }) => require("react").createElement(require("react-native").Text, { testID: "paddock-note" }, note),
}));
jest.mock("../components/pen/SendSheet", () => ({ SendSheet: () => null }));
const homecomingRows: number[] = [];
jest.mock("../components/pen/Homecoming", () => ({
	Homecoming: ({ row }: { row: { id: number } | null }) => {
		if (row) homecomingRows.push(row.id);
		// eslint-disable-next-line @testing-library/no-node-access, @typescript-eslint/no-require-imports
		return row ? require("react").createElement(require("react-native").Text, { testID: "homecoming-open" }, String(row.id)) : null;
	},
}));

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MotionPolicyProvider } from "../hooks/useMotionPolicy";
import { PigPenView } from "../components/PigPenView";
import { paddockNote, pigCardState, sendablePigs } from "../components/pen/penState";
import { usePigErrands, type UsePigErrands } from "../hooks/usePigErrands";
import { ERRAND_TUNING, type ErrandRow } from "../constants/errands";
import { EMPTY_ERRANDS, type ErrandState } from "../utils/errands";
import { DEFAULT_PIG_ROSTER, type PigRoster } from "../utils/pigRoster";
import { rpcAction } from "../utils/rpc";
import type { WishTargets } from "../hooks/useFriendWishTargets";

const mockRpc = rpcAction as jest.Mock;

const metrics = {
	frame: { x: 0, y: 0, width: 390, height: 844 },
	insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const wrap = (node: React.ReactNode) => (
	<SafeAreaProvider initialMetrics={metrics}>
		<MotionPolicyProvider reduceMotion>{node}</MotionPolicyProvider>
	</SafeAreaProvider>
);

const row = (over: Partial<ErrandRow> = {}): ErrandRow => ({
	id: 1,
	pig_id: "rosie",
	target_find_id: "blue_feather",
	for_user_id: "friend-1",
	for_wish_no: 3,
	started_at: "2026-09-18T10:00:00Z",
	ends_at: "2026-09-18T14:00:00Z",
	status: "out",
	result_find_ids: [],
	...over,
});

const member: PigRoster = {
	isMember: true,
	activePigId: "rosie",
	recruitedPigId: "copper",
	pigs: DEFAULT_PIG_ROSTER.pigs.map((p) => ({ ...p, owned: p.id === "rosie" || p.id === "copper" })),
};

const enabled = (over: Partial<ErrandState> = {}): ErrandState => ({ ...EMPTY_ERRANDS, enabled: true, ...over });

const targets: WishTargets = { friends: [], names: new Map([["friend-1", { name: "Maya", pigId: "pickles" }]]), mine: null, bag: [] };

describe("penState", () => {
	it("offers the send only to an owned, awake, unspent pig with room on the board", () => {
		expect(pigCardState(member, enabled(), ERRAND_TUNING, "rosie").action.kind).toBe("send");
		expect(pigCardState(member, enabled(), ERRAND_TUNING, "copper").action.kind).toBe("send");
		expect(pigCardState(member, enabled(), ERRAND_TUNING, "pepper").action.kind).toBe("choice_locked");
		expect(pigCardState(DEFAULT_PIG_ROSTER, enabled(), ERRAND_TUNING, "pepper").action.kind).toBe("join");
		expect(pigCardState(member, enabled({ today: { rosie: true } }), ERRAND_TUNING, "rosie").action.kind).toBe("used_today");
		expect(pigCardState(member, EMPTY_ERRANDS, ERRAND_TUNING, "rosie").action.kind).toBe("none");
	});

	it("a lapsed member's companion rests while Rosie still goes", () => {
		const lapsed = { ...member, isMember: false };
		expect(pigCardState(lapsed, enabled(), ERRAND_TUNING, "copper").action.kind).toBe("resting");
		expect(pigCardState(lapsed, enabled(), ERRAND_TUNING, "copper").medallion).toBe("resting");
		expect(pigCardState(lapsed, enabled(), ERRAND_TUNING, "rosie").action.kind).toBe("send");
	});

	it("out and back rows own the card, the medallion and the job readout", () => {
		const out = pigCardState(member, enabled({ out: [row()], away: "rosie" }), ERRAND_TUNING, "rosie");
		expect(out.action.kind).toBe("out");
		expect(out.medallion).toBe("out");
		expect(out.job).toBe("out");
		expect(out.jobEditable).toBe(false);
		const back = pigCardState(member, enabled({ board: [row({ status: "back", result_find_ids: ["blue_feather"] })] }), ERRAND_TUNING, "rosie");
		expect(back.action.kind).toBe("back");
		expect(back.medallion).toBe("back");
		expect(back.job).toBe("home");
	});

	it("the board caps at board_cap: a pig rests until you look", () => {
		const three = [1, 2, 3].map((id) => row({ id, pig_id: "copper", status: "back", result_find_ids: ["clover"] }));
		const full = enabled({ board: three });
		expect(pigCardState(member, full, ERRAND_TUNING, "rosie").action.kind).toBe("board_full");
		expect(sendablePigs(member, full, ERRAND_TUNING)).toEqual([]);
		const two = enabled({ board: three.slice(0, 2) });
		expect(pigCardState(member, two, ERRAND_TUNING, "rosie").action.kind).toBe("send");
		expect(sendablePigs(member, two, ERRAND_TUNING)).toEqual(["rosie"]);
		expect(pigCardState(member, full, { ...ERRAND_TUNING, boardCap: 4 }, "rosie").action.kind).toBe("send");
	});

	it("the paddock note names who is out, what waits, or who lives here", () => {
		expect(paddockNote(member, enabled(), null)).toBe("Copper lives here with Rosie");
		expect(paddockNote(member, enabled({ out: [row()] }), null)).toBe("Rosie is out looking");
		expect(paddockNote(member, enabled({ out: [row(), row({ id: 2, pig_id: "copper" })] }), null)).toBe("Rosie and Copper are out looking");
		expect(paddockNote(member, enabled({ board: [row({ status: "back" })] }), null)).toBe("one on the board");
		expect(paddockNote(DEFAULT_PIG_ROSTER, enabled(), "Bandit")).toBe("previewing Bandit");
	});
});

describe("usePigErrands — the optimistic send", () => {
	let latest: UsePigErrands | null = null;
	function Probe() {
		latest = usePigErrands();
		return null;
	}
	const stateAnswer = (over: Record<string, unknown> = {}) => ({
		ok: true,
		enabled: true,
		away: null,
		today: {},
		out: [],
		board: [],
		tuning: null,
		...over,
	});

	beforeEach(() => {
		latest = null;
		mockRpc.mockReset();
	});

	it("walks the pig out on the tap and back on a refusal — the day is not spent", async () => {
		mockRpc.mockImplementation(async (name: string) => {
			if (name === "pig_errands") return stateAnswer();
			if (name === "send_pig") return { ok: false, reason: "errand_used_today" };
			return { ok: false, reason: "unknown" };
		});
		let tree!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			tree = TestRenderer.create(<Probe />);
		});
		expect(latest!.available).toBe(true);
		expect(latest!.state.out).toHaveLength(0);

		let resolveSend!: (v: unknown) => void;
		mockRpc.mockImplementation((name: string) => {
			if (name === "pig_errands") return Promise.resolve(stateAnswer());
			if (name === "send_pig") return new Promise((resolve) => (resolveSend = resolve));
			return Promise.resolve({ ok: false, reason: "unknown" });
		});
		let outcome: Promise<unknown>;
		await act(async () => {
			outcome = latest!.send("rosie", "blue_feather", "friend-1");
		});
		// Optimistic: the pig is out and today is spent, before the server answers.
		expect(latest!.state.out).toHaveLength(1);
		expect(latest!.state.out[0].pig_id).toBe("rosie");
		expect(latest!.state.out[0].target_find_id).toBe("blue_feather");
		expect(latest!.state.today.rosie).toBe(true);
		expect(latest!.busyPig).toBe("rosie");

		await act(async () => {
			resolveSend({ ok: false, reason: "errand_used_today" });
			await outcome;
		});
		// The refusal walks him back and the day is free again.
		expect(latest!.state.out).toHaveLength(0);
		expect(latest!.state.today.rosie).toBeUndefined();
		expect(latest!.busyPig).toBeNull();
		tree.unmount();
	});

	it("keeps the server's row on an accepted send (and the re-read agrees)", async () => {
		let sent = false;
		mockRpc.mockImplementation(async (name: string) => {
			if (name === "pig_errands") return stateAnswer(sent ? { out: [row({ id: 77 })], today: { rosie: true }, away: "rosie" } : {});
			if (name === "send_pig") {
				sent = true;
				return { ok: true, replay: false, errand: row({ id: 77 }) };
			}
			return { ok: false, reason: "unknown" };
		});
		let tree!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			tree = TestRenderer.create(<Probe />);
		});
		await act(async () => {
			await latest!.send("rosie", "blue_feather", "friend-1");
		});
		expect(latest!.state.out.map((r) => r.id)).toEqual([77]);
		expect(latest!.state.away).toBe("rosie");
		tree.unmount();
	});
});

describe("PigPenView", () => {
	const errandsWith = (state: ErrandState): UsePigErrands => ({
		state,
		available: true,
		loading: false,
		error: false,
		busyId: null,
		busyPig: null,
		refresh: jest.fn(async () => state),
		send: jest.fn(),
		claim: jest.fn(),
		recall: jest.fn(async () => ({ ok: true as const, errand: row({ status: "recalled" }) })),
		summon: jest.fn(async () => true),
	});
	const render = (errands: UsePigErrands) =>
		TestRenderer.create(
			wrap(
				<PigPenView
					roster={member}
					loading={false}
					busyPigId={null}
					onJoinSlopClub={jest.fn()}
					onRecruit={jest.fn()}
					onActivate={jest.fn()}
					errands={errands}
					targets={targets}
					targetsLoading={false}
					targetsLoaded
					loadTargets={jest.fn(async () => targets)}
				/>,
			),
		);

	const texts = (tree: TestRenderer.ReactTestRenderer) =>
		tree.root
			.findAllByType(require("react-native").Text)
			.map((t) => (Array.isArray(t.props.children) ? t.props.children.join("") : String(t.props.children ?? "")));

	beforeEach(() => homecomingRows.splice(0));

	it("the recall is a decision: the dialog says he comes back empty-handed and the day is spent", async () => {
		const errands = errandsWith(enabled({ out: [row({ pig_id: "copper" })], away: null }));
		let tree!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			tree = render(errands);
		});
		await act(async () => {
			tree.root.findByProps({ testID: "fence-copper" }).props.onPress();
		});
		expect(texts(tree).some((t) => t.includes("looking for a blue feather · for Maya's Pickles"))).toBe(true);
		await act(async () => {
			tree.root.findByProps({ testID: "recall-copper" }).props.onPress();
		});
		const all = texts(tree);
		expect(all).toContain("Call Copper home?");
		expect(all).toContain("He'll come back now, empty-handed. Today's errand is spent either way.");
		expect(all).toContain("Call him home");
		expect(all).toContain("Let him look");
		// Confirm → the recall runs on the row.
		await act(async () => {
			tree.root.findByProps({ testID: "dialog-confirm" }).props.onPress();
		});
		expect(errands.recall).toHaveBeenCalledWith(1);
		tree.unmount();
	});

	it("opens the homecoming once per back row, then leaves it on the board", async () => {
		const back = row({ id: 9, status: "back", result_find_ids: ["blue_feather"] });
		const errands = errandsWith(enabled({ board: [back] }));
		let tree!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			tree = render(errands);
		});
		expect(homecomingRows).toEqual([9]);
		// The host closes it; the same board again does NOT reopen it.
		await act(async () => {
			tree.update(
				wrap(
					<PigPenView
						roster={member}
						loading={false}
						busyPigId={null}
						onJoinSlopClub={jest.fn()}
						onRecruit={jest.fn()}
						onActivate={jest.fn()}
						errands={errandsWith(enabled({ board: [back] }))}
						targets={targets}
						targetsLoading={false}
						targetsLoaded
						loadTargets={jest.fn(async () => targets)}
					/>,
				),
			);
		});
		// (The mock records every render with a row; one row, however many renders.)
		expect(new Set(homecomingRows)).toEqual(new Set([9]));
		// The pin stays on the board for a tap.
		expect(tree.root.findAllByProps({ testID: "pin-9" }).length).toBeGreaterThan(0);
		tree.unmount();
	});
});

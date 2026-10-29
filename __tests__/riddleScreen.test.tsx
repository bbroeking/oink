// The Sheep's Riddle page (app/riddle.tsx) on today's real deal:
//   • one clue up at first, the rest asked for in turn, then the button goes
//   • the solve path: a miss greys its tile and leaves one guess, the answer
//     solves, the reveal ties it to every clue, the share line copies, and
//     reopening the page from storage keeps the result
//   • the fail path: two misses end it, the answer is shown, nothing else
//     takes a tap, and reopening keeps it failed
//   • every answer is a labelled button at least TAP_MIN wide
import React from "react";
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import RiddleScreen from "@/app/riddle";
import { resetDailyRiddleCache } from "@/hooks/useDailyRiddle";
import { dealRiddle, utcDayKey } from "@/utils/dailyRiddle";
import { TAP_MIN } from "@/constants/theme";

jest.mock("@/components/ui/Icon", () => ({ Icon: () => null }));
jest.mock("@sentry/react-native", () => ({ captureException: jest.fn(), captureMessage: jest.fn(), addBreadcrumb: jest.fn() }));
jest.mock("expo-haptics", () => ({
	impactAsync: jest.fn(async () => {}),
	selectionAsync: jest.fn(async () => {}),
	notificationAsync: jest.fn(async () => {}),
	ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
	NotificationFeedbackType: { Success: "success", Error: "error" },
}));
jest.mock("expo-router", () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock("react-native-safe-area-context", () => ({
	SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
	useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 34, left: 0 }),
}));
jest.mock("@/components/ui/PageHeader", () => ({ PageHeader: () => null }));
// The sheep's frame clock is a timer loop; he is decoration here.
jest.mock("@/components/trader/TraderArt", () => ({ TraderSprite: () => null, TraderArt: () => null }));
jest.mock("@/hooks/useMotionPolicy", () => ({
	useMotionPolicy: () => ({ reduceMotion: true }),
	MOTION_DURATION: { crossfade: 0, state: 0 },
}));

// The page deals from the clock, so the test reads the same day.
const riddle = dealRiddle(utcDayKey());
const misses = riddle.answers.filter((a) => a !== riddle.secret);

async function mount(): Promise<ReactTestRenderer> {
	let r!: ReactTestRenderer;
	await act(async () => {
		r = TestRenderer.create(<RiddleScreen />);
	});
	// The stored record is read on mount.
	await act(async () => {});
	return r;
}

function find(root: ReactTestInstance, testID: string): ReactTestInstance | null {
	return root.findAll((n) => n.props.testID === testID)[0] ?? null;
}

function pressOf(root: ReactTestInstance, testID: string): (() => void) | null {
	const node = find(root, testID);
	if (!node) throw new Error(`no ${testID}`);
	const pressable = node.findAll((n) => typeof n.props.onPress === "function" && !n.props.disabled);
	return pressable.length > 0 ? pressable[0].props.onPress : null;
}

async function press(root: ReactTestInstance, testID: string): Promise<void> {
	const onPress = pressOf(root, testID);
	if (!onPress) throw new Error(`${testID} takes no tap`);
	await act(async () => {
		onPress();
	});
}

function labelOf(root: ReactTestInstance, testID: string): string {
	const node = find(root, testID);
	if (!node) throw new Error(`no ${testID}`);
	return node.findAll((n) => typeof n.props.accessibilityLabel === "string")[0].props.accessibilityLabel;
}

function text(root: ReactTestInstance): string {
	return root
		.findAll((n) => String(n.type) === "Text")
		.map((n) => (n.children as unknown[]).filter((c) => typeof c === "string").join(""))
		.join(" | ");
}

beforeEach(async () => {
	resetDailyRiddleCache();
	await AsyncStorage.clear();
	jest.clearAllMocks();
});

describe("the riddle page", () => {
	it("shows one clue and asks for the rest in turn", async () => {
		const r = await mount();
		expect(labelOf(r.root, "riddle-clue-0")).toContain("Clue 1");
		expect(labelOf(r.root, "riddle-clue-1")).toBe("Clue 2, not shown yet");
		expect(labelOf(r.root, "riddle-clue-2")).toBe("Clue 3, not shown yet");
		await press(r.root, "riddle-more");
		expect(labelOf(r.root, "riddle-clue-1")).not.toContain("not shown yet");
		expect(labelOf(r.root, "riddle-clue-2")).toBe("Clue 3, not shown yet");
		await press(r.root, "riddle-more");
		expect(labelOf(r.root, "riddle-clue-2")).not.toContain("not shown yet");
		expect(find(r.root, "riddle-more")).toBeNull();
	});

	it("draws nine labelled answer buttons, each at least TAP_MIN", async () => {
		const r = await mount();
		for (const [i, id] of riddle.answers.entries()) {
			const tile = find(r.root, `riddle-answer-${id}`)!;
			expect(tile).not.toBeNull();
			const button = tile.findAll((n) => n.props.accessibilityRole === "button")[0];
			expect(button.props.accessibilityLabel).toMatch(new RegExp(`picture ${i + 1} of 9$`));
			// The outermost node with the testID is the tile itself: its width.
			expect(tile.props.size).toBeGreaterThanOrEqual(TAP_MIN);
		}
	});

	it("solves on the second guess, explains the answer, and keeps the result", async () => {
		const r = await mount();
		await press(r.root, "riddle-more");
		await press(r.root, "riddle-more");
		await press(r.root, `riddle-answer-${misses[0]}`);
		expect(labelOf(r.root, `riddle-answer-${misses[0]}`)).toMatch(/not this one$/);
		expect(pressOf(r.root, `riddle-answer-${misses[0]}`)).toBeNull();
		expect(text(r.root)).toContain("one guess left");
		expect(find(r.root, "riddle-result")).toBeNull();

		await press(r.root, `riddle-answer-${riddle.secret}`);
		expect(find(r.root, "riddle-result")).not.toBeNull();
		expect(text(r.root)).toContain("Got it in two.");
		expect(text(r.root)).toContain("Come back tomorrow");
		expect(text(r.root)).toContain("1 riddle solved on this phone");
		expect(labelOf(r.root, `riddle-answer-${riddle.secret}`)).toMatch(/the answer$/);
		// Every picture is done taking taps.
		for (const id of riddle.answers) expect(pressOf(r.root, `riddle-answer-${id}`)).toBeNull();

		await press(r.root, "riddle-copy");
		expect(Clipboard.setStringAsync).toHaveBeenCalledWith(`The Sheep's Riddle ${riddle.number} · got it in 2 · 3 clues`);
		expect(text(r.root)).toContain("Copied");

		// Reopen from storage alone.
		act(() => r.unmount());
		resetDailyRiddleCache();
		const again = await mount();
		expect(text(again.root)).toContain("Got it in two.");
		expect(find(again.root, "riddle-more")).toBeNull();
	});

	it("fails after two misses, shows the answer, and stays failed", async () => {
		const r = await mount();
		await press(r.root, `riddle-answer-${misses[0]}`);
		await press(r.root, `riddle-answer-${misses[1]}`);
		expect(text(r.root)).toContain("The sheep kept this one.");
		expect(text(r.root)).toContain("0 riddles solved on this phone");
		expect(labelOf(r.root, `riddle-answer-${riddle.secret}`)).toMatch(/the answer$/);
		for (const id of riddle.answers) expect(pressOf(r.root, `riddle-answer-${id}`)).toBeNull();
		expect(find(r.root, "riddle-more")).toBeNull();

		await press(r.root, "riddle-copy");
		expect(Clipboard.setStringAsync).toHaveBeenCalledWith(`The Sheep's Riddle ${riddle.number} · the sheep kept this one`);

		act(() => r.unmount());
		resetDailyRiddleCache();
		const again = await mount();
		expect(text(again.root)).toContain("The sheep kept this one.");
		for (const id of riddle.answers) expect(pressOf(again.root, `riddle-answer-${id}`)).toBeNull();
	});

	it("ignores a third tap after the riddle is over", async () => {
		const r = await mount();
		const first = pressOf(r.root, `riddle-answer-${misses[0]}`)!;
		const second = pressOf(r.root, `riddle-answer-${misses[1]}`)!;
		const third = pressOf(r.root, `riddle-answer-${riddle.secret}`)!;
		// Three fast taps from one stale render: only two can land.
		await act(async () => {
			first();
			second();
			third();
		});
		expect(text(r.root)).toContain("The sheep kept this one.");
	});
});

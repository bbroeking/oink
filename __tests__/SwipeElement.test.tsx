// Regression guard for the CORE mechanic: tapping the pig must fire the
// tickle handler. SwipeElement owns the pig's <Pressable>; Barn passes
// handleIncrement as onLuckySwipe. If the press wiring ever breaks (a gate
// that swallows the press, a disabled Pressable, a mis-wired handler), this
// goes red. (It can't catch a NATIVE overlay/z-order touch-block — that
// needs an e2e/Detox pass — but it locks the JS wiring.)
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Pressable } from "react-native";

jest.mock("expo-audio", () => ({
	useAudioPlayer: () => ({ seekTo: jest.fn(), play: jest.fn() }),
}));
jest.mock("expo-haptics", () => ({
	impactAsync: jest.fn().mockResolvedValue(undefined),
	notificationAsync: jest.fn().mockResolvedValue(undefined),
	selectionAsync: jest.fn().mockResolvedValue(undefined),
	ImpactFeedbackStyle: { Light: "light", Soft: "soft", Medium: "medium" },
	NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));
jest.mock("@react-navigation/native", () => ({ useFocusEffect: jest.fn() }));
jest.mock("@react-native-async-storage/async-storage", () => ({
	getItem: jest.fn().mockResolvedValue(null),
	setItem: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../constants/hats", () => ({ HAT_IMAGES: {}, HAT_REL: {} }));
jest.mock("../components/ui/PigStage", () => ({
	PigStage: () => null,
	resolveSlot: () => null,
}));
jest.mock("../components/ui/SpritePig", () => ({ PigAnimation: {} }));
jest.mock("../components/dev/AnchorDebugOverlay", () => ({
	AnchorDebugOverlay: () => null,
}));

import SwipeElement from "../components/SwipeElement";

async function renderAct(node: React.ReactElement) {
	let r!: TestRenderer.ReactTestRenderer;
	await act(async () => {
		r = TestRenderer.create(node);
	});
	return r;
}

describe("SwipeElement — pig tap wiring", () => {
	test("tapping the pig fires onLuckySwipe when tickles are available", async () => {
		const onLuckySwipe = jest.fn();
		const r = await renderAct(
			<SwipeElement onLuckySwipe={onLuckySwipe} canTickle={true} />
		);
		const pressable = r.root.findByType(Pressable);
		await act(async () => {
			pressable.props.onPress();
		});
		expect(onLuckySwipe).toHaveBeenCalledTimes(1);
		act(() => r.unmount());
	});

	test("tapping still notifies onLuckySwipe when out of tickles (the bank gate lives in Barn, not the press)", async () => {
		const onLuckySwipe = jest.fn();
		const r = await renderAct(
			<SwipeElement onLuckySwipe={onLuckySwipe} canTickle={false} />
		);
		const pressable = r.root.findByType(Pressable);
		await act(async () => {
			pressable.props.onPress();
		});
		expect(onLuckySwipe).toHaveBeenCalledTimes(1);
		act(() => r.unmount());
	});

	test("a mid-reaction tap is QUEUED (not dropped) and replays after the reaction", async () => {
		jest.useFakeTimers();
		// Force "surprise" — a transient reaction (not a rest pose): floor(0.7*6)=4.
		const rand = jest.spyOn(Math, "random").mockReturnValue(0.7);
		const onLuckySwipe = jest.fn();
		const r = await renderAct(
			<SwipeElement onLuckySwipe={onLuckySwipe} canTickle={true} />
		);
		const pressable = r.root.findByType(Pressable);

		// 1st tap (pig at rest) → fires a reaction + the tickle.
		await act(async () => {
			pressable.props.onPress();
		});
		expect(onLuckySwipe).toHaveBeenCalledTimes(1);

		// 2nd tap lands MID-reaction → queued, NOT fired again (the old code
		// silently dropped it).
		await act(async () => {
			pressable.props.onPress();
		});
		expect(onLuckySwipe).toHaveBeenCalledTimes(1);

		// The reaction's 700ms hold reverts the pig to rest...
		await act(async () => {
			jest.advanceTimersByTime(720);
		});
		// ...then the queued tap replays after the ~180ms mini-delay.
		await act(async () => {
			jest.advanceTimersByTime(220);
		});
		expect(onLuckySwipe).toHaveBeenCalledTimes(2);

		rand.mockRestore();
		act(() => r.unmount());
		jest.useRealTimers();
	});

	test("the pig's Pressable is wired to a press handler (not disabled / not null)", async () => {
		const r = await renderAct(
			<SwipeElement onLuckySwipe={jest.fn()} canTickle={true} />
		);
		const pressable = r.root.findByType(Pressable);
		expect(typeof pressable.props.onPress).toBe("function");
		expect(pressable.props.disabled).toBeFalsy();
		act(() => r.unmount());
	});
});

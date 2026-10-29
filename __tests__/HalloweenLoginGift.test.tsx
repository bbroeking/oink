import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import type { HalloweenLoginGiftReceipt } from "@/features/cards/domain/halloweenLoginGift";

jest.mock("@sentry/react-native", () => ({
	addBreadcrumb: jest.fn(),
	captureException: jest.fn(),
}));

jest.mock("@/components/prototypes/card-packs/CostumeRosieStage", () => {
	const { Text } = require("react-native");
	return {
		CostumeRosieStage: ({ showControls }: { showControls?: boolean }) => (
			<Text testID="costume-stage">{showControls ? "controls" : "preview"}</Text>
		),
	};
});

import { HalloweenLoginGiftContent } from "@/components/HalloweenLoginGift";

const makeReceipt = (receiptId: string): HalloweenLoginGiftReceipt => ({
	receiptId,
	campaignKey: "halloween_2026_login_gift_v1",
	costumeId: "halloween_2026_linen_lurker_costume",
	cardId: "halloween_2026_card_linen_lurker_costume",
	claimedAt: "2026-10-20T12:00:00Z",
	acknowledgedAt: null,
});

const costume = {
	name: "Linen Lurker",
	fit: {} as never,
};

describe("HalloweenLoginGiftContent", () => {
	it("reveals one resolved costume and only acknowledges from Continue", async () => {
		const onContinue = jest.fn().mockResolvedValue(true);
		const onLater = jest.fn();
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(
				<HalloweenLoginGiftContent receipt={makeReceipt("receipt-1")} costume={costume} onContinue={onContinue} onLater={onLater} reduceMotion />,
			);
		});
		expect(onContinue).not.toHaveBeenCalled();
		expect(renderer.root.findAllByProps({ testID: "halloween-gift-continue" })).toHaveLength(0);
		await act(async () => renderer.root.findByProps({ testID: "halloween-gift-reveal" }).props.onPress());
		expect(onContinue).not.toHaveBeenCalled();
		expect(renderer.root.findByProps({ testID: "costume-stage" }).props.children).toBe("preview");
		await act(async () => renderer.root.findByProps({ testID: "halloween-gift-continue" }).props.onPress());
		expect(onContinue).toHaveBeenCalledTimes(1);
		expect(onLater).not.toHaveBeenCalled();
		act(() => renderer.unmount());
	});

	it("Later defers without acknowledgement and a new receipt resets to sealed", async () => {
		const onContinue = jest.fn().mockResolvedValue(true);
		const onLater = jest.fn();
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(
				<HalloweenLoginGiftContent receipt={makeReceipt("receipt-1")} costume={costume} onContinue={onContinue} onLater={onLater} reduceMotion />,
			);
		});
		act(() => renderer.root.findByProps({ testID: "halloween-gift-later" }).props.onPress());
		expect(onLater).toHaveBeenCalledTimes(1);
		expect(onContinue).not.toHaveBeenCalled();
		await act(async () => renderer.root.findByProps({ testID: "halloween-gift-reveal" }).props.onPress());
		await act(async () => renderer.update(
			<HalloweenLoginGiftContent receipt={makeReceipt("receipt-2")} costume={costume} onContinue={onContinue} onLater={onLater} reduceMotion />,
		));
		expect(renderer.root.findAllByProps({ testID: "halloween-gift-reveal" }).length).toBeGreaterThan(0);
		expect(renderer.root.findAllByProps({ testID: "halloween-gift-continue" })).toHaveLength(0);
		act(() => renderer.unmount());
	});

	it("keeps the result visible when Continue does not acknowledge", async () => {
		const onContinue = jest.fn().mockResolvedValue(false);
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(
				<HalloweenLoginGiftContent receipt={makeReceipt("receipt-1")} costume={costume} onContinue={onContinue} reduceMotion />,
			);
		});
		await act(async () => renderer.root.findByProps({ testID: "halloween-gift-reveal" }).props.onPress());
		await act(async () => renderer.root.findByProps({ testID: "halloween-gift-continue" }).props.onPress());
		expect(renderer.root.findAllByProps({ testID: "halloween-login-gift-result" }).length).toBeGreaterThan(0);
		expect(renderer.root.findAllByProps({ children: "That didn't stick. Your costume is safe." }).length).toBeGreaterThan(0);
		act(() => renderer.unmount());
	});

	it("coalesces rapid Continue taps and turns a thrown acknowledgement into retry state", async () => {
		let reject!: (error: Error) => void;
		const onContinue = jest.fn().mockReturnValue(new Promise<boolean>((_resolve, fail) => { reject = fail; }));
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(
				<HalloweenLoginGiftContent receipt={makeReceipt("receipt-1")} costume={costume} onContinue={onContinue} reduceMotion />,
			);
		});
		await act(async () => renderer.root.findByProps({ testID: "halloween-gift-reveal" }).props.onPress());
		act(() => {
			renderer.root.findByProps({ testID: "halloween-gift-continue" }).props.onPress();
			renderer.root.findByProps({ testID: "halloween-gift-continue" }).props.onPress();
		});
		expect(onContinue).toHaveBeenCalledTimes(1);
		await act(async () => reject(new Error("offline")));
		expect(renderer.root.findAllByProps({ children: "That didn't stick. Your costume is safe." }).length).toBeGreaterThan(0);
		act(() => renderer.unmount());
	});
});

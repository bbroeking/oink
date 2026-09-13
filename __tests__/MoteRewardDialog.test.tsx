import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { router } from "expo-router";
import { Button } from "@/components/ui/Button";
import { MoteRewardDialog } from "@/components/season1/MoteRewardDialog";
import { POPUP_TEARDOWN_MS } from "@/components/ui/PopupQueue";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/constants/featureFlags", () => ({ MOTE_MACHINE_VISIBLE: true }));
jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 20, left: 0 }),
}));

describe("MoteRewardDialog", () => {
	beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); });
	afterEach(() => { jest.useRealTimers(); });
	it("opens the machine after dismissing the reward, without claiming or spending again", () => {
		const onClose = jest.fn();
		let tree!: TestRenderer.ReactTestRenderer;
		act(() => { tree = TestRenderer.create(<MoteRewardDialog amount={1} onClose={onClose} />); });
		expect(JSON.stringify(tree.toJSON())).toContain("claimed");
		act(() => tree.root.findAllByType(Button).find((b) => b.props.children === "Use Motes")!.props.onPress());
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(router.push).not.toHaveBeenCalled();
		act(() => { jest.advanceTimersByTime(POPUP_TEARDOWN_MS); });
		expect(router.push).toHaveBeenCalledWith("/mote-machine");
		act(() => tree.unmount());
	});
	it("lets the player keep the reward and stay on the pass", () => {
		const onClose = jest.fn();
		let tree!: TestRenderer.ReactTestRenderer;
		act(() => { tree = TestRenderer.create(<MoteRewardDialog amount={5} onClose={onClose} />); });
		act(() => tree.root.findAllByType(Button).find((b) => b.props.children === "Keep for later")!.props.onPress());
		expect(onClose).toHaveBeenCalledTimes(1);
		act(() => { jest.runOnlyPendingTimers(); });
		expect(router.push).not.toHaveBeenCalled();
		act(() => tree.unmount());
	});
});

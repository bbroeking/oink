import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { router } from "expo-router";
import { MoteMachineCard } from "@/components/season1/MoteMachineCard";
import { fetchMoteMachineState } from "@/utils/moteMachine";

jest.mock("expo-router", () => ({
	router: { push: jest.fn() },
}));

jest.mock("expo-router/react-navigation", () => ({
	useFocusEffect: (effect: () => void | (() => void)) => {
		const React = require("react");
		React.useEffect(effect, [effect]);
	},
}));

jest.mock("@/utils/moteMachine", () => ({
	fetchMoteMachineState: jest.fn(),
}));

jest.mock("@/constants/featureFlags", () => ({
	MOTE_MACHINE_VISIBLE: true,
}));

const mockedFetch = fetchMoteMachineState as jest.MockedFunction<
	typeof fetchMoteMachineState
>;
const mockedPush = router.push as jest.MockedFunction<typeof router.push>;

describe("MoteMachineCard", () => {
	it("shows a just-claimed authoritative balance without waiting for a focus change", async () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => { renderer = TestRenderer.create(<MoteMachineCard balance={0} />); });
		await act(async () => { renderer.update(<MoteMachineCard balance={5} />); });
		expect(renderer.root.find((node) => node.props.accessibilityRole === "button").props.accessibilityLabel)
			.toBe("Open the Mote Machine. 5 Motes available.");
		expect(mockedFetch).not.toHaveBeenCalled();
		act(() => renderer.unmount());
	});
	beforeEach(() => {
		mockedFetch.mockReset();
		mockedPush.mockReset();
	});

	it("shows the real Mote balance and opens the native machine", async () => {
		mockedFetch.mockResolvedValue({
			ok: true,
			motes: 2,
			reward_family: {
				contraption_id: "auto_tickler",
				name: "Auto-Tickler",
				resource_id: "clockwork_acorn",
				resource_name: "Clockwork Acorn",
				resource_icon: "acorn",
			},
			inventory: [],
		});

		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(<MoteMachineCard />);
			await Promise.resolve();
		});

		const button = renderer.root.find(
			(node) => node.props.accessibilityRole === "button",
		);
		expect(button.props.accessibilityLabel).toBe(
			"Open the Mote Machine. 2 Motes available.",
		);
		act(() => button.props.onPress());
		expect(mockedPush).toHaveBeenCalledWith("/mote-machine");
		act(() => renderer.unmount());
	});

	it("stays feature-dark while the server contract is unavailable", async () => {
		mockedFetch.mockResolvedValue({ ok: false, reason: "network" });

		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(<MoteMachineCard />);
			await Promise.resolve();
		});

		expect(renderer.toJSON()).toBeNull();
		act(() => renderer.unmount());
	});
});

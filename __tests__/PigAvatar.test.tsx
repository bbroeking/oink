import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { PigAvatar } from "../components/ui/PigAvatar";
import { PigStage } from "../components/ui/PigStage";

describe("PigAvatar independent Hat/Bow rendering", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	it("composes both wearables on the roster pig when both are equipped", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<PigAvatar size={48} hatId="cowboy" bowId="pink_bow" />,
			);
		});

		const stage = renderer.root.findByType(PigStage);
		expect(stage.props.equipped).toEqual({
			id: "cowboy",
			category: "hat",
			emoji: null,
		});
		expect(stage.props.equippedBow).toEqual({
			id: "pink_bow",
			category: "bow",
			emoji: null,
		});

		act(() => renderer.unmount());
	});
});

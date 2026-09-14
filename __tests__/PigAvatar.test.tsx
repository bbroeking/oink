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

	it("worn mode draws the named pig wearing a lone hat instead of the hat icon", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<PigAvatar size={48} mode="worn" pigId="copper" hatId="cowboy" />,
			);
		});

		const stage = renderer.root.findByType(PigStage);
		expect(stage.props.pigId).toBe("copper");
		expect(stage.props.pigFrozen).toBe(true);
		expect(stage.props.equipped).toEqual({ id: "cowboy", category: "hat", emoji: null });
		expect(stage.props.equippedBow).toBeNull();

		act(() => renderer.unmount());
	});

	it("icon mode still stands a lone hat in for the pig", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(<PigAvatar size={48} hatId="cowboy" />);
		});
		expect(renderer.root.findAllByType(PigStage)).toHaveLength(0);
		act(() => renderer.unmount());
	});
});

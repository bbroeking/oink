import React from "react";
import { Image } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { PIG_IDS } from "@/utils/pigs";
import {
	RIVE_PIG_INPUTS,
	rivePigSkinIndex,
	rivePigSkinSource,
} from "@/components/ui/rivePigContract";

const mockAwaitViewReady = jest.fn(() => ({
	then: (onReady: (ready: boolean) => unknown) => {
		onReady(true);
		return { catch: jest.fn() };
	},
}));
const mockSetNumberInputValue = jest.fn();
const mockTriggerInput = jest.fn();
const mockSetHybridRef = jest.fn();
const mockPlay = jest.fn().mockResolvedValue(undefined);
const mockPause = jest.fn().mockResolvedValue(undefined);
const mockOnEventListener = jest.fn();
const mockRiveViewRef = {
	awaitViewReady: mockAwaitViewReady,
	play: mockPlay,
	pause: mockPause,
	onEventListener: mockOnEventListener,
	removeEventListeners: jest.fn(),
	setNumberInputValue: mockSetNumberInputValue,
	triggerInput: mockTriggerInput,
};
const mockUseRiveFile = jest.fn(
	(source: unknown, options?: Record<string, unknown>) => ({
		riveFile: { source, options },
		error: null,
	}),
);
const mockLogWarn = jest.fn();

jest.mock("@/utils/log", () => ({
	log: {
		warn: mockLogWarn,
	},
}));

jest.mock("@rive-app/react-native", () => {
	const React = require("react");
	const { View } = require("react-native");
	const MockRive = (props: Record<string, unknown>) =>
		React.createElement(View, {
			...props,
			testID: "mock-rive-view",
		});
	MockRive.displayName = "MockRive";
	return {
		__esModule: true,
		RiveView: MockRive,
		useRive: () => ({
			riveViewRef: mockRiveViewRef,
			setHybridRef: mockSetHybridRef,
		}),
		useRiveFile: mockUseRiveFile,
		Alignment: { Center: "center" },
		Fit: { Contain: "contain" },
	};
});

const { RivePig } =
	require("@/components/ui/RivePig") as typeof import("@/components/ui/RivePig");

describe("RivePig fallback", () => {
	beforeEach(() => {
		mockAwaitViewReady.mockClear();
		mockSetNumberInputValue.mockClear();
		mockTriggerInput.mockClear();
		mockSetHybridRef.mockClear();
		mockUseRiveFile.mockClear();
		mockLogWarn.mockClear();
	});

	it("supplies exactly one referenced skin to the shared Rive mesh", () => {
		let renderer: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<RivePig
					source={123}
					skinSource={456}
					animation="idle"
					pigId="pickles"
				/>,
			);
		});

		expect(mockUseRiveFile).toHaveBeenCalledWith(123, {
			referencedAssets: { pig_skin: { source: 456 } },
		});
		act(() => {
			renderer!.unmount();
		});
	});

	it("replays the full state-machine contract after every skin remount", () => {
		let renderer: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
					<RivePig
						source={123}
						animation="wave"
						pigId="biscuit"
						equipment={{
							headId: "party",
							faceId: "pixel_glasses",
							heldId: "garden_trowel_held",
						}}
					/>,
			);
		});

		for (const pigId of PIG_IDS) {
			mockSetNumberInputValue.mockClear();
			mockTriggerInput.mockClear();

			act(() => {
				renderer!.update(
						<RivePig
							source={123}
							animation="wave"
							pigId={pigId}
							equipment={{
								headId: "party",
								faceId: "pixel_glasses",
								heldId: "garden_trowel_held",
							}}
						/>,
				);
			});

			expect(mockUseRiveFile).toHaveBeenLastCalledWith(123, {
				referencedAssets: {
					pig_skin: { source: rivePigSkinSource(pigId) },
				},
			});

			expect(mockSetNumberInputValue).toHaveBeenCalledWith(
				RIVE_PIG_INPUTS.skin,
				rivePigSkinIndex(pigId),
			);
			expect(mockSetNumberInputValue).toHaveBeenCalledWith(
				RIVE_PIG_INPUTS.hat,
				1,
			);
			expect(mockSetNumberInputValue).toHaveBeenCalledWith(
				RIVE_PIG_INPUTS.face,
				1,
			);
			expect(mockSetNumberInputValue).toHaveBeenCalledWith(
				RIVE_PIG_INPUTS.held,
				1,
			);
			expect(mockSetNumberInputValue).toHaveBeenCalledWith(RIVE_PIG_INPUTS.activity, 3);
			expect(mockTriggerInput).not.toHaveBeenCalled();
		}

		act(() => {
			renderer!.unmount();
		});
	});

	it("replaces a failed native view with the raster pig", () => {
		jest.useFakeTimers();
		let renderer: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<RivePig source={123} animation="idle" pigId="pickles" />,
			);
		});

		const riveView = renderer!.root.findByProps({
			testID: "mock-rive-view",
		});
		act(() => {
			riveView.props.onError({ message: "invalid authored contract" });
		});

		expect(
			renderer!.root.findAllByProps({ testID: "mock-rive-view" }),
		).toHaveLength(0);
		expect(renderer!.root.findAllByType(Image).length).toBeGreaterThan(0);
		expect(mockLogWarn).toHaveBeenCalledWith(
			"[rive-pig:renderer-failure]",
			expect.stringContaining("invalid authored contract"),
		);
		act(() => {
			renderer!.unmount();
		});
		jest.useRealTimers();
	});
});

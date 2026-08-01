import React from "react";
import { Image } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { PIG_IDS } from "@/utils/pigs";
import {
	RIVE_PIG_INPUTS,
	rivePigSkinIndex,
	rivePigSkinSource,
} from "@/components/ui/rivePigContract";

const mockSetInputState = jest.fn();
const mockFireState = jest.fn();
const mockLogWarn = jest.fn();

jest.mock("@/utils/log", () => ({
	log: {
		warn: mockLogWarn,
	},
}));

jest.mock("rive-react-native", () => {
	const React = require("react");
	const { View } = require("react-native");
	const MockRive = React.forwardRef(
		(props: Record<string, unknown>, ref: React.ForwardedRef<unknown>) => {
			React.useImperativeHandle(ref, () => ({
				setInputState: mockSetInputState,
				fireState: mockFireState,
			}));
			return React.createElement(View, {
				...props,
				testID: "mock-rive-view",
			});
		},
	);
	MockRive.displayName = "MockRive";
	return {
		__esModule: true,
		default: MockRive,
		Alignment: { Center: "center" },
		Fit: { Contain: "contain" },
	};
});

const { RivePig } =
	require("@/components/ui/RivePig") as typeof import("@/components/ui/RivePig");

describe("RivePig fallback", () => {
	beforeEach(() => {
		mockSetInputState.mockClear();
		mockFireState.mockClear();
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

		const riveView = renderer!.root.findByProps({
			testID: "mock-rive-view",
		});
		expect(riveView.props.referencedAssets).toEqual({
			pig_skin: { source: 456 },
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
						pigId="rosie"
						equipment={{
							headId: "party",
							faceId: "pixel_glasses",
							heldId: "garden_trowel_held",
						}}
					/>,
			);
		});

		for (const pigId of PIG_IDS) {
			mockSetInputState.mockClear();
			mockFireState.mockClear();

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

			const riveView = renderer!.root.findByProps({
				testID: "mock-rive-view",
			});
			expect(riveView.props.referencedAssets).toEqual({
				pig_skin: { source: rivePigSkinSource(pigId) },
			});

			act(() => {
				riveView.props.onPlay();
			});

			expect(mockSetInputState).toHaveBeenCalledWith(
				"pig",
				RIVE_PIG_INPUTS.skin,
				rivePigSkinIndex(pigId),
			);
			expect(mockSetInputState).toHaveBeenCalledWith(
				"pig",
				RIVE_PIG_INPUTS.hat,
				1,
			);
			expect(mockSetInputState).toHaveBeenCalledWith(
				"pig",
				RIVE_PIG_INPUTS.face,
				1,
			);
			expect(mockSetInputState).toHaveBeenCalledWith(
				"pig",
				RIVE_PIG_INPUTS.held,
				1,
			);
			expect(mockFireState).toHaveBeenCalledWith(
				"pig",
				RIVE_PIG_INPUTS.wave,
			);
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

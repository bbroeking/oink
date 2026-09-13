import React from "react";
import { Image } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { RivePig } from "@/components/ui/RivePig.web";
import { RiveRuntimeProbe } from "@/components/prototypes/RiveRuntimeProbe.web";

describe("Rive web fallback", () => {
	it("keeps Reduce Motion on raster without mounting a browser canvas", () => {
		let renderer: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<RivePig source={123} animation="idle" pigId="rosie" reduceMotion />,
			);
		});

		expect(renderer!.root.findAllByType(Image).length).toBeGreaterThan(0);

		act(() => {
			renderer!.unmount();
		});
	});

	it("keeps the native audit route informative on web", () => {
		let renderer: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(<RiveRuntimeProbe autoStart />);
		});

		expect(
			renderer!.root.findByProps({
				children:
					"The native Rive probe runs only in an iOS development build. Open the Rosie motion gallery to inspect the web renderer and asset status.",
			}),
		).toBeTruthy();

		act(() => {
			renderer!.unmount();
		});
	});
});

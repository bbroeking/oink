// A queue-slotted Sheet must not take the unmanaged-modal latch: the latch
// holds the PopupQueue, the queue then never presents the slot, and the sheet
// sits mounted-but-hidden (open true, visible false) holding every other popup
// with it. Reproduces the buried-truffle "check on it" dead tap (2026-09-13).
import React, { useState } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Modal, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Sheet } from "../components/ui/Sheet";
import {
	POPUP_HANDOFF_GAP_MS,
	POPUP_TEARDOWN_MS,
	PopupQueueProvider,
	usePopupSlot,
} from "../components/ui/PopupQueue";

const metrics = {
	frame: { x: 0, y: 0, width: 320, height: 568 },
	insets: { top: 20, left: 0, right: 0, bottom: 16 },
};

const seen: { open: boolean; visible: boolean }[] = [];

function Harness({ slotted, initialOpen }: { slotted: boolean; initialOpen: boolean }) {
	const [open, setOpen] = useState(initialOpen);
	const slot = usePopupSlot("truffleSheet", open, 5);
	seen.push({ open, visible: slot.visible });
	return (
		<>
			<Text testID="opener" onPress={() => setOpen(true)}>
				check on it
			</Text>
			{open ? (
				<Sheet
					open={open}
					modalVisible={slot.visible}
					slotted={slotted}
					onClose={() => {
						// The two-phase teardown Barn.tsx uses (PopupQueue contract).
						slot.release();
						setTimeout(() => setOpen(false), POPUP_TEARDOWN_MS);
					}}
					title="Your buried truffle"
					testID="truffle-sheet"
				>
					<Text>of 3 snouts left</Text>
				</Sheet>
			) : null}
		</>
	);
}

function mount(props: { slotted: boolean; initialOpen: boolean }) {
	let renderer!: TestRenderer.ReactTestRenderer;
	act(() => {
		renderer = TestRenderer.create(
			<SafeAreaProvider initialMetrics={metrics}>
				<PopupQueueProvider>
					<Harness {...props} />
				</PopupQueueProvider>
			</SafeAreaProvider>,
		);
	});
	return renderer;
}

const modalVisible = (renderer: TestRenderer.ReactTestRenderer) =>
	renderer.root.findAllByType(Modal).at(-1)!.props.visible;

describe("a queue-slotted Sheet", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		seen.length = 0;
	});
	afterEach(() => jest.useRealTimers());

	test("without `slotted` the Sheet's own latch holds the queue against it (the bug)", () => {
		const renderer = mount({ slotted: false, initialOpen: false });
		act(() => {
			renderer.root.findByProps({ testID: "opener" }).props.onPress();
		});
		act(() => {
			jest.advanceTimersByTime(POPUP_HANDOFF_GAP_MS * 2);
		});
		expect(seen.at(-1)).toEqual({ open: true, visible: false });
		expect(modalVisible(renderer)).toBe(false);
		act(() => renderer.unmount());
	});

	test("with `slotted` a tap lands as open true · visible true, and close is two-phase", () => {
		const renderer = mount({ slotted: true, initialOpen: false });
		act(() => {
			renderer.root.findByProps({ testID: "opener" }).props.onPress();
		});
		expect(seen.at(-1)).toEqual({ open: true, visible: true });
		expect(modalVisible(renderer)).toBe(true);
		expect(
			renderer.root.findAll((node) => node.props.children === "of 3 snouts left"),
		).not.toHaveLength(0);

		// Close: release() hides the native Modal this frame; the mount gate
		// clears a POPUP_TEARDOWN_MS beat later.
		act(() => {
			renderer.root.findAllByType(Sheet).at(-1)!.props.onClose();
		});
		expect(seen.at(-1)).toEqual({ open: true, visible: false });
		expect(modalVisible(renderer)).toBe(false);
		act(() => {
			jest.advanceTimersByTime(POPUP_TEARDOWN_MS - 1);
		});
		expect(seen.at(-1)).toEqual({ open: true, visible: false });
		act(() => {
			jest.advanceTimersByTime(1);
		});
		expect(seen.at(-1)).toEqual({ open: false, visible: false });
		act(() => renderer.unmount());
	});
});

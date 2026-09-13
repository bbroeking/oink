import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Image, Modal, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { DialogButtonRow } from "../components/ui/DialogButtonRow";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { SPACE } from "../constants/theme";

const metrics = {
	frame: { x: 0, y: 0, width: 320, height: 568 },
	insets: { top: 20, left: 0, right: 0, bottom: 16 },
};

function inSafeArea(node: React.ReactNode) {
	return <SafeAreaProvider initialMetrics={metrics}>{node}</SafeAreaProvider>;
}

function buttons(renderer: TestRenderer.ReactTestRenderer) {
	// Pressable shows up twice (composite + host View); only the composite
	// carries the onPress we handed it.
	return renderer.root.findAll(
		(node) =>
			node.props.accessibilityRole === "button" &&
			typeof node.props.onPress === "function",
	);
}

describe("DialogButtonRow", () => {
	test("puts the quiet way out on the left and balances both halves", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<DialogButtonRow
					confirmLabel="Swap · 25"
					onConfirm={() => {}}
					onCancel={() => {}}
				/>,
			);
		});

		const [cancel, confirm] = buttons(renderer);
		// Default cancel copy, and it comes FIRST in the tree (left).
		expect(cancel.props.accessibilityLabel).toBe("Not now");
		expect(confirm.props.accessibilityLabel).toBe("Swap · 25");
		for (const button of [cancel, confirm]) {
			expect(typeof button.props.accessibilityHint).toBe("string");
			expect(button.props.accessibilityState).toBeDefined();
		}
		const row = renderer.root.findAll(
			(node) => StyleSheet.flatten(node.props.style)?.gap === SPACE.sm,
		)[0];
		expect(StyleSheet.flatten(row.props.style).flexDirection).toBe("row");
		act(() => renderer.unmount());
	});

	test("busy swaps the confirm label and disables both halves", () => {
		const onConfirm = jest.fn();
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<DialogButtonRow
					confirmLabel="Swap"
					onConfirm={onConfirm}
					onCancel={() => {}}
					busy
				/>,
			);
		});

		const [cancel, confirm] = buttons(renderer);
		expect(cancel.props.accessibilityState.disabled).toBe(true);
		expect(confirm.props.accessibilityState.disabled).toBe(true);
		expect(confirm.props.accessibilityState.busy).toBe(true);
		expect(
			renderer.root.findAll((node) => node.props.children === "★ working ★"),
		).not.toHaveLength(0);
		act(() => renderer.unmount());
	});

	test("confirmCoin states the cost on the confirm's own face", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<DialogButtonRow
					confirmLabel="Swap · 25"
					onConfirm={() => {}}
					onCancel={() => {}}
					confirmCoin
				/>,
			);
		});
		expect(renderer.root.findAllByType(Image).length).toBeGreaterThan(0);
		act(() => renderer.unmount());
	});

	test("a destructive tone says so in the confirm's hint", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<DialogButtonRow
					confirmLabel="Delete"
					onConfirm={() => {}}
					onCancel={() => {}}
					tone="destructive"
				/>,
			);
		});
		const [, confirm] = buttons(renderer);
		expect(confirm.props.accessibilityHint).toBe("This cannot be undone");
		act(() => renderer.unmount());
	});
});

describe("ConfirmDialog", () => {
	test("renders the paper dialog with an a11y modal frame and wires both actions", () => {
		const onConfirm = jest.fn();
		const onCancel = jest.fn();
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				inSafeArea(
					<ConfirmDialog
						open
						title="Swap this bounty?"
						body="Replace 'Generous Hoof' with a random one."
						confirmLabel="Swap · 25"
						onConfirm={onConfirm}
						onCancel={onCancel}
					/>,
				),
			);
		});

		const frame = renderer.root
			.findAll((node) => node.props.testID === "confirm-dialog")
			.at(-1)!;
		expect(frame.props.accessibilityViewIsModal).toBe(true);
		expect(
			renderer.root.findAll(
				(node) => node.props.children === "Swap this bounty?",
			),
		).not.toHaveLength(0);

		const [cancel, confirm] = buttons(renderer).filter((node) =>
			["Cancel", "Swap · 25"].includes(node.props.accessibilityLabel),
		);
		// The legacy default cancel copy is preserved for the existing call sites.
		expect(cancel.props.accessibilityLabel).toBe("Cancel");
		act(() => confirm.props.onPress());
		expect(onConfirm).toHaveBeenCalledTimes(1);
		act(() => cancel.props.onPress());
		expect(onCancel).toHaveBeenCalledTimes(1);
		act(() => renderer.unmount());
	});

	test("forwards tone=\"destructive\" to the button row", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				inSafeArea(
					<ConfirmDialog
						open
						tone="destructive"
						title="Leave the sounder?"
						confirmLabel="Leave"
						onConfirm={() => {}}
						onCancel={() => {}}
					/>,
				),
			);
		});
		const confirm = buttons(renderer).find(
			(node) => node.props.accessibilityLabel === "Leave",
		)!;
		expect(confirm.props.accessibilityHint).toBe("This cannot be undone");
		act(() => renderer.unmount());
	});

	test("keeps the PopupQueue contract: mounted while open, hidden by visible", () => {
		// Closed: nothing mounts at all.
		let renderer = TestRenderer.create(
			inSafeArea(
				<ConfirmDialog
					open={false}
					title="Gone"
					confirmLabel="ok"
					onConfirm={() => {}}
					onCancel={() => {}}
				/>,
			),
		);
		expect(renderer.root.findAllByType(Modal)).toHaveLength(0);
		act(() => renderer.unmount());

		// Queue-slotted: still MOUNTED through the teardown beat, but not visible.
		renderer = TestRenderer.create(
			inSafeArea(
				<ConfirmDialog
					open
					visible={false}
					title="Draining"
					confirmLabel="ok"
					onConfirm={() => {}}
					onCancel={() => {}}
				/>,
			),
		);
		const modal = renderer.root.findByType(Modal);
		expect(modal.props.visible).toBe(false);
		act(() => renderer.unmount());
	});
});

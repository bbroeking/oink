import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";

const mockFetchBlockedUsers = jest.fn();
const mockUnblockUser = jest.fn();

jest.mock("@/utils/moderation", () => ({
	fetchBlockedUsers: (...args: unknown[]) => mockFetchBlockedUsers(...args),
	unblockUser: (...args: unknown[]) => mockUnblockUser(...args),
}));

jest.mock("@/components/ui/Icon", () => ({
	Icon: () => null,
}));

import { BlockedUsersSheet } from "@/components/BlockedUsersSheet";

// The dialog is now the `Sheet` panel, which reads safe-area insets.
const METRICS = {
	frame: { x: 0, y: 0, width: 320, height: 568 },
	insets: { top: 20, left: 0, right: 0, bottom: 16 },
};

function mount(onClose: () => void = jest.fn()) {
	return (
		<SafeAreaProvider initialMetrics={METRICS}>
			<BlockedUsersSheet visible blockerId="me-1" onClose={onClose} />
		</SafeAreaProvider>
	);
}

function textOf(tree: TestRenderer.ReactTestInstance): string {
	const output: string[] = [];
	function walk(node: TestRenderer.ReactTestInstance | string) {
		if (typeof node === "string") {
			output.push(node);
			return;
		}
		for (const child of node.children ?? []) walk(child);
	}
	walk(tree);
	return output.join("");
}

describe("BlockedUsersSheet", () => {
	beforeEach(() => {
		mockFetchBlockedUsers.mockReset();
		mockUnblockUser.mockReset();
		mockFetchBlockedUsers.mockResolvedValue([
			{
				id: "blocked-1",
				username: "Rosie",
				discriminator: "0067",
				blockedAt: "2026-08-13T12:00:00Z",
			},
		]);
		mockUnblockUser.mockResolvedValue({ ok: true });
	});

	it("loads blocked users and removes one after a successful unblock", async () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(mount());
		});

		expect(mockFetchBlockedUsers).toHaveBeenCalledWith("me-1");
		expect(textOf(renderer.root)).toContain("Rosie#0067");

		// Unblocking removes a safety boundary, so the row's button only ASKS.
		await act(async () => {
			renderer.root.findByProps({ testID: "unblock-blocked-1" }).props.onPress();
		});
		expect(mockUnblockUser).not.toHaveBeenCalled();
		expect(textOf(renderer.root)).toContain("Unblock Rosie#0067?");

		await act(async () => {
			renderer.root.findByProps({ testID: "dialog-confirm" }).props.onPress();
		});

		expect(mockUnblockUser).toHaveBeenCalledWith("blocked-1");
		expect(textOf(renderer.root)).not.toContain("Rosie#0067");
		expect(textOf(renderer.root)).toContain("Nobody blocked");
	});

	it("keeps the user listed when unblock fails", async () => {
		mockUnblockUser.mockResolvedValue({ ok: false, reason: "network" });
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(mount());
		});

		await act(async () => {
			renderer.root.findByProps({ testID: "unblock-blocked-1" }).props.onPress();
		});
		await act(async () => {
			renderer.root.findByProps({ testID: "dialog-confirm" }).props.onPress();
		});

		expect(textOf(renderer.root)).toContain("Rosie#0067");
		expect(textOf(renderer.root)).toContain("Couldn't unblock Rosie#0067");
	});

	it("a failed fetch renders the error state with a retry, never the empty shelf", async () => {
		mockFetchBlockedUsers.mockRejectedValueOnce(new Error("offline"));
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(mount());
		});

		expect(textOf(renderer.root)).not.toContain("Nobody blocked");
		expect(textOf(renderer.root)).toContain("Couldn't check the gate");

		await act(async () => {
			renderer.root.findByProps({ testID: "blocked-users-retry" }).props.onPress();
		});

		expect(mockFetchBlockedUsers).toHaveBeenCalledTimes(2);
		expect(textOf(renderer.root)).toContain("Rosie#0067");
	});
});

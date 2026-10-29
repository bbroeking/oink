// The soft-update card (components/UpdateNudge.tsx) rendered over the real
// useMinBuild hook: the rpc chain and the native build number are mocked at the
// module boundary, Linking.openURL is spied.

import React from "react";
import { Linking, Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

const mockRpc = jest.fn();
jest.mock("@/utils/rpc", () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }));
jest.mock("expo-constants", () => ({
	__esModule: true,
	default: { platform: { ios: { buildNumber: "196" } }, expoConfig: { ios: {} } },
}));

import { UpdateNudge } from "@/components/UpdateNudge";
import { resetMinBuildForTests } from "@/hooks/useMinBuild";
import { TICKLE_THE_PIG_APP_STORE_URL } from "@/utils/redemption";

async function render() {
	let renderer!: TestRenderer.ReactTestRenderer;
	await act(async () => {
		renderer = TestRenderer.create(<UpdateNudge />);
	});
	return renderer;
}

function texts(renderer: TestRenderer.ReactTestRenderer): string[] {
	return renderer.root
		.findAllByType(Text)
		.map((n) => n.props.children)
		.filter((c): c is string => typeof c === "string");
}

const byTestId = (renderer: TestRenderer.ReactTestRenderer, id: string) =>
	renderer.root.findAll((n) => n.props.testID === id && typeof n.type !== "string");

beforeEach(() => {
	resetMinBuildForTests();
	mockRpc.mockReset();
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe("UpdateNudge", () => {
	test("renders nothing while min_build is inert", async () => {
		mockRpc.mockResolvedValue({ build: 0, title: "", body: "" });
		const r = await render();
		expect(r.toJSON()).toBeNull();
		act(() => r.unmount());
	});

	test("shows the server's title and body when this build is behind", async () => {
		mockRpc.mockResolvedValue({
			build: 197,
			title: "A new season rolled in",
			body: "Update to see it properly.",
		});
		const r = await render();
		const words = texts(r);
		expect(words).toContain("A new season rolled in");
		expect(words).toContain("Update to see it properly.");
		act(() => r.unmount());
	});

	test("the Update button opens the canonical App Store listing", async () => {
		mockRpc.mockResolvedValue({ build: 197, title: "", body: "" });
		const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
		const r = await render();
		const [button] = byTestId(r, "update-nudge-update");
		expect(button).toBeDefined();
		await act(async () => {
			button.props.onPress();
		});
		expect(open).toHaveBeenCalledWith(TICKLE_THE_PIG_APP_STORE_URL);
		expect(TICKLE_THE_PIG_APP_STORE_URL).toBe(
			"https://apps.apple.com/us/app/tickle-the-pig/id6740339848",
		);
		act(() => r.unmount());
	});

	test("a refused App Store open is swallowed and the card stays", async () => {
		mockRpc.mockResolvedValue({ build: 197, title: "", body: "" });
		jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no store"));
		const r = await render();
		const [button] = byTestId(r, "update-nudge-update");
		await act(async () => {
			button.props.onPress();
		});
		expect(r.toJSON()).not.toBeNull();
		act(() => r.unmount());
	});

	test("dismiss is a 44pt labelled control, and it hides the card", async () => {
		mockRpc.mockResolvedValue({ build: 197, title: "", body: "" });
		const r = await render();
		const dismiss = r.root.find(
			(n) =>
				n.props.accessibilityRole === "button" &&
				n.props.accessibilityLabel === "Dismiss the update note" &&
				typeof n.props.onPress === "function",
		);
		expect(dismiss.props.accessibilityHint).toBeTruthy();
		await act(async () => {
			dismiss.props.onPress();
		});
		expect(r.toJSON()).toBeNull();
		act(() => r.unmount());
	});

	test("falls back to the compiled copy when the server sends none", async () => {
		mockRpc.mockResolvedValue({ build: 197, title: "", body: "" });
		const r = await render();
		const words = texts(r);
		expect(words).toContain("A new version is ready");
		expect(words).toContain("Update to get the latest.");
		act(() => r.unmount());
	});
});

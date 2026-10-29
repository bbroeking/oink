// The soft-update switch (hooks/useMinBuild.ts): app_settings.min_build read
// through the configCell lifecycle, compared to the native build number. The
// rpc chain and expo-constants are mocked at the module boundary; the native
// build number is a mutable stand-in for the Info.plist's CFBundleVersion.

import React from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

const mockRpc = jest.fn();
jest.mock("@/utils/rpc", () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }));

// The factory builds the object (jest.mock is hoisted above any const here);
// tests mutate it through jest.requireMock.
jest.mock("expo-constants", () => ({ __esModule: true, default: {} }));
const mockConstants: {
	platform?: { ios?: { buildNumber?: string | null } };
	expoConfig?: { ios?: { buildNumber?: string } } | null;
} = jest.requireMock("expo-constants").default;

import {
	nativeBuildNumber,
	parseBuildNumber,
	resetMinBuildForTests,
	resolveMinBuildNudge,
	sanitizeMinBuild,
	UPDATE_NUDGE_FALLBACK_BODY,
	UPDATE_NUDGE_FALLBACK_TITLE,
	useMinBuild,
	type MinBuildState,
} from "@/hooks/useMinBuild";

function setNativeBuild(platformBuild: string | null | undefined, configBuild?: string) {
	mockConstants.platform =
		platformBuild === undefined ? undefined : { ios: { buildNumber: platformBuild } };
	mockConstants.expoConfig = { ios: configBuild === undefined ? {} : { buildNumber: configBuild } };
}

let appStateChange: ((state: AppStateStatus) => void) | undefined;

function Probe({ onCommit }: { onCommit: (v: MinBuildState) => void }) {
	const value = useMinBuild();
	React.useLayoutEffect(() => onCommit(value), [onCommit, value]);
	return null;
}

async function mount() {
	let latest!: MinBuildState;
	const onCommit = (v: MinBuildState) => {
		latest = v;
	};
	let renderer!: TestRenderer.ReactTestRenderer;
	await act(async () => {
		renderer = TestRenderer.create(<Probe onCommit={onCommit} />);
	});
	return {
		get value() {
			return latest;
		},
		unmount() {
			act(() => renderer.unmount());
		},
	};
}

beforeEach(() => {
	resetMinBuildForTests();
	mockRpc.mockReset().mockResolvedValue(null);
	setNativeBuild("196");
	appStateChange = undefined;
	jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
		appStateChange = listener as (state: AppStateStatus) => void;
		return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
	});
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe("pure parts", () => {
	test("the test environment is iOS (the nudge's only platform)", () => {
		expect(Platform.OS).toBe("ios");
	});

	test("parseBuildNumber takes positive whole numbers and digit strings only", () => {
		expect(parseBuildNumber("197")).toBe(197);
		expect(parseBuildNumber(" 197 ")).toBe(197);
		expect(parseBuildNumber(197)).toBe(197);
		expect(parseBuildNumber("1.2")).toBeNull();
		expect(parseBuildNumber("abc")).toBeNull();
		expect(parseBuildNumber(0)).toBeNull();
		expect(parseBuildNumber(-3)).toBeNull();
		expect(parseBuildNumber(null)).toBeNull();
		expect(parseBuildNumber(undefined)).toBeNull();
	});

	test("sanitize keeps 0 as inert, rejects a bad build, and blanks bad copy", () => {
		expect(sanitizeMinBuild({ build: 0, title: "", body: "" })).toEqual({
			build: 0,
			title: "",
			body: "",
		});
		expect(sanitizeMinBuild({ build: 197, title: 5 })).toEqual({
			build: 197,
			title: "",
			body: "",
		});
		expect(sanitizeMinBuild({ build: -1 })).toBeNull();
		expect(sanitizeMinBuild({ build: "soon" })).toBeNull();
		expect(sanitizeMinBuild({})).toBeNull();
		expect(sanitizeMinBuild(null)).toBeNull();
		expect(sanitizeMinBuild([197])).toBeNull();
	});

	test("resolve: inert at 0, shows below, hides at or above, inert when unknown", () => {
		const cfg = (build: number) => ({ build, title: "", body: "" });
		expect(resolveMinBuildNudge(cfg(0), 196).show).toBe(false);
		expect(resolveMinBuildNudge(cfg(197), 196).show).toBe(true);
		expect(resolveMinBuildNudge(cfg(197), 197).show).toBe(false);
		expect(resolveMinBuildNudge(cfg(197), 198).show).toBe(false);
		expect(resolveMinBuildNudge(cfg(197), null).show).toBe(false);
	});

	test("the native build prefers the Info.plist number over the app config", () => {
		setNativeBuild("196", "1");
		expect(nativeBuildNumber()).toBe(196);
		setNativeBuild(null, "150");
		expect(nativeBuildNumber()).toBe(150);
		setNativeBuild(undefined);
		expect(nativeBuildNumber()).toBeNull();
	});
});

describe("useMinBuild", () => {
	test("reads app_settings.min_build through the app_setting RPC", async () => {
		const probe = await mount();
		expect(mockRpc).toHaveBeenCalledWith("app_setting", { p_key: "min_build" });
		probe.unmount();
	});

	test("inert at the seeded build 0", async () => {
		mockRpc.mockResolvedValue({ build: 0, title: "", body: "" });
		const probe = await mount();
		expect(probe.value.show).toBe(false);
		probe.unmount();
	});

	test("inert when the row is missing (fail-soft to the compiled fallback)", async () => {
		mockRpc.mockResolvedValue(null);
		const probe = await mount();
		expect(probe.value.show).toBe(false);
		probe.unmount();
	});

	test("shows the server's words when the native build is below min_build", async () => {
		mockRpc.mockResolvedValue({
			build: 197,
			title: "A new season rolled in",
			body: "Update to see it properly.",
		});
		const probe = await mount();
		expect(probe.value).toMatchObject({
			show: true,
			title: "A new season rolled in",
			body: "Update to see it properly.",
		});
		probe.unmount();
	});

	test("hides when the native build equals min_build", async () => {
		setNativeBuild("197");
		mockRpc.mockResolvedValue({ build: 197, title: "", body: "" });
		const probe = await mount();
		expect(probe.value.show).toBe(false);
		probe.unmount();
	});

	test("hides when the native build is above min_build", async () => {
		setNativeBuild("205");
		mockRpc.mockResolvedValue({ build: 197, title: "", body: "" });
		const probe = await mount();
		expect(probe.value.show).toBe(false);
		probe.unmount();
	});

	test("inert when the native build number is unknown", async () => {
		setNativeBuild(null);
		mockRpc.mockResolvedValue({ build: 197, title: "", body: "" });
		const probe = await mount();
		expect(probe.value.show).toBe(false);
		probe.unmount();
	});

	test("empty server copy falls back to the compiled lines", async () => {
		mockRpc.mockResolvedValue({ build: 197, title: "", body: "  " });
		const probe = await mount();
		expect(probe.value).toMatchObject({
			show: true,
			title: UPDATE_NUDGE_FALLBACK_TITLE,
			body: UPDATE_NUDGE_FALLBACK_BODY,
		});
		expect(UPDATE_NUDGE_FALLBACK_TITLE).toBe("A new version is ready");
		expect(UPDATE_NUDGE_FALLBACK_BODY).toBe("Update to get the latest.");
		probe.unmount();
	});

	test("a raise reaches an open app on its next foreground", async () => {
		mockRpc.mockResolvedValue({ build: 0, title: "", body: "" });
		const probe = await mount();
		expect(probe.value.show).toBe(false);

		mockRpc.mockResolvedValue({ build: 197, title: "", body: "" });
		// Past the fetch debounce floor.
		const now = Date.now();
		jest.spyOn(Date, "now").mockReturnValue(now + 61_000);
		await act(async () => {
			appStateChange?.("active");
		});
		expect(probe.value.show).toBe(true);
		probe.unmount();
	});

	test("dismiss lasts the session, and the next launch shows it again", async () => {
		mockRpc.mockResolvedValue({ build: 197, title: "", body: "" });
		const first = await mount();
		expect(first.value.show).toBe(true);
		await act(async () => {
			first.value.dismiss();
		});
		expect(first.value.show).toBe(false);
		first.unmount();

		// Home remounts in the same session: still dismissed.
		const again = await mount();
		expect(again.value.show).toBe(false);
		again.unmount();

		// A fresh launch (module state reset): back.
		resetMinBuildForTests();
		const nextLaunch = await mount();
		expect(nextLaunch.value.show).toBe(true);
		nextLaunch.unmount();
	});
});

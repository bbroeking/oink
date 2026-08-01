import fs from "node:fs";
import path from "node:path";
import React from "react";
import { Pressable } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

jest.mock("@react-navigation/native", () => ({
	useFocusEffect: (callback: () => void) => {
		const react = require("react");
		react.useEffect(() => {
			callback();
		}, []);
	},
}));

jest.mock("expo-router", () => ({
	router: { push: jest.fn() },
}));

jest.mock("expo-audio", () => ({
	createAudioPlayer: jest.fn(() => ({
		play: jest.fn(),
		pause: jest.fn(),
		replace: jest.fn(),
		release: jest.fn(),
	})),
	setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-notifications", () => ({
	SchedulableTriggerInputTypes: { DATE: "date" },
	setNotificationHandler: jest.fn(),
	cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
	getExpoPushTokenAsync: jest.fn(),
	getPermissionsAsync: jest.fn(),
	requestPermissionsAsync: jest.fn(),
	scheduleNotificationAsync: jest.fn(),
}));

const mockGetUser = jest
	.fn()
	.mockResolvedValue({ data: { user: { id: "barn-user" } } });
const mockChannel = {
	on() {
		return this;
	},
	subscribe() {
		return this;
	},
};
jest.mock("../utils/supabase", () => ({
	supabase: {
		auth: { getUser: () => mockGetUser() },
		channel: () => mockChannel,
		removeChannel: jest.fn(),
		getChannels: () => [],
	},
}));

jest.mock("../utils/activeEffects", () => {
	const actual = jest.requireActual("../utils/activeEffects");
	return {
		...actual,
		fetchActiveEffects: jest.fn().mockResolvedValue([
			{
				source: "blessing",
				kind: "lucky_snout",
				expires_at: "2030-01-01T00:00:00Z",
				sender_id: null,
				sender_username: null,
			},
		]),
	};
});

import { BarnUpdatesTray } from "../components/BarnUpdatesTray";
import { ActiveEffectsProvider } from "../hooks/ActiveEffectsProvider";
import { MotionPolicyProvider } from "../hooks/useMotionPolicy";

const ROOT = path.resolve(__dirname, "..");
const tray = fs.readFileSync(
	path.join(ROOT, "components/BarnUpdatesTray.tsx"),
	"utf8",
);
const barn = fs.readFileSync(path.join(ROOT, "components/Barn.tsx"), "utf8");

describe("Barn updates tray", () => {
	test("the Barn no longer exposes the retired Oinkogram share card", () => {
		expect(barn).not.toContain("OinkogramCard");
	});

	test("the compact header expands and collapses the cards", async () => {
		const originalDev = __DEV__;
		(globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = false;
		let renderer!: TestRenderer.ReactTestRenderer;
		try {
			await act(async () => {
				renderer = TestRenderer.create(
					React.createElement(
						MotionPolicyProvider,
						{
							reduceMotion: true,
							children: React.createElement(ActiveEffectsProvider, {
								children: React.createElement(BarnUpdatesTray),
							}),
						},
					),
				);
			});
			await act(async () => Promise.resolve());

			const button = (label: string) =>
				renderer.root
					.findAllByType(Pressable)
					.find((node) => node.props.accessibilityLabel === label);

			expect(button("Barn updates")).toBeDefined();
			act(() => button("Barn updates")?.props.onPress());
			expect(button("Barn updates")?.props.accessibilityState).toEqual({ expanded: true });
			act(() => button("Barn updates")?.props.onPress());
			expect(button("Barn updates")?.props.accessibilityState).toEqual({ expanded: false });
		} finally {
			act(() => renderer?.unmount());
			(globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ =
				originalDev;
		}
	});

	test("collapses live status surfaces into one home-screen control", () => {
		expect(tray).toContain("const [expanded, setExpanded] = useState(false)");
		expect(tray).toContain('accessibilityState={{ expanded }}');
		expect(tray).toContain("<BarnActiveEffectsStrip />");
		expect(tray).toContain("<BarnSounderChip />");
		expect(barn).toContain("<BarnUpdatesTray />");
		expect(barn).not.toContain("<BarnActiveEffectsStrip />");
		expect(barn).not.toContain("<BarnSounderChip />");
	});

	test("keeps live state intact without a redundant clear footer", () => {
		expect(tray).toContain('parts.push("Truffle Patch")');
		expect(tray).toContain('parts.push(`${effects.length} active`)');
		expect(tray).not.toContain("Clear all");
		expect(tray).not.toContain("clearButton");
		expect(tray).not.toContain("dismissedSignature");
		expect(tray).not.toContain("cleanse(");
	});

	test("uses one-line tray chrome and a two-line compact Patch row", () => {
		const chip = fs.readFileSync(
			path.join(ROOT, "components/BarnSounderChip.tsx"),
			"utf8",
		);
		expect(tray).toContain('<Text style={styles.title}>Updates</Text>');
		expect(tray).toContain('paddingTop: SPACE.sm');
		expect(chip).not.toContain("digKicker");
		expect(chip).toContain("minHeight: 48");
		expect(chip).toContain("...TYPE.cardTitleSm");
	});

	test("honors reduced motion when expanding and collapsing", () => {
		expect(tray).toContain("if (!reduceMotion)");
		expect(tray).toContain("LayoutAnimation.configureNext");
	});
});

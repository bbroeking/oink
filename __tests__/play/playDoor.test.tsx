// The one door to matchmade play (components/play/PlayDoor): nothing at all
// while the flag is off; with it on, "Play together" with the five icons and
// a sun badge counting your moves plus your invites, only when there are any.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { PlayDoor } from "@/components/play/PlayDoor";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock("@/utils/log", () => ({ log: { error: jest.fn(), info: jest.fn(), warn: jest.fn() } }));
jest.mock("@sentry/react-native", () => ({ captureException: jest.fn(), captureMessage: jest.fn(), addBreadcrumb: jest.fn() }));
jest.mock("@/components/ui/Icon", () => ({ Icon: () => null }));

const mockPlay = { enabled: true, yourTurnCount: 0, incomingInvites: [] as unknown[] };
jest.mock("@/hooks/useMultiplayer", () => ({
	usePlayEnabled: () => mockPlay.enabled,
	usePlay: () => mockPlay,
}));


const EM_DASH = "\u2014";
const EMOJI = /[\u{1F300}-\u{1FAFF}]|[\u2600-\u2604\u2606-\u2664\u2666-\u2712\u2714\u2716-\u2725\u2728-\u27BF]/u;

function textOf(node: TestRenderer.ReactTestInstance | string): string {
	if (typeof node === "string") return node;
	return (node.children ?? []).map(textOf).join("");
}

function host(root: TestRenderer.ReactTestInstance, testID: string) {
	return root.findAll((n) => n.props.testID === testID && typeof n.type === "string");
}

function render() {
	let r!: TestRenderer.ReactTestRenderer;
	act(() => {
		r = TestRenderer.create(<PlayDoor />);
	});
	return r;
}

describe("PlayDoor", () => {
	beforeEach(() => {
		mockPlay.enabled = true;
		mockPlay.yourTurnCount = 0;
		mockPlay.incomingInvites = [];
		mockPush.mockReset();
	});

	it("draws nothing while the multiplayer flag is off", () => {
		mockPlay.enabled = false;
		const r = render();
		expect(r.toJSON()).toBeNull();
	});

	it("is Play together with the five icons, and no badge with nothing waiting", () => {
		const r = render();
		const text = textOf(r.root);
		expect(text).toContain("Play together");
		expect(text).toContain("five little games with a pig or two");
		expect(host(r.root, "play-door-badge")).toHaveLength(0);
		// The fan: the five games' painted icons.
		expect(r.root.findAll((n) => typeof n.type === "string" && !!n.props.source).length).toBeGreaterThanOrEqual(5);
		expect(text.includes(EM_DASH)).toBe(false);
		expect(EMOJI.test(text)).toBe(false);
	});

	it("counts your moves plus your invites on a sun badge, and says it out loud", () => {
		mockPlay.yourTurnCount = 2;
		mockPlay.incomingInvites = [{ code: "AAAAAAAA" }];
		const r = render();
		const badge = host(r.root, "play-door-badge");
		expect(badge.length).toBeGreaterThan(0);
		expect(textOf(badge[0])).toBe("3");
		const door = host(r.root, "play-door")[0];
		expect(door.props.accessibilityLabel).toBe("Play together, 3 waiting on you");
	});

	it("caps a long count at 9+", () => {
		mockPlay.yourTurnCount = 12;
		const r = render();
		expect(textOf(host(r.root, "play-door-badge")[0])).toBe("9+");
	});

	it("opens Play together", () => {
		const r = render();
		const pressable = r.root.find((n) => n.props.testID === "play-door" && typeof n.props.onPress === "function");
		act(() => pressable.props.onPress());
		expect(mockPush).toHaveBeenCalledWith("/play");
	});
});

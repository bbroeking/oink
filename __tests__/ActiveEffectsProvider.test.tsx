// Guards the "cleanse doesn't refresh the Barn" fix: ActiveEffectsProvider
// shares ONE active-effects instance across the tab subtree, so a cleanse()
// from any consumer clears curses for EVERY consumer. Previously each surface
// (Barn overlay, chip strip, Hoofprints sheet, Inbox) held an isolated copy
// and only the one that owned the cleanse closure updated.

import React from "react";
import { Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

// useFocusEffect → run the refresh callback once on mount (simulates the
// screen focusing). Return undefined so React doesn't see a non-function
// cleanup (refresh() returns a Promise).
jest.mock("@react-navigation/native", () => ({
	useFocusEffect: (cb: () => void) => {
		const react = require("react");
		react.useEffect(() => {
			cb();
		}, []);
	},
}));

const mockGetUser = jest
	.fn()
	.mockResolvedValue({ data: { user: { id: "u1" } } });
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

const mockRpc = jest.fn().mockResolvedValue({ ok: true, cleared: 1 });
jest.mock("../utils/rpc", () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }));

// Initial fetch returns one active curse; cleanse should drop it everywhere.
const curseRow = {
	source: "curse",
	kind: "sluggish_snout",
	expires_at: "2030-01-01T00:00:00Z",
	sender_id: null,
	sender_username: null,
};
jest.mock("../utils/activeEffects", () => {
	const actual = jest.requireActual("../utils/activeEffects");
	return {
		...actual,
		fetchActiveEffects: jest.fn().mockResolvedValue([curseRow]),
	};
});

import {
	ActiveEffectsProvider,
	useActiveEffectsContext,
} from "../hooks/ActiveEffectsProvider";

// Captured from a consumer so the test can trigger a cleanse the way the
// Hoofprints sheet / Inbox would. Same identity across all consumers because
// it comes from the single provider value.
let sharedCleanse: (() => Promise<unknown>) | null = null;

function Reader({ label }: { label: string }) {
	const { curses, cleanse } = useActiveEffectsContext();
	sharedCleanse = cleanse;
	return <Text>{`${label}:${curses.length}`}</Text>;
}

function textOf(node: TestRenderer.ReactTestInstance): string {
	const out: string[] = [];
	function walk(n: TestRenderer.ReactTestInstance | string) {
		if (typeof n === "string") {
			out.push(n);
			return;
		}
		for (const c of n.children ?? []) walk(c);
	}
	walk(node);
	return out.join("");
}

test("a cleanse from one consumer clears curses for every consumer", async () => {
	let r!: TestRenderer.ReactTestRenderer;
	await act(async () => {
		r = TestRenderer.create(
			<ActiveEffectsProvider>
				<Reader label="overlay" />
				<Reader label="strip" />
			</ActiveEffectsProvider>
		);
	});
	// Flush the focus-refresh fetch.
	await act(async () => {
		await Promise.resolve();
	});

	// Both surfaces see the curse from the single shared instance.
	expect(textOf(r.root)).toContain("overlay:1");
	expect(textOf(r.root)).toContain("strip:1");

	// Cleanse via one surface...
	await act(async () => {
		await sharedCleanse!();
	});

	// ...and BOTH surfaces drop the curse (the bug: only the cleansing one did).
	expect(textOf(r.root)).toContain("overlay:0");
	expect(textOf(r.root)).toContain("strip:0");
	expect(mockRpc).toHaveBeenCalledWith("cleanse_curses");
});

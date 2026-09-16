// The "Claim a Barn furnishing" sheet: both buttons run the tier's claim; the
// gold one then hands the furnishing to the Barn editor (by route param, never
// placed), the paper one only claims. A missed claim keeps the sheet open with
// its retry line.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";

// The ui barrel reaches utils/log → Sentry, whose native init arms a timer
// that keeps Jest from exiting; the same no-op mock the Barn tests use.
jest.mock("@sentry/react-native", () => ({
	captureException: jest.fn(),
	captureMessage: jest.fn(),
	addBreadcrumb: jest.fn(),
}));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
	router: { push: (...args: unknown[]) => mockPush(...args), setParams: jest.fn() },
}));

import { BarnRewardClaimSheet } from "@/components/season1/BarnRewardClaimSheet";
import { POPUP_HANDOFF_GAP_MS } from "@/components/ui";
import type { TierRow } from "@/utils/seasonPass";

const metrics = {
	frame: { x: 0, y: 0, width: 390, height: 844 },
	insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const tier: TierRow = {
	tier: 5,
	track: "free",
	reward_type: "habitat",
	reward_value: { item_id: "firefly_lantern" },
	display_label: "Firefly Lantern",
};

function mount(onClaim: (t: TierRow) => Promise<any>, onClose = jest.fn()) {
	let renderer!: TestRenderer.ReactTestRenderer;
	act(() => {
		renderer = TestRenderer.create(
			<SafeAreaProvider initialMetrics={metrics}>
				<BarnRewardClaimSheet open tier={tier} onClose={onClose} onClaim={onClaim} />
			</SafeAreaProvider>
		);
	});
	return renderer;
}

const button = (renderer: TestRenderer.ReactTestRenderer, testID: string) =>
	renderer.root.findAll((n) => n.props.testID === testID && typeof n.props.onPress === "function").at(-1)!;

const texts = (renderer: TestRenderer.ReactTestRenderer) =>
	renderer.root
		.findAll((n) => typeof n.props.children === "string" || Array.isArray(n.props.children))
		.map((n) => (Array.isArray(n.props.children) ? n.props.children.join("") : n.props.children));

beforeEach(() => {
	jest.useFakeTimers();
	mockPush.mockClear();
});
afterEach(() => {
	jest.useRealTimers();
});

describe("BarnRewardClaimSheet", () => {
	it("shows the tier kicker, the catalog name, the Barn slot pill and the keep line", () => {
		const renderer = mount(jest.fn().mockResolvedValue({ ok: true }));
		const all = texts(renderer);
		expect(all).toContain("season pass · tier 5");
		expect(all).toContain("Firefly Lantern");
		// The lantern hangs from the rafters — the pill says the real spot.
		expect(all).toContain("barn · rafters");
		expect(all).toContain("Yours to keep, season over or not.");
		act(() => renderer.unmount());
	});

	it("'Hang it in the Barn' claims, closes, then opens the Barn with the furnishing in hand", async () => {
		const onClaim = jest.fn().mockResolvedValue({ ok: true, habitat_item_id: "firefly_lantern" });
		const onClose = jest.fn();
		const renderer = mount(onClaim, onClose);
		await act(async () => {
			button(renderer, "barn-reward-hang").props.onPress();
		});
		expect(onClaim).toHaveBeenCalledWith(tier);
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(mockPush).not.toHaveBeenCalled();
		act(() => {
			jest.advanceTimersByTime(POPUP_HANDOFF_GAP_MS);
		});
		expect(mockPush).toHaveBeenCalledWith({
			pathname: "/barn-interior",
			params: { handItemId: "firefly_lantern" },
		});
		act(() => renderer.unmount());
	});

	it("'Claim, hang it later' claims and closes without opening the Barn", async () => {
		const onClaim = jest.fn().mockResolvedValue({ ok: true, already_owned: true });
		const onClose = jest.fn();
		const renderer = mount(onClaim, onClose);
		await act(async () => {
			button(renderer, "barn-reward-later").props.onPress();
		});
		expect(onClaim).toHaveBeenCalledWith(tier);
		expect(onClose).toHaveBeenCalledTimes(1);
		act(() => {
			jest.advanceTimersByTime(POPUP_HANDOFF_GAP_MS);
		});
		expect(mockPush).not.toHaveBeenCalled();
		act(() => renderer.unmount());
	});

	it("a missed claim keeps the sheet open with a retry line", async () => {
		const onClaim = jest.fn().mockResolvedValue({ ok: false, reason: "network" });
		const onClose = jest.fn();
		const renderer = mount(onClaim, onClose);
		await act(async () => {
			button(renderer, "barn-reward-hang").props.onPress();
		});
		expect(onClose).not.toHaveBeenCalled();
		expect(texts(renderer)).toContain("Couldn't claim it — give it another tap.");
		act(() => {
			jest.advanceTimersByTime(POPUP_HANDOFF_GAP_MS);
		});
		expect(mockPush).not.toHaveBeenCalled();
		act(() => renderer.unmount());
	});
});

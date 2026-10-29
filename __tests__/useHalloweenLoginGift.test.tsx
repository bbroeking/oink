import React from "react";
import { AppState, type AppStateStatus } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import type { HalloweenLoginGiftResult } from "@/features/cards/domain/halloweenLoginGift";

const mockClaim = jest.fn();
const mockAcknowledge = jest.fn();
jest.mock("@/utils/halloweenLoginGift", () => ({
	claimHalloweenLoginGift: (...args: unknown[]) => mockClaim(...args),
	acknowledgeHalloweenLoginGift: (...args: unknown[]) => mockAcknowledge(...args),
}));

import {
	useHalloweenLoginGift,
	type UseHalloweenLoginGiftOptions,
	type UseHalloweenLoginGiftResult,
} from "@/hooks/useHalloweenLoginGift";

const receipt = (receiptId: string, acknowledgedAt: string | null = null): HalloweenLoginGiftResult => ({
	ok: true,
	status: "new",
	receipt: {
		receiptId,
		campaignKey: "halloween_2026_login_gift_v1",
		costumeId: "halloween_2026_linen_lurker_costume",
		cardId: "halloween_2026_card_linen_lurker_costume",
		claimedAt: "2026-10-20T12:00:00Z",
		acknowledgedAt,
	},
});

let appStateChange: (state: AppStateStatus) => void;

function Probe({
	options,
	onCommit,
}: {
	options: UseHalloweenLoginGiftOptions;
	onCommit: (value: UseHalloweenLoginGiftResult) => void;
}) {
	const value = useHalloweenLoginGift(options);
	React.useLayoutEffect(() => onCommit(value), [onCommit, value]);
	return null;
}

async function mount(initialOptions: UseHalloweenLoginGiftOptions) {
	let latest!: UseHalloweenLoginGiftResult;
	const commits: Array<{ userId: string | null; receiptId: string | null }> = [];
	let currentOptions = initialOptions;
	const onCommit = (next: UseHalloweenLoginGiftResult) => {
		latest = next;
		commits.push({
			userId: currentOptions.userId,
			receiptId: next.receipt?.receiptId ?? null,
		});
	};
	let renderer!: TestRenderer.ReactTestRenderer;
	await act(async () => {
		renderer = TestRenderer.create(<Probe options={currentOptions} onCommit={onCommit} />);
	});
	return {
		get value() { return latest; },
		commits,
		async update(nextOptions: UseHalloweenLoginGiftOptions) {
			currentOptions = nextOptions;
			await act(async () => {
				renderer.update(<Probe options={currentOptions} onCommit={onCommit} />);
			});
		},
		unmount() { act(() => renderer.unmount()); },
	};
}

describe("useHalloweenLoginGift", () => {
	beforeEach(() => {
		mockClaim.mockReset().mockResolvedValue({ ok: true, status: "inactive" });
		mockAcknowledge.mockReset();
		AppState.currentState = "active";
		jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
			appStateChange = listener;
			return { remove: jest.fn() };
		});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	const options = (userId = "pig-a"): UseHalloweenLoginGiftOptions => ({
		userId,
		enabled: true,
		clientBuild: 200,
		fitPolicyVersion: 1,
	});

	it("claims on startup and rechecks quietly on foreground", async () => {
		const harness = await mount(options());
		expect(mockClaim).toHaveBeenCalledWith(200, 1);
		expect(harness.value.receipt).toBeNull();
		await act(async () => appStateChange("active"));
		expect(mockClaim).toHaveBeenCalledTimes(2);
		harness.unmount();
	});

	it("coalesces concurrent claims for one account generation", async () => {
		let resolve!: (result: HalloweenLoginGiftResult) => void;
		mockClaim.mockReturnValue(new Promise((done) => { resolve = done; }));
		const harness = await mount(options());
		let first!: Promise<unknown>;
		let second!: Promise<unknown>;
		act(() => {
			first = harness.value.claim();
			second = harness.value.claim();
		});
		expect(mockClaim).toHaveBeenCalledTimes(1);
		await act(async () => resolve(receipt("r-1")));
		expect(await first).toEqual(await second);
		expect(harness.value.receipt?.receiptId).toBe("r-1");
		harness.unmount();
	});

	it("drops a stale response after account switch", async () => {
		let resolve!: (result: HalloweenLoginGiftResult) => void;
		mockClaim.mockReturnValueOnce(new Promise((done) => { resolve = done; }))
			.mockResolvedValue({ ok: true, status: "inactive" });
		const harness = await mount(options());
		await harness.update(options("pig-b"));
		await act(async () => resolve(receipt("pig-a-receipt")));
		expect(harness.value.receipt).toBeNull();
		harness.unmount();
	});

	it("never publishes an existing account A receipt during account B's first render", async () => {
		mockClaim.mockResolvedValueOnce(receipt("pig-a-visible"))
			.mockResolvedValue({ ok: true, status: "inactive" });
		const harness = await mount(options());
		expect(harness.value.receipt?.receiptId).toBe("pig-a-visible");
		harness.commits.length = 0;
		await harness.update(options("pig-b"));
		expect(harness.commits.filter((entry) => entry.userId === "pig-b"))
			.toEqual(expect.arrayContaining([{ userId: "pig-b", receiptId: null }]));
		expect(harness.commits.some((entry) => entry.userId === "pig-b" && entry.receiptId === "pig-a-visible"))
			.toBe(false);
		harness.unmount();
	});

	it("keeps a visible receipt when acknowledgement fails, then clears it after explicit success", async () => {
		mockClaim.mockResolvedValue(receipt("r-ack"));
		mockAcknowledge
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(receipt("r-ack", "2026-10-20T12:01:00Z"));
		const harness = await mount(options());
		expect(harness.value.receipt?.receiptId).toBe("r-ack");
		await act(async () => { expect(await harness.value.acknowledge()).toBe(false); });
		expect(harness.value.receipt?.receiptId).toBe("r-ack");
		expect(harness.value.error).toBe("ack_failed");
		await act(async () => { expect(await harness.value.acknowledge()).toBe(true); });
		expect(harness.value.receipt).toBeNull();
		harness.unmount();
	});

	it("never acknowledges on mount and hides an already acknowledged replay", async () => {
		mockClaim.mockResolvedValue(receipt("already-seen", "2026-10-20T12:01:00Z"));
		const harness = await mount(options());
		expect(mockAcknowledge).not.toHaveBeenCalled();
		expect(harness.value.receipt).toBeNull();
		harness.unmount();
	});
});

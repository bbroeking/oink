// useProEntitlement resolves the RevenueCat entitlement, flips
// loading off, and updates when a customer-info change fires.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";

// Mock utils/iap before importing the hook. `mockIsPro` resolves the
// initial value; `customerCb` captures the onCustomerInfoUpdate
// listener so a test can fire a later entitlement change.
const mockIsPro = jest.fn();
let customerCb: ((info: unknown) => void) | null = null;
jest.mock("@/utils/iap", () => ({
	isPro: () => mockIsPro(),
	onCustomerInfoUpdate: (cb: (info: unknown) => void) => {
		customerCb = cb;
		return () => { customerCb = null; };
	},
}));

import { useProEntitlement } from "../hooks/useProEntitlement";

// Tiny probe component that renders the hook's output as text.
function Probe() {
	const { isPro, loading } = useProEntitlement();
	return <Text>{loading ? "loading" : isPro ? "pro" : "free"}</Text>;
}

function textOf(r: TestRenderer.ReactTestRenderer): string {
	const out: string[] = [];
	function walk(n: TestRenderer.ReactTestInstance | string) {
		if (typeof n === "string") { out.push(n); return; }
		for (const c of n.children ?? []) walk(c);
	}
	walk(r.root);
	return out.join("");
}

describe("useProEntitlement", () => {
	beforeEach(() => {
		mockIsPro.mockReset();
		customerCb = null;
	});

	test("starts loading, then resolves free when not entitled", async () => {
		mockIsPro.mockResolvedValue(false);
		let r!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			r = TestRenderer.create(<Probe />);
		});
		expect(textOf(r)).toBe("free");
		act(() => r.unmount());
	});

	test("resolves pro when the entitlement is active", async () => {
		mockIsPro.mockResolvedValue(true);
		let r!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			r = TestRenderer.create(<Probe />);
		});
		expect(textOf(r)).toBe("pro");
		act(() => r.unmount());
	});

	test("updates when a customer-info change reports Pro", async () => {
		mockIsPro.mockResolvedValue(false);
		let r!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			r = TestRenderer.create(<Probe />);
		});
		expect(textOf(r)).toBe("free");
		// RevenueCat fires an entitlement change (purchase completed).
		await act(async () => {
			customerCb?.({
				entitlements: { active: { tickle_the_pig_pro: {} } },
			});
		});
		expect(textOf(r)).toBe("pro");
		act(() => r.unmount());
	});

	test("a customer-info change with no entitlement keeps it free", async () => {
		mockIsPro.mockResolvedValue(false);
		let r!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			r = TestRenderer.create(<Probe />);
		});
		await act(async () => {
			customerCb?.({ entitlements: { active: {} } });
		});
		expect(textOf(r)).toBe("free");
		act(() => r.unmount());
	});
});

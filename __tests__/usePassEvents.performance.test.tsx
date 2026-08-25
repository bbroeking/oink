import React from "react";
import TestRenderer, { act } from "react-test-renderer";

const mockRpc = jest.fn();
jest.mock("@/utils/rpc", () => ({
	rpc: (...args: unknown[]) => mockRpc(...args),
}));
jest.mock("expo-router", () => ({
	router: { push: jest.fn() },
}));

import { usePassEvents, type UsePassEvents } from "../hooks/usePassEvents";

function Probe({
	valueRef,
}: {
	valueRef: React.MutableRefObject<UsePassEvents | null>;
}) {
	const value = usePassEvents({ showToast: jest.fn() });
	React.useEffect(() => {
		valueRef.current = value;
	}, [value, valueRef]);
	return null;
}

describe("pass-event polling performance", () => {
	beforeEach(() => {
		mockRpc.mockReset();
	});

	test("coalesces a burst of checks into one in-flight server read", async () => {
		let resolveRpc!: (value: unknown[]) => void;
		mockRpc.mockImplementation(
			() => new Promise<unknown[]>((resolve) => (resolveRpc = resolve)),
		);

		let renderer!: TestRenderer.ReactTestRenderer;
		const valueRef = { current: null } as React.MutableRefObject<UsePassEvents | null>;
		await act(async () => {
			renderer = TestRenderer.create(<Probe valueRef={valueRef} />);
		});

		const checks = Array.from({ length: 20 }, () => valueRef.current!.check());
		expect(mockRpc).toHaveBeenCalledTimes(1);

		resolveRpc([]);
		await act(async () => {
			await Promise.all(checks);
		});
		act(() => renderer.unmount());
	});
});

import React, { useEffect } from "react";
import TestRenderer, { act } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  HABITAT_EXPANSION_VERSION,
  habitatExpansionDismissedKey,
  habitatExpansionPendingAckKey,
  useHabitatExpansionDiscovery,
  type HabitatExpansionDiscoveryBackend,
} from "@/hooks/useHabitatExpansionDiscovery";

let current: ReturnType<typeof useHabitatExpansionDiscovery>;
function Probe({
  accountId,
  enabled,
  backend,
}: {
  accountId: string | null;
  enabled: boolean;
  backend: HabitatExpansionDiscoveryBackend;
}) {
  const state = useHabitatExpansionDiscovery(accountId, enabled, backend);
  useEffect(() => { current = state; });
  return null;
}
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe("useHabitatExpansionDiscovery", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("stays inert while disabled or signed out", async () => {
    const backend = { fetch: jest.fn(), acknowledge: jest.fn() };
    await act(async () => {
      TestRenderer.create(<Probe accountId={null} enabled backend={backend} />);
    });
    expect(backend.fetch).not.toHaveBeenCalled();
  });

  it("dismisses offline and retries the same durable acknowledgement after remount", async () => {
    const acknowledge = jest
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ ok: true, replayed: true });
    const backend: HabitatExpansionDiscoveryBackend = {
      fetch: jest.fn().mockResolvedValue({
        ok: true,
        available: true,
        pending: true,
        version: HABITAT_EXPANSION_VERSION,
      }),
      acknowledge,
    };
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <Probe accountId="a" enabled backend={backend} />,
      );
    });
    expect(current.pending).toBe(true);
    await act(async () => {
      expect(await current.acknowledge()).toBe(true);
    });
    expect(current.pending).toBe(false);
    const requestId = await AsyncStorage.getItem(
      habitatExpansionPendingAckKey("a"),
    );
    expect(await AsyncStorage.getItem(habitatExpansionDismissedKey("a"))).toBe(
      "1",
    );
    expect(requestId).toEqual(expect.any(String));
    act(() => tree.unmount());

    await act(async () => {
      tree = TestRenderer.create(
        <Probe accountId="a" enabled backend={backend} />,
      );
    });
    expect(current.pending).toBe(false);
    expect(acknowledge.mock.calls[1][1]).toBe(acknowledge.mock.calls[0][1]);
    expect(acknowledge.mock.calls[1][1]).toBe(requestId);
    expect(
      await AsyncStorage.getItem(habitatExpansionPendingAckKey("a")),
    ).toBeNull();
    act(() => tree.unmount());
  });

  it("does not announce when the server says the catalog is unavailable", async () => {
    const backend: HabitatExpansionDiscoveryBackend = {
      fetch: jest.fn().mockResolvedValue({
        ok: true,
        available: false,
        pending: true,
        version: HABITAT_EXPANSION_VERSION,
      }),
      acknowledge: jest.fn(),
    };
    await act(async () => {
      TestRenderer.create(<Probe accountId="a" enabled backend={backend} />);
    });
    expect(current.available).toBe(false);
    expect(current.pending).toBe(false);
    expect(backend.acknowledge).not.toHaveBeenCalled();
  });

  it("ignores a stale response after an account switch", async () => {
    const first = deferred<{
      ok: true;
      available: boolean;
      pending: boolean;
      version: string;
    }>();
    const backend: HabitatExpansionDiscoveryBackend = {
      fetch: jest
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockResolvedValueOnce({
          ok: true,
          available: true,
          pending: false,
          version: HABITAT_EXPANSION_VERSION,
        }),
      acknowledge: jest.fn(),
    };
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <Probe accountId="a" enabled backend={backend} />,
      );
    });
    await act(async () => {
      tree.update(<Probe accountId="b" enabled backend={backend} />);
    });
    first.resolve({
      ok: true,
      available: true,
      pending: true,
      version: HABITAT_EXPANSION_VERSION,
    });
    await act(async () => {});
    expect(current.pending).toBe(false);
    act(() => tree.unmount());
  });

  it("keeps dismissal and acknowledgement requests scoped to the initiating account", async () => {
    const acknowledgement = deferred<{ ok: true; replayed: boolean }>();
    const backend: HabitatExpansionDiscoveryBackend = {
      fetch: jest.fn().mockResolvedValue({
        ok: true,
        available: true,
        pending: true,
        version: HABITAT_EXPANSION_VERSION,
      }),
      acknowledge: jest.fn().mockReturnValue(acknowledgement.promise),
    };
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <Probe accountId="a" enabled backend={backend} />,
      );
    });
    await act(async () => {
      expect(await current.acknowledge()).toBe(true);
    });
    await act(async () => {
      tree.update(<Probe accountId="b" enabled backend={backend} />);
    });
    expect(current.pending).toBe(true);
    acknowledgement.resolve({ ok: true, replayed: false });
    await act(async () => {});
    expect(
      await AsyncStorage.getItem(habitatExpansionDismissedKey("b")),
    ).toBeNull();
    expect(current.pending).toBe(true);
    act(() => tree.unmount());
  });

  it("never traps the optional popup when local persistence rejects", async () => {
    const backend: HabitatExpansionDiscoveryBackend = {
      fetch: jest.fn().mockResolvedValue({
        ok: true,
        available: true,
        pending: true,
        version: HABITAT_EXPANSION_VERSION,
      }),
      acknowledge: jest.fn().mockRejectedValue(new Error("offline")),
    };
    const storage = jest
      .spyOn(AsyncStorage, "multiSet")
      .mockRejectedValueOnce(new Error("storage unavailable"));
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <Probe accountId="a" enabled backend={backend} />,
      );
    });
    await act(async () => {
      expect(await current.acknowledge()).toBe(true);
    });
    expect(current.pending).toBe(false);
    expect(backend.acknowledge).toHaveBeenCalledTimes(1);
    storage.mockRestore();
    act(() => tree.unmount());
  });
});

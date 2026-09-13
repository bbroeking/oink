import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  acknowledgeHabitatExpansion,
  createHabitatRequestId,
  fetchHabitatExpansionDiscovery,
} from "@/utils/habitat";

export const HABITAT_EXPANSION_VERSION = "barn100:v1";

export type HabitatExpansionDiscoveryState = {
  available: boolean;
  pending: boolean;
  version: string | null;
};

type DiscoveryResult =
  | { ok: true; available: boolean; pending: boolean; version: string }
  | { ok: false };
type AcknowledgeResult = { ok: true; replayed: boolean } | { ok: false };

export type HabitatExpansionDiscoveryBackend = {
  fetch: () => Promise<DiscoveryResult>;
  acknowledge: (
    version: string,
    requestId: string,
  ) => Promise<AcknowledgeResult>;
};

const habitatExpansionDiscoveryBackend: HabitatExpansionDiscoveryBackend =
  {
    fetch: fetchHabitatExpansionDiscovery,
    acknowledge: acknowledgeHabitatExpansion,
  };

export const habitatExpansionDismissedKey = (accountId: string) =>
  `habitat:expansion:${HABITAT_EXPANSION_VERSION}:${accountId}:dismissed`;
export const habitatExpansionPendingAckKey = (accountId: string) =>
  `habitat:expansion:${HABITAT_EXPANSION_VERSION}:${accountId}:pending-ack`;

export function useHabitatExpansionDiscovery(
  accountId: string | null,
  enabled: boolean,
  backend: HabitatExpansionDiscoveryBackend = habitatExpansionDiscoveryBackend,
) {
  const [state, setState] = useState<HabitatExpansionDiscoveryState>({
    available: false,
    pending: false,
    version: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedAccountId, setResolvedAccountId] = useState<string | null>(
    null,
  );
  const generation = useRef(0);
  const activeAccount = useRef(accountId);
  activeAccount.current = accountId;
  const request = useRef<{ accountId: string; id: string } | null>(null);

  const confirm = useCallback(
    async (id: string, version: string, requestId: string) => {
      try {
        const result = await backend.acknowledge(version, requestId);
        if (result.ok)
          await AsyncStorage.removeItem(habitatExpansionPendingAckKey(id));
      } catch {
        // The durable request remains for the next refresh or login.
      }
    },
    [backend],
  );

  const refresh = useCallback(async () => {
    const callGeneration = ++generation.current;
    if (!accountId || !enabled) {
      setState({ available: false, pending: false, version: null });
      setResolvedAccountId(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const stored = await AsyncStorage.multiGet([
        habitatExpansionDismissedKey(accountId),
        habitatExpansionPendingAckKey(accountId),
      ]);
      if (callGeneration !== generation.current) return;
      const locallyDismissed = stored[0]?.[1] === "1";
      let pendingRequestId = stored[1]?.[1] ?? null;
      if (locallyDismissed && !pendingRequestId) {
        pendingRequestId = createHabitatRequestId();
        await AsyncStorage.setItem(
          habitatExpansionPendingAckKey(accountId),
          pendingRequestId,
        );
      }
      if (pendingRequestId)
        request.current = { accountId, id: pendingRequestId };

      const result = await backend.fetch();
      if (callGeneration !== generation.current) return;
      if (!result.ok || result.version !== HABITAT_EXPANSION_VERSION) {
        setState({ available: false, pending: false, version: null });
        setResolvedAccountId(accountId);
        setError(result.ok ? null : "Could not check Barn updates.");
        return;
      }
      setState({
        available: result.available,
        pending: result.available && result.pending && !locallyDismissed,
        version: result.version,
      });
      setResolvedAccountId(accountId);
      setError(null);
      if (locallyDismissed && result.pending && pendingRequestId)
        void confirm(accountId, result.version, pendingRequestId);
      else if (!result.pending)
        void AsyncStorage.removeItem(habitatExpansionPendingAckKey(accountId));
    } catch {
      if (callGeneration === generation.current) {
        setResolvedAccountId(accountId);
        setError("Could not check Barn updates.");
      }
    } finally {
      if (callGeneration === generation.current) setLoading(false);
    }
  }, [accountId, confirm, backend, enabled]);

  useEffect(() => {
    void refresh();
    return () => {
      generation.current += 1;
    };
  }, [refresh]);

  const acknowledge = useCallback(async () => {
    if (!accountId || !enabled || !state.pending || !state.version)
      return false;
    const callGeneration = generation.current;
    if (request.current?.accountId !== accountId)
      request.current = { accountId, id: createHabitatRequestId() };
    const requestId = request.current.id;
    setLoading(true);
    try {
      await AsyncStorage.multiSet([
        [habitatExpansionDismissedKey(accountId), "1"],
        [habitatExpansionPendingAckKey(accountId), requestId],
      ]);
    } catch {
      // Optional discovery must still be dismissible if local storage is down.
    }
    if (
      callGeneration !== generation.current ||
      activeAccount.current !== accountId
    )
      return false;
    setState((current) => ({ ...current, pending: false }));
    setError(null);
    setLoading(false);
    void confirm(accountId, state.version, requestId);
    return true;
  }, [accountId, confirm, enabled, state.pending, state.version]);

  const current = resolvedAccountId === accountId;
  return {
    ...state,
    available: current && state.available,
    pending: current && state.pending,
    loading,
    error: current ? error : null,
    refresh,
    acknowledge,
  };
}

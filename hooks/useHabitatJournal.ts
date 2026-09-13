import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  ackHabitatAcquisitions,
  fetchHabitatJournal,
  setHabitatWishlist,
  type AcquisitionAckKind,
  type HabitatJournal,
} from "@/utils/habitatCompletion";

export type HabitatJournalBackend = {
  fetch: typeof fetchHabitatJournal;
  acknowledge: typeof ackHabitatAcquisitions;
  wishlist: typeof setHabitatWishlist;
};
const production: HabitatJournalBackend = {
  fetch: fetchHabitatJournal,
  acknowledge: ackHabitatAcquisitions,
  wishlist: setHabitatWishlist,
};
type Pending = { presented: string[]; seen: string[] };
const emptyPending = (): Pending => ({ presented: [], seen: [] });
const empty: HabitatJournal = { acquisitions: [], wishlist: [] };
const pendingKey = (id: string) => `habitat:journal:v1:${id}:ack`;
const listeners = new Map<string, Set<() => void>>();
const storageQueues = new Map<string, Promise<unknown>>();
const wishlistQueues = new Map<string, Promise<unknown>>();
function serial<T>(
  queues: Map<string, Promise<unknown>>,
  id: string,
  operation: () => Promise<T>,
): Promise<T> {
  const next = (queues.get(id) ?? Promise.resolve())
    .catch(() => {})
    .then(operation);
  queues.set(id, next);
  void next
    .finally(() => {
      if (queues.get(id) === next) queues.delete(id);
    })
    .catch(() => {});
  return next;
}
function notify(id: string) {
  listeners.get(id)?.forEach((refresh) => refresh());
}
async function readPending(id: string): Promise<Pending> {
  const raw = await AsyncStorage.getItem(pendingKey(id));
  if (!raw) return emptyPending();
  try {
    const value = JSON.parse(raw);
    return Object.fromEntries(
      ["presented", "seen"].map((kind) => [
        kind,
        Array.isArray(value?.[kind])
          ? value[kind].filter((v: unknown) => typeof v === "string")
          : [],
      ]),
    ) as Pending;
  } catch {
    return emptyPending();
  }
}
function applyPending(
  journal: HabitatJournal,
  pending: Pending,
): HabitatJournal {
  return {
    ...journal,
    acquisitions: journal.acquisitions.map((entry) => ({
      ...entry,
      presented: entry.presented || pending.presented.includes(entry.id),
      seen: entry.seen || pending.seen.includes(entry.id),
    })),
  };
}

/** Owner-scoped journal. Dismissals survive offline/relaunch; New clears separately. */
export function useHabitatJournal(
  accountId: string | null,
  backend: HabitatJournalBackend = production,
) {
  const [state, setState] = useState<{
    id: string | null;
    data: HabitatJournal;
    loading: boolean;
    supported: boolean;
    error: string | null;
  }>({
    id: accountId,
    data: empty,
    loading: !!accountId,
    supported: false,
    error: null,
  });
  const current = useRef(accountId);
  const lifecycle = useRef(0);
  const generation = useRef(0);
  const isCurrent = useCallback((id: string) => current.current === id, []);
  const flush = useCallback(
    async (id: string, epoch: number) => {
      const active = () => isCurrent(id) && lifecycle.current === epoch;
      for (const kind of ["presented", "seen"] as const) {
        const pending = await readPending(id);
        if (!pending[kind].length || !active()) continue;
        for (let offset = 0; offset < pending[kind].length; offset += 100) {
          if (!active()) return;
          const sent = pending[kind].slice(offset, offset + 100);
          const result = await backend
            .acknowledge(sent, kind)
            .catch(() => null);
          if (!active()) return;
          if (!result?.ok) break;
          await serial(storageQueues, id, async () => {
            if (!active()) return;
            const latest = await readPending(id);
            if (!active()) return;
            const acknowledged = new Set(sent);
            latest[kind] = latest[kind].filter(
              (entry) => !acknowledged.has(entry),
            );
            await AsyncStorage.setItem(pendingKey(id), JSON.stringify(latest));
          });
        }
      }
    },
    [backend, isCurrent],
  );
  const refresh = useCallback(async () => {
    const id = accountId;
    if (!id || !isCurrent(id)) return;
    const epoch = lifecycle.current;
    const request = ++generation.current;
    try {
      const pending = await readPending(id);
      // Network reconciliation is deliberately detached from the local read.
      // A stalled request must never block a durable Later/Seen choice.
      void flush(id, epoch).catch(() => {});
      if (!isCurrent(id) || request !== generation.current) return;
      const result = await backend.fetch();
      if (!isCurrent(id) || request !== generation.current) return;
      if (result.ok) {
        setState({
          id,
          data: applyPending(result, pending),
          loading: false,
          supported: true,
          error: null,
        });
      } else {
        setState((old) => ({
          ...old,
          id,
          data: old.id === id ? old.data : empty,
          loading: false,
          error: result.reason,
          supported: old.id === id && old.supported,
        }));
      }
    } catch {
      if (isCurrent(id) && request === generation.current)
        setState((old) => ({
          ...old,
          id,
          data: old.id === id ? old.data : empty,
          loading: false,
          error: "network",
          supported: old.id === id && old.supported,
        }));
    }
  }, [accountId, backend, flush, isCurrent]);
  useEffect(() => {
    ++lifecycle.current;
    current.current = accountId;
    if (!accountId) return;
    const callbacks = listeners.get(accountId) ?? new Set();
    const update = () => {
      void refresh();
    };
    callbacks.add(update);
    listeners.set(accountId, callbacks);
    return () => {
      ++lifecycle.current;
      callbacks.delete(update);
      if (!callbacks.size) listeners.delete(accountId);
      ++generation.current;
      current.current = null;
    };
  }, [accountId, refresh]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  const acknowledge = useCallback(
    async (ids: string[], kind: AcquisitionAckKind) => {
      const id = accountId;
      if (!id || !isCurrent(id)) return false;
      const epoch = lifecycle.current;
      if (!ids.length) return true;
      return serial(storageQueues, id, async () => {
        if (!isCurrent(id)) return false;
        try {
          const pending = await readPending(id);
          pending[kind] = [...new Set([...pending[kind], ...ids])];
          await AsyncStorage.setItem(pendingKey(id), JSON.stringify(pending));
          if (!isCurrent(id)) return false;
          ++generation.current;
          setState((old) =>
            old.id === id
              ? { ...old, data: applyPending(old.data, pending) }
              : old,
          );
          // The local receipt is enough to dismiss. Network replay never occupies
          // the storage queue, so a hung request cannot block later local choices.
          void flush(id, epoch)
            .then(() => {
              if (isCurrent(id) && lifecycle.current === epoch) notify(id);
            })
            .catch(() => {});
          return true;
        } catch {
          if (isCurrent(id)) setState((old) => ({ ...old, error: "storage" }));
          return false;
        }
      });
    },
    [accountId, flush, isCurrent],
  );
  const setWishlisted = useCallback(
    async (itemId: string, saved: boolean) => {
      const id = accountId;
      if (!id || !isCurrent(id)) return false;
      return serial(wishlistQueues, id, async () => {
        if (!isCurrent(id)) return false;
        try {
          const result = await backend.wishlist(itemId, saved);
          if (!isCurrent(id)) return false;
          if (!result.ok) {
            setState((old) => ({ ...old, error: result.reason }));
            return false;
          }
          ++generation.current;
          setState((old) =>
            old.id === id
              ? {
                  ...old,
                  error: null,
                  data: { ...old.data, wishlist: result.wishlist },
                }
              : old,
          );
          notify(id);
          return true;
        } catch {
          if (isCurrent(id)) setState((old) => ({ ...old, error: "network" }));
          return false;
        }
      });
    },
    [accountId, backend, isCurrent],
  );
  const data = state.id === accountId && accountId ? state.data : empty;
  const newItemIds = useMemo(
    () =>
      new Set(
        data.acquisitions
          .filter(
            (entry) =>
              entry.newlyOwned &&
              !entry.seen &&
              entry.source !== "habitat_starter",
          )
          .map((entry) => entry.itemId),
      ),
    [data],
  );
  return {
    ...data,
    newItemIds,
    loading: !!accountId && (state.id !== accountId || state.loading),
    supported: state.id === accountId && state.supported,
    error: state.id === accountId ? state.error : null,
    refresh,
    setWishlisted,
    markPresented: useCallback(
      (ids: string[]) => acknowledge(ids, "presented"),
      [acknowledge],
    ),
    markSeen: useCallback(
      (ids: string[]) => acknowledge(ids, "seen"),
      [acknowledge],
    ),
  };
}

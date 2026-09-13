import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  buyHabitatItem,
  claimHabitatStarter,
  createHabitatDraft,
  createHabitatRequestId,
  draftSnapshot,
  fetchMyHabitat,
  habitatDraftDirty,
  habitatDraftPlace,
  habitatDraftRemove,
  habitatDraftUndo,
  saveHabitat,
  parseHabitatOwnerData,
  type HabitatCatalogItem,
  type HabitatDraft,
  type HabitatOwnerData,
  type HabitatPosition,
  type HabitatSnapshot,
  type SaveHabitatInput,
} from "@/utils/habitat";

type PendingCommand =
  | { kind: "save"; accountId: string; input: SaveHabitatInput }
  | { kind: "buy"; accountId: string; itemId: string; requestId: string };
export type HabitatConflict = {
  latest: HabitatSnapshot;
  preservedDraft: HabitatDraft;
  reviewing?: boolean;
};
export type HabitatBackend = {
  fetch: typeof fetchMyHabitat;
  claim: typeof claimHabitatStarter;
  save: typeof saveHabitat;
  buy: typeof buyHabitatItem;
};
const productionBackend: HabitatBackend = {
  fetch: fetchMyHabitat,
  claim: claimHabitatStarter,
  save: saveHabitat,
  buy: buyHabitatItem,
};
const cacheKey = (id: string) => `habitat:v1:${id}:confirmed`;
const draftKey = (id: string) => `habitat:v1:${id}:draft`;
const commandKey = (id: string) => `habitat:v1:${id}:pending`;
const starterWelcomeKey = (id: string) =>
  `habitat:v1:${id}:starter-welcome-seen`;
const starterWelcomePendingKey = (id: string) =>
  `habitat:v1:${id}:starter-welcome-pending`;
const safeParse = <T>(raw: string | null): T | null => {
  try {
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const positionKeys: readonly HabitatPosition[] = [
  "interior_background",
  "wall",
  "ceiling",
  "floor_left",
  "floor_right",
  "floor_centerpiece",
  "surface",
];
const parseDraftPositions = (
  value: unknown,
): HabitatDraft["positions"] | null => {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== positionKeys.length ||
    !positionKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(value, key) &&
        (value[key] === null || typeof value[key] === "string"),
    )
  )
    return null;
  return Object.fromEntries(
    positionKeys.map((key) => [key, value[key]]),
  ) as HabitatDraft["positions"];
};
const parsePersistedDraft = (value: unknown): HabitatDraft | null => {
  if (
    !isRecord(value) ||
    !Number.isSafeInteger(value.baseRevision) ||
    (value.baseRevision as number) < 0 ||
    !Array.isArray(value.history)
  )
    return null;
  const positions = parseDraftPositions(value.positions);
  const history = value.history.map(parseDraftPositions);
  if (!positions || history.some((entry) => !entry)) return null;
  return {
    positions,
    history: history as HabitatDraft["history"],
    baseRevision: value.baseRevision as number,
  };
};
const parsePendingCommand = (value: unknown): PendingCommand | null => {
  if (!isRecord(value) || typeof value.accountId !== "string") return null;
  if (value.kind === "buy") {
    return typeof value.itemId === "string" &&
      value.itemId.length > 0 &&
      typeof value.requestId === "string" &&
      value.requestId.length > 0
      ? {
          kind: "buy",
          accountId: value.accountId,
          itemId: value.itemId,
          requestId: value.requestId,
        }
      : null;
  }
  if (value.kind !== "save" || !isRecord(value.input)) return null;
  const positions = parseDraftPositions(value.input.positions);
  if (
    !positions ||
    !Number.isSafeInteger(value.input.expectedRevision) ||
    (value.input.expectedRevision as number) < 0 ||
    typeof value.input.requestId !== "string" ||
    value.input.requestId.length === 0
  )
    return null;
  return {
    kind: "save",
    accountId: value.accountId,
    input: {
      expectedRevision: value.input.expectedRevision as number,
      requestId: value.input.requestId,
      positions,
    },
  };
};
const isIndeterminate = (reason: string) =>
  ["network", "no_data", "invalid_response", "storage", "unknown"].includes(
    reason,
  );
const activeMutationAccounts = new Set<string>();

export function useHabitat(
  accountId: string | null,
  backend: HabitatBackend = productionBackend,
) {
  const [data, setData] = useState<HabitatOwnerData | null>(null);
  const [draft, setDraft] = useState<HabitatDraft | null>(null);
  const [loading, setLoading] = useState(true),
    [offline, setOffline] = useState(false),
    [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null),
    [conflict, setConflict] = useState<HabitatConflict | null>(null);
  const [starterWelcomePending, setStarterWelcomePending] = useState(false);
  const generation = useRef(0);
  const accountRef = useRef(accountId),
    mutationBusy = useRef(false);
  accountRef.current = accountId;
  const acceptData = useCallback(
    (next: HabitatOwnerData, preserveDraft = false) =>
      setData((current) => {
        if (
          current &&
          current.snapshot.ownerId === next.snapshot.ownerId &&
          current.snapshot.revision > next.snapshot.revision
        )
          return current;
        if (!preserveDraft) setDraft(createHabitatDraft(next.snapshot));
        return next;
      }),
    [],
  );

  const recoverPending = useCallback(
    async (id: string, current: HabitatOwnerData | null) => {
      const pendingRaw = await AsyncStorage.getItem(commandKey(id));
      const pending = parsePendingCommand(safeParse(pendingRaw));
      if (!pending || pending.accountId !== id) {
        if (pendingRaw) await AsyncStorage.removeItem(commandKey(id));
        return null;
      }
      if (accountRef.current !== id) return null;
      if (activeMutationAccounts.has(id)) return null;
      let recovered: PendingCommand["kind"] | null = null;
      activeMutationAccounts.add(id);
      mutationBusy.current = true;
      try {
        if (pending.kind === "save") {
          const result = await backend.save(pending.input);
          if (accountRef.current !== id) return;
          if (result.ok) {
            let acknowledged = current
              ? result.snapshot.revision >= current.snapshot.revision
                ? { ...current, snapshot: result.snapshot }
                : current
              : null;
            if (!acknowledged) {
              const fresh = await backend
                .fetch()
                .catch(() => ({ ok: false as const, reason: "network" }));
              if (accountRef.current !== id) return;
              if (
                fresh.ok &&
                fresh.snapshot.revision >= result.snapshot.revision
              )
                acknowledged = fresh;
            }
            if (acknowledged) {
              const cleanDraft = createHabitatDraft(acknowledged.snapshot);
              await AsyncStorage.setItem(
                cacheKey(id),
                JSON.stringify(acknowledged),
              );
              await AsyncStorage.setItem(
                draftKey(id),
                JSON.stringify(cleanDraft),
              );
              await AsyncStorage.removeItem(commandKey(id));
              if (accountRef.current !== id) return;
              recovered = "save";
              acceptData(acknowledged);
              setConflict(null);
            }
          } else if (!isIndeterminate(result.reason)) {
            await AsyncStorage.removeItem(commandKey(id));
            if (result.reason === "revision_conflict" && result.snapshot)
              setConflict({
                latest: result.snapshot,
                preservedDraft: {
                  positions: pending.input.positions,
                  history: [],
                  baseRevision: pending.input.expectedRevision,
                },
              });
          }
        } else {
          const result = await backend.buy(pending.itemId, pending.requestId);
          if (accountRef.current !== id) return;
          if (result.ok) {
            let acknowledged: HabitatOwnerData | null = null;
            if (current) {
              acknowledged = {
                ...current,
                currentSnouts: result.currentSnouts,
                owned: current.owned.some((item) => item.id === result.item.id)
                  ? current.owned
                  : [...current.owned, result.item],
              };
            }
            if (!acknowledged) {
              const fresh = await backend
                .fetch()
                .catch(() => ({ ok: false as const, reason: "network" }));
              if (accountRef.current !== id) return;
              if (fresh.ok) acknowledged = fresh;
            }
            if (acknowledged) {
              await AsyncStorage.setItem(
                cacheKey(id),
                JSON.stringify(acknowledged),
              );
              await AsyncStorage.removeItem(commandKey(id));
              if (accountRef.current !== id) return;
              recovered = "buy";
              acceptData(acknowledged, true);
            }
          } else if (!isIndeterminate(result.reason))
            await AsyncStorage.removeItem(commandKey(id));
        }
      } finally {
        mutationBusy.current = false;
        activeMutationAccounts.delete(id);
      }
      return recovered;
    },
    [acceptData, backend],
  );

  const refresh = useCallback(async () => {
    if (!accountId) {
      setLoading(false);
      setData(null);
      return;
    }
    const run = ++generation.current;
    setLoading(true);
    setError(null);
    const stored = parsePersistedDraft(
      safeParse(
        await AsyncStorage.getItem(draftKey(accountId)).catch(() => null),
      ),
    );
    const welcomeSeen =
      (await AsyncStorage.getItem(starterWelcomeKey(accountId)).catch(
        () => null,
      )) === "1";
    const welcomePendingStored =
      (await AsyncStorage.getItem(starterWelcomePendingKey(accountId)).catch(
        () => null,
      )) === "1";
    if (run !== generation.current || accountRef.current !== accountId) return;
    if (!welcomeSeen && welcomePendingStored) setStarterWelcomePending(true);
    const cached = parseHabitatOwnerData(
      safeParse(
        await AsyncStorage.getItem(cacheKey(accountId)).catch(() => null),
      ),
    );
    if (cached && cached.snapshot.ownerId !== accountId) {
      await AsyncStorage.removeItem(cacheKey(accountId)).catch(() => {});
    }
    if (run !== generation.current || accountRef.current !== accountId) return;
    if (cached?.snapshot.ownerId === accountId) {
      acceptData(cached, true);
      if (stored?.positions && stored.baseRevision === cached.snapshot.revision)
        setDraft(stored);
      else setDraft(createHabitatDraft(cached.snapshot));
      setOffline(true);
    }
    const recoveredCommand = await recoverPending(
      accountId,
      cached?.snapshot.ownerId === accountId ? cached : null,
    ).catch(() => {
      if (accountRef.current === accountId) setError("storage");
      return null;
    });
    if (run !== generation.current || accountRef.current !== accountId) return;
    let result = await backend
      .fetch()
      .catch(() => ({ ok: false as const, reason: "network" }));
    if (!result.ok && result.reason === "not_found") {
      if (!welcomeSeen) {
        await AsyncStorage.setItem(
          starterWelcomePendingKey(accountId),
          "1",
        ).catch(() => {});
        if (run !== generation.current || accountRef.current !== accountId)
          return;
      }
      result = await backend
        .claim()
        .catch(() => ({ ok: false as const, reason: "network" }));
      if (!result.ok && !isIndeterminate(result.reason))
        await AsyncStorage.removeItem(
          starterWelcomePendingKey(accountId),
        ).catch(() => {});
    }
    if (run !== generation.current || accountRef.current !== accountId) return;
    if (result.ok) {
      const durableRecovery = recoveredCommand
        ? parseHabitatOwnerData(
            safeParse(
              await AsyncStorage.getItem(cacheKey(accountId)).catch(() => null),
            ),
          )
        : null;
      if (run !== generation.current || accountRef.current !== accountId)
        return;
      const next: HabitatOwnerData =
        durableRecovery?.snapshot.ownerId === accountId &&
        (durableRecovery.snapshot.revision > result.snapshot.revision ||
          (recoveredCommand === "buy" &&
            durableRecovery.snapshot.revision === result.snapshot.revision &&
            !durableRecovery.owned.every((confirmed) =>
              result.owned.some((item) => item.id === confirmed.id),
            )))
          ? durableRecovery
          : result;
      acceptData(next, true);
      // Login or an authorized friend visit may have prepared the room first.
      // Introduce confirmed starter ownership on this device even without a claim.
      if (!welcomeSeen) {
        await AsyncStorage.setItem(
          starterWelcomePendingKey(accountId),
          "1",
        ).catch(() => {});
        if (run !== generation.current || accountRef.current !== accountId)
          return;
        setStarterWelcomePending(true);
      }
      setOffline(false);
      await AsyncStorage.setItem(
        cacheKey(accountId),
        JSON.stringify(next),
      ).catch(() => {});
      if (run !== generation.current || accountRef.current !== accountId)
        return;
      if (stored?.positions && recoveredCommand !== "save") {
        if (stored.baseRevision === next.snapshot.revision) setDraft(stored);
        else {
          setDraft(createHabitatDraft(next.snapshot));
          // A pristine persisted draft is just the previous confirmed room.
          // Preset activation (or another device's save) can safely replace it.
          // Only offer conflict recovery when there are actual unsaved changes,
          // or when the cached base is unavailable and that cannot be proven.
          const wasClean = cached?.snapshot.ownerId === accountId &&
            stored.baseRevision === cached.snapshot.revision &&
            !habitatDraftDirty(stored, cached.snapshot);
          setConflict(wasClean ? null : { latest: next.snapshot, preservedDraft: stored });
        }
      } else setDraft(createHabitatDraft(next.snapshot));
    } else {
      setError(result.reason);
      setOffline(cached?.snapshot.ownerId === accountId);
    }
    setLoading(false);
  }, [accountId, acceptData, recoverPending, backend]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  useEffect(() => {
    setData(null);
    setDraft(null);
    setConflict(null);
    setError(null);
    setStarterWelcomePending(false);
  }, [accountId]);
  useEffect(() => {
    if (accountId && draft && data?.snapshot.ownerId === accountId)
      void AsyncStorage.setItem(
        draftKey(accountId),
        JSON.stringify(draft),
      ).catch(() => {
        if (accountRef.current === accountId) setError("storage");
      });
  }, [accountId, draft, data?.snapshot.ownerId]);

  const place = useCallback(
    (position: HabitatPosition, item: HabitatCatalogItem) =>
      setDraft((d) => (d ? habitatDraftPlace(d, position, item) : d)),
    [],
  );
  const remove = useCallback(
    (position: HabitatPosition) =>
      setDraft((d) => (d ? habitatDraftRemove(d, position) : d)),
    [],
  );
  const undo = useCallback(
    () => setDraft((d) => (d ? habitatDraftUndo(d) : d)),
    [],
  );
  const cancel = useCallback(() => {
    if (data) setDraft(createHabitatDraft(data.snapshot));
    setConflict(null);
  }, [data]);
  const dismissStarterWelcome = useCallback(() => {
    if (!accountId) return;
    setStarterWelcomePending(false);
    void AsyncStorage.setItem(starterWelcomeKey(accountId), "1").catch(
      () => {},
    );
    void AsyncStorage.removeItem(starterWelcomePendingKey(accountId)).catch(
      () => {},
    );
  }, [accountId]);
  const reviewLatest = useCallback(() => {
    if (!conflict || !data) return;
    setData({ ...data, snapshot: conflict.latest });
    setDraft(createHabitatDraft(conflict.latest));
    setConflict({ ...conflict, reviewing: true });
  }, [conflict, data]);
  const reapply = useCallback(() => {
    if (!conflict || !data) return;
    setData({ ...data, snapshot: conflict.latest });
    setDraft({
      ...conflict.preservedDraft,
      baseRevision: conflict.latest.revision,
    });
    setConflict(null);
  }, [conflict, data]);
  const save = useCallback(async () => {
    if (
      !accountId ||
      !data ||
      !draft ||
      saving ||
      offline ||
      mutationBusy.current ||
      activeMutationAccounts.has(accountId)
    )
      return {
        ok: false as const,
        reason: offline ? "offline" : "unavailable",
      };
    mutationBusy.current = true;
    activeMutationAccounts.add(accountId);
    try {
      if (await AsyncStorage.getItem(commandKey(accountId)))
        return { ok: false as const, reason: "pending_command" };
      if (accountRef.current !== accountId)
        return { ok: false as const, reason: "account_changed" };
      const input = {
        expectedRevision: data.snapshot.revision,
        requestId: createHabitatRequestId(),
        positions: { ...draft.positions },
      };
      setSaving(true);
      setError(null);
      await AsyncStorage.setItem(
        commandKey(accountId),
        JSON.stringify({
          kind: "save",
          accountId,
          input,
        } satisfies PendingCommand),
      );
      if (accountRef.current !== accountId)
        return { ok: false as const, reason: "account_changed" };
      const result = await backend.save(input);
      if (accountRef.current !== accountId) return result;
      if (result.ok) {
        const acknowledged: HabitatOwnerData = {
          ...data,
          snapshot: result.snapshot,
        };
        const cleanDraft = createHabitatDraft(result.snapshot);
        await AsyncStorage.setItem(
          cacheKey(accountId),
          JSON.stringify(acknowledged),
        );
        await AsyncStorage.setItem(
          draftKey(accountId),
          JSON.stringify(cleanDraft),
        );
        await AsyncStorage.removeItem(commandKey(accountId));
        if (accountRef.current !== accountId) return result;
        acceptData(acknowledged);
        const fresh = await backend
          .fetch()
          .catch(() => ({ ok: false as const, reason: "network" }));
        if (accountRef.current !== accountId) return result;
        const useFresh =
          fresh.ok && fresh.snapshot.revision >= result.snapshot.revision;
        if (useFresh) {
          acceptData(fresh);
          await AsyncStorage.setItem(
            cacheKey(accountId),
            JSON.stringify(fresh),
          ).catch(() => {});
          await AsyncStorage.setItem(
            draftKey(accountId),
            JSON.stringify(createHabitatDraft(fresh.snapshot)),
          ).catch(() => {});
        }
      } else if (result.reason === "revision_conflict" && result.snapshot) {
        await AsyncStorage.removeItem(commandKey(accountId));
        setConflict({ latest: result.snapshot, preservedDraft: draft });
      } else if (!isIndeterminate(result.reason)) {
        await AsyncStorage.removeItem(commandKey(accountId));
        setError(result.reason);
      }
      return result;
    } catch {
      setError("storage");
      return { ok: false as const, reason: "storage" };
    } finally {
      mutationBusy.current = false;
      activeMutationAccounts.delete(accountId);
      setSaving(false);
    }
  }, [accountId, data, draft, saving, offline, acceptData, backend]);
  const buy = useCallback(
    async (item: HabitatCatalogItem) => {
      if (!accountId)
        return { ok: false as const, reason: "not_authenticated" };
      if (mutationBusy.current)
        return { ok: false as const, reason: "pending_command" };
      if (activeMutationAccounts.has(accountId))
        return { ok: false as const, reason: "pending_command" };
      mutationBusy.current = true;
      activeMutationAccounts.add(accountId);
      try {
        if (await AsyncStorage.getItem(commandKey(accountId)))
          return { ok: false as const, reason: "pending_command" };
        if (accountRef.current !== accountId)
          return { ok: false as const, reason: "account_changed" };
        const requestId = createHabitatRequestId();
        await AsyncStorage.setItem(
          commandKey(accountId),
          JSON.stringify({
            kind: "buy",
            accountId,
            itemId: item.id,
            requestId,
          } satisfies PendingCommand),
        );
        if (accountRef.current !== accountId)
          return { ok: false as const, reason: "account_changed" };
        const result = await backend.buy(item.id, requestId);
        if (accountRef.current !== accountId) return result;
        if (result.ok && data) {
          const acknowledged: HabitatOwnerData = {
            ...data,
            currentSnouts: result.currentSnouts,
            owned: data.owned.some((i) => i.id === result.item.id)
              ? data.owned
              : [...data.owned, result.item],
          };
          await AsyncStorage.setItem(
            cacheKey(accountId),
            JSON.stringify(acknowledged),
          );
          await AsyncStorage.removeItem(commandKey(accountId));
          if (accountRef.current !== accountId) return result;
          acceptData(acknowledged, true);
        } else if (!result.ok && !isIndeterminate(result.reason))
          await AsyncStorage.removeItem(commandKey(accountId));
        setError(result.ok ? null : result.reason);
        return result;
      } catch {
        setError("storage");
        return { ok: false as const, reason: "storage" };
      } finally {
        mutationBusy.current = false;
        activeMutationAccounts.delete(accountId);
      }
    },
    [accountId, data, acceptData, backend],
  );
  const preview = useMemo(
    () =>
      data && draft
        ? draftSnapshot(draft, data.snapshot, data.catalog)
        : (data?.snapshot ?? null),
    [data, draft],
  );
  return {
    data,
    draft,
    preview,
    loading,
    offline,
    saving,
    error,
    conflict,
    dirty: Boolean(data && draft && habitatDraftDirty(draft, data.snapshot)),
    place,
    remove,
    undo,
    cancel,
    save,
    buy,
    refresh,
    reviewLatest,
    reapply,
    starterWelcomePending,
    dismissStarterWelcome,
  };
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  activateHabitatPreset,
  fetchHabitatPresets,
  saveHabitatPreset,
  type HabitatPresetsData,
} from "@/utils/habitatCompletion";
import {
  createHabitatRequestId,
  type HabitatPositions,
  type HabitatSnapshot,
} from "@/utils/habitat";

export type HabitatPresetBackend = {
  fetch: typeof fetchHabitatPresets;
  save: typeof saveHabitatPreset;
  activate: typeof activateHabitatPreset;
};
const productionBackend: HabitatPresetBackend = {
  fetch: fetchHabitatPresets,
  save: saveHabitatPreset,
  activate: activateHabitatPreset,
};
type Pending =
  | {
      kind: "save";
      accountId: string;
      input: Parameters<typeof saveHabitatPreset>[0];
    }
  | {
      kind: "activate";
      accountId: string;
      input: Parameters<typeof activateHabitatPreset>[0];
    };
const key = (id: string) => `habitat:v1:${id}:preset-pending`;
const uncertain = (reason?: string) =>
  ["network", "unknown", "no_data", "invalid_response", "storage"].includes(
    reason ?? "",
  );
const failureMessage = (reason: string) => {
  switch (reason) {
    case "not_authenticated":
      return "Sign in again to use saved rooms.";
    case "invalid_request":
      return "Check the room name and arrangement, then try again.";
    case "not_found":
      return "That saved room is no longer available. Refresh your rooms.";
    case "not_owned":
      return "This arrangement includes an item you no longer own.";
    case "category_mismatch":
    case "duplicate_item":
      return "This arrangement is no longer valid. Review it and save again.";
    case "idempotency_mismatch":
      return "This saved-room request could not be verified. Try again.";
    default:
      return "Could not update saved rooms. Try again.";
  }
};
const isPending = (value: unknown, accountId: string): value is Pending => {
  if (!value || typeof value !== "object") return false;
  const pending = value as Partial<Pending>;
  return (
    pending.accountId === accountId &&
    (pending.kind === "save" || pending.kind === "activate") &&
    Boolean(pending.input && typeof pending.input === "object")
  );
};

export function useHabitatPresets(
  accountId: string | null,
  backend: HabitatPresetBackend = productionBackend,
) {
  const [data, setData] = useState<HabitatPresetsData | null>(null);
  const [dataAccountId, setDataAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const [storageReady, setStorageReady] = useState(false);
  const [conflict, setConflict] = useState<Pending | null>(null);
  const [conflictReason, setConflictReason] = useState<string | null>(null);
  const [recoveredActivation, setRecoveredActivation] =
    useState<HabitatSnapshot | null>(null);
  const account = useRef(accountId);
  const generation = useRef(0);
  const busyRef = useRef(false);
  const startingRef = useRef(false);
  account.current = accountId;

  const runPending = useCallback(async (pending: Pending, recovering = false) => {
    if (account.current !== pending.accountId || busyRef.current) return null;
    busyRef.current = true;
    setBusy(true);
    let result;
    try {
      result =
        pending.kind === "save"
          ? await backend.save(pending.input)
          : await backend.activate(pending.input);
    } catch {
      if (account.current === pending.accountId)
        setError("Could not confirm that change. Retry to safely check it.");
      return null;
    } finally {
      busyRef.current = false;
      if (account.current === pending.accountId) setBusy(false);
    }
    if (account.current !== pending.accountId) return null;
    if (result.ok) {
      if (recovering && pending.kind === "activate" && "snapshot" in result)
        setRecoveredActivation(result.snapshot);
      if (!(recovering && pending.kind === "activate")) {
        await AsyncStorage.removeItem(key(pending.accountId)).catch(() => {
          // Leaving the receipt is safe: the server request is idempotent.
        });
      }
      const fresh = await backend.fetch().catch(() => null);
      if (account.current !== pending.accountId) return result;
      if (fresh?.ok) {
        setData(fresh);
        setDataAccountId(pending.accountId);
      }
      setConflict(null);
      setConflictReason(null);
      setError(null);
      return result;
    }
    if (
      result.reason === "revision_conflict" ||
      result.reason === "preset_revision_conflict"
    ) {
      await AsyncStorage.removeItem(key(pending.accountId)).catch(() => {});
      setConflict(pending);
      setConflictReason(result.reason);
      setError("This room changed elsewhere. Review the latest rooms, then retry explicitly.");
      const fresh = await backend.fetch();
      if (account.current === pending.accountId && fresh.ok) {
        setData(fresh);
        setDataAccountId(pending.accountId);
      }
    } else if (!uncertain(result.reason)) {
      await AsyncStorage.removeItem(key(pending.accountId));
      setError(failureMessage(result.reason));
    } else setError("Could not confirm that change. Retry to safely check it.");
    return result;
  }, [backend]);

  const refresh = useCallback(async () => {
    const id = accountId;
    const run = ++generation.current;
    if (!id) {
      setLoading(false);
      setData(null);
      return;
    }
    setLoading(true);
    let raw: string | null;
    try {
      raw = await AsyncStorage.getItem(key(id));
      setStorageReady(true);
    } catch {
      if (run === generation.current && account.current === id) {
        setStorageReady(false);
        setError("Could not check saved-room requests on this device. Retry.");
        setLoading(false);
      }
      return;
    }
    let pending: Pending | null = null;
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      pending = isPending(parsed, id) ? parsed : null;
    } catch {
      // Invalid receipts are discarded below.
    }
    if (pending) await runPending(pending, true);
    else if (raw) await AsyncStorage.removeItem(key(id));
    const result = await backend.fetch();
    if (run !== generation.current || account.current !== id) return;
    if (result.ok) {
      setData(result);
      setDataAccountId(id);
      setSupported(true);
      setError(null);
    } else if (
      ["not_found", "unknown_function", "invalid_response"].includes(
        result.reason,
      )
    ) {
      setSupported(false);
      setData(null);
      setError(null);
    } else setError(failureMessage(result.reason));
    setLoading(false);
  }, [accountId, backend, runPending]);
  useEffect(() => {
    setData(null);
    setConflict(null);
    setConflictReason(null);
    setRecoveredActivation(null);
    setBusy(false);
    setError(null);
    setSupported(true);
    setStorageReady(false);
    void refresh();
    return () => {
      generation.current++;
    };
  }, [refresh]);

  const persistAndRun = useCallback(async (pending: Pending) => {
    if (busyRef.current || startingRef.current) return null;
    startingRef.current = true;
    try {
      await AsyncStorage.setItem(key(pending.accountId), JSON.stringify(pending));
      return await runPending(pending);
    } catch {
      if (account.current === pending.accountId)
        setError("Could not save this request on this device. Try again.");
      return null;
    } finally {
      startingRef.current = false;
    }
  }, [runPending]);
  const scopedData = dataAccountId === accountId ? data : null;
  const save = useCallback((slot: 1 | 2, name: string, positions: HabitatPositions<string | null>) => {
    if (!accountId || !storageReady) return Promise.resolve(null);
    const existing = scopedData?.presets.find((preset) => preset.slot === slot);
    return persistAndRun({ kind: "save", accountId, input: {
      slot, name: name.trim(), positions, expectedRevision: existing?.revision ?? null, requestId: createHabitatRequestId(),
    }});
  }, [accountId, scopedData, persistAndRun, storageReady]);
  const activate = useCallback((slot: 1 | 2, roomRevision: number) => {
    if (!accountId || !storageReady) return Promise.resolve(null);
    const preset = scopedData?.presets.find((candidate) => candidate.slot === slot);
    return persistAndRun({ kind: "activate", accountId, input: {
      slot, expectedRevision: roomRevision, expectedPresetRevision: preset?.revision, requestId: createHabitatRequestId(),
    }});
  }, [accountId, scopedData, persistAndRun, storageReady]);
  const retryConflict = useCallback(async () => {
    const pending = conflict;
    if (!pending || !scopedData) return null;
    const presetRevision = scopedData.presets.find(
      (preset) => preset.slot === pending.input.slot,
    )?.revision;
    const next: Pending = pending.kind === "save"
      ? { ...pending, input: { ...pending.input, expectedRevision: presetRevision ?? null, requestId: createHabitatRequestId() } }
      : { ...pending, input: { ...pending.input, expectedPresetRevision: presetRevision, requestId: createHabitatRequestId() } };
    if (pending.kind === "activate" && conflictReason === "revision_conflict") {
      setError(
        "The live Barn changed. Close saved rooms, review the current room, then choose it again.",
      );
      return null;
    }
    setConflict(null);
    return persistAndRun(next);
  }, [conflict, conflictReason, scopedData, persistAndRun]);
  return {
    data: scopedData,
    loading,
    busy,
    error,
    supported,
    storageReady,
    conflict,
    conflictReason,
    recoveredActivation,
    refresh,
    save,
    activate,
    retryConflict,
    clearConflict: () => setConflict(null),
    clearRecoveredActivation: async () => {
      const id = account.current;
      if (!id) return;
      setRecoveredActivation(null);
      await AsyncStorage.removeItem(key(id));
    },
  };
}

export type PresetActivationResult = HabitatSnapshot;

import AsyncStorage from "@react-native-async-storage/async-storage";

export interface PendingDigSubmission {
  uid: string;
  windowIndex: number;
  windowEndsAtMs: number;
  finds: string[];
  actions: number;
  missed: string[];
  savedAt: string;
  // Snout Deep (20260913060000): present → submit_rooting_deep with the
  // action log, the layer the dig ended on and the revealed thing ids;
  // absent → the classic submit_rooting_checked. `actions` above stays the
  // count so an older reader of the payload still validates it.
  deep?: PendingSnoutDeep;
}

export interface PendingSnoutDeep {
  actions: string[];
  layer: number;
  things: string[];
}

// The Snout Deep mid-dig snapshot (spec §10): `{ layer, actions }` replayed
// through utils/snoutDeep.replay on restore, plus the banked truffle ids the
// server's close cron ties with. Keyed like the classic progress snapshot.
export interface SnoutDeepProgressSnapshot {
  uid: string;
  windowIndex: number;
  seed: number;
  layer: number;
  actions: string[];
  finds: string[];
  savedAt: string;
}

export interface DigProgressSnapshot {
  uid: string;
  windowIndex: number;
  seed: number;
  layers: number[];
  collected: string[];
  actions: number;
  dugOrder: number[];
  streak: number;
  freeNext: boolean;
  savedAt: string;
}

const pendingKey = (uid: string) => `rooting_pending_submission_v1:${uid}`;
const progressKey = (uid: string, win: number) =>
  `rooting_progress_v1:${uid}:${win}`;
const deepProgressKey = (uid: string, win: number) =>
  `snout_deep_progress_v1:${uid}:${win}`;
const pendingOperations = new Map<string, Promise<unknown>>();

function withPendingLock<T>(
  uid: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = pendingOperations.get(uid) ?? Promise.resolve();
  const started = previous.catch(() => {}).then(operation);
  pendingOperations.set(uid, started);
  started
    .finally(() => {
      if (pendingOperations.get(uid) === started) pendingOperations.delete(uid);
    })
    .catch(() => {});
  return started;
}

function stringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

// The Snout Deep log contract the server enforces (submit_rooting_deep):
// ≤ 45 entries of "s2:14" / "r2:14" / "h2:14"; the layer 0–2.
const DEEP_ACTION = /^[srh][0-2]:([0-9]|[12][0-9])$/;
const DEEP_ACTION_CAP = 45;
function validDeepActions(value: unknown): value is string[] {
  return (
    stringArray(value) &&
    value.length <= DEEP_ACTION_CAP &&
    value.every((entry) => DEEP_ACTION.test(entry))
  );
}
function validDeep(value: unknown): value is PendingSnoutDeep {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<PendingSnoutDeep>;
  return (
    validDeepActions(v.actions) &&
    Number.isInteger(v.layer) &&
    (v.layer as number) >= 0 &&
    (v.layer as number) <= 2 &&
    stringArray(v.things)
  );
}

export async function savePendingDig(
  value: PendingDigSubmission,
): Promise<void> {
  await withPendingLock(value.uid, () =>
    AsyncStorage.setItem(pendingKey(value.uid), JSON.stringify(value)),
  );
}

async function loadPendingDigUnlocked(
  uid: string,
): Promise<PendingDigSubmission | null> {
  const raw = await AsyncStorage.getItem(pendingKey(uid));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PendingDigSubmission>;
    if (
      value.uid !== uid ||
      !Number.isInteger(value.windowIndex) ||
      !Number.isFinite(value.windowEndsAtMs) ||
      !Number.isInteger(value.actions) ||
      !stringArray(value.finds) ||
      !stringArray(value.missed) ||
      typeof value.savedAt !== "string" ||
      (value.deep !== undefined && !validDeep(value.deep))
    )
      return null;
    return value as PendingDigSubmission;
  } catch {
    return null;
  }
}

export async function loadPendingDig(
  uid: string,
): Promise<PendingDigSubmission | null> {
  return withPendingLock(uid, () => loadPendingDigUnlocked(uid));
}

export async function clearPendingDig(uid: string): Promise<void> {
  await withPendingLock(uid, () => AsyncStorage.removeItem(pendingKey(uid)));
}

export async function clearPendingDigIfMatches(
  value: PendingDigSubmission,
): Promise<boolean> {
  return withPendingLock(value.uid, async () => {
    const current = await loadPendingDigUnlocked(value.uid);
    if (
      !current ||
      current.windowIndex !== value.windowIndex ||
      current.savedAt !== value.savedAt
    )
      return false;
    await AsyncStorage.removeItem(pendingKey(value.uid));
    return true;
  });
}

const submissionAttempts = new Map<string, Promise<unknown>>();
export function shareSubmissionAttempt<T>(
  uid: string,
  windowIndex: number,
  run: () => Promise<T>,
): Promise<T> {
  const key = `${uid}:${windowIndex}`;
  const active = submissionAttempts.get(key) as Promise<T> | undefined;
  if (active) return active;
  const started = run().finally(() => {
    if (submissionAttempts.get(key) === started) submissionAttempts.delete(key);
  });
  submissionAttempts.set(key, started);
  return started;
}

export async function saveDigProgress(
  value: DigProgressSnapshot,
): Promise<void> {
  await AsyncStorage.setItem(
    progressKey(value.uid, value.windowIndex),
    JSON.stringify(value),
  );
}

export async function loadDigProgress(
  uid: string,
  windowIndex: number,
  seed: number,
): Promise<DigProgressSnapshot | null> {
  const raw = await AsyncStorage.getItem(progressKey(uid, windowIndex));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<DigProgressSnapshot>;
    if (
      value.uid !== uid ||
      value.windowIndex !== windowIndex ||
      value.seed !== seed ||
      !Array.isArray(value.layers) ||
      value.layers.length !== 30 ||
      !value.layers.every((n) => Number.isFinite(n) && n >= 0 && n <= 10) ||
      !stringArray(value.collected) ||
      typeof value.actions !== "number" ||
      !Number.isInteger(value.actions) ||
      value.actions < 0 ||
      value.actions > 25 ||
      !Array.isArray(value.dugOrder) ||
      !value.dugOrder.every((n) => Number.isInteger(n) && n >= 0 && n < 30) ||
      new Set(value.dugOrder).size !== value.dugOrder.length ||
      typeof value.streak !== "number" ||
      !Number.isInteger(value.streak) ||
      value.streak < 0 ||
      value.streak > 25 ||
      typeof value.freeNext !== "boolean" ||
      typeof value.savedAt !== "string"
    )
      return null;
    return value as DigProgressSnapshot;
  } catch {
    return null;
  }
}

export async function clearDigProgress(
  uid: string,
  windowIndex: number,
): Promise<void> {
  await AsyncStorage.removeItem(progressKey(uid, windowIndex));
}

// ── Snout Deep progress (spec §10: the snapshot is `{ layer, actions }`) ──────

export async function saveSnoutDeepProgress(
  value: SnoutDeepProgressSnapshot,
): Promise<void> {
  await AsyncStorage.setItem(
    deepProgressKey(value.uid, value.windowIndex),
    JSON.stringify(value),
  );
}

export async function loadSnoutDeepProgress(
  uid: string,
  windowIndex: number,
  seed: number,
): Promise<SnoutDeepProgressSnapshot | null> {
  const raw = await AsyncStorage.getItem(deepProgressKey(uid, windowIndex));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SnoutDeepProgressSnapshot>;
    if (
      value.uid !== uid ||
      value.windowIndex !== windowIndex ||
      value.seed !== seed ||
      !Number.isInteger(value.layer) ||
      (value.layer as number) < 0 ||
      (value.layer as number) > 2 ||
      !validDeepActions(value.actions) ||
      !stringArray(value.finds) ||
      typeof value.savedAt !== "string"
    )
      return null;
    return value as SnoutDeepProgressSnapshot;
  } catch {
    return null;
  }
}

export async function clearSnoutDeepProgress(
  uid: string,
  windowIndex: number,
): Promise<void> {
  await AsyncStorage.removeItem(deepProgressKey(uid, windowIndex));
}

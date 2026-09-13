import AsyncStorage from "@react-native-async-storage/async-storage";

export interface PendingDigSubmission {
  uid: string;
  windowIndex: number;
  windowEndsAtMs: number;
  finds: string[];
  actions: number;
  missed: string[];
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
      typeof value.savedAt !== "string"
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

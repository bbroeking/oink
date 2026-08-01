import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GuestbookEntry } from "@/utils/guestbookStamps";

export type BarnNoticeKind = "guestbook";

const noticeKey = (kind: BarnNoticeKind) =>
  `barn_notice_dismissed_v1:${kind}`;

/**
 * A dismissed guestbook notice stays gone until the owner receives a new stamp.
 * The global row id distinguishes accounts that share one device, while total
 * catches server-side history changes without storing any private content.
 */
export function guestbookNoticeSignature(
  total: number,
  entries: readonly GuestbookEntry[],
): string {
  const newestId = entries.reduce(
    (highest, entry) => Math.max(highest, entry.id),
    0,
  );
  return `${Math.max(0, total)}:${newestId}`;
}

export async function isBarnNoticeDismissed(
  kind: BarnNoticeKind,
  signature: string,
): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(noticeKey(kind))) === signature;
  } catch {
    return false;
  }
}

export async function dismissBarnNotice(
  kind: BarnNoticeKind,
  signature: string,
): Promise<void> {
  try {
    await AsyncStorage.setItem(noticeKey(kind), signature);
  } catch {
    // Presentation preferences must never interrupt play. The in-memory state
    // still hides the notice for this session if storage is unavailable.
  }
}

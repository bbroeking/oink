import type { GlyphName } from "@/components/ui/Glyph";
import { rpc } from "@/utils/rpc";
import {
  BLESSING_META,
  type BlessingKind,
} from "@/utils/rituals";

export const GUESTBOOK_STAMP_IDS = [
  "hoofprint",
  "heart",
  "sunshine",
  "sparkle",
] as const;

export type GuestbookStampId = (typeof GUESTBOOK_STAMP_IDS)[number];

export const GUESTBOOK_STAMP_META: Record<
  GuestbookStampId,
  { label: string; glyph: GlyphName }
> = {
  hoofprint: { label: "Pig stopped by", glyph: "pigface" },
  heart: { label: "With love", glyph: "heart" },
  sunshine: { label: "Warm wishes", glyph: "sun" },
  sparkle: { label: "Looking sharp", glyph: "sparkle" },
};

export interface GuestbookEntry {
  id: number;
  stampId: GuestbookStampId;
  visitorName: string;
  stampedAt: string;
  blessingKind?: BlessingKind;
  blessingSentAt?: string;
}

interface GuestbookResult {
  ok?: boolean;
  entries?: unknown;
  total?: number;
}

export interface GuestbookSnapshot {
  entries: GuestbookEntry[];
  total: number;
}

export function isGuestbookStampId(value: unknown): value is GuestbookStampId {
  return (
    typeof value === "string" &&
    (GUESTBOOK_STAMP_IDS as readonly string[]).includes(value)
  );
}

export function parseGuestbookEntries(value: unknown): GuestbookEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    if (
      typeof row.id !== "number" ||
      !isGuestbookStampId(row.stamp_id) ||
      typeof row.stamped_at !== "string"
    ) {
      return [];
    }
    const blessingKind =
      typeof row.blessing_kind === "string" &&
      row.blessing_kind in BLESSING_META &&
      row.blessing_kind !== "chorus_glow"
        ? (row.blessing_kind as BlessingKind)
        : undefined;
    return [{
      id: row.id,
      stampId: row.stamp_id,
      visitorName:
        typeof row.visitor_name === "string" && row.visitor_name.trim()
          ? row.visitor_name.trim()
          : "A friendly pig",
      stampedAt: row.stamped_at,
      ...(blessingKind && typeof row.blessing_sent_at === "string"
        ? {
            blessingKind,
            blessingSentAt: row.blessing_sent_at,
          }
        : {}),
    }];
  });
}

export async function fetchMyGuestbook(
  limit = 60,
): Promise<GuestbookSnapshot | null> {
  const result = await rpc<GuestbookResult>("my_barn_guestbook", {
    p_limit: limit,
  });
  if (!result?.ok) return null;
  const entries = parseGuestbookEntries(result.entries);
  return {
    entries,
    total: typeof result.total === "number" ? result.total : entries.length,
  };
}

export function guestbookAgeLabel(
  stampedAt: string,
  nowMs = Date.now(),
): string {
  const ageMs = Math.max(0, nowMs - new Date(stampedAt).getTime());
  const days = Math.floor(ageMs / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  return new Date(stampedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

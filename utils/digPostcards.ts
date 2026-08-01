import type { DigShareData, ShareCell } from "@/utils/digShare";
import {
  rpc,
  rpcAction,
  rpcOutcome,
  type RpcResult,
} from "@/utils/rpc";
import { supabase } from "@/utils/supabase";
import { getFriendIds, type Profile } from "@/utils/friendships";

export interface PostcardFriend {
  id: string;
  username: string | null;
  discriminator: string | null;
}

export interface DigPostcard {
  id: string;
  senderId: string;
  recipientId: string;
  senderUsername: string | null;
  recipientUsername: string | null;
  feedingNumber: number;
  cells: ShareCell[];
  digs: number;
  finds: number;
  goldenInDigs: number | null;
  createdAt: string;
  recipientOpenedAt: string | null;
  cheeredAt: string | null;
}

type RawDigPostcard = {
  id?: unknown;
  sender_id?: unknown;
  recipient_id?: unknown;
  sender_username?: unknown;
  recipient_username?: unknown;
  feeding_number?: unknown;
  cells?: unknown;
  digs?: unknown;
  finds?: unknown;
  golden_in_digs?: unknown;
  created_at?: unknown;
  recipient_opened_at?: unknown;
  cheered_at?: unknown;
};

const SHARE_CELLS = new Set<ShareCell>(["mud", "truffle", "shimmer", "unique"]);

export function normalizeDigPostcard(raw: RawDigPostcard): DigPostcard | null {
  if (
    typeof raw.id !== "string" ||
    typeof raw.sender_id !== "string" ||
    typeof raw.recipient_id !== "string" ||
    typeof raw.feeding_number !== "number" ||
    typeof raw.digs !== "number" ||
    typeof raw.finds !== "number" ||
    typeof raw.created_at !== "string" ||
    !Array.isArray(raw.cells)
  ) {
    return null;
  }
  const cells = raw.cells.filter(
    (cell): cell is ShareCell =>
      typeof cell === "string" && SHARE_CELLS.has(cell as ShareCell),
  );
  if (cells.length !== raw.cells.length || cells.length > 30) return null;
  return {
    id: raw.id,
    senderId: raw.sender_id,
    recipientId: raw.recipient_id,
    senderUsername:
      typeof raw.sender_username === "string" ? raw.sender_username : null,
    recipientUsername:
      typeof raw.recipient_username === "string"
        ? raw.recipient_username
        : null,
    feedingNumber: raw.feeding_number,
    cells,
    digs: raw.digs,
    finds: raw.finds,
    goldenInDigs:
      typeof raw.golden_in_digs === "number" ? raw.golden_in_digs : null,
    createdAt: raw.created_at,
    recipientOpenedAt:
      typeof raw.recipient_opened_at === "string"
        ? raw.recipient_opened_at
        : null,
    cheeredAt: typeof raw.cheered_at === "string" ? raw.cheered_at : null,
  };
}

export async function fetchPostcardFriends(): Promise<PostcardFriend[]> {
  const ids = (await getFriendIds()) ?? [];
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, discriminator")
    .in("id", ids.slice(0, 100));
  if (error) return [];
  return ((data ?? []) as Profile[])
    .map((profile) => ({
      id: profile.id,
      username: profile.username ?? null,
      discriminator: profile.discriminator ?? null,
    }))
    .sort((a, b) =>
      (a.username ?? "").localeCompare(b.username ?? "", undefined, {
        sensitivity: "base",
      }),
    );
}

export function createDigPostcard(
  recipientId: string,
  data: DigShareData,
): Promise<RpcResult<{ id: string }>> {
  return rpcAction<{ id: string }>("create_dig_postcard", {
    p_recipient_id: recipientId,
    p_feeding_number: data.feedingNumber,
    p_cells: data.cells,
    p_digs: data.digs,
    p_golden_in_digs: data.goldenInDigs,
  });
}

export async function digPostcardsAvailable(): Promise<boolean> {
  const outcome = await rpcOutcome<RawDigPostcard[]>("my_dig_postcards", {
    p_limit: 1,
  });
  return outcome.ok;
}

export async function fetchDigPostcards(): Promise<DigPostcard[]> {
  const rows =
    (await rpc<RawDigPostcard[]>("my_dig_postcards", {
      p_limit: 100,
    })) ?? [];
  return rows
    .map(normalizeDigPostcard)
    .filter((row): row is DigPostcard => row !== null);
}

export async function markDigPostcardsOpened(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await rpcAction("open_dig_postcards", { p_ids: ids });
}

export function cheerDigPostcard(id: string) {
  return rpcAction("cheer_dig_postcard", { p_postcard_id: id });
}

export function postcardAccessibilityLabel(postcard: DigPostcard): string {
  const findWord = postcard.finds === 1 ? "find" : "finds";
  const digWord = postcard.digs === 1 ? "dig" : "digs";
  return `Feeding ${postcard.feedingNumber}: ${postcard.finds} ${findWord} in ${postcard.digs} ${digWord}`;
}

import { rpcAction, type RpcResult } from "@/utils/rpc";

export const HABITAT_POSITION_KEYS = [
  "interior_background",
  "wall",
  "ceiling",
  "floor_left",
  "floor_right",
  "floor_centerpiece",
  "surface",
] as const;
export type HabitatPosition = (typeof HABITAT_POSITION_KEYS)[number];
export type HabitatCategory =
  | "interior_background"
  | "wall_decor"
  | "ceiling_decor"
  | "floor_decor"
  | "floor_centerpiece"
  | "surface_decor";
export type HabitatRarity = "common" | "uncommon" | "rare";

export type HabitatPlacedItem = {
  id: string;
  name: string;
  description: string;
  category: HabitatCategory;
  rarity: HabitatRarity;
  assetKey: string;
};
export type HabitatCatalogItem = HabitatPlacedItem & {
  snoutCost: number;
  isForSale: boolean;
  active: boolean;
  displayOrder: number;
  collectionId?: string;
  rewardThreshold?: 4 | 8;
  /** Permanent Wallow rank that gifts this design; it can still be bought early. */
  prestigeRank?: number;
  /** Exclusive permanent Wallow keepsake; never sold. */
  prestigeKeepsake?: boolean;
};
export type HabitatCollectionProgress = {
  id: string;
  name: string;
  ownedPaidCount: number;
  paidCount: number;
  rewards: { itemId: string; threshold: 4 | 8; earned: boolean }[];
};
export type HabitatPositions<T> = Record<HabitatPosition, T>;
export type HabitatSnapshot = {
  ownerId: string;
  revision: number;
  positions: HabitatPositions<HabitatPlacedItem | null>;
  themeRecovered?: boolean;
  wallowRank?: number;
};
export type HabitatOwnerData = {
  snapshot: HabitatSnapshot;
  owned: HabitatCatalogItem[];
  catalog: HabitatCatalogItem[];
  currentSnouts: number;
  wallowRank?: number;
};
export type HabitatDraft = {
  positions: HabitatPositions<string | null>;
  history: HabitatPositions<string | null>[];
  baseRevision: number;
};

const CATEGORY_FOR_POSITION: HabitatPositions<HabitatCategory> = {
  interior_background: "interior_background",
  wall: "wall_decor",
  ceiling: "ceiling_decor",
  floor_left: "floor_decor",
  floor_right: "floor_decor",
  floor_centerpiece: "floor_centerpiece",
  surface: "surface_decor",
};
const emptyPositions = <T>(value: T): HabitatPositions<T> => ({
  interior_background: value,
  wall: value,
  ceiling: value,
  floor_left: value,
  floor_right: value,
  floor_centerpiece: value,
  surface: value,
});
const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).every((key) => keys.includes(key));

export function positionAccepts(
  position: HabitatPosition,
  category: HabitatCategory,
) {
  return CATEGORY_FOR_POSITION[position] === category;
}

function parseItem(raw: unknown, catalog: true): HabitatCatalogItem | null;
function parseItem(raw: unknown, catalog?: false): HabitatPlacedItem | null;
function parseItem(
  raw: unknown,
  catalog = false,
): HabitatPlacedItem | HabitatCatalogItem | null {
  if (!isObject(raw)) return null;
  const categories: HabitatCategory[] = [
    "interior_background",
    "wall_decor",
    "ceiling_decor",
    "floor_decor",
    "floor_centerpiece",
    "surface_decor",
  ];
  const rarities: HabitatRarity[] = ["common", "uncommon", "rare"];
  if (
    typeof raw.id !== "string" ||
    typeof raw.name !== "string" ||
    typeof raw.description !== "string" ||
    typeof raw.assetKey !== "string" ||
    !categories.includes(raw.category as HabitatCategory) ||
    !rarities.includes(raw.rarity as HabitatRarity)
  )
    return null;
  const item: HabitatPlacedItem = {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    category: raw.category as HabitatCategory,
    rarity: raw.rarity as HabitatRarity,
    assetKey: raw.assetKey,
  };
  if (!catalog) return item;
  if (
    typeof raw.snoutCost !== "number" ||
    !Number.isSafeInteger(raw.snoutCost) ||
    raw.snoutCost < 0 ||
    typeof raw.isForSale !== "boolean" ||
    typeof raw.active !== "boolean" ||
    typeof raw.displayOrder !== "number" ||
    !Number.isSafeInteger(raw.displayOrder) ||
    (raw.collectionId !== undefined && typeof raw.collectionId !== "string") ||
    (raw.rewardThreshold !== undefined &&
      raw.rewardThreshold !== 4 &&
      raw.rewardThreshold !== 8) ||
    (raw.rewardThreshold !== undefined &&
      typeof raw.collectionId !== "string") ||
    (raw.prestigeRank !== undefined &&
      (typeof raw.prestigeRank !== "number" ||
        !Number.isSafeInteger(raw.prestigeRank) ||
        raw.prestigeRank < 1)) ||
    (raw.prestigeKeepsake !== undefined &&
      typeof raw.prestigeKeepsake !== "boolean")
  )
    return null;
  return {
    ...item,
    snoutCost: raw.snoutCost,
    isForSale: raw.isForSale,
    active: raw.active,
    displayOrder: raw.displayOrder,
    ...(typeof raw.collectionId === "string"
      ? { collectionId: raw.collectionId }
      : {}),
    ...(raw.rewardThreshold === 4 || raw.rewardThreshold === 8
      ? { rewardThreshold: raw.rewardThreshold }
      : {}),
    ...(typeof raw.prestigeRank === "number"
      ? { prestigeRank: raw.prestigeRank }
      : {}),
    ...(raw.prestigeKeepsake === true ? { prestigeKeepsake: true } : {}),
  };
}

export async function fetchHabitatCollectionProgress(): Promise<
  RpcResult<{ collections: HabitatCollectionProgress[] }>
> {
  const result = await rpcAction<Record<string, unknown>>(
    "my_habitat_collection_progress" as never,
  );
  if (!result.ok) return result;
  if (!Array.isArray(result.collections)) return invalid();
  const collections = result.collections.filter(isObject).map((collection) => ({
    id: collection.id,
    name: collection.name,
    ownedPaidCount: collection.ownedPaidCount,
    paidCount: collection.paidCount,
    rewards: Array.isArray(collection.rewards) ? collection.rewards : [],
  }));
  if (
    collections.some(
      (c) =>
        typeof c.id !== "string" ||
        typeof c.name !== "string" ||
        !Number.isSafeInteger(c.ownedPaidCount) ||
        !Number.isSafeInteger(c.paidCount) ||
        c.rewards.some(
          (r) =>
            !isObject(r) ||
            typeof r.itemId !== "string" ||
            (r.threshold !== 4 && r.threshold !== 8) ||
            typeof r.earned !== "boolean",
        ),
    )
  )
    return invalid();
  return { ok: true, collections: collections as HabitatCollectionProgress[] };
}

export async function fetchHabitatExpansionDiscovery(): Promise<
  RpcResult<{ available: boolean; pending: boolean; version: string }>
> {
  const result = await rpcAction<Record<string, unknown>>(
    "habitat_expansion_discovery" as never,
  );
  return result.ok &&
    typeof result.available === "boolean" &&
    typeof result.pending === "boolean" &&
    typeof result.version === "string"
    ? {
        ok: true,
        available: result.available,
        pending: result.pending,
        version: result.version,
      }
    : result.ok
      ? invalid()
      : result;
}

export async function acknowledgeHabitatExpansion(
  version: string,
  requestId: string,
): Promise<RpcResult<{ replayed: boolean }>> {
  const result = await rpcAction<Record<string, unknown>>(
    "acknowledge_habitat_expansion" as never,
    { p_version: version, p_request_id: requestId },
  );
  return result.ok && typeof result.replayed === "boolean"
    ? { ok: true, replayed: result.replayed }
    : result.ok
      ? invalid()
      : result;
}

export function parseHabitatSnapshot(raw: unknown): HabitatSnapshot | null {
  if (
    !isObject(raw) ||
    typeof raw.ownerId !== "string" ||
    typeof raw.revision !== "number" ||
    !Number.isSafeInteger(raw.revision) ||
    raw.revision < 0 ||
    !isObject(raw.positions) ||
    (raw.themeRecovered !== undefined &&
      typeof raw.themeRecovered !== "boolean") ||
    (raw.wallowRank !== undefined &&
      (typeof raw.wallowRank !== "number" ||
        !Number.isSafeInteger(raw.wallowRank) ||
        raw.wallowRank < 0)) ||
    !exactKeys(raw.positions, HABITAT_POSITION_KEYS)
  )
    return null;
  const positions = emptyPositions<HabitatPlacedItem | null>(null);
  const seen = new Set<string>();
  let themeRecovered = raw.themeRecovered === true;
  for (const position of HABITAT_POSITION_KEYS) {
    const value = raw.positions[position];
    if (value === null || value === undefined) {
      positions[position] = null;
      continue;
    }
    const item = parseItem(value);
    if (!item || !positionAccepts(position, item.category)) {
      if (position === "interior_background") {
        positions[position] = null;
        themeRecovered = true;
        continue;
      }
      return null;
    }
    if (seen.has(item.id)) return null;
    seen.add(item.id);
    positions[position] = item;
  }
  if (!positions.interior_background) {
    positions.interior_background = {
      id: "warm_plank_barn",
      name: "Warm Plank Barn",
      description:
        "Honeyed timber, soft daylight, and a room that already feels like home.",
      category: "interior_background",
      rarity: "common",
      assetKey: "warm_plank_barn",
    };
    themeRecovered = true;
  }
  return {
    ownerId: raw.ownerId,
    revision: raw.revision,
    positions,
    ...(themeRecovered ? { themeRecovered: true } : {}),
    ...(typeof raw.wallowRank === "number"
      ? { wallowRank: raw.wallowRank }
      : {}),
  };
}

function parseCatalog(raw: unknown): HabitatCatalogItem[] | null {
  if (!Array.isArray(raw)) return null;
  const parsed = raw.map((item) => parseItem(item, true));
  return parsed.every(Boolean) ? (parsed as HabitatCatalogItem[]) : null;
}
export function parseHabitatOwnerData(raw: unknown): HabitatOwnerData | null {
  if (!isObject(raw)) return null;
  const snapshot = parseHabitatSnapshot(raw.snapshot),
    owned = parseCatalog(raw.owned),
    catalog = parseCatalog(raw.catalog);
  if (
    !snapshot ||
    !owned ||
    !catalog ||
    typeof raw.currentSnouts !== "number" ||
    !Number.isFinite(raw.currentSnouts) ||
    (raw.wallowRank !== undefined &&
      (typeof raw.wallowRank !== "number" ||
        !Number.isSafeInteger(raw.wallowRank) ||
        raw.wallowRank < 0))
  )
    return null;
  return {
    snapshot,
    owned,
    catalog,
    currentSnouts: raw.currentSnouts,
    ...(typeof raw.wallowRank === "number"
      ? { wallowRank: raw.wallowRank }
      : {}),
  };
}
function invalid<T>(): RpcResult<T> {
  return { ok: false, reason: "invalid_response" };
}
function parseOwnerResult(
  raw: RpcResult<Record<string, unknown>>,
): RpcResult<HabitatOwnerData> {
  if (!raw.ok) return raw;
  const parsed = parseHabitatOwnerData(raw);
  return parsed ? { ok: true, ...parsed } : invalid();
}
export async function claimHabitatStarter() {
  return parseOwnerResult(
    await rpcAction<Record<string, unknown>>("claim_habitat_starter"),
  );
}
export async function fetchMyHabitat() {
  return parseOwnerResult(
    await rpcAction<Record<string, unknown>>("my_habitat"),
  );
}
export async function fetchFriendHabitat(
  ownerId: string,
): Promise<RpcResult<HabitatSnapshot>> {
  const result = await rpcAction<Record<string, unknown>>("view_habitat", {
    p_owner: ownerId,
  });
  if (!result.ok) return result;
  const snapshot = parseHabitatSnapshot(result.snapshot);
  return snapshot?.ownerId === ownerId ? { ok: true, ...snapshot } : invalid();
}
export type SaveHabitatInput = {
  expectedRevision: number;
  requestId: string;
  positions: HabitatPositions<string | null>;
};
export async function saveHabitat(
  input: SaveHabitatInput,
): Promise<RpcResult<{ snapshot: HabitatSnapshot; replayed: boolean }>> {
  const result = await rpcAction<Record<string, unknown>>("save_habitat", {
    p_expected_revision: input.expectedRevision,
    p_request_id: input.requestId,
    p_positions: input.positions,
  });
  const snapshot = parseHabitatSnapshot(result.snapshot);
  if (!result.ok)
    return { ...result, ...(snapshot ? { snapshot } : {}) } as RpcResult<{
      snapshot: HabitatSnapshot;
      replayed: boolean;
    }>;
  return snapshot && typeof result.replayed === "boolean"
    ? { ok: true, snapshot, replayed: result.replayed }
    : invalid();
}
export async function buyHabitatItem(
  itemId: string,
  requestId: string,
): Promise<
  RpcResult<{
    item: HabitatCatalogItem;
    receipt: { snoutCost: number; balanceAfterPurchase: number };
    currentSnouts: number;
    newlyOwned: boolean;
    replayed: boolean;
  }>
> {
  const result = await rpcAction<Record<string, unknown>>("buy_habitat_item", {
    p_item_id: itemId,
    p_request_id: requestId,
  });
  if (!result.ok) return result;
  const item = parseItem(result.item, true),
    receipt = result.receipt;
  if (
    !item ||
    !isObject(receipt) ||
    typeof receipt.snoutCost !== "number" ||
    typeof receipt.balanceAfterPurchase !== "number" ||
    typeof result.currentSnouts !== "number" ||
    typeof result.newlyOwned !== "boolean" ||
    typeof result.replayed !== "boolean"
  )
    return invalid();
  return {
    ok: true,
    item,
    receipt: {
      snoutCost: receipt.snoutCost,
      balanceAfterPurchase: receipt.balanceAfterPurchase,
    },
    currentSnouts: result.currentSnouts,
    newlyOwned: result.newlyOwned,
    replayed: result.replayed,
  };
}

function snapshotPayload(
  snapshot: HabitatSnapshot,
): HabitatPositions<string | null> {
  const p = emptyPositions<string | null>(null);
  for (const key of HABITAT_POSITION_KEYS)
    p[key] = snapshot.positions[key]?.id ?? null;
  return p;
}
export function createHabitatDraft(snapshot: HabitatSnapshot): HabitatDraft {
  return {
    positions: snapshotPayload(snapshot),
    history: [],
    baseRevision: snapshot.revision,
  };
}
export function habitatDraftPlace(
  draft: HabitatDraft,
  position: HabitatPosition,
  item: HabitatPlacedItem,
): HabitatDraft {
  if (!positionAccepts(position, item.category)) return draft;
  const next = { ...draft.positions };
  for (const key of HABITAT_POSITION_KEYS)
    if (next[key] === item.id) next[key] = null;
  next[position] = item.id;
  return {
    ...draft,
    positions: next,
    history: [...draft.history, draft.positions],
  };
}
export function habitatDraftRemove(
  draft: HabitatDraft,
  position: HabitatPosition,
): HabitatDraft {
  if (position === "interior_background" || draft.positions[position] === null)
    return draft;
  return {
    ...draft,
    positions: { ...draft.positions, [position]: null },
    history: [...draft.history, draft.positions],
  };
}
export function habitatDraftUndo(draft: HabitatDraft): HabitatDraft {
  const previous = draft.history.at(-1);
  return previous
    ? { ...draft, positions: previous, history: draft.history.slice(0, -1) }
    : draft;
}
export function habitatDraftDirty(
  draft: HabitatDraft,
  snapshot: HabitatSnapshot,
) {
  if (snapshot.themeRecovered) return true;
  const base = snapshotPayload(snapshot);
  return HABITAT_POSITION_KEYS.some(
    (key) => draft.positions[key] !== base[key],
  );
}
export function draftSnapshot(
  draft: HabitatDraft,
  base: HabitatSnapshot,
  items: HabitatCatalogItem[],
): HabitatSnapshot {
  const byId = new Map(items.map((i) => [i.id, i]));
  const positions = emptyPositions<HabitatPlacedItem | null>(null);
  for (const key of HABITAT_POSITION_KEYS) {
    const itemId = draft.positions[key];
    positions[key] = itemId ? (byId.get(itemId) ?? base.positions[key]) : null;
  }
  return { ...base, positions };
}
export function createHabitatRequestId() {
  const hex = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  return hex.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
}

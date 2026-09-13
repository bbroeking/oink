import { rpcAction, type RpcResult } from "@/utils/rpc";
import {
  HABITAT_POSITION_KEYS,
  parseHabitatSnapshot,
  type HabitatPosition,
  type HabitatPositions,
  type HabitatSnapshot,
} from "@/utils/habitat";

export type AcquisitionAckKind = "presented" | "seen";
export type HabitatAcquisition = {
  id: string;
  itemId: string;
  source: string;
  grantedAt: string;
  newlyOwned: boolean;
  seen: boolean;
  presented: boolean;
};
export type HabitatJournal = {
  acquisitions: HabitatAcquisition[];
  wishlist: string[];
};
export type HabitatPreset = {
  slot: 1 | 2;
  name: string;
  positions: HabitatPositions<string | null>;
  revision: number;
};
export type HabitatPresetsData = {
  presets: HabitatPreset[];
  activeSlot: 1 | 2 | null;
};

type RecordValue = Record<string, unknown>;
const isObject = (value: unknown): value is RecordValue =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const invalid = <T>(): RpcResult<T> => ({
  ok: false,
  reason: "invalid_response",
});

const parsePositions = (
  raw: unknown,
): HabitatPositions<string | null> | null => {
  if (
    !isObject(raw) ||
    Object.keys(raw).length !== HABITAT_POSITION_KEYS.length ||
    !HABITAT_POSITION_KEYS.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(raw, key) &&
        (raw[key] === null || typeof raw[key] === "string"),
    )
  )
    return null;
  return Object.fromEntries(
    HABITAT_POSITION_KEYS.map((key) => [key, raw[key]]),
  ) as Record<HabitatPosition, string | null>;
};

function parseHabitatJournal(raw: unknown): HabitatJournal | null {
  if (
    !isObject(raw) ||
    !Array.isArray(raw.acquisitions) ||
    !Array.isArray(raw.wishlist)
  )
    return null;
  const acquisitions = raw.acquisitions.map((entry) => {
    if (
      !isObject(entry) ||
      typeof entry.id !== "string" ||
      typeof entry.itemId !== "string" ||
      typeof entry.source !== "string" ||
      typeof entry.grantedAt !== "string" ||
      typeof entry.newlyOwned !== "boolean" ||
      typeof entry.seen !== "boolean" ||
      typeof entry.presented !== "boolean"
    )
      return null;
    return entry as HabitatAcquisition;
  });
  if (
    acquisitions.some((entry) => !entry) ||
    raw.wishlist.some((id) => typeof id !== "string")
  )
    return null;
  return {
    acquisitions: acquisitions as HabitatAcquisition[],
    wishlist: raw.wishlist as string[],
  };
}

function parseHabitatPreset(raw: unknown): HabitatPreset | null {
  if (
    !isObject(raw) ||
    (raw.slot !== 1 && raw.slot !== 2) ||
    typeof raw.name !== "string" ||
    !Number.isSafeInteger(raw.revision) ||
    (raw.revision as number) < 0
  )
    return null;
  const positions = parsePositions(raw.positions);
  return positions
    ? {
        slot: raw.slot,
        name: raw.name,
        positions,
        revision: raw.revision as number,
      }
    : null;
}

function parseHabitatPresetsData(
  raw: unknown,
): HabitatPresetsData | null {
  if (
    !isObject(raw) ||
    !Array.isArray(raw.presets) ||
    (raw.activeSlot !== null && raw.activeSlot !== 1 && raw.activeSlot !== 2)
  )
    return null;
  const presets = raw.presets.map(parseHabitatPreset);
  if (presets.some((preset) => !preset)) return null;
  return {
    presets: presets as HabitatPreset[],
    activeSlot: raw.activeSlot,
  };
}

export async function fetchHabitatJournal(): Promise<
  RpcResult<HabitatJournal>
> {
  const result = await rpcAction<RecordValue>("my_habitat_journal");
  if (!result.ok) return result;
  const parsed = parseHabitatJournal(result);
  return parsed ? { ok: true, ...parsed } : invalid();
}

export async function ackHabitatAcquisitions(
  ids: string[],
  kind: AcquisitionAckKind,
): Promise<RpcResult<{ updated: number }>> {
  const result = await rpcAction<RecordValue>("ack_habitat_acquisitions", {
    p_ids: ids,
    p_kind: kind,
  });
  return result.ok &&
    Number.isSafeInteger(result.updated) &&
    (result.updated as number) >= 0
    ? { ok: true, updated: result.updated as number }
    : result.ok
      ? invalid()
      : result;
}

export async function setHabitatWishlist(
  itemId: string,
  saved: boolean,
): Promise<RpcResult<{ wishlist: string[] }>> {
  const result = await rpcAction<RecordValue>("set_habitat_wishlist", {
    p_item_id: itemId,
    p_saved: saved,
  });
  return result.ok &&
    Array.isArray(result.wishlist) &&
    result.wishlist.every((id) => typeof id === "string")
    ? { ok: true, wishlist: result.wishlist as string[] }
    : result.ok
      ? invalid()
      : result;
}

export async function fetchHabitatPresets(): Promise<
  RpcResult<HabitatPresetsData>
> {
  const result = await rpcAction<RecordValue>("my_habitat_presets");
  if (!result.ok) return result;
  const parsed = parseHabitatPresetsData(result);
  return parsed ? { ok: true, ...parsed } : invalid();
}

export async function saveHabitatPreset(input: {
  slot: 1 | 2;
  name: string;
  positions: HabitatPositions<string | null>;
  expectedRevision: number | null;
  requestId: string;
}): Promise<RpcResult<{ preset: HabitatPreset; replayed: boolean }>> {
  const result = await rpcAction<RecordValue>("save_habitat_preset", {
    p_slot: input.slot,
    p_name: input.name,
    p_positions: input.positions,
    p_expected_revision: input.expectedRevision,
    p_request_id: input.requestId,
  });
  if (!result.ok) return result;
  const preset = parseHabitatPreset(result.preset);
  return preset && typeof result.replayed === "boolean"
    ? { ok: true, preset, replayed: result.replayed }
    : invalid();
}

export async function activateHabitatPreset(input: {
  slot: 1 | 2;
  expectedRevision: number;
  expectedPresetRevision?: number;
  requestId: string;
}): Promise<RpcResult<{ snapshot: HabitatSnapshot; replayed: boolean }>> {
  const result = await rpcAction<RecordValue>("activate_habitat_preset", {
    p_slot: input.slot,
    p_expected_revision: input.expectedRevision,
    ...(input.expectedPresetRevision === undefined
      ? {}
      : { p_expected_preset_revision: input.expectedPresetRevision }),
    p_request_id: input.requestId,
  });
  if (!result.ok) return result;
  const snapshot = parseHabitatSnapshot(result.snapshot);
  return snapshot && typeof result.replayed === "boolean"
    ? { ok: true, snapshot, replayed: result.replayed }
    : invalid();
}

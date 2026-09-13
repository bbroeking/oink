// Local acceptance fixture only. No Supabase client, wallet, or production writes.
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  HABITAT_CATALOG,
  HABITAT_STARTER_ITEM_IDS,
  HABITAT_STARTER_POSITIONS,
} from "@/constants/habitat";
import { HABITAT_EXPANSION_COLLECTIONS } from "@/constants/habitatExpansion";
import type { HabitatExpansionDiscoveryBackend } from "@/hooks/useHabitatExpansionDiscovery";
import type { HabitatBackend } from "@/hooks/useHabitat";
import type {
  HabitatOwnerData,
  HabitatPositions,
  HabitatSnapshot,
  SaveHabitatInput,
} from "@/utils/habitat";
import type { HabitatCollectionProgress } from "@/utils/habitat";

export const HABITAT_ACCEPTANCE_ACCOUNT =
  "00000000-0000-4000-8000-000000000024";
const KEY = "habitat:dev-acceptance:server-v1";
const ALL_CATALOG = HABITAT_CATALOG;
type Server = {
  data: HabitatOwnerData;
  saves: Record<string, { payload: string; snapshot: HabitatSnapshot }>;
  buys: Record<string, { itemId: string; balance: number }>;
  discoveryAcknowledged: boolean;
  discoveryRequests: Record<string, true>;
};
function snapshot(
  positions: HabitatPositions<string | null>,
  revision: number,
): HabitatSnapshot {
  return {
    ownerId: HABITAT_ACCEPTANCE_ACCOUNT,
    revision,
    positions: Object.fromEntries(
      Object.entries(positions).map(([position, id]) => [
        position,
        ALL_CATALOG.find((item) => item.id === id) ?? null,
      ]),
    ) as HabitatSnapshot["positions"],
  };
}
function initial(): Server {
  return {
    data: {
      snapshot: snapshot(HABITAT_STARTER_POSITIONS, 0),
      owned: HABITAT_CATALOG.filter((item) =>
        HABITAT_STARTER_ITEM_IDS.includes(
          item.id as (typeof HABITAT_STARTER_ITEM_IDS)[number],
        ),
      ),
      catalog: [...ALL_CATALOG],
      currentSnouts: 1200,
      wallowRank: 0,
    },
    saves: {},
    buys: {},
    discoveryAcknowledged: false,
    discoveryRequests: {},
  };
}
function reconcileRewards(server: Server) {
  for (const collection of HABITAT_EXPANSION_COLLECTIONS) {
    const count = collection.paidItemIds.filter((id) =>
      server.data.owned.some((item) => item.id === id),
    ).length;
    for (const reward of collection.rewards) {
      const item = ALL_CATALOG.find(
        (candidate) => candidate.id === reward.itemId,
      );
      if (
        item &&
        count >= reward.threshold &&
        !server.data.owned.some((owned) => owned.id === item.id)
      )
        server.data.owned.push(item);
    }
  }
}
async function read(): Promise<Server> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return initial();
  const stored = JSON.parse(raw) as Partial<Server>;
  const fallback = initial();
  return {
    data: {
      ...(stored.data ?? fallback.data),
      catalog: [...ALL_CATALOG],
    },
    saves: stored.saves ?? {},
    buys: stored.buys ?? {},
    discoveryAcknowledged: stored.discoveryAcknowledged ?? false,
    discoveryRequests: stored.discoveryRequests ?? {},
  };
}
async function write(server: Server) {
  await AsyncStorage.setItem(KEY, JSON.stringify(server));
}
let offline = false;
let loseNextResponse = false;
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(work: () => Promise<T>): Promise<T> {
  const next = chain.then(work);
  chain = next.catch(() => {});
  return next;
}

export const habitatAcceptanceBackend: HabitatBackend = {
  async fetch() {
    return offline
      ? { ok: false, reason: "network" }
      : { ok: true, ...(await read()).data };
  },
  async claim() {
    const server = await read();
    await write(server);
    return { ok: true, ...server.data };
  },
  save(input: SaveHabitatInput) {
    return serial(async () => {
      if (offline) return { ok: false as const, reason: "network" };
      const server = await read();
      const previous = server.saves[input.requestId];
      const payload = JSON.stringify(input);
      if (previous)
        return previous.payload === payload
          ? { ok: true as const, snapshot: previous.snapshot, replayed: true }
          : { ok: false as const, reason: "idempotency_mismatch" };
      if (server.data.snapshot.revision !== input.expectedRevision)
        return {
          ok: false as const,
          reason: "revision_conflict",
          snapshot: server.data.snapshot,
        };
      server.data.snapshot = snapshot(
        input.positions,
        input.expectedRevision + 1,
      );
      server.data.snapshot.wallowRank = server.data.wallowRank;
      const custom = Object.entries(HABITAT_STARTER_POSITIONS).some(
        ([position, itemId]) =>
          input.positions[position as keyof typeof input.positions] !== itemId,
      );
      const full = Object.values(input.positions).every(Boolean);
      for (const id of [
        custom ? "apple_basket" : "",
        full ? "firefly_lantern" : "",
      ]) {
        const item = HABITAT_CATALOG.find((candidate) => candidate.id === id);
        if (item && !server.data.owned.some((owned) => owned.id === id))
          server.data.owned.push(item);
      }
      server.saves[input.requestId] = {
        payload,
        snapshot: server.data.snapshot,
      };
      await write(server);
      if (loseNextResponse) {
        loseNextResponse = false;
        return { ok: false as const, reason: "network" };
      }
      return {
        ok: true as const,
        snapshot: server.data.snapshot,
        replayed: false,
      };
    });
  },
  buy(itemId, requestId) {
    return serial(async () => {
      if (offline) return { ok: false as const, reason: "network" };
      const server = await read();
      const previous = server.buys[requestId];
      const item = ALL_CATALOG.find((candidate) => candidate.id === itemId);
      if (!item) return { ok: false as const, reason: "unknown_item" };
      if (previous && previous.itemId !== itemId)
        return { ok: false as const, reason: "idempotency_mismatch" };
      if (!previous) {
        if (server.data.owned.some((candidate) => candidate.id === itemId))
          return { ok: false as const, reason: "already_owned" };
        if (!item.isForSale || server.data.currentSnouts < item.snoutCost)
          return { ok: false as const, reason: "insufficient_snouts" };
        server.data.currentSnouts -= item.snoutCost;
        server.data.owned.push(item);
        reconcileRewards(server);
        server.buys[requestId] = { itemId, balance: server.data.currentSnouts };
        await write(server);
      }
      if (loseNextResponse) {
        loseNextResponse = false;
        return { ok: false as const, reason: "network" };
      }
      return {
        ok: true as const,
        item,
        receipt: {
          snoutCost: item.snoutCost,
          balanceAfterPurchase: server.buys[requestId].balance,
        },
        currentSnouts: server.data.currentSnouts,
        newlyOwned: true,
        replayed: Boolean(previous),
      };
    });
  },
};
export const habitatAcceptanceProgressBackend = async (): Promise<
  | { ok: true; collections: HabitatCollectionProgress[] }
  | { ok: false; reason: string }
> => {
  if (offline) return { ok: false, reason: "network" };
  const server = await read();
  reconcileRewards(server);
  await write(server);
  return {
    ok: true,
    collections: HABITAT_EXPANSION_COLLECTIONS.map((collection) => ({
      id: collection.id,
      name: collection.name,
      ownedPaidCount: collection.paidItemIds.filter((id) =>
        server.data.owned.some((item) => item.id === id),
      ).length,
      paidCount: 8,
      rewards: collection.rewards.map((reward) => ({
        ...reward,
        earned: server.data.owned.some((item) => item.id === reward.itemId),
      })),
    })),
  };
};
export const habitatAcceptanceDiscoveryBackend: HabitatExpansionDiscoveryBackend =
  {
    async fetch() {
      if (offline) return { ok: false };
      const server = await read();
      return {
        ok: true,
        available: true,
        pending: !server.discoveryAcknowledged,
        version: "barn100:v1",
      };
    },
    acknowledge(version, requestId) {
      return serial(async () => {
        if (offline) return { ok: false as const };
        if (version !== "barn100:v1") return { ok: false as const };
        const server = await read();
        const replayed =
          server.discoveryAcknowledged ||
          Boolean(server.discoveryRequests[requestId]);
        server.discoveryAcknowledged = true;
        server.discoveryRequests[requestId] = true;
        await write(server);
        return { ok: true as const, replayed };
      });
    },
  };
export const habitatAcceptanceControls = {
  setOffline(value: boolean) {
    offline = value;
  },
  loseResponse() {
    loseNextResponse = true;
  },
  async conflict() {
    const server = await read();
    server.data.snapshot.revision++;
    await write(server);
  },
  async reset(full = false) {
    offline = false;
    loseNextResponse = false;
    const server = initial();
    if (full) {
      server.data.owned = [...ALL_CATALOG];
      server.data.wallowRank = 10;
      server.data.snapshot = snapshot(
        {
          ...HABITAT_STARTER_POSITIONS,
          ceiling: "dried_herb_garland",
          floor_right: "reading_chair",
          surface: "apple_basket",
        },
        1,
      );
    }
    server.data.snapshot.wallowRank = server.data.wallowRank;
    await write(server);
    await AsyncStorage.multiRemove(
      ["confirmed", "draft", "pending"].map(
        (part) => `habitat:v1:${HABITAT_ACCEPTANCE_ACCOUNT}:${part}`,
      ),
    );
  },
  async resetAnnouncement() {
    const server = await read();
    server.discoveryAcknowledged = false;
    server.discoveryRequests = {};
    await write(server);
    await AsyncStorage.multiRemove([
      `habitat:expansion:barn100:v1:${HABITAT_ACCEPTANCE_ACCOUNT}:dismissed`,
      `habitat:expansion:barn100:v1:${HABITAT_ACCEPTANCE_ACCOUNT}:pending-ack`,
    ]);
  },
};

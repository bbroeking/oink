import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  HABITAT_EXPANSION_CATALOG,
  HABITAT_EXPANSION_COLLECTIONS,
} from "@/constants/habitatExpansion";
import {
  habitatAcceptanceBackend,
  habitatAcceptanceControls,
  habitatAcceptanceDiscoveryBackend,
  habitatAcceptanceProgressBackend,
} from "@/components/dev/screens/habitatAcceptanceBackend";

describe("Barn housing acceptance fixture", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await habitatAcceptanceControls.reset();
  });

  afterEach(() => habitatAcceptanceControls.setOffline(false));

  it("starts empty with four gifts and rewards the first placed decoration", async () => {
    const claimed = await habitatAcceptanceBackend.claim();
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    expect(claimed.owned.map((item) => item.id).sort()).toEqual([
      "patchwork_rug", "rosies_pencil_sketch", "sunflower_crock", "warm_plank_barn",
    ]);
    expect(claimed.snapshot.positions.interior_background?.id).toBe("warm_plank_barn");
    expect(Object.entries(claimed.snapshot.positions)
      .filter(([position]) => position !== "interior_background")
      .every(([, item]) => item === null)).toBe(true);

    // Key order must not change whether the default layout earns a reward.
    const positions = {
      surface: null, floor_right: null, floor_left: null, floor_centerpiece: null,
      ceiling: null, wall: null, interior_background: "warm_plank_barn",
    };
    const saved = await habitatAcceptanceBackend.save({
      expectedRevision: 0, requestId: "empty-save", positions,
    });
    expect(saved.ok).toBe(true);
    const empty = await habitatAcceptanceBackend.fetch();
    expect(empty.ok && empty.owned).toHaveLength(4);

    const firstDecoration = {
      expectedRevision: 1, requestId: "first-decoration",
      positions: { ...positions, wall: "rosies_pencil_sketch" },
    };
    expect((await habitatAcceptanceBackend.save(firstDecoration)).ok).toBe(true);
    expect(await habitatAcceptanceBackend.save(firstDecoration)).toEqual(
      expect.objectContaining({ ok: true, replayed: true }),
    );
    const decorated = await habitatAcceptanceBackend.fetch();
    expect(decorated.ok && decorated.owned.filter((item) => item.id === "apple_basket"))
      .toHaveLength(1);
  });

  it("exposes all 122 designs and can preload ownership of every design", async () => {
    await habitatAcceptanceControls.reset(true);
    const result = await habitatAcceptanceBackend.fetch();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.catalog).toHaveLength(122);
    expect(result.owned).toHaveLength(122);
    expect(new Set(result.catalog.map((item) => item.id)).size).toBe(122);
  });

  it("awards and reports deterministic collection progress", async () => {
    const collection = HABITAT_EXPANSION_COLLECTIONS[0];
    for (const [index, itemId] of collection.paidItemIds
      .slice(0, 4)
      .entries()) {
      const result = await habitatAcceptanceBackend.buy(
        itemId,
        `collection-buy-${index}`,
      );
      expect(result.ok).toBe(true);
    }

    const progress = await habitatAcceptanceProgressBackend();
    expect(progress).toEqual({
      ok: true,
      collections: expect.arrayContaining([
        expect.objectContaining({
          id: collection.id,
          ownedPaidCount: 4,
          paidCount: 8,
          rewards: expect.arrayContaining([
            expect.objectContaining({ threshold: 4, earned: true }),
            expect.objectContaining({ threshold: 8, earned: false }),
          ]),
        }),
      ]),
    });
    const owner = await habitatAcceptanceBackend.fetch();
    expect(owner.ok).toBe(true);
    if (owner.ok)
      expect(owner.owned.map((item) => item.id)).toContain(
        collection.rewards[0].itemId,
      );
  });

  it("persists announcement acknowledgement and resets it explicitly", async () => {
    expect(await habitatAcceptanceDiscoveryBackend.fetch()).toEqual({
      ok: true,
      available: true,
      pending: true,
      version: "barn100:v1",
    });
    expect(
      await habitatAcceptanceDiscoveryBackend.acknowledge(
        "barn100:v1",
        "discovery-request",
      ),
    ).toEqual({ ok: true, replayed: false });
    expect(
      await habitatAcceptanceDiscoveryBackend.acknowledge(
        "barn100:v1",
        "discovery-request",
      ),
    ).toEqual({ ok: true, replayed: true });
    expect(await habitatAcceptanceDiscoveryBackend.fetch()).toEqual(
      expect.objectContaining({ ok: true, pending: false }),
    );

    await habitatAcceptanceControls.resetAnnouncement();
    expect(await habitatAcceptanceDiscoveryBackend.fetch()).toEqual(
      expect.objectContaining({ ok: true, pending: true }),
    );
  });

  it("keeps discovery state isolated while the fixture is offline", async () => {
    habitatAcceptanceControls.setOffline(true);
    expect(await habitatAcceptanceDiscoveryBackend.fetch()).toEqual({
      ok: false,
    });
    expect(
      await habitatAcceptanceDiscoveryBackend.acknowledge(
        "barn100:v1",
        "offline-request",
      ),
    ).toEqual({ ok: false });

    habitatAcceptanceControls.setOffline(false);
    expect(await habitatAcceptanceDiscoveryBackend.fetch()).toEqual(
      expect.objectContaining({ ok: true, pending: true }),
    );
  });

  it("contains exactly the 100 expansion designs in the combined fixture", async () => {
    const result = await habitatAcceptanceBackend.fetch();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const expansionIds = new Set<string>(
      HABITAT_EXPANSION_CATALOG.map((item) => item.id),
    );
    expect(
      result.catalog.filter((item) => expansionIds.has(item.id)),
    ).toHaveLength(100);
  });
});

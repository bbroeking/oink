import {
  HABITAT_CATALOG,
  HABITAT_ASSETS,
  HABITAT_THUMBNAILS,
  HABITAT_STARTER_POSITIONS,
} from "@/constants/habitat";
import {
  createHabitatDraft,
  draftSnapshot,
  habitatDraftDirty,
  habitatDraftPlace,
  habitatDraftRemove,
  habitatDraftUndo,
  parseHabitatSnapshot,
  parseHabitatOwnerData,
  positionAccepts,
  type HabitatSnapshot,
} from "@/utils/habitat";

const byId = Object.fromEntries(HABITAT_CATALOG.map((i) => [i.id, i]));
const furnishedPositions = {
  ...HABITAT_STARTER_POSITIONS,
  wall: "rosies_pencil_sketch",
  floor_centerpiece: "patchwork_rug",
  floor_left: "sunflower_crock",
};
const snapshot: HabitatSnapshot = {
  ownerId: "owner",
  revision: 1,
  positions: Object.fromEntries(
    Object.entries(furnishedPositions).map(([key, id]) => [
      key,
      id ? byId[id] : null,
    ]),
  ) as HabitatSnapshot["positions"],
};

describe("habitat contract", () => {
  const ownerPayload = () => ({
    snapshot,
    owned: [],
    catalog: [...HABITAT_CATALOG],
    currentSnouts: 100,
    wallowRank: 4,
  });
  it("preserves permanent prestige rank and gifts in server and cached owner data", () => {
    const parsed = parseHabitatOwnerData(ownerPayload());
    expect(parsed?.wallowRank).toBe(4);
    expect(
      parsed?.catalog
        .filter((i) => i.prestigeRank)
        .map((i) => i.prestigeRank!)
        .sort((a, b) => a - b),
    ).toEqual([1, 1, 2, 3, 3, 4, 5, 6, 6, 10]);
    const legacy = {
      ...ownerPayload(),
      wallowRank: undefined,
      catalog: HABITAT_CATALOG.map(({ prestigeRank, ...item }) => item),
    };
    expect(parseHabitatOwnerData(legacy)).not.toBeNull();
    expect(parseHabitatOwnerData(legacy)?.wallowRank).toBeUndefined();
  });
  it.each([-1, 0, 1.5, "2", null, Number.MAX_SAFE_INTEGER + 1])(
    "rejects malformed furnishing prestige rank %s",
    (prestigeRank) => {
      expect(
        parseHabitatOwnerData({
          ...ownerPayload(),
          catalog: [{ ...HABITAT_CATALOG[0], prestigeRank }],
        }),
      ).toBeNull();
    },
  );
  it.each([-1, 1.5, "2", null])(
    "rejects malformed permanent rank %s",
    (wallowRank) => {
      expect(
        parseHabitatOwnerData({ ...ownerPayload(), wallowRank }),
      ).toBeNull();
    },
  );
  it("preserves the 18 originals and 100 expansion designs with four free exclusive keepsakes", () => {
    expect(HABITAT_CATALOG).toHaveLength(122);
    const originals = HABITAT_CATALOG.filter(
      (i) => !i.collectionId && !i.prestigeKeepsake,
    );
    expect(originals).toHaveLength(18);
    expect(originals.reduce((sum, i) => sum + i.snoutCost, 0)).toBe(1125);
    expect(
      HABITAT_CATALOG.filter((i) => i.isForSale).reduce(
        (n, i) => n + i.snoutCost,
        0,
      ),
    ).toBe(8625);
    expect(new Set(HABITAT_CATALOG.map((i) => i.id)).size).toBe(122);
    expect(Object.keys(HABITAT_ASSETS).sort()).toEqual(
      HABITAT_CATALOG.map((i) => i.assetKey).sort(),
    );
    expect(Object.keys(HABITAT_THUMBNAILS).sort()).toEqual(
      HABITAT_CATALOG.map((i) => i.assetKey).sort(),
    );
  });
  it("keeps prestige keepsakes exclusive, free, and available as shelf furnishings", () => {
    const keepsakes = HABITAT_CATALOG.filter((item) => item.prestigeKeepsake);
    expect(keepsakes.map((item) => item.prestigeRank)).toEqual([1, 3, 6, 10]);
    for (const item of keepsakes) {
      expect(item.isForSale).toBe(false);
      expect(item.snoutCost).toBe(0);
      expect(item.category).toBe("surface_decor");
    }
  });
  it("accepts only the position category with shared floor decor", () => {
    for (const item of HABITAT_CATALOG) {
      const accepted = [
        "interior_background",
        "wall",
        "ceiling",
        "floor_left",
        "floor_right",
        "floor_centerpiece",
        "surface",
      ].filter((p) => positionAccepts(p as never, item.category));
      expect(accepted).toEqual(
        item.category === "floor_decor"
          ? ["floor_left", "floor_right"]
          : [
              (
                {
                  interior_background: "interior_background",
                  wall_decor: "wall",
                  ceiling_decor: "ceiling",
                  floor_centerpiece: "floor_centerpiece",
                  surface_decor: "surface",
                } as const
              )[item.category as Exclude<typeof item.category, "floor_decor">],
            ],
      );
    }
  });
  it("moves a design, removes, undoes, and leaves confirmed state immutable", () => {
    const draft = createHabitatDraft(snapshot);
    const moved = habitatDraftPlace(draft, "floor_right", byId.sunflower_crock);
    expect(moved.positions.floor_left).toBeNull();
    expect(moved.positions.floor_right).toBe("sunflower_crock");
    expect(snapshot.positions.floor_left?.id).toBe("sunflower_crock");
    const removed = habitatDraftRemove(moved, "floor_right");
    expect(removed.positions.floor_right).toBeNull();
    expect(habitatDraftUndo(removed).positions).toEqual(moved.positions);
    expect(habitatDraftDirty(moved, snapshot)).toBe(true);
  });
  it("rejects duplicates, incompatible items, and unknown keys", () => {
    const raw = JSON.parse(JSON.stringify(snapshot));
    raw.positions.floor_right = raw.positions.floor_left;
    expect(parseHabitatSnapshot(raw)).toBeNull();
    raw.positions.floor_right = null;
    raw.positions.extra = null;
    expect(parseHabitatSnapshot(raw)).toBeNull();
  });
  it("recovers a missing theme explicitly without adding it to ownership", () => {
    const raw = JSON.parse(JSON.stringify(snapshot));
    raw.positions.interior_background = null;
    const recovered = parseHabitatSnapshot(raw);
    expect(recovered?.positions.interior_background?.id).toBe(
      "warm_plank_barn",
    );
    expect(recovered?.themeRecovered).toBe(true);
    expect(habitatDraftDirty(createHabitatDraft(recovered!), recovered!)).toBe(
      true,
    );
    expect(
      parseHabitatSnapshot(JSON.parse(JSON.stringify(recovered)))
        ?.themeRecovered,
    ).toBe(true);
  });
  it("recovers corrupt theme metadata but still rejects corrupt furniture", () => {
    const wrongTheme = JSON.parse(JSON.stringify(snapshot));
    wrongTheme.positions.interior_background = byId.rosies_pencil_sketch;
    expect(
      parseHabitatSnapshot(wrongTheme)?.positions.interior_background?.id,
    ).toBe("warm_plank_barn");
    const malformedTheme = JSON.parse(JSON.stringify(snapshot));
    malformedTheme.positions.interior_background = { id: "broken" };
    expect(parseHabitatSnapshot(malformedTheme)?.themeRecovered).toBe(true);
    const malformedFurniture = JSON.parse(JSON.stringify(snapshot));
    malformedFurniture.positions.wall = { id: "broken" };
    expect(parseHabitatSnapshot(malformedFurniture)).toBeNull();
  });
  it("fills omitted known positions with null and hydrates previews", () => {
    const raw = {
      ownerId: "owner",
      revision: 0,
      positions: { interior_background: byId.warm_plank_barn },
    };
    expect(parseHabitatSnapshot(raw)?.positions.wall).toBeNull();
    const draft = createHabitatDraft(snapshot);
    expect(
      draftSnapshot(draft, snapshot, [...HABITAT_CATALOG]).positions.wall?.name,
    ).toBe("Rosie's Pencil Sketch");
  });
});

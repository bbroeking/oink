import { HABITAT_CATALOG } from "@/constants/habitat";
import {
  HABITAT_EXPANSION_CATALOG,
  HABITAT_EXPANSION_COLLECTIONS,
} from "@/constants/habitatExpansion";

describe("Barn furnishing expansion metadata", () => {
  it("contains exactly 100 new designs in ten complete collections", () => {
    expect(HABITAT_EXPANSION_CATALOG).toHaveLength(100);
    expect(HABITAT_EXPANSION_COLLECTIONS).toHaveLength(10);
    const classicIds = new Set(
      HABITAT_CATALOG.filter((item) => !item.collectionId).map(
        (item) => item.id,
      ),
    );
    expect(
      HABITAT_EXPANSION_CATALOG.some((item) => classicIds.has(item.id)),
    ).toBe(false);
    expect(HABITAT_CATALOG).toHaveLength(122);
    expect(new Set(HABITAT_EXPANSION_CATALOG.map((item) => item.id)).size).toBe(
      100,
    );
  });

  it("pins category, purchase, price, and non-circular reward contracts", () => {
    const count = (category: string) =>
      HABITAT_EXPANSION_CATALOG.filter((item) => item.category === category)
        .length;
    expect({
      floor: count("floor_decor"),
      wall: count("wall_decor"),
      surface: count("surface_decor"),
      ceiling: count("ceiling_decor"),
      centerpiece: count("floor_centerpiece"),
    }).toEqual({
      floor: 40,
      wall: 20,
      surface: 20,
      ceiling: 10,
      centerpiece: 10,
    });
    expect(
      HABITAT_EXPANSION_CATALOG.filter((item) => item.isForSale),
    ).toHaveLength(80);
    expect(
      HABITAT_EXPANSION_CATALOG.filter((item) => !item.isForSale),
    ).toHaveLength(20);
    expect(
      new Set(
        HABITAT_EXPANSION_CATALOG.filter((item) => item.isForSale).map(
          (item) => item.snoutCost,
        ),
      ),
    ).toEqual(new Set([50, 100, 175]));
    for (const collection of HABITAT_EXPANSION_COLLECTIONS) {
      expect(collection.paidItemIds).toHaveLength(8);
      expect(collection.rewards.map((reward) => reward.threshold)).toEqual([
        4, 8,
      ]);
      const paidIds = new Set<string>(collection.paidItemIds);
      expect(
        collection.rewards.some((reward) => paidIds.has(reward.itemId)),
      ).toBe(false);
    }
  });
});

import { habitatAcquisitionPaths } from "@/components/habitat/HabitatInspectionSheet";
import type { HabitatCatalogItem } from "@/utils/habitat";

const item: HabitatCatalogItem = {
  id: "reading_chair",
  assetKey: "reading_chair",
  name: "Reading Chair",
  description: "A soft chair for a quiet corner.",
  category: "floor_decor",
  rarity: "uncommon",
  snoutCost: 100,
  isForSale: true,
  active: true,
  displayOrder: 1,
  prestigeRank: 4,
};

describe("visitor furnishing acquisition paths", () => {
  it("shows every public path without claiming how the host acquired it", () => {
    expect(habitatAcquisitionPaths(item)).toEqual([
      "Barn Collection · 100 Snouts",
      "Free gift at Wallow Rank 4",
    ]);
  });

  it("describes a collection reward from public catalog metadata", () => {
    expect(habitatAcquisitionPaths({
      ...item,
      isForSale: false,
      snoutCost: 0,
      prestigeRank: undefined,
      collectionId: "orchard",
      rewardThreshold: 4,
    })).toEqual(["Collection gift after 4 purchased designs"]);
  });
});

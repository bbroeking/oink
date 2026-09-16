import type { ImageSourcePropType } from "react-native";
import { HABITAT_EXPANSION_CATALOG } from "./habitatExpansion";
import {
  HABITAT_EXPANSION_ASSETS,
  HABITAT_EXPANSION_THUMBNAILS,
} from "./habitatExpansionAssets";
import type {
  HabitatCatalogItem,
  HabitatCategory,
  HabitatPosition,
} from "@/utils/habitat";

export const HABITAT_POSITIONS = [
  "interior_background",
  "wall",
  "ceiling",
  "floor_centerpiece",
  "floor_left",
  "floor_right",
  "surface",
] as const satisfies readonly HabitatPosition[];

export const HABITAT_DECOR_POSITIONS = HABITAT_POSITIONS.filter(
  (position): position is Exclude<HabitatPosition, "interior_background"> =>
    position !== "interior_background",
);

export type HabitatPositionMeta = {
  label: string;
  category: HabitatCategory;
  accessibilityHint: string;
  /** Normalized center and size in the 390 x 844 scene canvas. */
  anchor: { x: number; y: number; width: number; height: number };
  layer: number;
};

export const HABITAT_POSITION_META: Record<
  HabitatPosition,
  HabitatPositionMeta
> = {
  interior_background: {
    label: "Room",
    category: "interior_background",
    accessibilityHint: "Choose the room walls and floor",
    anchor: { x: 0.5, y: 0.5, width: 1, height: 1 },
    layer: 0,
  },
  wall: {
    label: "Back wall",
    category: "wall_decor",
    accessibilityHint: "Choose decoration for the back wall",
    anchor: { x: 0.5, y: 0.35, width: 0.32, height: 0.22 },
    layer: 10,
  },
  ceiling: {
    label: "Rafters",
    category: "ceiling_decor",
    accessibilityHint: "Choose decoration hanging from the rafters",
    anchor: { x: 0.5, y: 0.19, width: 0.48, height: 0.16 },
    layer: 20,
  },
  floor_centerpiece: {
    label: "Center floor",
    category: "floor_centerpiece",
    accessibilityHint: "Choose a centerpiece under the pigs",
    anchor: { x: 0.5, y: 0.76, width: 0.68, height: 0.16 },
    layer: 30,
  },
  floor_left: {
    label: "Left floor",
    category: "floor_decor",
    accessibilityHint: "Choose furniture for the left floor",
    anchor: { x: 0.2, y: 0.7, width: 0.28, height: 0.3 },
    layer: 40,
  },
  floor_right: {
    label: "Right floor",
    category: "floor_decor",
    accessibilityHint: "Choose furniture for the right floor",
    anchor: { x: 0.8, y: 0.7, width: 0.28, height: 0.3 },
    layer: 40,
  },
  surface: {
    label: "Shelf",
    category: "surface_decor",
    accessibilityHint: "Choose a small object for the shelf",
    anchor: { x: 0.18, y: 0.47, width: 0.24, height: 0.15 },
    layer: 60,
  },
};

type CatalogSeed = Omit<HabitatCatalogItem, "active" | "displayOrder">;
const item = (seed: CatalogSeed, displayOrder: number): HabitatCatalogItem => ({
  ...seed,
  active: true,
  displayOrder,
});

export const HABITAT_CATALOG: readonly HabitatCatalogItem[] = [
  item(
    {
      id: "warm_plank_barn",
      assetKey: "warm_plank_barn",
      name: "Warm Plank Barn",
      description:
        "Honey-colored plank walls, broad beams, and an old sunlit floor.",
      category: "interior_background",
      rarity: "common",
      snoutCost: 0,
      isForSale: false,
    },
    0,
  ),
  item(
    {
      id: "spring_whitewash",
      assetKey: "spring_whitewash",
      name: "Spring Whitewash",
      description:
        "Fresh whitewashed boards with sage beams and small spring blossoms.",
      category: "interior_background",
      rarity: "uncommon",
      snoutCost: 100,
      isForSale: true,
    },
    1,
  ),
  item(
    {
      id: "midnight_rafters",
      prestigeRank: 6,
      assetKey: "midnight_rafters",
      name: "Midnight Rafters",
      description:
        "Moonlit indigo boards with quiet stars between the rafters.",
      category: "interior_background",
      rarity: "rare",
      snoutCost: 175,
      isForSale: true,
    },
    2,
  ),
  item(
    {
      id: "rosies_pencil_sketch",
      assetKey: "rosies_pencil_sketch",
      name: "Rosie's Pencil Sketch",
      description: "A warm pencil portrait of Rosie in a simple wooden frame.",
      category: "wall_decor",
      rarity: "common",
      snoutCost: 0,
      isForSale: false,
    },
    3,
  ),
  item(
    {
      id: "pressed_clover_frame",
      assetKey: "pressed_clover_frame",
      name: "Pressed Clover Frame",
      description: "A lucky pressed clover mounted on cream paper.",
      category: "wall_decor",
      rarity: "common",
      snoutCost: 50,
      isForSale: true,
    },
    4,
  ),
  item(
    {
      id: "barn_bunting",
      prestigeRank: 2,
      assetKey: "barn_bunting",
      name: "Barn Bunting",
      description: "Five soft-colored pennants strung across the back wall.",
      category: "wall_decor",
      rarity: "uncommon",
      snoutCost: 100,
      isForSale: true,
    },
    5,
  ),
  item(
    {
      id: "firefly_lantern",
      assetKey: "firefly_lantern",
      name: "Firefly Lantern",
      description: "A golden lantern glowing with four sleepy fireflies.",
      category: "ceiling_decor",
      rarity: "rare",
      snoutCost: 0,
      isForSale: false,
    },
    6,
  ),
  item(
    {
      id: "dried_herb_garland",
      prestigeRank: 1,
      assetKey: "dried_herb_garland",
      name: "Dried Herb Garland",
      description: "Bundles of sage leaves hanging from a curved barn cord.",
      category: "ceiling_decor",
      rarity: "common",
      snoutCost: 50,
      isForSale: true,
    },
    7,
  ),
  item(
    {
      id: "sunflower_crock",
      assetKey: "sunflower_crock",
      name: "Sunflower Crock",
      description: "Three sunny blooms in a blue striped crock.",
      category: "floor_decor",
      rarity: "common",
      snoutCost: 0,
      isForSale: false,
    },
    8,
  ),
  item(
    {
      id: "reading_chair",
      prestigeRank: 4,
      assetKey: "reading_chair",
      name: "Reading Chair",
      description: "A soft lilac armchair with a comfortably rumpled seat.",
      category: "floor_decor",
      rarity: "uncommon",
      snoutCost: 100,
      isForSale: true,
    },
    9,
  ),
  item(
    {
      id: "hay_bale",
      assetKey: "hay_bale",
      name: "Hay Bale",
      description: "A tidy golden bale tied with two dark bands.",
      category: "floor_decor",
      rarity: "common",
      snoutCost: 50,
      isForSale: true,
    },
    10,
  ),
  item(
    {
      id: "milk_can_lamp",
      assetKey: "milk_can_lamp",
      name: "Milk-can Lamp",
      description: "A silver milk can topped with a sunny yellow shade.",
      category: "floor_decor",
      rarity: "rare",
      snoutCost: 175,
      isForSale: true,
    },
    11,
  ),
  item(
    {
      id: "patchwork_rug",
      assetKey: "patchwork_rug",
      name: "Patchwork Rug",
      description: "A rose and blue patchwork rug on the center floor.",
      category: "floor_centerpiece",
      rarity: "common",
      snoutCost: 0,
      isForSale: false,
    },
    12,
  ),
  item(
    {
      id: "braided_straw_rug",
      assetKey: "braided_straw_rug",
      name: "Braided Straw Rug",
      description: "An oval straw rug braided in broad golden rings.",
      category: "floor_centerpiece",
      rarity: "common",
      snoutCost: 50,
      isForSale: true,
    },
    13,
  ),
  item(
    {
      id: "muddy_paw_rug",
      prestigeRank: 3,
      assetKey: "muddy_paw_rug",
      name: "Muddy Paw Rug",
      description: "A sky-blue rug proudly stamped with one muddy paw.",
      category: "floor_centerpiece",
      rarity: "uncommon",
      snoutCost: 100,
      isForSale: true,
    },
    14,
  ),
  item(
    {
      id: "apple_basket",
      assetKey: "apple_basket",
      name: "Apple Basket",
      description: "A small woven basket heaped with red orchard apples.",
      category: "surface_decor",
      rarity: "uncommon",
      snoutCost: 0,
      isForSale: false,
    },
    15,
  ),
  item(
    {
      id: "guestbook_keepsake",
      assetKey: "guestbook_keepsake",
      name: "Guestbook Keepsake",
      description: "An open guestbook marked with a rosy heart-shaped stamp.",
      category: "surface_decor",
      rarity: "rare",
      snoutCost: 0,
      isForSale: false,
    },
    16,
  ),
  item(
    {
      id: "tiny_radio",
      prestigeRank: 5,
      assetKey: "tiny_radio",
      name: "Tiny Radio",
      description: "A rosy barn radio with a golden speaker and blue dial.",
      category: "surface_decor",
      rarity: "rare",
      snoutCost: 175,
      isForSale: true,
    },
    17,
  ),
  // The weekly race's first-place spoils (20260916110000): grant-only, never
  // sold. ART PENDING — its asset key maps onto the Barn Bunting art below
  // until a gilded set lands; surfaces tint it gold meanwhile.
  item(
    {
      id: "gold_bunting",
      assetKey: "gold_bunting",
      name: "Gold Bunting",
      description: "Gilded pennants strung for the herd that dug the most in one week.",
      category: "wall_decor",
      rarity: "rare",
      snoutCost: 0,
      isForSale: false,
    },
    18,
  ),
  ...HABITAT_EXPANSION_CATALOG,
  item(
    {
      id: "wallow_keepsake_bronze",
      assetKey: "wallow_keepsake_bronze",
      name: "Bronze Wallow Keepsake",
      description:
        "A warm bronze pig remembers the first brave return to the mud.",
      category: "surface_decor",
      rarity: "uncommon",
      snoutCost: 0,
      isForSale: false,
      prestigeRank: 1,
      prestigeKeepsake: true,
    },
    3000,
  ),
  item(
    {
      id: "wallow_keepsake_silver",
      assetKey: "wallow_keepsake_silver",
      name: "Silver Wallow Keepsake",
      description:
        "A bright silver pig marks three journeys through the Wallow.",
      category: "surface_decor",
      rarity: "rare",
      snoutCost: 0,
      isForSale: false,
      prestigeRank: 3,
      prestigeKeepsake: true,
    },
    3010,
  ),
  item(
    {
      id: "wallow_keepsake_gold",
      assetKey: "wallow_keepsake_gold",
      name: "Gold Wallow Keepsake",
      description:
        "A burnished gold pig celebrates six complete Wallow climbs.",
      category: "surface_decor",
      rarity: "rare",
      snoutCost: 0,
      isForSale: false,
      prestigeRank: 6,
      prestigeKeepsake: true,
    },
    3020,
  ),
  item(
    {
      id: "wallow_keepsake_celestial",
      assetKey: "wallow_keepsake_celestial",
      name: "Celestial Wallow Keepsake",
      description:
        "A starry keepsake glows for a pig who has crossed the Wallow ten times.",
      category: "surface_decor",
      rarity: "rare",
      snoutCost: 0,
      isForSale: false,
      prestigeRank: 10,
      prestigeKeepsake: true,
    },
    3030,
  ),
] as const;

export const HABITAT_CATALOG_BY_ID = Object.fromEntries(
  HABITAT_CATALOG.map((catalogItem) => [catalogItem.id, catalogItem]),
) as Record<string, HabitatCatalogItem>;

export const HABITAT_ASSETS: Record<string, ImageSourcePropType> = {
  ...HABITAT_EXPANSION_ASSETS,
  wallow_keepsake_bronze: require("../assets/images/habitat/prestige/wallow_keepsake_bronze.png"),
  wallow_keepsake_silver: require("../assets/images/habitat/prestige/wallow_keepsake_silver.png"),
  wallow_keepsake_gold: require("../assets/images/habitat/prestige/wallow_keepsake_gold.png"),
  wallow_keepsake_celestial: require("../assets/images/habitat/prestige/wallow_keepsake_celestial.png"),
  warm_plank_barn: require("../assets/images/habitat/warm_plank_barn.png"),
  spring_whitewash: require("../assets/images/habitat/spring_whitewash.png"),
  midnight_rafters: require("../assets/images/habitat/midnight_rafters.png"),
  rosies_pencil_sketch: require("../assets/images/habitat/rosies_pencil_sketch_v4.png"),
  pressed_clover_frame: require("../assets/images/habitat/pressed_clover_frame.png"),
  barn_bunting: require("../assets/images/habitat/barn_bunting.png"),
  // gold_bunting art pending — the bunting art stands in (2026-09-16).
  gold_bunting: require("../assets/images/habitat/barn_bunting.png"),
  firefly_lantern: require("../assets/images/habitat/firefly_lantern.png"),
  dried_herb_garland: require("../assets/images/habitat/dried_herb_garland.png"),
  sunflower_crock: require("../assets/images/habitat/sunflower_crock.png"),
  reading_chair: require("../assets/images/habitat/reading_chair.png"),
  hay_bale: require("../assets/images/habitat/hay_bale.png"),
  milk_can_lamp: require("../assets/images/habitat/milk_can_lamp.png"),
  patchwork_rug: require("../assets/images/habitat/patchwork_rug_v4.png"),
  braided_straw_rug: require("../assets/images/habitat/braided_straw_rug.png"),
  muddy_paw_rug: require("../assets/images/habitat/muddy_paw_rug.png"),
  apple_basket: require("../assets/images/habitat/apple_basket.png"),
  guestbook_keepsake: require("../assets/images/habitat/guestbook_keepsake.png"),
  tiny_radio: require("../assets/images/habitat/tiny_radio.png"),
};

// The painted barn that stands on the Exterior beside Rosie — three raster
// layers instead of the retired in-code SVG drawing. The body carries its own
// hollowed doorway; the two leaves are laid over it from the door fractions in
// `constants/barnExterior.ts` (see `scripts/habitat/slice_barn.py`).
// (2026-09-12)
export const BARN_EXTERIOR_ASSETS = {
  body: require("../assets/images/barn/exterior/barn_body.png"),
  doorLeafLeft: require("../assets/images/barn/exterior/door_leaf_left.png"),
  doorLeafRight: require("../assets/images/barn/exterior/door_leaf_right.png"),
} as const;

export const HABITAT_CHROME_ASSETS = {
  barnDoor: require("../assets/images/habitat/barn_door.png"),
  workshopCabinet: require("../assets/images/habitat/workshop_cabinet.png"),
  missingItem: require("../assets/images/habitat/missing_item.png"),
  // The plank under the Shelf decorating spot. Rooms are painted empty, so
  // the shelf is the scene's to draw (2026-09-15).
  shelfPlank: require("../assets/images/habitat/shelf_plank.png"),
} as const;

export const HABITAT_THUMBNAILS: Record<string, ImageSourcePropType> = {
  ...HABITAT_EXPANSION_THUMBNAILS,
  wallow_keepsake_bronze: require("../assets/images/habitat/prestige/wallow_keepsake_bronze.png"),
  wallow_keepsake_silver: require("../assets/images/habitat/prestige/wallow_keepsake_silver.png"),
  wallow_keepsake_gold: require("../assets/images/habitat/prestige/wallow_keepsake_gold.png"),
  wallow_keepsake_celestial: require("../assets/images/habitat/prestige/wallow_keepsake_celestial.png"),
  warm_plank_barn: require("../assets/images/habitat/thumbnails/warm_plank_barn.png"),
  spring_whitewash: require("../assets/images/habitat/thumbnails/spring_whitewash.png"),
  midnight_rafters: require("../assets/images/habitat/thumbnails/midnight_rafters.png"),
  rosies_pencil_sketch: require("../assets/images/habitat/rosies_pencil_sketch_v4.png"),
  pressed_clover_frame: require("../assets/images/habitat/thumbnails/pressed_clover_frame.png"),
  barn_bunting: require("../assets/images/habitat/thumbnails/barn_bunting.png"),
  gold_bunting: require("../assets/images/habitat/thumbnails/barn_bunting.png"),
  firefly_lantern: require("../assets/images/habitat/thumbnails/firefly_lantern.png"),
  dried_herb_garland: require("../assets/images/habitat/thumbnails/dried_herb_garland.png"),
  sunflower_crock: require("../assets/images/habitat/thumbnails/sunflower_crock.png"),
  reading_chair: require("../assets/images/habitat/thumbnails/reading_chair.png"),
  hay_bale: require("../assets/images/habitat/thumbnails/hay_bale.png"),
  milk_can_lamp: require("../assets/images/habitat/thumbnails/milk_can_lamp.png"),
  patchwork_rug: require("../assets/images/habitat/patchwork_rug_v4.png"),
  braided_straw_rug: require("../assets/images/habitat/thumbnails/braided_straw_rug.png"),
  muddy_paw_rug: require("../assets/images/habitat/thumbnails/muddy_paw_rug.png"),
  apple_basket: require("../assets/images/habitat/thumbnails/apple_basket.png"),
  guestbook_keepsake: require("../assets/images/habitat/thumbnails/guestbook_keepsake.png"),
  tiny_radio: require("../assets/images/habitat/thumbnails/tiny_radio.png"),
};

export function habitatItemAsset(assetKey: string): ImageSourcePropType {
  return HABITAT_ASSETS[assetKey] ?? HABITAT_CHROME_ASSETS.missingItem;
}

export function positionAcceptsCategory(
  position: HabitatPosition,
  category: HabitatCategory,
): boolean {
  return HABITAT_POSITION_META[position].category === category;
}

export const HABITAT_STARTER_ITEM_IDS = [
  "warm_plank_barn",
  "rosies_pencil_sketch",
  "sunflower_crock",
  "patchwork_rug",
] as const;

export const HABITAT_STARTER_POSITIONS: Record<HabitatPosition, string | null> = {
  interior_background: "warm_plank_barn",
  wall: null,
  ceiling: null,
  floor_centerpiece: null,
  floor_left: null,
  floor_right: null,
  surface: null,
};

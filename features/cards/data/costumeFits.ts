import type { ImageSourcePropType } from "react-native";

export interface CostumeLayerGeometry {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface RosieCostumeFit {
  id: string;
  cardId: string;
  name: string;
  hoodSource: ImageSourcePropType;
  romperSource: ImageSourcePropType;
  hood: CostumeLayerGeometry;
  romper: CostumeLayerGeometry;
}

const STANDARD_HOOD = { left: 0, top: 0, width: 360, height: 320 } as const;
const STANDARD_ROMPER = { left: 32, top: 196, width: 260, height: 213 } as const;

export const ROSIE_COSTUME_FITS: readonly RosieCostumeFit[] = [
  {
    id: "halloween_2026_hollow_jack_costume",
    cardId: "halloween_2026_card_hollow_jack_costume",
    name: "Hollow Jack",
    hoodSource: require("../../../assets/images/costumes/hollow-jack/rosie-hood-v1.png"),
    romperSource: require("../../../assets/images/costumes/hollow-jack/rosie-romper-v3.png"),
    hood: STANDARD_HOOD,
    romper: STANDARD_ROMPER,
  },
  {
    id: "halloween_2026_count_snout_costume",
    cardId: "halloween_2026_card_count_snout_costume",
    name: "Count Snout",
    hoodSource: require("../../../assets/images/costumes/count-snout/rosie-hood-v1.png"),
    romperSource: require("../../../assets/images/costumes/count-snout/rosie-romper-v1.png"),
    hood: STANDARD_HOOD,
    romper: STANDARD_ROMPER,
  },
  {
    id: "halloween_2026_moonpuff_costume",
    cardId: "halloween_2026_card_moonpuff_costume",
    name: "Moonpuff",
    hoodSource: require("../../../assets/images/costumes/moonpuff/rosie-hood-v1.png"),
    romperSource: require("../../../assets/images/costumes/moonpuff/rosie-romper-v1.png"),
    hood: STANDARD_HOOD,
    romper: STANDARD_ROMPER,
  },
  {
    id: "halloween_2026_little_reaper_costume",
    cardId: "halloween_2026_card_little_reaper_costume",
    name: "Little Reaper",
    hoodSource: require("../../../assets/images/costumes/little-reaper/rosie-hood-v1.png"),
    romperSource: require("../../../assets/images/costumes/little-reaper/rosie-romper-v1.png"),
    hood: STANDARD_HOOD,
    romper: STANDARD_ROMPER,
  },
  {
    id: "halloween_2026_patchwork_pal_costume",
    cardId: "halloween_2026_card_patchwork_pal_costume",
    name: "Patchwork Pal",
    hoodSource: require("../../../assets/images/costumes/patchwork-pal/rosie-hood-v1.png"),
    romperSource: require("../../../assets/images/costumes/patchwork-pal/rosie-romper-v1.png"),
    hood: STANDARD_HOOD,
    romper: STANDARD_ROMPER,
  },
  {
    id: "halloween_2026_candy_corn_costume",
    cardId: "halloween_2026_card_candy_corn_costume",
    name: "Candy Corn",
    hoodSource: require("../../../assets/images/costumes/candy-corn/rosie-hood-v1.png"),
    romperSource: require("../../../assets/images/costumes/candy-corn/rosie-romper-v1.png"),
    hood: STANDARD_HOOD,
    romper: STANDARD_ROMPER,
  },
  {
    id: "halloween_2026_linen_lurker_costume",
    cardId: "halloween_2026_card_linen_lurker_costume",
    name: "Linen Lurker",
    hoodSource: require("../../../assets/images/costumes/linen-lurker/rosie-hood-v1.png"),
    romperSource: require("../../../assets/images/costumes/linen-lurker/rosie-romper-v1.png"),
    hood: STANDARD_HOOD,
    romper: STANDARD_ROMPER,
  },
  {
    id: "halloween_2026_starspell_costume",
    cardId: "halloween_2026_card_starspell_costume",
    name: "Starspell",
    hoodSource: require("../../../assets/images/costumes/starspell/rosie-hood-v1.png"),
    romperSource: require("../../../assets/images/costumes/starspell/rosie-romper-v1.png"),
    hood: STANDARD_HOOD,
    romper: STANDARD_ROMPER,
  },
  {
    id: "halloween_2026_bat_nap_costume",
    cardId: "halloween_2026_card_bat_nap_costume",
    name: "Bat Nap",
    hoodSource: require("../../../assets/images/costumes/bat-nap/rosie-hood-v1.png"),
    romperSource: require("../../../assets/images/costumes/bat-nap/rosie-romper-v1.png"),
    hood: STANDARD_HOOD,
    romper: STANDARD_ROMPER,
  },
  {
    id: "halloween_2026_little_imp_costume",
    cardId: "halloween_2026_card_little_imp_costume",
    name: "Little Imp",
    hoodSource: require("../../../assets/images/costumes/little-imp/rosie-hood-v1.png"),
    romperSource: require("../../../assets/images/costumes/little-imp/rosie-romper-v1.png"),
    hood: STANDARD_HOOD,
    romper: STANDARD_ROMPER,
  },
  {
    id: "halloween_2026_marshmallow_boo_costume",
    cardId: "halloween_2026_card_marshmallow_boo_costume",
    name: "Marshmallow Boo",
    hoodSource: require("../../../assets/images/costumes/marshmallow-boo/rosie-hood-v1.png"),
    romperSource: require("../../../assets/images/costumes/marshmallow-boo/rosie-romper-v1.png"),
    hood: STANDARD_HOOD,
    romper: STANDARD_ROMPER,
  },
] as const;

export const ROSIE_COSTUME_FIT_BY_ID: ReadonlyMap<string, RosieCostumeFit> = new Map(
  ROSIE_COSTUME_FITS.map((fit) => [fit.id, fit]),
);

export function isKnownRosieCostumeId(value: unknown): value is string {
  return typeof value === "string" && ROSIE_COSTUME_FIT_BY_ID.has(value);
}

export function restoreEquippedRosieCostume(
  value: unknown,
  cosmeticUnlocks: Readonly<Record<string, string>>,
): string | null {
  return isKnownRosieCostumeId(value) && Boolean(cosmeticUnlocks[value]) ? value : null;
}

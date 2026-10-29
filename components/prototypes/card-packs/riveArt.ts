import type { ImageSourcePropType } from "react-native";

/** Normalized derivatives for the Rive dynamic-image slot. Album art stays original. */
export const riveCardArtSources: Readonly<Record<string, ImageSourcePropType>> = {
  firefly_swarm: require("../../../assets/rive/card-packs/art/firefly_swarm.png"),
  mud_shovel: require("../../../assets/rive/card-packs/art/mud_shovel.png"),
  puddle_duckling: require("../../../assets/rive/card-packs/art/puddle_duckling.png"),
  mushroom_cap: require("../../../assets/rive/card-packs/art/mushroom_cap.png"),
  moon_firefly: require("../../../assets/rive/card-packs/art/moon_firefly.png"),
};

export type RiveCardArtId =
  | "firefly_swarm"
  | "mud_shovel"
  | "puddle_duckling"
  | "mushroom_cap"
  | "moon_firefly";

import React from "react";
import { Image } from "react-native";

// Compatibility export for older callers. New tickle surfaces should import
// from `TickleIcon` so Snout Coins and tickle rewards cannot be conflated.
export { TickleIcon } from "./TickleIcon";

// Hand-drawn cozy snout coin (generated to match the game's sticker style).
const SNOUT_COIN = require("../../assets/images/snout-coin.png");

export function SnoutCoin({ size = 22 }: { size?: number }) {
	return <Image source={SNOUT_COIN} style={{ width: size, height: size }} resizeMode="contain" />;
}

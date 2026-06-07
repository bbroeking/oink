import React from "react";
import { Image } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Ellipse } from "react-native-svg";

// Hand-drawn cozy snout coin (generated to match the game's sticker style).
const SNOUT_COIN = require("../../assets/images/snout-coin.png");

export function SnoutCoin({ size = 22 }: { size?: number }) {
	return <Image source={SNOUT_COIN} style={{ width: size, height: size }} resizeMode="contain" />;
}

export function TickleIcon({ size = 18 }: { size?: number }) {
	return (
		<Svg width={size} height={size} viewBox="0 0 24 24">
			<Defs>
				<RadialGradient id="tickle_snout" cx="0.4" cy="0.35" r="0.7">
					<Stop offset="0" stopColor="#FFD0DC" />
					<Stop offset="0.7" stopColor="#F0B8C8" />
					<Stop offset="1" stopColor="#C47A8E" />
				</RadialGradient>
			</Defs>
			<Ellipse
				cx="12"
				cy="13"
				rx="9"
				ry="7"
				fill="url(#tickle_snout)"
				stroke="#A05A72"
				strokeWidth="1.4"
			/>
			<Ellipse cx="9" cy="13" rx="1.3" ry="1.8" fill="#1A1A1A" />
			<Ellipse cx="15" cy="13" rx="1.3" ry="1.8" fill="#1A1A1A" />
		</Svg>
	);
}

import React from "react";
import { View, Image, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { HAT_IMAGES } from "@/constants/hats";

interface Props {
	size?: number;
	hatId?: string | null;
	border?: string;
	style?: ViewStyle;
}

// When the player has any equipped item, show its art as the full
// avatar icon — this makes leaderboard rows feel individualized
// instead of "tiny pig + barely visible hat speck" for everyone.
// Fallback to the pig only when nothing is equipped.
export function PigAvatar({ size = 40, hatId, border, style }: Props) {
	const hatSrc = hatId ? HAT_IMAGES[hatId] : null;
	return (
		<View
			style={[
				{
					width: size,
					height: size,
					borderRadius: size / 2,
					overflow: "hidden",
					borderWidth: border ? 2.5 : 0,
					borderColor: border,
				},
				style,
			]}
		>
			<LinearGradient
				colors={["#FFD0DC", "#E8A7B9"]}
				style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
			>
				{hatSrc ? (
					<Image
						source={hatSrc}
						style={{ width: size * 0.85, height: size * 0.85 }}
						resizeMode="contain"
					/>
				) : (
					<Image
						// Rosie's real sprite — not the legacy soft-shaded pig.png.
						source={require("../../assets/images/sprites/rosie/idle_1.png")}
						style={{
							width: size * 0.95,
							height: size * 0.95,
							marginBottom: -size * 0.05,
						}}
						resizeMode="contain"
					/>
				)}
			</LinearGradient>
		</View>
	);
}

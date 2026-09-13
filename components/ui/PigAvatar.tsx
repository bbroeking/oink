import React from "react";
import { View, Image, ViewStyle } from "react-native";
import { ART_SIZE, AVATAR_SIZE, BORDER, RADII, WHIMSY } from "@/constants/theme";
import { HAT_IMAGES } from "@/constants/hats";
import { PigStage } from "./PigStage";

interface Props {
	size?: number;
	hatId?: string | null;
	bowId?: string | null;
	border?: string;
	style?: ViewStyle;
}

// The fractions of the frame each fallback fills. Drawing geometry: the pig is
// drawn a hair larger than a worn item so a bare pig still fills the disc.
const ITEM_FRAC = 0.85;
const PIG_FRAC = 0.95;
const PIG_DROP_FRAC = 0.05;

// When the player has any equipped item, show its art as the full
// avatar icon — this makes leaderboard rows feel individualized
// instead of "tiny pig + barely visible hat speck" for everyone.
// Fallback to the pig only when nothing is equipped.
//
// The wash is FLAT `WHIMSY.rose`. It was a two-stop LinearGradient (#FFD0DC →
// #E8A7B9) — the only soft gradient in the social area, sitting under every pig
// on every friend row, crew row and sheet header, in a system whose DNA is hard
// edges and flat pastel. A soft gradient is the one fill grammar the taste
// standard retires. [B-05] (2026-09-11)
export function PigAvatar({
	size = AVATAR_SIZE[1],
	hatId,
	bowId,
	border,
	style,
}: Props) {
	const hatSrc = hatId ? HAT_IMAGES[hatId] : null;
	const bowSrc = bowId ? HAT_IMAGES[bowId] : null;
	const showCombinedOutfit = !!hatId && !!bowId;
	return (
		<View
			style={[
				{
					width: size,
					height: size,
					borderRadius: RADII.pill,
					overflow: "hidden",
					borderWidth: border ? BORDER.ink : 0,
					borderColor: border,
					backgroundColor: WHIMSY.rose,
					alignItems: "center",
					justifyContent: "center",
				},
				style,
			]}
		>
			{showCombinedOutfit ? (
				<View
					pointerEvents="none"
					style={{
						position: "absolute",
						left: (size - ART_SIZE.stage) / 2,
						top: (size - ART_SIZE.stage) / 2,
						width: ART_SIZE.stage,
						height: ART_SIZE.stage,
						transform: [{ scale: size / ART_SIZE.stage }],
					}}
				>
					<PigStage
						pigFrozen
						equipped={{ id: hatId, category: "hat", emoji: null }}
						equippedBow={{ id: bowId, category: "bow", emoji: null }}
					/>
				</View>
			) : hatSrc || bowSrc ? (
				<Image
					source={hatSrc ?? bowSrc!}
					style={{ width: size * ITEM_FRAC, height: size * ITEM_FRAC }}
					resizeMode="contain"
					accessible={false}
				/>
			) : (
				<Image
					// Rosie's real sprite — not the legacy soft-shaded pig.png.
					source={require("../../assets/images/sprites/rosie/idle_1.png")}
					style={{
						width: size * PIG_FRAC,
						height: size * PIG_FRAC,
						marginBottom: -size * PIG_DROP_FRAC,
					}}
					resizeMode="contain"
					accessible={false}
				/>
			)}
		</View>
	);
}

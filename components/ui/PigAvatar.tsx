import React from "react";
import { View, Image, ViewStyle } from "react-native";
import { ART_SIZE, AVATAR_SIZE, BORDER, RADII, WHIMSY } from "@/constants/theme";
import { HAT_IMAGES } from "@/constants/hats";
import { PigStage } from "./PigStage";
import { PigPortrait } from "./PigPortrait";
import type { PigId } from "@/utils/pigs";
import { staticPigFx, type PigFx } from "@/constants/ritualFx";

interface Props {
	size?: number;
	hatId?: string | null;
	bowId?: string | null;
	border?: string;
	style?: ViewStyle;
	/** Which pig. Defaults to Rosie, the way every list row did before pigs
	 *  had names. */
	pigId?: PigId;
	/** `icon` (default): a worn item stands in for the pig, the leaderboard's
	 *  choice below. `worn`: the pig is always drawn, wearing whatever it has —
	 *  for a place where WHICH pig matters as much as what it wears (the two
	 *  tallies of a Barn visit). */
	mode?: "icon" | "worn";
	/** The merged ritual pig recipe (weekday rituals, 2026-09-14). A list row is
	 *  the wrong place for a loop, so ONLY the static channels survive here —
	 *  skin, tint, forced cosmetics, flip, scale. Float, hop, followers,
	 *  particles and the glow are dropped by `staticPigFx`, which is what keeps
	 *  a friends list of fifty bacon-striped, upside-down pigs scrolling. */
	ritual?: PigFx;
}

// The fractions of the frame each fallback fills. Drawing geometry: the pig is
// drawn a hair larger than a worn item so a bare pig still fills the disc.
const ITEM_FRAC = 0.85;
const PIG_FRAC = 0.95;
const PIG_DROP_FRAC = 0.05;
// Worn mode draws the pig with headroom: a hat's crown rises above the stage's
// top edge, so the stage sits smaller and lower in the disc than a bare pig.
const WORN_FRAC = 0.78;
const WORN_DROP_FRAC = 0.09;

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
	pigId = "rosie",
	mode = "icon",
	ritual,
}: Props) {
	const staticRitual = staticPigFx(ritual);
	const hatSrc = hatId ? HAT_IMAGES[hatId] : null;
	const bowSrc = bowId ? HAT_IMAGES[bowId] : null;
	// The pig wears its outfit on the stage when it has both pieces (the icon
	// path can only show one), or whenever the caller asked for the pig itself.
	const showCombinedOutfit = (!!hatId && !!bowId) || (mode === "worn" && (!!hatId || !!bowId));
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
						top: (size - ART_SIZE.stage) / 2 + (mode === "worn" ? size * WORN_DROP_FRAC : 0),
						width: ART_SIZE.stage,
						height: ART_SIZE.stage,
						transform: [{ scale: (size / ART_SIZE.stage) * (mode === "worn" ? WORN_FRAC : 1) }],
					}}
				>
					<PigStage
						pigFrozen
						pigId={pigId}
						ritual={staticRitual}
						equipped={hatId ? { id: hatId, category: "hat", emoji: null } : null}
						equippedBow={bowId ? { id: bowId, category: "bow", emoji: null } : null}
					/>
				</View>
			) : hatSrc || bowSrc ? (
				<Image
					source={hatSrc ?? bowSrc!}
					style={{ width: size * ITEM_FRAC, height: size * ITEM_FRAC }}
					resizeMode="contain"
					accessible={false}
				/>
			) : pigId !== "rosie" ? (
				<PigPortrait pigId={pigId} size={size * PIG_FRAC} />
			) : (
				<Image
					// Rosie's real sprite — not the legacy soft-shaded pig.png.
					source={require("../../assets/images/sprites/rosie/idle_1.png")}
					style={{
						width: size * PIG_FRAC,
						height: size * PIG_FRAC,
						marginBottom: -size * PIG_DROP_FRAC,
						// The bare-pig path answers the same static channels the
						// stage path does, so a half-size upside-down bacon pig reads
						// the same in a row as it does in the Barn.
						...(staticRitual?.tint ? { tintColor: staticRitual.tint } : null),
						...(staticRitual?.flip || staticRitual?.scale !== undefined
							? {
									transform: [
										...(staticRitual.scale !== undefined
											? [{ scale: staticRitual.scale }]
											: []),
										...(staticRitual.flip ? [{ rotate: "180deg" }] : []),
									],
								}
							: null),
					}}
					resizeMode="contain"
					accessible={false}
				/>
			)}
		</View>
	);
}

import React from "react";
import { Image, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { FONTS, WHIMSY } from "@/constants/theme";
import { PigAvatar } from "./PigAvatar";

const AURAS = {
	1: require("../../assets/images/prestige/wallow_aura_w1.png"),
	2: require("../../assets/images/prestige/wallow_aura_w2.png"),
	3: require("../../assets/images/prestige/wallow_aura_w3.png"),
	4: require("../../assets/images/prestige/wallow_aura_w4.png"),
	5: require("../../assets/images/prestige/wallow_aura_w5.png"),
} as const;

export function PrestigeAvatar({
	size = 40,
	hatId,
	prestigeLevel = 0,
	showRank = true,
	style,
}: {
	size?: number;
	hatId?: string | null;
	prestigeLevel?: number | null;
	showRank?: boolean;
	style?: ViewStyle;
}) {
	const rank = Math.max(0, Math.floor(prestigeLevel ?? 0));
	if (rank === 0) return <PigAvatar size={size} hatId={hatId} style={style} />;

	const visualStage = Math.min(5, rank) as keyof typeof AURAS;
	const coreSize = Math.round(size * 0.57);
	return (
		<View
			style={[styles.root, { width: size, height: size }, style]}
			accessibilityLabel={`Wallow Rank ${rank}`}
		>
			<Image
				source={AURAS[visualStage]}
				style={{ position: "absolute", width: size, height: size }}
				resizeMode="contain"
			/>
			<View style={styles.core}>
				<PigAvatar size={coreSize} hatId={hatId} border={WHIMSY.ink} />
			</View>
			{showRank && (
				<View style={[styles.badge, size < 46 && styles.badgeSmall]}>
					<Text style={[styles.badgeText, size < 46 && styles.badgeTextSmall]}>W{rank}</Text>
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { alignItems: "center", justifyContent: "center", overflow: "visible" },
	core: { alignItems: "center", justifyContent: "center" },
	badge: {
		position: "absolute",
		bottom: -2,
		minWidth: 28,
		paddingHorizontal: 5,
		paddingVertical: 2,
		borderRadius: 9,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: "#D9A45D",
	},
	badgeSmall: { minWidth: 22, paddingHorizontal: 3, paddingVertical: 1 },
	badgeText: {
		fontFamily: FONTS.bodyBlack,
			fontSize: 11,
			lineHeight: 12,
		textAlign: "center",
		color: WHIMSY.ink,
	},
		badgeTextSmall: { fontSize: 11, lineHeight: 12 },
});

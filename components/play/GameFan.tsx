// The five games' painted icons fanned like a hand of cards: the mark of
// "any of the five" on the hub's shortcut and of Play together itself on the
// Friends tab's door. Decorative; the control around it says what it does.

import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { GAME_IDS } from "@/multiplayer/games";
import type { GameId } from "@/multiplayer/types";
import { GAME_ICONS } from "./playArt";
import { FAN_ICON, FAN_TILTS, FAN_TUCK_FRAC } from "./layout";

export function GameFan({ games = GAME_IDS, size = FAN_ICON, style }: { games?: readonly GameId[]; size?: number; style?: StyleProp<ViewStyle> }) {
	return (
		<View
			style={[styles.fan, style]}
			pointerEvents="none"
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
		>
			{games.map((id, i) => (
				<Image
					key={id}
					source={GAME_ICONS[id]}
					resizeMode="contain"
					style={[
						{ width: size, height: size },
						i > 0 ? { marginLeft: -Math.round(size * FAN_TUCK_FRAC) } : null,
						{ transform: [{ rotate: `${FAN_TILTS[i % FAN_TILTS.length]}deg` }] },
					]}
				/>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	fan: { flexDirection: "row", alignItems: "center" },
});

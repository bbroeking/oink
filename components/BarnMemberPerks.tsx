// Compact Slop Club entry for the Barn. Member parting emotes intentionally do
// not live here; they appear only at the end of a real friend-Barn visit.
import { Image, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { router, type Href } from "expo-router";
import { WHIMSY, SHADOW_SM, RADII } from "@/constants/theme";

export function BarnLoungeChip() {
	return (
		<Pressable
			onPress={() => {
				Haptics.selectionAsync().catch(() => {});
				router.push("/lounge" as Href);
			}}
			hitSlop={12}
			style={({ pressed }) => [
				styles.loungeChip,
				pressed && {
					opacity: 0.92,
					transform: [{ rotate: "0.8deg" }, { scale: 0.96 }],
				},
			]}
			accessibilityRole="button"
			accessibilityLabel="Open the Slop Club members' lounge"
		>
			<Image
				source={require("../assets/images/hats/slop_club_signet_crown.png")}
				style={styles.loungeMark}
				resizeMode="contain"
			/>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	loungeChip: {
		width: 46,
		height: 46,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: WHIMSY.slopGold,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.lg,
		transform: [{ rotate: "0.8deg" }],
		...SHADOW_SM,
	},
	loungeMark: {
		width: 36,
		height: 36,
	},
});

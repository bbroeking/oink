import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { fetchPorchRound, groupPorchPages } from "@/utils/porchRound";
import { trackInteraction } from "@/utils/interactionAnalytics";
import { Glyph } from "./ui/Glyph";
import { RADII, SHADOW_SM, SPACE, TYPE, WHIMSY } from "@/constants/theme";

export function PorchRoundLaunchCard({ refreshKey = 0 }: { refreshKey?: number }) {
	const [stopCount, setStopCount] = useState<number | null>(null);

	const refresh = useCallback(async () => {
		const stops = await fetchPorchRound();
		if (stops == null) {
			setStopCount(null);
			return;
		}
		const current = groupPorchPages(stops)[0];
		setStopCount(current?.complete ? 0 : (current?.stops.length ?? 0));
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh, refreshKey]);

	useFocusEffect(
		useCallback(() => {
			void refresh();
		}, [refresh]),
	);

	// The migration can ship after the client. Until the RPC exists, leave no
	// dead launch door behind.
	if (stopCount == null) return null;
	const remaining = Math.max(0, 3 - stopCount);

	return (
		<Pressable
			testID="porch-round-open"
			onPress={() => {
				void trackInteraction({
					eventName: "porch_round_started",
					surface: "porch_round",
					result: "completed",
					properties: { source: "cta", count: stopCount },
				});
				router.push("/porch-round");
			}}
			style={({ pressed }) => [styles.card, pressed && styles.pressed]}
			accessibilityRole="button"
			accessibilityLabel="Open your Porch Round scrapbook"
		>
			<View style={styles.iconWell}>
				<Glyph name="pigface" size={25} />
			</View>
			<View style={styles.copy}>
				<Text style={styles.kicker}>★ PORCH ROUND</Text>
				<Text style={styles.title}>Your visit scrapbook</Text>
				<Text style={styles.body}>
					{stopCount === 0
						? "Your next three Barn visits can make a page."
						: `${stopCount} ${stopCount === 1 ? "visit" : "visits"} kept · ${remaining} more ${remaining === 1 ? "makes" : "make"} a page`}
				</Text>
			</View>
			<Glyph name="arrowRight" size={16} />
		</Pressable>
	);
}

const styles = StyleSheet.create({
	card: {
		backgroundColor: WHIMSY.paper,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.lg,
		borderWidth: 1.5,
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		marginBottom: SPACE.md,
		padding: SPACE.md,
		...SHADOW_SM,
	},
	pressed: { transform: [{ scale: 0.985 }] },
	iconWell: {
		width: 45,
		height: 45,
		borderRadius: RADII.md,
		backgroundColor: WHIMSY.peach,
		alignItems: "center",
		justifyContent: "center",
		transform: [{ rotate: "-2deg" }],
	},
	copy: { flex: 1, minWidth: 0 },
	kicker: {
		color: WHIMSY.mute,
		...TYPE.kickerPill,
	},
	title: {
		color: WHIMSY.ink,
		...TYPE.cardTitle,
		marginTop: 1,
	},
	body: {
		color: WHIMSY.mute,
		...TYPE.bodySm,
		marginTop: 2,
	},
});

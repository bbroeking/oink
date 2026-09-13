import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router/react-navigation";
import { router } from "expo-router";
import { fetchPorchRound, groupPorchPages, PORCH_PAGE_SIZE } from "@/utils/porchRound";
import { trackInteraction } from "@/utils/interactionAnalytics";
import { Glyph } from "./ui/Glyph";
import { Sticker } from "./ui/Sticker";
import { CardTitle, KickerPill, T } from "./ui/Text";
import { ART_SIZE, BORDER, RADII, SPACE, WHIMSY } from "@/constants/theme";

// Three friendly doorsteps finish a scrapbook page. `utils/porchRound.ts`
// hard-codes the same 3 in `groupPorchPages`; it belongs there, but that file
// is outside this pass.

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
	const remaining = Math.max(0, PORCH_PAGE_SIZE - stopCount);

	return (
		<Sticker
			testID="porch-round-open"
			color="paper"
			rotate={0}
			radius={RADII.lg}
			border={BORDER.thin}
			shadow="sm"
			onPress={() => {
				void trackInteraction({
					eventName: "porch_round_started",
					surface: "porch_round",
					result: "completed",
					properties: { source: "cta", count: stopCount },
				});
				router.push("/porch-round");
			}}
			accessibilityLabel="Open your Porch Round scrapbook"
			accessibilityHint="Shows the friends you've visited, three to a page"
			style={styles.card}
		>
			<View style={styles.iconWell}>
				<Glyph name="pigface" size={ART_SIZE.glyphSm} />
			</View>
			<View style={styles.copy}>
				<KickerPill tone="secondary">Porch Round</KickerPill>
				<CardTitle style={styles.title}>Your visit scrapbook</CardTitle>
				<T role="bodySm" tone="secondary" style={styles.body}>
					{stopCount === 0
						? `Your next ${PORCH_PAGE_SIZE} Barn visits can make a page.`
						: `${stopCount} ${stopCount === 1 ? "visit" : "visits"} kept · ${remaining} more ${remaining === 1 ? "makes" : "make"} a page`}
				</T>
			</View>
			<Glyph name="arrowRight" size={ART_SIZE.mark} />
		</Sticker>
	);
}

const styles = StyleSheet.create({
	card: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		marginBottom: SPACE.md,
		padding: SPACE.md,
	},
	iconWell: {
		width: ART_SIZE.glyph,
		height: ART_SIZE.glyph,
		borderRadius: RADII.md,
		backgroundColor: WHIMSY.peach,
		alignItems: "center",
		justifyContent: "center",
		transform: [{ rotate: "-2deg" }],
	},
	copy: { flex: 1, minWidth: 0 },
	title: { marginTop: SPACE.xxs },
	body: { marginTop: SPACE.xxs },
});

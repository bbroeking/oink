import { useCallback, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "expo-router/react-navigation";
import {
	BodySm,
	Glyph,
	Icon,
	SectionTitle,
	Sticker,
	T,
} from "@/components/ui";
import { fetchMoteMachineState } from "@/utils/moteMachine";
import { MOTE_MACHINE_VISIBLE } from "@/constants/featureFlags";
import {
	ART_SIZE,
	BORDER,
	RADII,
	SPACE,
	TAP_MIN,
	UI_COLORS,
} from "@/constants/theme";

import { MOTE_IMAGE, MOTE_EARNING_HINT } from "@/constants/motes";

// Drawing geometry for the card's art well: the Mote sits in a `thumb`-sized
// paper disc with a little breathing room, and the card holds a fixed height so
// a one-line and a two-line body don't resize the row.
const MOTE_ART = 58;
const CARD_MIN_H = 116;
const SPARKLE_OFFSET = -SPACE.xs;
const SPARKLE_SIZE = 20;

export function MoteMachineCard({ balance }: { balance?: number } = {}) {
	if (!MOTE_MACHINE_VISIBLE) return null;
	return <VisibleMoteMachineCard balance={balance} />;
}

function VisibleMoteMachineCard({ balance }: { balance?: number }) {
	const [fetchedMotes, setMotes] = useState<number | null>(null);

	useFocusEffect(
		useCallback(() => {
			if (balance !== undefined) return;
			let cancelled = false;
			fetchMoteMachineState().then((result) => {
				if (!cancelled) setMotes(result.ok ? result.motes : null);
			});
			return () => {
				cancelled = true;
			};
		}, [balance]),
	);

	const motes = balance ?? fetchedMotes;

	// The client may ship before the database migration. Stay feature-dark until
	// the authoritative wallet and spin RPC are available.
	if (motes === null) return null;

	return (
		<Sticker
			color="lilac"
			rotate={0.5}
			radius={RADII.lg}
			style={styles.card}
			onPress={() => router.push("/mote-machine")}
			accessibilityLabel={`Open the Mote Machine. ${motes} Motes available.`}
			accessibilityHint="Opens the Mote Machine, where a Mote unlocks or recharges a Contraption"
		>
			<View style={styles.artWell}>
				<Image source={MOTE_IMAGE} style={styles.mote} resizeMode="contain" accessible={false} />
				<Glyph name="sparkles" size={SPARKLE_SIZE} style={styles.sparkle} />
			</View>
			<View style={styles.copy}>
				<T role="kickerPillSm" tone="accent">the mote machine</T>
				<SectionTitle style={styles.title}>
					{motes > 0 ? `${motes} ${motes === 1 ? "Mote" : "Motes"} ready` : "Find your next Mote"}
				</SectionTitle>
				<BodySm tone="secondary" style={styles.body}>
					{motes > 0
						? "Deposit one to unlock or recharge a helpful Contraption."
						: MOTE_EARNING_HINT}
				</BodySm>
			</View>
			<View style={styles.go}>
				<T role="kickerPillSm" tone="accent">
					{motes > 0 ? "play" : "visit"}
				</T>
				<Icon name="chevronRight" size={ART_SIZE.glyphSm} color={UI_COLORS.textPrimary} />
			</View>
		</Sticker>
	);
}

const styles = StyleSheet.create({
	card: {
		minHeight: CARD_MIN_H,
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		padding: SPACE.md,
	},
	artWell: {
		width: ART_SIZE.thumb,
		height: ART_SIZE.thumb,
		borderRadius: RADII.pill,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: UI_COLORS.surface,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
	},
	mote: { width: MOTE_ART, height: MOTE_ART },
	sparkle: { position: "absolute", right: SPARKLE_OFFSET, top: SPARKLE_OFFSET },
	copy: { flex: 1 },
	title: { marginTop: SPACE.xxs },
	body: { marginTop: SPACE.xxs },
	go: { minWidth: TAP_MIN, alignItems: "center" },
});

import React from "react";
import { View, StyleSheet } from "react-native";
import { SPACE } from "@/constants/theme";
import { ProgressTrack } from "@/components/ui/ProgressTrack";
import { T } from "@/components/ui/Text";
import { ZOOMIES_MAX } from "@/utils/expedition";

// The Zoomies charge — a FEELING, not a number. It rides the one meter drawing
// (`ProgressTrack`, spec §2 row 09), mounted with no caption and with its value
// announcement off: a visible or spoken "4/5" would turn the feeling into a
// digit, which is the law this whole screen is built on. The charge is spoken in
// words instead — see `zoomiesLabel`.

// The charge, in words — since there is no visible number, this is what a screen
// reader announces and what the caption would have said.
export function zoomiesLabel(value: number): string {
	if (value <= 0) return "Zoomies resting";
	if (value < Math.ceil(ZOOMIES_MAX / 2)) return "Zoomies stirring";
	if (value < ZOOMIES_MAX) return "Zoomies nearly bursting";
	return "Zoomies ready to burst";
}

export function ZoomiesMeter({ value }: { value: number }) {
	const label = zoomiesLabel(value);
	return (
		<View style={styles.wrap}>
			<T role="kickerPill" tone="accent">
				ZOOMIES
			</T>
			{/* The worded label IS the readout: `announceValue={false}` keeps the
			    track from reading the feeling out as a fraction. */}
			<ProgressTrack
				value={value}
				max={ZOOMIES_MAX}
				tone="rose"
				height="sm"
				accessibilityLabel={label}
				announceValue={false}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { gap: SPACE.xs },
});

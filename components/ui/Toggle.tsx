// The labelled switch — the one drawing for "a setting you flip". [wave 4]
//
// Before this, every settings row hand-rolled `<ListRow trailing={<Switch/>}>`
// and hand-wrote the announcement ("Sound on"), which is how a switch ends up
// announcing its own state twice, or not at all. A `Switch` is a control, so it
// carries `accessibilityRole="switch"` and `accessibilityState.checked`; the
// platform reads the on/off for us and the label stays the plain label.
//
// The track is the system's own pair — `surfaceStrong` at rest, `sage` when on
// (the success surface, not a stock iOS green) — and the thumb is paper.
// Disabled is `DISABLED_TEXT` ink on a live-shaped row, never an opacity crush
// (spec §3.3).
import React from "react";
import {
	StyleSheet,
	Switch,
	View,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import { SPACE, UI_COLORS, WHIMSY } from "@/constants/theme";
import { ListRow } from "./ListRow";
import { Body, Hand } from "./Text";

// The one track/thumb pair. Named here so no screen picks a switch color.
const TRACK = { false: UI_COLORS.surfaceStrong, true: WHIMSY.sage };
const THUMB = UI_COLORS.surface;

export interface ToggleProps {
	value: boolean;
	/** Flipped state; the row is the only writer. */
	onValueChange: (next: boolean) => void;
	/** The visible label — a noun the setting turns on ("Sound", "Haptics"). */
	label: string;
	/** A quiet hand line under the label; also the spoken hint when set. */
	hint?: string;
	/** Kept shaped, muted ink, no opacity. */
	disabled?: boolean;
	/** Draw as a bare label/switch line instead of a `ListRow` sticker. */
	standalone?: boolean;
	/** `ListRow`'s scrapbook tilt; pass `false` inside a dense settings stack. */
	tilt?: boolean;
	/** Position in the list, so stacked rows take their own turn. */
	index?: number;
	/** Sharpens the spoken name when the label alone is ambiguous. */
	accessibilityLabel?: string;
	/** What flipping it does. Defaults to `hint`. */
	accessibilityHint?: string;
	testID?: string;
	style?: StyleProp<ViewStyle>;
}

/**
 * `<Toggle label="Sound" value={sound} onValueChange={setSound} />` — a
 * settings row wearing the system's switch. (2026-09-11)
 */
export function Toggle({
	value,
	onValueChange,
	label,
	hint,
	disabled,
	standalone,
	tilt = false,
	index = 0,
	accessibilityLabel,
	accessibilityHint,
	testID,
	style,
}: ToggleProps) {
	const control = (
		<Switch
			value={value}
			onValueChange={onValueChange}
			disabled={disabled}
			trackColor={TRACK}
			thumbColor={THUMB}
			ios_backgroundColor={UI_COLORS.surfaceStrong}
			accessibilityRole="switch"
			accessibilityLabel={accessibilityLabel ?? label}
			accessibilityHint={accessibilityHint ?? hint}
			accessibilityState={{ checked: value, disabled: !!disabled }}
			testID={testID}
		/>
	);

	const text = (
		<>
			<Body tone={disabled ? "disabled" : "primary"}>{label}</Body>
			{hint ? <Hand tone="secondary">{hint}</Hand> : null}
		</>
	);

	// Standalone: the same row without the sticker, for a switch that already
	// sits inside a Sticker or a Sheet body.
	if (standalone) {
		return (
			<View style={[styles.bare, style]}>
				<View style={styles.bareText}>{text}</View>
				{control}
			</View>
		);
	}

	return (
		<ListRow
			title={text}
			trailing={control}
			tilt={tilt}
			index={index}
			style={style}
		/>
	);
}

const styles = StyleSheet.create({
	bare: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		paddingVertical: SPACE.sm,
	},
	bareText: { flex: 1, minWidth: 0 },
});

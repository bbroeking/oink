// A hanging sign — the storefront's doors (Storefront build 2, 2026-09-16,
// taste-standard ruling 3: "Closet and Furnish hang as signs so the counter
// front belongs to the pigs"). A paper sign on a short string, icon over
// label, in the same language as the hanging-signs tab bar: the current one
// wears the peach wash and a lean, the rest hang straight.
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import {
	ART_SIZE,
	BORDER,
	RADII,
	SHADOW_SM,
	SPACE,
	TAP_MIN,
	TILT,
	TYPE,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import { Icon, type IconName } from "../ui/Icon";
import { Glyph, type GlyphName } from "../ui/Glyph";
import { Sticker } from "../ui/Sticker";
import { T } from "../ui/Text";

/** The string a sign hangs from. */
const STRING_H = SPACE.lg;
/** The sign's own face: a 44pt tap plus the string above it. */
const SIGN_MIN_H = TAP_MIN;
/** The active sign's lean — the tab bar's, and no more. */
const ACTIVE_TILT = TILT.reveal;
/** The count badge on a sign's corner ("Closet" with 12 owned). */
const BADGE_MIN_W = 22;
const BADGE_H = 22;

export function HangingSign({
	label,
	count,
	icon,
	glyph,
	art,
	active = false,
	onPress,
	accessibilityLabel,
	accessibilityHint,
	testID,
}: {
	label: string;
	/** A count pinned to the sign's corner, so the word stays whole. */
	count?: number;
	icon?: IconName;
	glyph?: GlyphName;
	/** Bespoke art in the icon slot (the barn door), sized by the caller. */
	art?: ReactNode;
	active?: boolean;
	onPress: () => void;
	accessibilityLabel?: string;
	accessibilityHint?: string;
	testID?: string;
}) {
	return (
		<View style={styles.hanger}>
			<View style={styles.string} pointerEvents="none" />
			<Sticker
				color={active ? "peach" : "paper"}
				radius={RADII.md}
				shadow="sm"
				rotate={active ? ACTIVE_TILT : 0}
				onPress={onPress}
				accessibilityRole="button"
				accessibilityLabel={accessibilityLabel ?? label}
				accessibilityHint={accessibilityHint}
				accessibilityState={{ selected: active }}
				testID={testID}
				style={styles.sign}
			>
				{art ? (
					art
				) : glyph ? (
					<Glyph name={glyph} size={ART_SIZE.glyphSm} />
				) : icon ? (
					<Icon
						name={icon}
						size={ART_SIZE.glyphSm}
						color={UI_COLORS.textPrimary}
					/>
				) : null}
				<T role="label" numberOfLines={1}>
					{label}
				</T>
				{count !== undefined && count > 0 ? (
					<View style={styles.badge} pointerEvents="none">
						<T role="numeral" style={styles.badgeText}>
							{count.toLocaleString()}
						</T>
					</View>
				) : null}
			</Sticker>
		</View>
	);
}

const styles = StyleSheet.create({
	hanger: {
		flex: 1,
		minWidth: 0,
		alignItems: "stretch",
	},
	string: {
		alignSelf: "center",
		width: BORDER.ink,
		height: STRING_H,
		backgroundColor: UI_COLORS.border,
	},
	badge: {
		position: "absolute",
		top: -SPACE.sm,
		right: -SPACE.xs,
		minWidth: BADGE_MIN_W,
		height: BADGE_H,
		paddingHorizontal: SPACE.xs,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.sun,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		alignItems: "center",
		justifyContent: "center",
		...SHADOW_SM,
	},
	badgeText: { fontSize: TYPE.kicker.fontSize, lineHeight: TYPE.kicker.lineHeight },
	sign: {
		minHeight: SIGN_MIN_H,
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.xs,
		paddingVertical: SPACE.sm,
		paddingHorizontal: SPACE.xs,
	},
});

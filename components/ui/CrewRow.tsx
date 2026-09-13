// The crew row — the one "portrait · body · action" row shared by every
// Sounder invite/matchmaking surface (SounderCard, FriendInvitePicker,
// PlayerInvitePicker, JoinableSounders, TransferLeadershipSheet).
//
// Graduated out of `components/CrewRow.tsx` into the system 2026-09-11 (wave 4).
// It stays its own drawing beside `ListRow`: a crew row is a flat line with a
// dashed rule between siblings, not a sticker in a stack — the scrapbook lift
// would fight the sheet it lives in. The pieces it composes from (portrait, sun
// pill, hand link, kicker, dashed rule) live in `./SocialRows`.
//
// **Accessibility lives here, not at the call sites** [B-04]: the row composes
// its own label from the title spans and the sub line it already renders, so a
// call site may sharpen it but cannot forget it.

import React, { type ReactNode } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { T } from "./Text";
import { DashedRule, ROW_GAP, textOf } from "./SocialRows";
import { FONTS, OPACITY, PRESSED_FLAT, SPACE } from "@/constants/theme";

export function CrewRow({
	left,
	title,
	titleNode,
	sub,
	right,
	divider = false,
	dim = false,
	onPress,
	accessibilityLabel,
	accessibilityHint,
}: {
	left: ReactNode;
	/** String or rich <Text> spans (accent names); wrapped in the name style. */
	title: ReactNode;
	/** Fully laid-out identity block; bypasses the legacy single Text wrapper. */
	titleNode?: ReactNode;
	sub?: string;
	right?: ReactNode;
	/** Dashed rule above — pass for every row after a section's first. */
	divider?: boolean;
	dim?: boolean;
	onPress?: () => void;
	/** Sharpens the composed title + sub label; rarely needed. */
	accessibilityLabel?: string;
	/** What opens / happens on tap. */
	accessibilityHint?: string;
}) {
	const tappable = !!onPress;
	const composed = accessibilityLabel ?? [textOf(titleNode ?? title), sub].filter(Boolean).join(", ");
	return (
		<>
			{divider && <DashedRule />}
			<Pressable
				onPress={onPress}
				disabled={!tappable}
				accessible
				accessibilityRole={tappable ? "button" : "text"}
				accessibilityLabel={composed}
				accessibilityHint={tappable ? accessibilityHint : undefined}
				style={({ pressed }) => [
					styles.row,
					dim && styles.rowDim,
					tappable && pressed && PRESSED_FLAT,
				]}
			>
				{left}
				<View style={styles.rowBody}>
					{titleNode ?? (
						<T role="body" style={styles.rowName} numberOfLines={2}>
							{title}
						</T>
					)}
					{!!sub && (
						<T role="kicker" tone="secondary" style={styles.rowSub} numberOfLines={1}>
							{sub}
						</T>
					)}
				</View>
				{right ? <View style={styles.rowRight}>{right}</View> : null}
			</Pressable>
		</>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: ROW_GAP,
		paddingVertical: SPACE.sm,
	},
	rowDim: { opacity: OPACITY.dim },
	rowBody: { flex: 1, minWidth: 0 },
	// Fredoka name line over a Patrick Hand subline — the mockup's .nm/.ln pair.
	rowName: { fontFamily: FONTS.display },
	rowSub: { marginTop: SPACE.xxs },
	rowRight: { alignItems: "flex-end", gap: SPACE.xs },
});

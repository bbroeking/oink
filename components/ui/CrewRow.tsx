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
//
// **The action column is never inside the row's element** (2026-10-04). The
// identity (portrait + name + line) is ONE accessibility element, a button
// when the row opens something; `right` sits beside it, so each of its
// controls is its own VoiceOver target. Inside the element they were all
// silent: the leader's kick, Join / Decline, "let them in" / "not now",
// Invite, "take it back" (an element hides everything inside it). A status
// placed there ("leader", "full now") is read as its own short line.

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
	// The name: the title spans' own words, or the plain `title` when the
	// identity is a laid-out node with no text children (a ProfileIdentity,
	// which left the Sounder's rows saying only "rides with you").
	const name = textOf(titleNode) || textOf(title);
	const composed = accessibilityLabel ?? [name, sub].filter(Boolean).join(", ");
	return (
		<>
			{divider && <DashedRule />}
			<View style={[styles.row, dim && styles.rowDim]}>
				<Pressable
					onPress={onPress}
					disabled={!tappable}
					accessible
					accessibilityRole={tappable ? "button" : "text"}
					accessibilityLabel={composed}
					accessibilityHint={tappable ? accessibilityHint : undefined}
					// The row's pad still answers its tap, as it did when the whole
					// line was the button.
					hitSlop={IDENTITY_SLOP}
					style={({ pressed }) => [
						styles.identity,
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
				</Pressable>
				{right ? <View style={styles.rowRight}>{right}</View> : null}
			</View>
		</>
	);
}

// The row's vertical pad, which the identity's hit frame reaches back into.
const ROW_PAD_V = SPACE.sm;
const IDENTITY_SLOP = { top: ROW_PAD_V, bottom: ROW_PAD_V, left: 0, right: 0 };

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: ROW_GAP,
		paddingVertical: ROW_PAD_V,
	},
	// Portrait + name + line: the row's one element. It fills the row's height
	// so its hit frame plus the pad covers the line edge to edge.
	identity: {
		flex: 1,
		minWidth: 0,
		alignSelf: "stretch",
		flexDirection: "row",
		alignItems: "center",
		gap: ROW_GAP,
	},
	rowDim: { opacity: OPACITY.dim },
	rowBody: { flex: 1, minWidth: 0 },
	// Fredoka name line over a Patrick Hand subline — the mockup's .nm/.ln pair.
	rowName: { fontFamily: FONTS.display },
	rowSub: { marginTop: SPACE.xxs },
	rowRight: { alignItems: "flex-end", gap: SPACE.xs },
});

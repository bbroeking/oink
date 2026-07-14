// Shared guarded-phase CTA affordances — the pieces a player sees when the patch
// is closed and there's nothing to dig yet. Extracted from SounderStepCard so the
// onboarding first_dig branch AND the retained-player CrewedHome guarded state
// offer the SAME "oink me when it opens" opt-in (no forked copy), plus the Burrow
// Book as a real secondary affordance instead of an afterthought link.
//
//   NotifyChip     — one local push at the next window open (scheduleOpenReminder).
//                    A calm sticker chip, not a toggle; tapping schedules +
//                    confirms in place. Confirmed / denied copy lives here once.
//   BurrowBookLink — the dig's relic shelf, styled as a bordered secondary button
//                    (paper pill + ink outline), not a bare underlined link.

import { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Glyph, IconText } from "../ui/Glyph";
import { scheduleOpenReminder } from "@/utils/pushNotifications";
import { FONTS, RADII, SHADOW_SM, SPACE, TYPE, WHIMSY } from "@/constants/theme";

// "Oink me when it opens" — one local push at the next window open. A calm sticker
// chip, not a toggle; tapping it schedules and confirms in place.
export function NotifyChip() {
	const [state, setState] = useState<"idle" | "set" | "denied">("idle");
	const onPress = useCallback(async () => {
		Haptics.selectionAsync().catch(() => {});
		const r = await scheduleOpenReminder();
		setState(r === "scheduled" ? "set" : r === "denied" ? "denied" : "idle");
	}, []);

	if (state === "set") {
		return (
			<IconText
				right={<Glyph name="check" size={13} />}
				gap={4}
				style={styles.notifySetRow}
			>
				<Text style={styles.notifySet}>we'll oink you when the patch opens</Text>
			</IconText>
		);
	}
	if (state === "denied") {
		return (
			<Text style={styles.notifyDenied}>
				turn on notifications in Settings to be oinked
			</Text>
		);
	}
	return (
		<Pressable
			onPress={onPress}
			hitSlop={6}
			style={({ pressed }) => [styles.notifyRow, pressed && { opacity: 0.7 }]}
		>
			<Glyph name="gem" size={14} />
			<Text style={styles.notifyLink}>oink me when it opens ›</Text>
		</Pressable>
	);
}

// The Burrow Book — the dig's relic shelf. A real bordered secondary affordance
// (paper pill + ink outline + hard shadow), not a bare underlined afterthought.
export function BurrowBookLink() {
	return (
		<Pressable
			onPress={() => router.push("/dig-collection")}
			hitSlop={6}
			accessibilityRole="button"
			accessibilityLabel="Open the Burrow Book"
			style={({ pressed }) => [
				styles.burrowBtn,
				pressed && { transform: [{ translateX: 2 }, { translateY: 2 }], shadowOpacity: 0, elevation: 0 },
			]}
		>
			<Glyph name="gem" size={14} />
			<Text style={styles.burrowBtnText}>the Burrow Book</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	// Notify opt-in on the guarded state.
	notifyRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.xs,
		marginTop: SPACE.sm,
	},
	notifyLink: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		textDecorationLine: "underline",
	},
	notifySetRow: {
		justifyContent: "center",
		marginTop: SPACE.sm,
	},
	notifySet: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.sage,
	},
	notifyDenied: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: SPACE.sm,
	},
	// The Burrow Book secondary button.
	burrowBtn: {
		flexDirection: "row",
		alignItems: "center",
		alignSelf: "center",
		gap: SPACE.xs,
		marginTop: SPACE.sm,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.xs + 2,
		borderRadius: RADII.pill,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		...SHADOW_SM,
	},
	burrowBtnText: {
		fontFamily: FONTS.whimsy,
		fontSize: 13,
		color: WHIMSY.ink,
	},
});

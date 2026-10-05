// The one door to matchmade play (SKILL.md 2026-10-04: "one door, dark"):
// a sticker row on the Friends tab, the five games' icons fanned on it,
// "Play together", and a sun badge counting what is waiting on you (tables
// where it is your move plus invites for you) when there is anything. It
// draws nothing at all while the `multiplayer` flag is off (or loading), so
// the tab is unchanged for everyone outside the dark launch. It never opens
// the play socket itself: the counts are whatever the hub last heard.
//
// Placement: the Friends list's `top` slot (components/Friends.tsx), first in
// the list's head and above its empty, loading and error states. It sits
// straight, as the friend rows under it do: a lean at the top edge of a
// clipping list would lose a corner. It takes a `style` for its margins.
//
// It is chrome over a list, so its words state their ceiling
// (CHROME_TYPE_CAP): at accessibility sizes it grew to 212pt and left room for
// a friend and a half above the tab bar (the 2026-10-04 run).

import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { router } from "expo-router";
import { CardTitle, Hand, Icon, Sticker, T } from "@/components/ui";
import { ART_SIZE, BORDER, CHROME_TYPE_CAP, RADII, SPACE, UI_COLORS, WHIMSY } from "@/constants/theme";
import { usePlay, usePlayEnabled } from "@/hooks/useMultiplayer";
import { GameFan } from "./GameFan";
import { BADGE_MAX, BADGE_SIZE } from "./layout";
import { DOOR_COPY, fill } from "./playCopy";

export function PlayDoor({ style, onPress, testID = "play-door" }: { style?: StyleProp<ViewStyle>; onPress?: () => void; testID?: string }) {
	const enabled = usePlayEnabled();
	const play = usePlay();
	if (!enabled) return null;
	const waiting = play.yourTurnCount + play.incomingInvites.length;
	const label = waiting > 0 ? `${DOOR_COPY.title}, ${fill(DOOR_COPY.waiting, { n: String(waiting) })}` : DOOR_COPY.title;
	return (
		<Sticker
			color="sky"
			rotate={0}
			pad
			onPress={onPress ?? (() => router.push("/play"))}
			accessibilityLabel={label}
			accessibilityHint={DOOR_COPY.hint}
			style={[styles.door, style]}
			testID={testID}
		>
			<GameFan size={ART_SIZE.glyphSm} />
			<View style={styles.words}>
				<CardTitle maxFontSizeMultiplier={CHROME_TYPE_CAP}>{DOOR_COPY.title}</CardTitle>
				<Hand tone="secondary" maxFontSizeMultiplier={CHROME_TYPE_CAP}>
					{DOOR_COPY.sub}
				</Hand>
			</View>
			{waiting > 0 ? (
				<View style={styles.badge} testID={`${testID}-badge`}>
					<T role="kickerPillSm" maxFontSizeMultiplier={CHROME_TYPE_CAP}>
						{waiting > BADGE_MAX ? `${BADGE_MAX}+` : String(waiting)}
					</T>
				</View>
			) : null}
			<Icon name="chevronRight" size={ART_SIZE.mark} color={UI_COLORS.textSecondary} />
		</Sticker>
	);
}

const styles = StyleSheet.create({
	door: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
	words: { flex: 1, minWidth: 0 },
	badge: {
		minWidth: BADGE_SIZE,
		height: BADGE_SIZE,
		borderRadius: RADII.pill,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		backgroundColor: WHIMSY.sun,
		paddingHorizontal: SPACE.xs,
		alignItems: "center",
		justifyContent: "center",
	},
});

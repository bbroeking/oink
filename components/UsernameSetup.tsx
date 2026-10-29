// Name-pick screen. Same Rosie hero treatment as SupaAuth so the
// transition from sign-in → name-pick feels like one continuous
// storybook flow rather than two unrelated screens.
//
// Layout: cream backdrop, Rosie hero up top, paper-sticker card
// with the input + Save button below, on one scroller the keyboard insets
// (it lifts the handle well into view natively). (2026-10-04)
//
// Rebuilt on the design system 2026-09-11 (wave 3 · area E): the hand-rolled
// well is `TextField` (so the rules line is a `helper`, a taken name is an
// `errorText` and a good name earns the check), and the Save CTA is `Button` —
// which means a disabled Save is now "a button, asleep" instead of the 0.5
// opacity ghost the 2026-07-07 ruling retired. [E16]
import React, { useState } from "react";
import {
	StyleSheet,
	View,
	Image,
	ScrollView,
	useWindowDimensions,
	type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../utils/supabase";
import { Button, Kicker, PageTitle, Sticker, TextField } from "./ui";
import {
	fitRosieHeight,
	HERO_PAD_BOTTOM,
	HERO_PAD_TOP,
	ROSIE_ART,
	ROSIE_GAP,
} from "./rosieHero";
import { isUsernameAllowed } from "@/constants/bannedWords";
import {
	BORDER,
	BUTTON_SIZE,
	PAGE_PAD,
	RADII,
	SPACE,
	STICKER_SHADOW,
	TAP_MIN,
	TILT,
	TYPE,
	UI_COLORS,
} from "@/constants/theme";

// Rosie: the same hero as the sign-in screen just before this one, sized by
// the same arithmetic (`fitRosieHeight`, components/rosieHero.ts). She was
// asked for at 60% width but drew at 383pt on every phone, because React
// Native's Image writes the source's height into its style; a slot that
// flex-grew inside the scroller then never shrank either, so on an SE the
// card sat under the fold. Her height is now the scene's spare, measured.
// (2026-10-04)

// What the words and the card take before they have been measured, summed
// from the tokens they lay out with at the default text size, so the first
// frame is already the fitted one on an SE; onLayout corrects it for Dynamic
// Type and for an error line.
const sum = (parts: readonly number[]) => parts.reduce((a, b) => a + b, 0);
// The kicker, then the title (two lines on a phone) a SPACE.sm step below it.
const WORDS_H_GUESS = sum([
	TYPE.kicker.lineHeight,
	SPACE.sm,
	TYPE.pageTitle.lineHeight * 2,
]);
// The card (outline, pad, the handle well at TextField's tap-plus-a-step,
// its helper line, the gap, Save, pad, outline), then the card's bottom breath.
const CARD_H_GUESS = sum([
	BORDER.ink,
	SPACE.card,
	TAP_MIN,
	SPACE.xs,
	SPACE.xs,
	TYPE.hand.lineHeight,
	SPACE.md,
	BUTTON_SIZE.md.minH,
	SPACE.card,
	BORDER.ink,
	SPACE.xl,
]);

// Friendly copy for moderation rejections — shared between the
// client-side pre-check and the server trigger's username_not_allowed
// error (the DB is authoritative; this check just saves a round trip).
const MODERATION_COPY: Record<"banned" | "reserved", string> = {
	banned: "That name won't fly in the barn. Pick a different one.",
	reserved: "That name's taken by the barn itself. Pick a different one.",
};

const NAME_MIN = 3;
const NAME_MAX = 24;

interface Props {
	userId: string;
	onSaved: () => void;
}

export default function UsernameSetup({ userId, onSaved }: Props) {
	const [username, setUsername] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	const trimmed = username.trim();
	const valid = trimmed.length >= NAME_MIN && trimmed.length <= NAME_MAX;

	const handleSave = async () => {
		if (!valid || saving) return;
		// Moderation pre-check before any network call. The profiles
		// trigger enforces the same policy server-side.
		const allowed = isUsernameAllowed(trimmed);
		if (!allowed.ok) {
			setError(MODERATION_COPY[allowed.reason]);
			return;
		}
		setSaving(true);
		setError("");
		const { error: updateError } = await supabase
			.from("profiles")
			.update({ username: trimmed })
			.eq("id", userId);
		setSaving(false);
		if (updateError) {
			if (updateError.message?.includes("username_not_allowed")) {
				// Server trigger rejected it (client list may lag the DB's).
				setError(MODERATION_COPY.banned);
			} else if (updateError.code === "23505") {
				setError("That name is taken. Try another.");
			} else {
				setError("Couldn't save. Try again.");
			}
			return;
		}
		onSaved();
	};

	// The scene scrolls only when it must (a short phone, large text); the
	// keyboard insets it and lifts the handle well into view natively, rather
	// than squeezing the hero under a padding lift. React Native's deprecated
	// SafeAreaView is gone: the insets are applied here. (2026-10-04)
	const insets = useSafeAreaInsets();

	// Rosie fills what the scene can spare (see `fitRosieHeight`).
	const { height: windowH } = useWindowDimensions();
	const [wordsH, setWordsH] = useState(WORDS_H_GUESS);
	const [cardH, setCardH] = useState(CARD_H_GUESS);
	const rosieH = fitRosieHeight({
		sceneH: windowH - insets.top - insets.bottom,
		wordsH,
		cardH,
	});
	const onWordsLayout = (e: LayoutChangeEvent) => setWordsH(e.nativeEvent.layout.height);
	const onCardLayout = (e: LayoutChangeEvent) => setCardH(e.nativeEvent.layout.height);

	return (
		<View style={[styles.bg, { paddingTop: insets.top }]}>
			<ScrollView
				style={styles.flex}
				contentContainerStyle={[styles.scene, { paddingBottom: insets.bottom }]}
				automaticallyAdjustKeyboardInsets
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode="interactive"
				alwaysBounceVertical={false}
				showsVerticalScrollIndicator={false}
				testID="username-scene"
			>
				<View style={styles.hero}>
					<View style={[styles.rosieSlot, { height: rosieH }]} testID="username-rosie">
						<Image
							source={require("../assets/images/sprites/rosie/idle_1.png")}
							// Both axes, so the asset's own 370×383 can't win.
							style={styles.rosie}
							resizeMode="contain"
						/>
					</View>
					<View style={styles.words} onLayout={onWordsLayout} testID="username-words">
						<Kicker star={false}>★ pick your handle ★</Kicker>
						<PageTitle align="center" style={styles.title}>
							What should Rosie call you?
						</PageTitle>
					</View>
				</View>

				<View style={styles.cardWrap} onLayout={onCardLayout} testID="username-card">
					<Sticker
						color="paper"
						rotate={TILT.card}
						radius={RADII.xxl}
						pad
						style={[styles.card, STICKER_SHADOW]}
					>
						<TextField
							// The hero title already asks the question out loud, so
							// the kicker label stays for VoiceOver only.
							label="Your handle"
							labelHidden
							value={username}
							onChangeText={(t) => {
								setUsername(t);
								if (error) setError("");
							}}
							placeholder={`${NAME_MIN}–${NAME_MAX} characters`}
							helper="Shows up next to your name on the leaderboard."
							state={error ? "error" : valid ? "valid" : "default"}
							errorText={error || undefined}
							autoCapitalize="none"
							autoCorrect={false}
							maxLength={NAME_MAX}
							editable={!saving}
						/>
						<Button
							full
							variant="lilac"
							onPress={handleSave}
							disabled={!valid}
							loading={saving}
							loadingLabel="Saving…"
							accessibilityLabel={
								valid ? `Save the name ${trimmed}` : "Save your name"
							}
							accessibilityHint={
								valid
									? "Names your pig and opens the next step"
									: `Enter ${NAME_MIN} to ${NAME_MAX} characters first`
							}
						>
							Save
						</Button>
					</Sticker>
				</View>
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	bg: { flex: 1, backgroundColor: UI_COLORS.surfaceMuted },
	flex: { flex: 1 },
	// At least the viewport, taller only when it must. The side inset lives
	// here now: React Native's SafeAreaView silently replaced it, so the card
	// ran edge to edge on device.
	scene: { flexGrow: 1, justifyContent: "space-between", paddingHorizontal: PAGE_PAD },
	hero: {
		// `flexGrow`, not `flex: 1`: inside a scroller the hero's own content
		// must count toward the scene's height.
		flexGrow: 1,
		alignItems: "center",
		justifyContent: "center",
		// Top minus bottom keeps the 24pt (SPACE.xl) the hero kept above Rosie;
		// SPACE.sm underneath is a short phone's breath above the card.
		paddingTop: HERO_PAD_TOP,
		paddingBottom: HERO_PAD_BOTTOM,
	},
	// Rosie's slot: its height is `fitRosieHeight`'s, set inline; her width
	// follows from the art's ratio.
	rosieSlot: {
		aspectRatio: ROSIE_ART.width / ROSIE_ART.height,
		marginBottom: ROSIE_GAP,
	},
	rosie: { width: "100%", height: "100%" },
	// The kicker and the title, measured as one block, centred as before.
	words: { alignSelf: "stretch", alignItems: "center" },
	title: {
		paddingHorizontal: SPACE.lg,
		marginTop: SPACE.sm,
	},
	cardWrap: { paddingBottom: SPACE.xl },
	card: { gap: SPACE.md },
});

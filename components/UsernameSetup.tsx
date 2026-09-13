// Name-pick screen. Same Rosie hero treatment as SupaAuth so the
// transition from sign-in → name-pick feels like one continuous
// storybook flow rather than two unrelated screens.
//
// Layout: cream backdrop, Rosie hero up top, paper-sticker card
// with the input + Save button below. Keyboard avoidance preserved.
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
	SafeAreaView,
	KeyboardAvoidingView,
	Platform,
} from "react-native";
import { supabase } from "../utils/supabase";
import { Button, Kicker, PageTitle, Sticker, TextField } from "./ui";
import { isUsernameAllowed } from "@/constants/bannedWords";
import { PAGE_PAD, RADII, SPACE, STICKER_SHADOW, UI_COLORS } from "@/constants/theme";

// Friendly copy for moderation rejections — shared between the
// client-side pre-check and the server trigger's username_not_allowed
// error (the DB is authoritative; this check just saves a round trip).
const MODERATION_COPY: Record<"banned" | "reserved", string> = {
	banned: "That name won't fly in the barn — pick a different one.",
	reserved: "That name's taken by the barn itself — pick a different one.",
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
				setError("That name is taken — try another.");
			} else {
				setError("Couldn't save. Try again.");
			}
			return;
		}
		onSaved();
	};

	return (
		<View style={styles.bg}>
			<KeyboardAvoidingView
				style={styles.flex}
				behavior={Platform.OS === "ios" ? "padding" : undefined}
			>
				<SafeAreaView style={styles.safe}>
					<View style={styles.hero}>
						<Image
							source={require("../assets/images/sprites/rosie/idle_1.png")}
							style={styles.rosie}
							resizeMode="contain"
						/>
						<Kicker star={false}>★ pick your handle ★</Kicker>
						<PageTitle align="center" style={styles.title}>
							What should Rosie call you?
						</PageTitle>
					</View>

					<View style={styles.cardWrap}>
						<Sticker
							color="paper"
							rotate={-0.6}
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
				</SafeAreaView>
			</KeyboardAvoidingView>
		</View>
	);
}

const styles = StyleSheet.create({
	bg: { flex: 1, backgroundColor: UI_COLORS.surfaceMuted },
	flex: { flex: 1 },
	safe: { flex: 1, justifyContent: "space-between", paddingHorizontal: PAGE_PAD },
	hero: {
		alignItems: "center",
		paddingTop: SPACE.xl,
		flex: 1,
		justifyContent: "center",
	},
	rosie: {
		width: "60%",
		aspectRatio: 370 / 383, // matches idle_1.png native ratio (near-square)
		marginBottom: SPACE.card,
	},
	title: {
		paddingHorizontal: SPACE.lg,
		marginTop: SPACE.sm,
	},
	cardWrap: { paddingBottom: SPACE.xl },
	card: { gap: SPACE.md },
});

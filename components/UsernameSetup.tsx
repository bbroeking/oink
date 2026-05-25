// Name-pick screen. Same Rosie hero treatment as SupaAuth so the
// transition from sign-in → name-pick feels like one continuous
// storybook flow rather than two unrelated screens.
//
// Layout: cream backdrop, Rosie hero up top, paper-sticker card
// with the input + Save button below. Keyboard avoidance preserved.
import React, { useState } from "react";
import {
	StyleSheet,
	View,
	TextInput,
	Pressable,
	Image,
	Text,
	SafeAreaView,
	KeyboardAvoidingView,
	Platform,
} from "react-native";
import { supabase } from "../utils/supabase";
import { Sticker } from "./ui/Sticker";
import { FONTS, KICKER_TEXT, WHIMSY, STICKER_SHADOW } from "@/constants/theme";

interface Props {
	userId: string;
	onSaved: () => void;
}

export default function UsernameSetup({ userId, onSaved }: Props) {
	const [username, setUsername] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	const trimmed = username.trim();
	const valid = trimmed.length >= 3 && trimmed.length <= 24;

	const handleSave = async () => {
		if (!valid || saving) return;
		setSaving(true);
		setError("");
		const { error: updateError } = await supabase
			.from("profiles")
			.update({ username: trimmed })
			.eq("id", userId);
		setSaving(false);
		if (updateError) {
			if (updateError.code === "23505") {
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
						<Text style={styles.kicker}>★ pick your handle ★</Text>
						<Text style={styles.title}>What should Rosie call you?</Text>
					</View>

					<View style={styles.cardWrap}>
						<Sticker
							color="paper"
							rotate={-0.6}
							radius={20}
							style={[styles.card, STICKER_SHADOW]}
						>
							<TextInput
								style={[styles.input, !!error && styles.inputError]}
								placeholder="3–24 characters"
								placeholderTextColor={WHIMSY.mute}
								value={username}
								onChangeText={(t) => {
									setUsername(t);
									if (error) setError("");
								}}
								autoCapitalize="none"
								autoCorrect={false}
								maxLength={24}
								editable={!saving}
							/>
							{error ? (
								<Text style={styles.errorText}>{error}</Text>
							) : (
								<Text style={styles.helper}>
									Shows up next to your name on the leaderboard.
								</Text>
							)}
							<Pressable
								onPress={handleSave}
								disabled={!valid || saving}
								style={({ pressed }) => [
									styles.btn,
									(!valid || saving) && styles.btnDisabled,
									pressed && { opacity: 0.85 },
								]}
							>
								<Text style={styles.btnText}>
									{saving ? "Saving…" : "Save"}
								</Text>
							</Pressable>
						</Sticker>
					</View>
				</SafeAreaView>
			</KeyboardAvoidingView>
		</View>
	);
}

const styles = StyleSheet.create({
	bg: { flex: 1, backgroundColor: WHIMSY.cream },
	flex: { flex: 1 },
	safe: { flex: 1, justifyContent: "space-between", paddingHorizontal: 22 },
	hero: {
		alignItems: "center",
		paddingTop: 24,
		flex: 1,
		justifyContent: "center",
	},
	rosie: {
		width: "60%",
		aspectRatio: 370 / 383, // matches idle_1.png native ratio (near-square)
		marginBottom: 14,
	},
	kicker: { ...KICKER_TEXT, marginBottom: 6 },
	title: {
		fontFamily: FONTS.whimsy,
		fontSize: 26,
		color: WHIMSY.ink,
		textAlign: "center",
		paddingHorizontal: 16,
	},
	cardWrap: { paddingBottom: 24 },
	card: { padding: 18 },
	input: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 16,
		color: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 12,
		marginBottom: 8,
	},
	inputError: { borderColor: WHIMSY.accent },
	helper: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		marginBottom: 10,
	},
	errorText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 13,
		color: WHIMSY.accent,
		marginBottom: 10,
	},
	btn: {
		backgroundColor: WHIMSY.lilac,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 12,
		paddingVertical: 13,
		alignItems: "center",
		marginTop: 4,
	},
	btnDisabled: { opacity: 0.5 },
	btnText: {
		fontFamily: FONTS.whimsy,
		fontSize: 17,
		color: WHIMSY.ink,
		letterSpacing: 0.3,
	},
});

import React, { useState } from "react";
import {
	StyleSheet,
	View,
	TextInput,
	TouchableOpacity,
	ImageBackground,
	KeyboardAvoidingView,
	Platform,
} from "react-native";
import { supabase } from "../utils/supabase";
import { ThemedText } from "./ThemedText";
import { PRIMARY_COLOR } from "./SupaAuth";

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
		<ImageBackground
			source={require("../assets/images/splash-art.png")}
			style={styles.bg}
			resizeMode="cover"
		>
			<KeyboardAvoidingView
				style={styles.contentContainer}
				behavior={Platform.OS === "ios" ? "padding" : undefined}
			>
				<View style={styles.card}>
					<ThemedText style={styles.title}>
						Pick a name
					</ThemedText>
					<ThemedText style={styles.subtitle}>
						This is what other tickle-ers will see on the leaderboard.
					</ThemedText>
					<TextInput
						style={[styles.input, error ? styles.inputError : null]}
						placeholder="3–24 characters"
						placeholderTextColor="#999"
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
						<ThemedText style={styles.errorText}>{error}</ThemedText>
					) : null}
					<TouchableOpacity
						style={[
							styles.button,
							(!valid || saving) && styles.buttonDisabled,
						]}
						onPress={handleSave}
						disabled={!valid || saving}
					>
						<ThemedText style={styles.buttonText}>
							{saving ? "Saving..." : "Save"}
						</ThemedText>
					</TouchableOpacity>
				</View>
			</KeyboardAvoidingView>
		</ImageBackground>
	);
}

const styles = StyleSheet.create({
	bg: { flex: 1, width: "100%", height: "100%" },
	contentContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: 20,
	},
	card: {
		backgroundColor: "white",
		borderRadius: 20,
		padding: 28,
		width: "100%",
		maxWidth: 400,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		elevation: 5,
	},
	title: {
		fontSize: 24,
		fontWeight: "700",
		color: "#222",
		textAlign: "center",
		marginBottom: 8,
	},
	subtitle: {
		fontSize: 14,
		color: "#555",
		textAlign: "center",
		marginBottom: 20,
		lineHeight: 20,
	},
	input: {
		borderWidth: 1,
		borderColor: "#E0E0E0",
		borderRadius: 12,
		paddingHorizontal: 15,
		height: 50,
		fontSize: 16,
		color: "#333",
		backgroundColor: "#FFF",
		marginBottom: 8,
	},
	inputError: {
		borderColor: "#FF6B6B",
	},
	errorText: {
		color: "#FF6B6B",
		fontSize: 13,
		marginBottom: 8,
	},
	button: {
		backgroundColor: PRIMARY_COLOR,
		padding: 15,
		borderRadius: 12,
		alignItems: "center",
		marginTop: 12,
	},
	buttonDisabled: {
		opacity: 0.5,
	},
	buttonText: {
		color: "white",
		fontSize: 16,
		fontWeight: "600",
	},
});

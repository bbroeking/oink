import React, { useState } from "react";
import { StyleSheet, View, TouchableOpacity } from "react-native";
import { supabase } from "../utils/supabase";
import { Input } from "@rneui/themed";
import { ThemedText } from "./ThemedText";
import { PRIMARY_COLOR } from "./SupaAuth";

export default function EmailAuth() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [emailFocused, setEmailFocused] = useState(false);
	const [passwordFocused, setPasswordFocused] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");

	async function signInWithEmail() {
		setLoading(true);
		setErrorMessage(""); // Clear any previous error messages
		const { error } = await supabase.auth.signInWithPassword({
			email: email,
			password: password,
		});

		if (error) {
			setErrorMessage("Invalid email or password");
		}
		setLoading(false);
	}

	return (
		<View style={styles.card}>
			<Input
				placeholder="Email address"
				onChangeText={setEmail}
				value={email}
				autoCapitalize="none"
				containerStyle={styles.input}
				inputContainerStyle={[
					styles.inputContainer,
					emailFocused && styles.inputContainerFocused,
					errorMessage.length > 0 && styles.inputContainerError,
				]}
				inputStyle={styles.inputText}
				onFocus={() => setEmailFocused(true)}
				onBlur={() => setEmailFocused(false)}
				placeholderTextColor="#999"
			/>
			<Input
				placeholder="Password"
				onChangeText={setPassword}
				value={password}
				secureTextEntry
				autoCapitalize="none"
				containerStyle={styles.input}
				inputContainerStyle={[
					styles.inputContainer,
					passwordFocused && styles.inputContainerFocused,
					errorMessage.length > 0 && styles.inputContainerError,
				]}
				inputStyle={styles.inputText}
				onFocus={() => setPasswordFocused(true)}
				onBlur={() => setPasswordFocused(false)}
				placeholderTextColor="#999"
			/>
			{errorMessage ? (
				<ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
			) : null}
			<TouchableOpacity
				style={styles.loginButton}
				onPress={signInWithEmail}
				disabled={loading}
			>
				<ThemedText style={styles.loginButtonText}>
					{loading ? "Loading..." : "Login"}
				</ThemedText>
			</TouchableOpacity>
			<View style={styles.divider}>
				<View style={styles.dividerLine} />
				<ThemedText style={styles.dividerText}>or</ThemedText>
				<View style={styles.dividerLine} />
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	backgroundImage: {
		flex: 1,
		width: "100%",
		height: "100%",
	},
	contentContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: 20,
	},
	card: {
		backgroundColor: "white",
		borderRadius: 20,
		padding: 30,
		width: "100%",
		maxWidth: 400,
		alignItems: "center",
		shadowColor: "#000",
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		elevation: 5,
	},
	input: {
		paddingHorizontal: 0,
		marginBottom: 15,
	},
	inputContainer: {
		borderWidth: 1,
		borderColor: "#E0E0E0",
		borderRadius: 12,
		paddingHorizontal: 15,
		paddingVertical: 5,
		backgroundColor: "#FFFFFF",
		height: 50,
	},
	inputContainerFocused: {
		borderColor: PRIMARY_COLOR,
		borderWidth: 1,
		backgroundColor: "#FFF",
	},
	inputContainerError: {
		borderColor: "#FF6B6B",
	},
	inputText: {
		fontSize: 16,
		color: "#333",
	},
	errorText: {
		color: "#FF6B6B",
		fontSize: 14,
		marginBottom: 15,
		alignSelf: "flex-start",
	},
	loginButton: {
		backgroundColor: PRIMARY_COLOR,
		width: "100%",
		padding: 15,
		borderRadius: 12,
		alignItems: "center",
		marginBottom: 20,
		shadowColor: PRIMARY_COLOR,
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		elevation: 3,
	},
	loginButtonText: {
		color: "white",
		fontSize: 16,
		fontWeight: "600",
	},
	divider: {
		flexDirection: "row",
		alignItems: "center",
		width: "100%",
		marginVertical: 20,
	},
	dividerLine: {
		flex: 1,
		height: 1,
		backgroundColor: "#e0e0e0",
	},
	dividerText: {
		marginHorizontal: 10,
		color: "#666",
	},
});

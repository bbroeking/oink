import React, { useState } from "react";
import {
	Alert,
	StyleSheet,
	View,
	ImageBackground,
	TouchableOpacity,
	Dimensions,
} from "react-native";
import { supabase } from "../utils/supabase";
import { Input } from "@rneui/themed";
import { AppleAuth } from "./AppleAuth";
import { ThemedText } from "./ThemedText";

export const PRIMARY_COLOR = "#E8A7B9"; // Soft pink

export default function SupaAuth() {
	return (
		<ImageBackground
			source={require("../assets/images/splash-art.png")}
			style={styles.backgroundImage}
			resizeMode="cover"
		>
			<View style={styles.contentContainer}>
				<AppleAuth />
			</View>
		</ImageBackground>
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

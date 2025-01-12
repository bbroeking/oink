import React from "react";
import { StyleSheet, View, ImageBackground } from "react-native";
import { AppleAuth } from "./AppleAuth";
import EmailAuth from "./EmailAuth";

export const PRIMARY_COLOR = "#E8A7B9"; // Soft pink

export default function SupaAuth() {
	return (
		<ImageBackground
			source={require("../assets/images/splash-art.png")}
			style={styles.backgroundImage}
			resizeMode="cover"
		>
			<View style={styles.contentContainer}>
				<EmailAuth />
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
});

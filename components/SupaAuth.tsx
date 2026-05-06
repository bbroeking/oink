import React from "react";
import { StyleSheet, View, ImageBackground, Text } from "react-native";
import { AppleAuth } from "./AppleAuth";

export const PRIMARY_COLOR = "#E8A7B9";

export default function SupaAuth() {
	return (
		<ImageBackground
			source={require("../assets/images/splash-art.png")}
			style={styles.backgroundImage}
			resizeMode="cover"
		>
			<View style={styles.overlay} />
			<View style={styles.contentContainer}>
				<View style={styles.bottomCard}>
					<Text style={styles.title}>Tickle the Pig</Text>
					<Text style={styles.subtitle}>
						Sign in to start tickling.
					</Text>
					<View style={{ marginTop: 16 }}>
						<AppleAuth />
					</View>
				</View>
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
	overlay: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: "rgba(0,0,0,0.15)",
	},
	contentContainer: {
		flex: 1,
		justifyContent: "flex-end",
		padding: 24,
		paddingBottom: 40,
	},
	bottomCard: {
		backgroundColor: "white",
		borderRadius: 24,
		padding: 24,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.15,
		shadowRadius: 20,
		elevation: 6,
	},
	title: {
		fontFamily: "Fredoka_700Bold",
		fontSize: 28,
		color: "#1A1A1A",
		textAlign: "center",
	},
	subtitle: {
		fontFamily: "Nunito_600SemiBold",
		fontSize: 14,
		color: "#6B6B6B",
		textAlign: "center",
		marginTop: 4,
	},
});

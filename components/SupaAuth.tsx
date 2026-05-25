// Sign-in screen. Rosie front-and-center as the storybook hero so
// the first thing a player sees on the loading flow is the same
// pig they're about to meet on the Barn screen — no disconnect
// between the splash art and the gameplay character.
//
// Layout: cream backdrop (matches the rest of the app's
// WHIMSY.cream surface), Rosie hero portrait scaled to ~70% width
// upper-center, then a paper-sticker card with the title + Apple
// sign-in button anchored to the bottom.
import React from "react";
import {
	StyleSheet,
	View,
	Image,
	Text,
	SafeAreaView,
} from "react-native";
import { AppleAuth } from "./AppleAuth";
import { Sticker } from "./ui/Sticker";
import { FONTS, KICKER_TEXT, WHIMSY, STICKER_SHADOW } from "@/constants/theme";

// Kept for back-compat with downstream imports (UsernameSetup
// references this constant for its button tint).
export const PRIMARY_COLOR = WHIMSY.lilac;

export default function SupaAuth() {
	return (
		<View style={styles.bg}>
			<SafeAreaView style={styles.safe}>
				<View style={styles.hero}>
					<Image
						source={require("../assets/images/pig.png")}
						style={styles.rosie}
						resizeMode="contain"
					/>
					<Text style={styles.kicker}>★ tickle the pig ★</Text>
					<Text style={styles.title}>Meet Rosie</Text>
					<Text style={styles.subtitle}>
						She'd like a tickle. Sign in to start.
					</Text>
				</View>

				<View style={styles.cardWrap}>
					<Sticker
						color="paper"
						rotate={-0.8}
						radius={20}
						style={[styles.card, STICKER_SHADOW]}
					>
						<AppleAuth />
					</Sticker>
				</View>
			</SafeAreaView>
		</View>
	);
}

const styles = StyleSheet.create({
	bg: { flex: 1, backgroundColor: WHIMSY.cream },
	safe: { flex: 1, justifyContent: "space-between", paddingHorizontal: 22 },
	hero: {
		alignItems: "center",
		paddingTop: 24,
		flex: 1,
		justifyContent: "center",
	},
	rosie: {
		width: "82%",
		aspectRatio: 577 / 433, // matches pig.png native ratio
		marginBottom: 18,
	},
	kicker: {
		...KICKER_TEXT,
		marginBottom: 6,
	},
	title: {
		fontFamily: FONTS.whimsy,
		fontSize: 36,
		color: WHIMSY.ink,
		marginBottom: 6,
		textAlign: "center",
	},
	subtitle: {
		fontFamily: FONTS.hand,
		fontSize: 16,
		color: WHIMSY.mute,
		textAlign: "center",
		paddingHorizontal: 20,
	},
	cardWrap: {
		paddingBottom: 24,
	},
	card: {
		padding: 20,
	},
});

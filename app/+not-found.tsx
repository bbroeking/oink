import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Stack, router } from "expo-router";

import { Button } from "@/components/ui/Button";
import { Glyph } from "@/components/ui/Glyph";
import { PageHeader } from "@/components/ui/PageHeader";
import { Sticker } from "@/components/ui/Sticker";
import { PAGE_PAD, SPACE, TYPE, UI_COLORS } from "@/constants/theme";

/**
 * The 404. A deep link can land here from a stale push, an old share URL, or a
 * route we renamed — so it is a real screen wearing the real system (audit E8
 * retired the Expo template's ThemedText/ThemedView here), not a dead end.
 */
export default function NotFoundScreen() {
	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />
			<View style={styles.page}>
				<SafeAreaView style={styles.safe}>
					<PageHeader kicker="lost" title="This pen is empty" />
					<View style={styles.body}>
						<Sticker color="paper" rotate={-1.2} style={styles.card}>
							<Glyph name="zzz" size={44} />
							<Text style={styles.line}>
								Rosie sniffed around and found nothing here.
							</Text>
						</Sticker>
						<Button full onPress={() => router.replace("/")}>
							Back to the Barn
						</Button>
					</View>
				</SafeAreaView>
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	page: { flex: 1, backgroundColor: UI_COLORS.canvas },
	safe: { flex: 1 },
	body: {
		flex: 1,
		justifyContent: "center",
		paddingHorizontal: PAGE_PAD,
		gap: SPACE.xl,
	},
	card: { alignItems: "center", gap: SPACE.md, padding: SPACE.xl },
	line: {
		...TYPE.hand,
		color: UI_COLORS.textSecondary,
		textAlign: "center",
	},
});

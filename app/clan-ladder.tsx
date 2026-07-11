// /clan-ladder — the thin route wrapper around <SounderLeague/>. The board
// itself (Table + Spirit, roster expanders, data fetch) moved into
// components/SounderLeague.tsx so the Friends hub can render it inside its own
// Board segment (the "standings live in the Board now" decision, Your Sounder
// redesign). This route stays only to keep the old deep links working — the
// season-tab LeaguePlacard and the mud-war spoils link both push here.
// Dark-launched behind the `mud_wars` server flag like the rest of Mud Wars.
// Spec: docs/sounder-league-spec.md.

import { View, StyleSheet, SafeAreaView } from "react-native";
import { Stack, router, Redirect } from "expo-router";
import { PageHeader } from "../components/ui/PageHeader";
import { SounderLeague } from "../components/SounderLeague";
import { useFeatureFlagState } from "@/hooks/useFeatureFlags";
import { WHIMSY } from "@/constants/theme";

export default function ClanLadderScreen() {
	const { visible: mudWarsVisible, loaded: flagLoaded } =
		useFeatureFlagState("mud_wars");

	if (!flagLoaded) return null;
	if (!mudWarsVisible) return <Redirect href="/(tabs)" />;

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />
			<View style={styles.bg}>
				<SafeAreaView style={{ flex: 1 }}>
					<PageHeader
						kicker="the season table"
						title="Sounder League"
						onBack={() => router.back()}
					/>
					<SounderLeague />
				</SafeAreaView>
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	bg: { flex: 1, backgroundColor: WHIMSY.cream },
});

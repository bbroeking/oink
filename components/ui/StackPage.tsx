// The shell every stack screen wears under its PageHeader crown — taste rule 5,
// "every screen wears the same crown": the cream paper ground bled to the
// device edges, and one SafeAreaView the crown and content sit in. Eight stack
// screens hand-rolled this pair with small drifts (a bg painted on the safe
// view, a bare `{ flex: 1 }`); this is the one shape.
//
// No `<Stack.Screen options={{ headerShown: false }} />` here: the root
// navigator in app/_layout.tsx already hides every header, so the per-screen
// copy each of the eight carried was a no-op — and importing expo-router from
// a ui primitive would drag its ESM deps into every test that touches the
// barrel.
//
// Siblings that must sit OUTSIDE the safe area (a UserSheet, a modal) go after
// the StackPage in the screen's fragment, exactly as they did after the old
// `</View>`.
import type { ReactNode } from "react";
import { SafeAreaView, StyleSheet, View } from "react-native";
import { WHIMSY } from "@/constants/theme";

export function StackPage({
	children,
	testID,
}: {
	children: ReactNode;
	testID?: string;
}) {
	return (
		<View style={styles.bg} testID={testID}>
			<SafeAreaView style={styles.safe}>{children}</SafeAreaView>
		</View>
	);
}

const styles = StyleSheet.create({
	bg: { flex: 1, backgroundColor: WHIMSY.cream },
	safe: { flex: 1 },
});

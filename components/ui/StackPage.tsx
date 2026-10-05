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
//
// The safe view is react-native-safe-area-context's, not React Native's:
// RN 0.86 deprecates its own `SafeAreaView` (a console warning on every screen
// that imported it). The context one pads the same four edges by default, so
// the layout is unchanged. (2026-10-04)
//
// A SCROLLING stack screen should not pad the bottom edge: a stack screen has
// no tab bar, so the page's bottom inset clipped the list 34pt above the screen
// edge, and the list's own `TAB_SAFE` then added ~74pt of dead paper after the
// last row (~108pt in all on the Barn collection). It passes
// `edges={STACK_SCROLL_EDGES}` and gives its scroller one bottom value,
// `useStackScrollPad()` — a loose step plus the home indicator, travelling
// with the last row. The default stays all four edges, because a stack screen
// with a control pinned at its foot (the match screen's tray) needs the page
// to keep it off the home indicator. (2026-10-04, Barn ask 3 / Shop ask c)
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import {
	SafeAreaView,
	useSafeAreaInsets,
	type Edge,
} from "react-native-safe-area-context";
import { SPACE, WHIMSY } from "@/constants/theme";

/** The safe edges a scrolling stack screen pads: the bottom belongs to its scroller. */
export const STACK_SCROLL_EDGES: readonly Edge[] = ["top", "left", "right"];

/**
 * The one bottom padding a stack screen's scroller ends on: a loose step
 * (SPACE.xl) plus the home indicator, so the last row clears it and nothing
 * else. Pair with `edges={STACK_SCROLL_EDGES}`; never `TAB_SAFE` on a stack
 * screen (it has no tab bar to clear).
 */
export function useStackScrollPad(): number {
	return SPACE.xl + useSafeAreaInsets().bottom;
}

export function StackPage({
	children,
	testID,
	edges,
}: {
	children: ReactNode;
	testID?: string;
	/** Which safe edges the page pads. Default: all four (as before). */
	edges?: readonly Edge[];
}) {
	return (
		<View style={styles.bg} testID={testID}>
			<SafeAreaView style={styles.safe} edges={edges}>
				{children}
			</SafeAreaView>
		</View>
	);
}

const styles = StyleSheet.create({
	bg: { flex: 1, backgroundColor: WHIMSY.cream },
	safe: { flex: 1 },
});

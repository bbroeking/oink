// The Pen — a room of its own (the shop-IA pass, 2026-09-17), and since
// 2026-09-18 the errand board: send a pig to look for a Find, see what it
// brought back. The doorway's three signs each LEAVE the page, so the Pen is
// a pushed route like Furnish, reached from its sign, from the Slop Club
// shelf, from Account, from the paywall handoff, from a friend's row
// (`?send=<friendId>` opens the ticket with their wish preset) and from the
// "{Pig}'s back" push. Old `?view=pen` links still land here (utils/shopNav).
import { useCallback, useState } from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { PageHeader } from "@/components/ui/PageHeader";
import { PigPenView } from "@/components/PigPenView";
import { usePigRoster } from "@/hooks/usePigRoster";
import { usePigErrands } from "@/hooks/usePigErrands";
import { useFriendWishTargets } from "@/hooks/useFriendWishTargets";
import { useJoinSlopClub } from "@/hooks/useJoinSlopClub";
import { WHIMSY } from "@/constants/theme";

export default function PenScreen() {
	const pigRoster = usePigRoster();
	const errands = usePigErrands();
	const wishes = useFriendWishTargets();
	const params = useLocalSearchParams<{ send?: string }>();
	// The door's preset is consumed once: after the ticket opens, a later
	// re-focus must not reopen it.
	const [sendFor, setSendFor] = useState<string | null>(typeof params.send === "string" ? params.send : null);
	const consumeSendFor = useCallback(() => setSendFor(null), []);
	// The Pen shows the roster and the errand board; the roster read is the
	// whole of what a fresh membership has to make true again (the errand
	// state re-reads on focus, and the card derives "resting" from the roster).
	const joinSlopClub = useJoinSlopClub(pigRoster.refresh);

	return (
		<SafeAreaView style={styles.page}>
			<PageHeader
				kicker="rosie’s place"
				title="The Pen"
				backLabel="back to the shop"
				onBack={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/shop"))}
			/>
			<PigPenView
				roster={pigRoster.roster}
				loading={pigRoster.loading}
				error={pigRoster.error}
				onRetry={() => {
					void pigRoster.refresh();
					void errands.refresh();
				}}
				busyPigId={pigRoster.busyPigId}
				onJoinSlopClub={joinSlopClub}
				onRecruit={pigRoster.recruit}
				onActivate={pigRoster.activate}
				errands={errands}
				targets={wishes.targets}
				targetsLoading={wishes.loading}
				targetsLoaded={wishes.loaded}
				loadTargets={wishes.load}
				sendFor={sendFor}
				onSendForConsumed={consumeSendFor}
			/>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	page: { flex: 1, backgroundColor: WHIMSY.cream },
});

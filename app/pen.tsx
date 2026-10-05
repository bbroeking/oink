// The Pen — a room of its own (the shop-IA pass, 2026-09-17), and since
// 2026-09-18 the errand board: send a pig to look for a Find, see what it
// brought back. The doorway's three signs each LEAVE the page, so the Pen is
// a pushed route like Furnish, reached from its sign, from the Slop Club
// shelf, from Account, from the paywall handoff, from a friend's row
// (`?send=<friendId>` opens the ticket with their wish preset) and from the
// "{Pig}'s back" push. Old `?view=pen` links still land here (utils/shopNav).
import { useCallback, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
	PageHeader,
	ScrollEdge,
	STACK_SCROLL_EDGES,
	StackPage,
	useScrollEdge,
} from "@/components/ui";
import { PigPenView } from "@/components/PigPenView";
import { usePigRoster } from "@/hooks/usePigRoster";
import { usePigErrands } from "@/hooks/usePigErrands";
import { useFriendWishTargets } from "@/hooks/useFriendWishTargets";
import { useJoinSlopClub } from "@/hooks/useJoinSlopClub";
import { CHROME_TYPE_CAP } from "@/constants/theme";

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
	// The crown's scroll edge, as on the Shop: drawn once the board has slid
	// under the crown, so the paddock is not cut by an invisible line.
	const edge = useScrollEdge();

	// A scrolling stack screen: the page pads the top and sides, and the board
	// runs to the screen's foot, clearing the home indicator by its own pad
	// (PigPenView, useStackScrollPad) instead of clipping at a line above it.
	return (
		<StackPage edges={STACK_SCROLL_EDGES}>
			<PageHeader
				kicker="rosie’s place"
				title="The Pen"
				backLabel="back to the shop"
				onBack={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/shop"))}
				maxFontSizeMultiplier={CHROME_TYPE_CAP}
			/>
			<ScrollEdge visible={edge.edgeVisible} />
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
				onScroll={edge.onScroll}
			/>
		</StackPage>
	);
}

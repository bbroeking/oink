// The Friends hub consolidates the player's social surfaces behind a
// segmented control:
//   Friends  — your friends list + add — DEFAULT
//   Inbox    — the activity feed
//   Rankings — the all-time tickle leaderboard
//   Sounder  — your crew, when the season feature is live
// Defaults to Friends so the tab label predicts the first thing players see.
// See docs/season-1-social-redesign.md.
//
// Wave-3 conformance pass (2026-09-11): the four hand-rolled nav sticker cards
// are `SegmentedControl layout="icon-over-label"` [B-06] and the hand-rolled
// kicker/title/rule crown is `PageHeader variant="tab"` [B-26]. The nav stays
// ABOVE the crown, which is why the header's own top padding moves onto the nav
// wrapper rather than the header.
import { useState, useCallback, useEffect, useMemo } from "react";
import { View, StyleSheet, Platform } from "react-native";
// RN 0.86 deprecates its own SafeAreaView; the context one pads the same four
// edges by default (the Shop and StackPage made the same swap).
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router/react-navigation";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "../../utils/supabase";
import { rpc } from "@/utils/rpc";
import type { TradeRow } from "@/constants/trade_types";
import type { IconName } from "@/components/ui";
import {
	PageHeader,
	SegmentedControl,
	T,
	type SegmentOption,
} from "@/components/ui";
import Friends from "../../components/Friends";
import { Inbox } from "../../components/Inbox";
import {
	Leaderboard,
	type BoardScope,
	type BoardView,
} from "../../components/Leaderboard";
import { SounderCard } from "../../components/SounderCard";
import { PlayDoor } from "@/components/play/PlayDoor";
import { usePlayEnabled } from "@/hooks/useMultiplayer";
import { useSeason1Active } from "@/hooks/useSeason1Active";
import { useCrew } from "@/hooks/useCrew";
import {
	BORDER,
	CHROME_TYPE_CAP,
	PAGE_PAD,
	RADII,
	SPACE,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";

type Segment = "friends" | "inbox" | "board" | "sounder";

interface SegmentDef {
	key: Segment;
	label: string;
	icon: IconName;
	hint: string;
}

const BASE_SEGMENTS: SegmentDef[] = [
	{
		key: "friends",
		label: "Friends",
		icon: "friends",
		hint: "Shows your pig pals and the add-a-friend search",
	},
	{
		key: "inbox",
		label: "Inbox",
		icon: "bell",
		hint: "Shows requests, trades and what happened lately",
	},
	{
		key: "board",
		label: "Rankings",
		icon: "ranks",
		hint: "Shows who leads the bog, all-time",
	},
];

const SOUNDER_SEGMENT: SegmentDef = {
	key: "sounder",
	label: "Sounder",
	icon: "crown",
	hint: "Shows your herd and the crews you could join",
};

// Per-segment page header — kicker over the whimsy title, both swapping with the
// active nav card. Sounder's title flips to "Find your Sounder" while crewless
// (handled at the call site so it can read crew state).
const SEGMENT_HEADERS: Record<Segment, { kicker: string; title: string }> = {
	board: { kicker: "all-time tickles", title: "Rankings" },
	inbox: { kicker: "word from the bog", title: "Inbox" },
	friends: { kicker: "your pig pals", title: "Friends" },
	sounder: { kicker: "your herd", title: "Your Sounder" },
};

// The Rankings crown names what the board is ranking. "all-time tickles" over a
// bond board (or a curse board) was a kicker that lied; every one of these is
// lifetime, per its own ledger (tickles_earned, pair_bonds.bond,
// pair_bonds.curses). The alignment board is Season 0's two sides. (2026-10-04)
const BOARD_KICKERS: Record<BoardView, string> = {
	global: "all-time tickles",
	friends: "all-time tickles",
	pairs: "all-time bonds",
	enemies: "all-time curses",
	alignment: "generous · greedy",
};

const SEGMENT_KEYS: Segment[] = ["board", "inbox", "friends", "sounder"];

// The unread count marker on the Inbox segment. Its diameter is drawing
// geometry (a dot that has to stay round around one or two glyphs), not a
// spacing step — named here the way `Chip`'s ribbon geometry is named in the
// primitive. Matches the tab bar's badge.
const BADGE_SIZE = 18;
const BADGE_MAX = 9;

function CountBadge({ count }: { count: number }) {
	return (
		<View style={styles.badge}>
			<T role="kickerPillSm" tone="onDark">
				{count > BADGE_MAX ? `${BADGE_MAX}+` : count}
			</T>
		</View>
	);
}

export default function FriendsHubScreen() {
	// Sounder (co-op crews) — the same Season-1 switch the Season tab uses, so
	// the crew is visible in both places whenever the season is live.
	const coopDig = useSeason1Active();
	// Matchmade play's one door (SKILL.md 2026-10-04): first in the friends
	// list, behind the `multiplayer` flag. Passing nothing when the flag is off
	// keeps the list pixel-identical for everyone else.
	const playOn = usePlayEnabled();
	// Crew state is owned here (not inside SounderCard) so the page title and
	// the card share ONE fetch: the header reads "Find your Sounder" while
	// crewless and "Your Sounder" once you ride with a crew. Enabled only when
	// the flag is on, so non-flag users never pay for the fetch/realtime.
	const crewHook = useCrew(coopDig);
	const segments = useMemo(
		() => (coopDig ? [...BASE_SEGMENTS, SOUNDER_SEGMENT] : BASE_SEGMENTS),
		[coopDig]
	);
	// Deep-link target — any segment can be routed to (e.g. the launch nudge
	// sends "?seg=sounder", the SounderCard sends "?seg=board"). Sounder is
	// flag-gated, so a "?seg=sounder" with the flag off falls back to Friends.
	const { seg } = useLocalSearchParams<{ seg?: string }>();
	// find() over the typed key list narrows to Segment without an assertion.
	const wantSeg = SEGMENT_KEYS.find((k) => k === seg) ?? null;
	const targetSeg = wantSeg && !(wantSeg === "sounder" && !coopDig) ? wantSeg : null;
	const [segment, setSegment] = useState<Segment>(targetSeg ?? "friends");
	// Which scope the Board opens on. Stays undefined (Global default) until a
	// jump asks for a specific one — the Sounder card's standings note opens
	// the Sounders scope directly.
	// (Nothing sets it today: the Sounder card's board jump is a segment switch.
	// The slot stays so a deep link can open a scope without a new prop.)
	const [boardScope] = useState<BoardScope | undefined>(undefined);
	// What the board is showing, reported up by the Leaderboard for the crown.
	const [boardView, setBoardView] = useState<BoardView>("global");
	// Season 2 ranks the season's tickles, not the lifetime number (the
	// server's board_sort_column, reported up by the Leaderboard).
	const [boardSeasonal, setBoardSeasonal] = useState(false);
	// The board remounts on its opening view each time it is shown, so the
	// crown's kicker starts there too, rather than flashing the last view's.
	const showSegment = useCallback(
		(next: Segment) => {
			if (next === "board") setBoardView(boardScope ?? "global");
			setSegment(next);
		},
		[boardScope]
	);
	// Re-honor the param if the tab was already mounted when we navigated to it.
	useEffect(() => {
		if (targetSeg) setSegment(targetSeg);
	}, [seg, targetSeg]);
	const [userId, setUserId] = useState<string | null>(null);
	const [inboxCount, setInboxCount] = useState(0);

	// Lightweight badge count — incoming friend requests + incoming
	// pending trades. Fetched on focus so the badge is fresh even
	// before the Inbox segment is opened; the Inbox itself reports
	// updates via onActionableCount while it's on screen.
	const refreshCount = useCallback(async (uid: string) => {
		const { count: frCount } = await supabase
			.from("friendships")
			.select("requester_id", { count: "exact", head: true })
			.eq("receiver_id", uid)
			.eq("status", "pending");
		const trades = await rpc<TradeRow[]>("my_tickle_trades");
		const trCount = (trades ?? []).filter(
			(t) => t.status === "pending" && t.target_id === uid
		).length;
		setInboxCount((frCount ?? 0) + trCount);
	}, []);

	useFocusEffect(
		useCallback(() => {
			supabase.auth.getUser().then(({ data }) => {
				const uid = data.user?.id ?? null;
				setUserId(uid);
				if (uid) refreshCount(uid);
			});
		}, [refreshCount])
	);

	const header = SEGMENT_HEADERS[segment];
	// Only the Sounder title tracks crew state (crewless → "Find your Sounder").
	const title =
		segment === "sounder" && !crewHook.crew.crew
			? "Find your Sounder"
			: header.title;
	// Only the Rankings kicker tracks the board (tickles · bonds · curses).
	const kicker =
		segment === "board"
			? boardSeasonal && (boardView === "global" || boardView === "friends")
				? "this season's tickles"
				: BOARD_KICKERS[boardView]
			: header.kicker;

	// Top-level nav — one radio per social surface, icon over label. The Inbox
	// carries its unread count in the segment's own badge slot, and says the
	// number out loud rather than leaving it to the dot.
	const options: SegmentOption<Segment>[] = segments.map((s) => {
		const badge = s.key === "inbox" && inboxCount > 0;
		return {
			value: s.key,
			label: s.label,
			icon: s.icon,
			badge: badge ? <CountBadge count={inboxCount} /> : undefined,
			accessibilityLabel: badge
				? `${s.label}, ${inboxCount} needing you`
				: s.label,
			accessibilityHint: s.hint,
		};
	});

	return (
		<View style={styles.container}>
			<SafeAreaView style={styles.safeArea}>
				<View style={styles.nav}>
					<SegmentedControl
						label="Friends hub sections"
						layout="icon-over-label"
						options={options}
						value={segment}
						onChange={showSegment}
						// The hub's nav is fixed chrome above every panel: past its
						// ceiling it would grow into the list it sits over (at
						// accessibility sizes only ~2.5 friends were left on screen).
						maxFontSizeMultiplier={CHROME_TYPE_CAP}
					/>
				</View>

				{/* Per-segment crown — kicker + title + rule track the nav. It is
				    pinned chrome over every panel, so it states its type ceiling
				    like the nav above it. The scroll edge under it belongs to the
				    panel that scrolls there (the Inbox, the Sounder) and lives in
				    that panel, so a segment switch starts it at rest; Friends and
				    Rankings draw theirs under their own sticky controls. */}
				<PageHeader
					variant="tab"
					kicker={kicker}
					title={title}
					maxFontSizeMultiplier={CHROME_TYPE_CAP}
					style={styles.crown}
				/>

				<View style={styles.body}>
					{/* The Friends panel carries no Sounder strip — the herd is the
					    `Sounder` segment in the nav above, so the panel needs
					    nothing from the crew hook. (2026-09-14) */}
					{segment === "friends" && (userId ? <Friends userId={userId} top={playOn ? <PlayDoor /> : undefined} /> : null)}
					{segment === "inbox" &&
						(userId ? (
							<Inbox userId={userId} onActionableCount={setInboxCount} />
						) : null)}
					{/* Board = the three-scope leaderboard (Global · Friends ·
					    Sounders); the Sounders scope renders the league table.
					    Remount on boardScope so a Sounder-card jump lands on
					    the league even if the board was already mounted. */}
					{segment === "board" && (
						<Leaderboard
							key={boardScope ?? "default"}
							initialScope={boardScope}
							onViewChange={setBoardView}
							onSeasonalChange={setBoardSeasonal}
						/>
					)}
					{segment === "sounder" && coopDig && (
						<SounderCard
							crewHook={crewHook}
							onShowBoard={() => showSegment("board")}
						/>
					)}
				</View>
			</SafeAreaView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: WHIMSY.cream },
	safeArea: { flex: 1 },
	// The nav sits above the crown, so it carries the tab screen's top inset and
	// PageHeader's own `tab` top padding is zeroed below.
	// TODO(ui-audit): SafeAreaView inset + SPACE.sm (deferred — device QA)
	nav: {
		paddingHorizontal: PAGE_PAD,
		paddingTop: Platform.OS === "ios" ? SPACE.sm : SPACE.xl,
		marginBottom: SPACE.md,
	},
	crown: { paddingTop: 0 },
	// Inbox count — pinned to the Inbox segment's top-right corner.
	badge: {
		minWidth: BADGE_SIZE,
		height: BADGE_SIZE,
		borderRadius: RADII.pill,
		backgroundColor: UI_COLORS.action,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: SPACE.xs,
	},
	// The page header carries its own bottom breath; no second one here.
	body: { flex: 1 },
});

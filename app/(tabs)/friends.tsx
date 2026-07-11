// The Friends hub — "Your Sounder" in the redesign. One tab
// consolidates three social surfaces behind a segmented control:
//   Board   — the leaderboard (Leaderboard.tsx) — DEFAULT
//   Inbox   — the activity feed (Inbox.tsx)
//   Friends — your friends list + add (Friends.tsx)
// Defaults to Board so the first impression on opening the hub is
// the sounder ranked, not your own friend list.
// See docs/season-1-social-redesign.md.
import { useState, useCallback, useEffect, useMemo } from "react";
import {
	View,
	StyleSheet,
	Platform,
	SafeAreaView,
	Pressable,
	Text,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "../../utils/supabase";
import { rpc } from "@/utils/rpc";
import { Icon, IconName } from "../../components/ui/Icon";
import Friends from "../../components/Friends";
import { Inbox } from "../../components/Inbox";
import { Leaderboard, type BoardScope } from "../../components/Leaderboard";
import { SounderCard } from "../../components/SounderCard";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";
import { useCrew } from "@/hooks/useCrew";
import {
	FONTS,
	KICKER_PILL,
	PAGE_PAD,
	RADII,
	SHADOW_SM,
	SPACE,
	TITLE_RULE,
	TYPE,
	WHIMSY,
} from "@/constants/theme";

type Segment = "friends" | "inbox" | "board" | "sounder";

const BASE_SEGMENTS: { key: Segment; label: string; icon: IconName }[] = [
	{ key: "board", label: "Board", icon: "ranks" },
	{ key: "inbox", label: "Inbox", icon: "bell" },
	{ key: "friends", label: "Friends", icon: "friends" },
];

// Per-segment page header — kicker over the whimsy title, both swapping with the
// active nav card. Sounder's title flips to "Find your Sounder" while crewless
// (handled at the call site so it can read crew state).
const SEGMENT_HEADERS: Record<Segment, { kicker: string; title: string }> = {
	board: { kicker: "who's on top", title: "The Board" },
	inbox: { kicker: "word from the bog", title: "Inbox" },
	friends: { kicker: "your drove", title: "Friends" },
	sounder: { kicker: "friends", title: "Your Sounder" },
};

const SEGMENT_KEYS: Segment[] = ["board", "inbox", "friends", "sounder"];

export default function FriendsHubScreen() {
	// Sounder (co-op crews) — gate on the SAME condition as the Season tab
	// (`world_boss || __DEV__`), not the standalone `coop_dig` flag. coop_dig
	// stayed false and hid the Sounder from Friends even while Season showed it
	// (and would keep hiding it after the world_boss flip). Aligning the two
	// keeps the crew visible in both places whenever the season is live.
	const worldBoss = useFeatureFlag("world_boss");
	const coopDig = worldBoss || __DEV__;
	// Crew state is owned here (not inside SounderCard) so the page title and
	// the card share ONE fetch: the header reads "Find your Sounder" while
	// crewless and "Your Sounder" once you ride with a crew. Enabled only when
	// the flag is on, so non-flag users never pay for the fetch/realtime.
	const crewHook = useCrew(coopDig);
	const segments = useMemo(
		() =>
			coopDig
				? [
						...BASE_SEGMENTS,
						{ key: "sounder" as Segment, label: "Sounder", icon: "crown" as IconName },
					]
				: BASE_SEGMENTS,
		[coopDig]
	);
	// Deep-link target — any segment can be routed to (e.g. the launch nudge
	// sends "?seg=sounder", the SounderCard sends "?seg=board"). Sounder is
	// flag-gated, so a "?seg=sounder" with the flag off falls back to Board.
	const { seg } = useLocalSearchParams<{ seg?: string }>();
	const wantSeg =
		typeof seg === "string" && (SEGMENT_KEYS as string[]).includes(seg)
			? (seg as Segment)
			: null;
	const targetSeg = wantSeg && !(wantSeg === "sounder" && !coopDig) ? wantSeg : null;
	const [segment, setSegment] = useState<Segment>(targetSeg ?? "board");
	// Which scope the Board opens on. Stays undefined (Global default) until a
	// jump asks for a specific one — the Sounder card's standings note opens
	// the Sounders scope directly.
	const [boardScope, setBoardScope] = useState<BoardScope | undefined>(undefined);
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
		const trades = await rpc<{ status: string; target_id: string }[]>(
			"my_tickle_trades"
		);
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

	return (
		<View style={styles.container}>
			<SafeAreaView style={styles.safeArea}>
				<View style={styles.header}>
					{/* Top-level nav — a row of sticker cards, one per segment, icon
					    over label. The active card lights sun; pressing any card
					    presses it into the page (translate + shadow gone). */}
					<View style={styles.nav}>
						{segments.map((s) => {
							const active = s.key === segment;
							const badge = s.key === "inbox" && inboxCount > 0;
							return (
								<Pressable
									key={s.key}
									onPress={() => setSegment(s.key)}
									accessibilityRole="button"
									accessibilityLabel={s.label}
									accessibilityState={{ selected: active }}
									style={({ pressed }) => [
										styles.navCard,
										active && styles.navCardActive,
										pressed && styles.navCardPressed,
									]}
								>
									<Icon name={s.icon} size={22} color={WHIMSY.ink} strokeWidth={2} />
									<Text style={styles.navLabel}>{s.label}</Text>
									{badge && (
										<View style={styles.navBadge}>
											<Text style={styles.badgeText}>
												{inboxCount > 9 ? "9+" : inboxCount}
											</Text>
										</View>
									)}
								</Pressable>
							);
						})}
					</View>

					{/* Per-segment crown — kicker + title + rule track the nav. */}
					<Text style={styles.kicker}>★ {header.kicker}</Text>
					<Text style={styles.title}>{title}</Text>
					<View style={styles.titleRule} />
				</View>

				<View style={styles.body}>
					{segment === "friends" &&
						(userId ? (
							<Friends
								userId={userId}
								crewHook={coopDig ? crewHook : undefined}
								onViewSounder={() => setSegment("sounder")}
							/>
						) : null)}
					{segment === "inbox" &&
						(userId ? (
							<Inbox userId={userId} onActionableCount={setInboxCount} />
						) : null)}
					{/* Board = the three-scope leaderboard (Global · Friends ·
					    Sounders); the Sounders scope renders the league table.
					    Remount on boardScope so a Sounder-card jump lands on
					    the league even if the board was already mounted. */}
					{segment === "board" && (
						<Leaderboard key={boardScope ?? "default"} initialScope={boardScope} />
					)}
					{segment === "sounder" && coopDig && (
						<SounderCard
							crewHook={crewHook}
							onShowBoard={() => setSegment("board")}
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
	header: {
		paddingHorizontal: PAGE_PAD,
		// TODO(ui-audit): SafeAreaView inset + 8 (deferred — device QA)
		paddingTop: Platform.OS === "ios" ? 8 : 20,
	},
	kicker: { ...KICKER_PILL, marginBottom: 2 },
	title: { ...TYPE.display, color: WHIMSY.ink },
	titleRule: { ...TITLE_RULE, width: 64, marginTop: 4 },
	// Top-level nav — flex-1 sticker cards, icon over a Fredoka label. The card
	// order stays Board · Inbox · Friends · Sounder.
	nav: { flexDirection: "row", gap: SPACE.sm, marginBottom: SPACE.lg },
	navCard: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.xs + 1,
		backgroundColor: WHIMSY.paper,
		borderWidth: 2.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.lg,
		paddingTop: SPACE.md,
		paddingHorizontal: SPACE.xs,
		paddingBottom: SPACE.sm,
		...SHADOW_SM,
	},
	navCardActive: { backgroundColor: WHIMSY.sun },
	// Pressed = pushed into the page: nudge down-right by the shadow offset and
	// drop the shadow, so the card looks stamped down.
	navCardPressed: {
		transform: [{ translateX: 2 }, { translateY: 2 }],
		shadowOpacity: 0,
		elevation: 0,
	},
	navLabel: { ...TYPE.bodySm, fontFamily: FONTS.display, color: WHIMSY.ink },
	// Inbox count — pinned to the Inbox card's top-right corner.
	navBadge: {
		position: "absolute",
		top: -6,
		right: -6,
		minWidth: 18,
		height: 18,
		borderRadius: 9,
		backgroundColor: WHIMSY.accent,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 4,
	},
	badgeText: {
		fontFamily: FONTS.whimsy,
		fontSize: 10,
		color: WHIMSY.paper,
	},
	body: { flex: 1, marginTop: SPACE.md },
});

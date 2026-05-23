// The Friends hub — the social tab. One tab consolidates the three
// social surfaces behind a segmented control:
//   Friends — your friends list + add (Friends.tsx)
//   Inbox   — the activity feed (Inbox.tsx)
//   Board   — the leaderboard (Leaderboard.tsx)
// The Inbox segment carries an unread-actionable count badge.
// See docs/season-1-social-redesign.md.
import { useState, useCallback } from "react";
import {
	View,
	StyleSheet,
	Platform,
	SafeAreaView,
	Pressable,
	Text,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../utils/supabase";
import { Sticker } from "../../components/ui/Sticker";
import { Icon, IconName } from "../../components/ui/Icon";
import Friends from "../../components/Friends";
import { Inbox } from "../../components/Inbox";
import { Leaderboard } from "../../components/Leaderboard";
import { FONTS, TITLE_RULE, WHIMSY } from "@/constants/theme";

type Segment = "friends" | "inbox" | "board";

const SEGMENTS: { key: Segment; label: string; icon: IconName }[] = [
	{ key: "friends", label: "Friends", icon: "friends" },
	{ key: "inbox", label: "Inbox", icon: "bell" },
	{ key: "board", label: "Board", icon: "ranks" },
];

export default function FriendsHubScreen() {
	const [segment, setSegment] = useState<Segment>("friends");
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
		const { data: trades } = await supabase.rpc("my_tickle_trades");
		const trCount = (
			(trades as { status: string; target_id: string }[] | null) ?? []
		).filter((t) => t.status === "pending" && t.target_id === uid).length;
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

	return (
		<View style={styles.container}>
			<SafeAreaView style={styles.safeArea}>
				<View style={styles.header}>
					<Text style={styles.title}>Friends</Text>
					<View style={styles.titleRule} />
					<View style={styles.segWrap}>
						<Sticker color="paper" rotate={0} radius={22} style={styles.seg}>
							{SEGMENTS.map((s) => {
								const active = s.key === segment;
								const badge = s.key === "inbox" && inboxCount > 0;
								return (
									<Pressable
										key={s.key}
										onPress={() => setSegment(s.key)}
										style={[styles.segBtn, active && styles.segBtnActive]}
									>
										<Icon
											name={s.icon}
											size={14}
											filled={active}
											color={WHIMSY.ink}
											strokeWidth={1.8}
										/>
										<Text
											style={[styles.segText, active && styles.segTextActive]}
										>
											{s.label}
										</Text>
										{badge && (
											<View style={styles.badge}>
												<Text style={styles.badgeText}>
													{inboxCount > 9 ? "9+" : inboxCount}
												</Text>
											</View>
										)}
									</Pressable>
								);
							})}
						</Sticker>
					</View>
				</View>

				<View style={styles.body}>
					{segment === "friends" &&
						(userId ? <Friends userId={userId} /> : null)}
					{segment === "inbox" &&
						(userId ? (
							<Inbox userId={userId} onActionableCount={setInboxCount} />
						) : null)}
					{segment === "board" && <Leaderboard />}
				</View>
			</SafeAreaView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: WHIMSY.cream },
	safeArea: { flex: 1 },
	header: {
		paddingHorizontal: 18,
		paddingTop: Platform.OS === "ios" ? 8 : 20,
	},
	title: { fontSize: 32, fontFamily: FONTS.whimsy, color: WHIMSY.ink },
	titleRule: { ...TITLE_RULE, width: 110, marginTop: 4 },
	segWrap: { marginTop: 14 },
	seg: { flexDirection: "row", padding: 4, gap: 4 },
	segBtn: {
		flex: 1,
		paddingVertical: 8,
		borderRadius: 18,
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: 6,
	},
	segBtnActive: {
		backgroundColor: WHIMSY.sun,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	segText: { fontFamily: FONTS.hand, fontSize: 14, color: WHIMSY.mute },
	segTextActive: { fontFamily: FONTS.whimsy, color: WHIMSY.ink },
	badge: {
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
	body: { flex: 1, marginTop: 10 },
});

// Friend invite picker — tapping a "+" slot on the Sounder roster slides
// this BOTTOM SHEET up: the caller's whole friends list, each row either
// invitable (free agent) or labeled with the Sounder they already ride
// with (friends_crews). Invites go through useCrew.invite — any crew
// member can rally friends (the server enforces are_friends + the cap).

import { useEffect, useState } from "react";
import {
	Modal,
	View,
	Text,
	Pressable,
	ScrollView,
	StyleSheet,
	ActivityIndicator,
} from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "@/utils/supabase";
import { PigAvatar } from "./ui/PigAvatar";
import type { UseCrew } from "@/hooks/useCrew";
import { fetchFriendsCrews, type FriendCrew } from "@/utils/mudWars";
import { getFriendIds, FRIEND_CAP_LIMIT, type Profile } from "@/utils/friendships";
import {
	FONTS,
	KICKER_TEXT,
	MODAL_BACKDROP_BG,
	RADII,
	SPACE,
	TYPE,
	WHIMSY,
} from "@/constants/theme";

function inviteError(reason?: string): string {
	switch (reason) {
		case "invitee_in_crew":
			return "They just joined a Sounder.";
		case "crew_full":
			return "Your Sounder is full.";
		case "already_invited":
			return "They already have a pending invite.";
		case "no_crew":
			return "You're not in a Sounder.";
		default:
			return "Couldn't send that invite.";
	}
}

export function FriendInvitePicker({
	visible,
	onDismiss,
	crewHook,
}: {
	visible: boolean;
	onDismiss: () => void;
	crewHook: UseCrew;
}) {
	const [friends, setFriends] = useState<Profile[] | null>(null);
	const [crewsByFriend, setCrewsByFriend] = useState<Map<string, FriendCrew>>(new Map());
	const [note, setNote] = useState<string | null>(null);
	const [busyId, setBusyId] = useState<string | null>(null);

	useEffect(() => {
		if (!visible) return;
		let cancelled = false;
		(async () => {
			const ids = ((await getFriendIds()) ?? []).slice(0, FRIEND_CAP_LIMIT);
			const [profiles, friendCrews] = await Promise.all([
				ids.length
					? supabase
							.from("profiles")
							.select("id, username, discriminator, active_hat_id")
							.in("id", ids)
							.then(({ data }) => (data as Profile[]) ?? [])
					: Promise.resolve([] as Profile[]),
				fetchFriendsCrews(),
			]);
			if (cancelled) return;
			setFriends(
				[...profiles].sort((a, b) => (a.username ?? "").localeCompare(b.username ?? ""))
			);
			setCrewsByFriend(new Map(friendCrews.map((fc) => [fc.friend_id, fc])));
		})();
		return () => {
			cancelled = true;
		};
	}, [visible]);

	const myCrewId = crewHook.crew.crew?.id ?? null;
	const waitingIds = new Set(crewHook.crew.invitesOut.map((i) => i.invitee_id));
	const slotsLeft = 5 - crewHook.crew.members.length;

	const invite = async (friendId: string) => {
		if (busyId) return;
		setBusyId(friendId);
		setNote(null);
		const r = await crewHook.invite(friendId);
		setBusyId(null);
		if (r.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
		} else {
			setNote(inviteError(r.reason));
		}
	};

	return (
		<Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
			<View style={styles.backdrop}>
				{/* Tap above the sheet to dismiss. */}
				<Pressable style={styles.backdropTap} onPress={onDismiss} />
				<View style={styles.sheet}>
					<View style={styles.grabber} />
					<Text style={styles.kicker}>★ rally a friend ★</Text>
					<Text style={styles.headline}>
						{slotsLeft === 1 ? "One spot left" : `${slotsLeft} spots at the trough`}
					</Text>

					{friends === null ? (
						<View style={styles.center}>
							<ActivityIndicator color={WHIMSY.accent} />
						</View>
					) : friends.length === 0 ? (
						<Text style={styles.emptyText}>
							No friends yet — add some pigs on the Friends tab first.
						</Text>
					) : (
						<ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
							{friends.map((f) => {
								const fc = crewsByFriend.get(f.id);
								const waiting = waitingIds.has(f.id);
								return (
									<View key={f.id} style={styles.row}>
										<PigAvatar size={34} hatId={f.active_hat_id ?? null} />
										<View style={styles.who}>
											<Text style={styles.name} numberOfLines={1}>
												{f.username ?? "—"}
												{f.discriminator ? (
													<Text style={styles.disc}>#{f.discriminator}</Text>
												) : null}
											</Text>
											{fc && (
												<Text style={styles.inCrew} numberOfLines={1}>
													{fc.crew_id === myCrewId
														? "rides with you"
														: `in ${fc.crew_name}`}
												</Text>
											)}
										</View>
										{fc ? null : waiting ? (
											<Text style={styles.waiting}>waiting…</Text>
										) : (
											<Pressable
												onPress={() => invite(f.id)}
												disabled={busyId !== null}
												style={[styles.inviteBtn, busyId === f.id && { opacity: 0.6 }]}
												hitSlop={6}
											>
												<Text style={styles.inviteBtnText}>
													{busyId === f.id ? "Inviting…" : "Invite"}
												</Text>
											</Pressable>
										)}
									</View>
								);
							})}
						</ScrollView>
					)}

					{!!note && <Text style={styles.note}>{note}</Text>}

					<Pressable onPress={onDismiss} style={styles.doneBtn} hitSlop={6}>
						<Text style={styles.doneText}>Done</Text>
					</Pressable>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		justifyContent: "flex-end",
		backgroundColor: MODAL_BACKDROP_BG,
	},
	backdropTap: { flex: 1 },
	// Bottom sheet — paper sticker anchored to the bottom edge: ink border
	// on the three visible sides, top corners rounded, grabber on top.
	sheet: {
		backgroundColor: WHIMSY.paper,
		borderTopLeftRadius: RADII.xxl,
		borderTopRightRadius: RADII.xxl,
		borderWidth: 3,
		borderBottomWidth: 0,
		borderColor: WHIMSY.ink,
		paddingHorizontal: SPACE.lg,
		paddingTop: SPACE.sm,
		paddingBottom: SPACE.xl,
	},
	grabber: {
		alignSelf: "center",
		width: 44,
		height: 5,
		borderRadius: 3,
		backgroundColor: WHIMSY.muteSoft,
		marginBottom: SPACE.sm,
	},
	kicker: { ...KICKER_TEXT, textAlign: "center", marginBottom: 4 },
	headline: {
		fontFamily: FONTS.whimsy,
		fontSize: 22,
		color: WHIMSY.ink,
		textAlign: "center",
		marginBottom: SPACE.md,
	},
	center: { paddingVertical: SPACE.xl, alignItems: "center" },
	emptyText: {
		...TYPE.hand,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		textAlign: "center",
		paddingVertical: SPACE.lg,
	},
	list: { maxHeight: 340 },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		paddingVertical: 8,
		borderBottomWidth: 1.5,
		borderBottomColor: WHIMSY.cream2,
	},
	who: { flex: 1, minWidth: 0 },
	name: { ...TYPE.bodySm, fontFamily: FONTS.bodyExtra, color: WHIMSY.ink },
	disc: { fontFamily: FONTS.body, color: WHIMSY.muteSoft },
	inCrew: { ...TYPE.kicker, fontFamily: FONTS.hand, color: WHIMSY.mute },
	waiting: { ...TYPE.kicker, fontFamily: FONTS.hand, color: WHIMSY.mute },
	inviteBtn: {
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		paddingHorizontal: SPACE.md,
		paddingVertical: 5,
		minHeight: 32,
		justifyContent: "center",
	},
	inviteBtnText: { fontFamily: FONTS.whimsy, fontSize: 13, color: WHIMSY.ink },
	note: {
		...TYPE.hand,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		textAlign: "center",
		marginTop: SPACE.sm,
	},
	doneBtn: { alignSelf: "center", marginTop: SPACE.md, paddingHorizontal: SPACE.lg },
	doneText: {
		fontFamily: FONTS.hand,
		fontSize: 15,
		color: WHIMSY.mute,
		textDecorationLine: "underline",
	},
});

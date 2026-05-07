import React, { useCallback, useState } from "react";
import {
	StyleSheet,
	View,
	Text,
	TextInput,
	Pressable,
	Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../utils/supabase";
import { Sticker } from "./ui/Sticker";
import { FONTS, WHIMSY, ROW_TILTS } from "@/constants/theme";

interface Profile {
	id: string;
	username: string | null;
	tickles_earned: number;
}

interface PendingRequest {
	requester_id: string;
	requester: Profile | null;
}

export default function Friends({ userId }: { userId: string }) {
	const [friends, setFriends] = useState<Profile[]>([]);
	const [pending, setPending] = useState<PendingRequest[]>([]);
	const [searchInput, setSearchInput] = useState("");
	const [sending, setSending] = useState(false);
	const [feedback, setFeedback] = useState<string>("");

	const load = useCallback(async () => {
		const { data: friendIds } = await supabase.rpc("friend_ids");
		const ids = (friendIds as string[] | null) ?? [];
		if (ids.length > 0) {
			const { data } = await supabase
				.from("profiles")
				.select("id, username, tickles_earned")
				.in("id", ids);
			setFriends((data as Profile[]) ?? []);
		} else {
			setFriends([]);
		}

		const { data: pendingRows } = await supabase
			.from("friendships")
			.select(
				"requester_id, profiles!friendships_requester_id_fkey(id, username, tickles_earned)"
			)
			.eq("receiver_id", userId)
			.eq("status", "pending");
		// fkey-style join may or may not work depending on schema relationships;
		// fall back to fetching requester profiles separately.
		if (pendingRows && pendingRows.length > 0) {
			const rows = pendingRows as { requester_id: string }[];
			const requesterIds = rows.map((r) => r.requester_id);
			const { data: profs } = await supabase
				.from("profiles")
				.select("id, username, tickles_earned")
				.in("id", requesterIds);
			const profById = new Map(
				((profs as Profile[]) ?? []).map((p) => [p.id, p])
			);
			setPending(
				rows.map((r) => ({
					requester_id: r.requester_id,
					requester: profById.get(r.requester_id) ?? null,
				}))
			);
		} else {
			setPending([]);
		}
	}, [userId]);

	useFocusEffect(
		useCallback(() => {
			load();
		}, [load])
	);

	const handleSendRequest = async () => {
		const name = searchInput.trim();
		if (!name || sending) return;
		setSending(true);
		setFeedback("");
		const { data, error } = await supabase.rpc("send_friend_request", {
			target_username: name,
		});
		setSending(false);
		if (error) {
			setFeedback("Something went wrong. Try again.");
			return;
		}
		const result = data as { ok: boolean; reason?: string; state?: string };
		if (!result.ok) {
			const map: Record<string, string> = {
				no_such_user: "No one with that name.",
				self: "You can't friend yourself.",
				already_friends: "You're already friends.",
				pending: "Already requested.",
			};
			setFeedback(map[result.reason ?? ""] ?? "Couldn't send request.");
			return;
		}
		setSearchInput("");
		setFeedback(result.state === "accepted" ? "Friends! 🎉" : "Request sent.");
		load();
	};

	const handleAccept = async (otherId: string) => {
		await supabase.rpc("accept_friend_request", { other_user_id: otherId });
		load();
	};

	const handleDecline = async (otherId: string) => {
		await supabase.rpc("remove_friendship", { other_user_id: otherId });
		load();
	};

	const handleUnfriend = (other: Profile) => {
		Alert.alert(
			"Remove friend?",
			`Stop being friends with ${other.username || "this user"}?`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Remove",
					style: "destructive",
					onPress: async () => {
						await supabase.rpc("remove_friendship", {
							other_user_id: other.id,
						});
						load();
					},
				},
			]
		);
	};

	return (
		<View style={styles.container}>
			<Text style={styles.heading}>★ friends</Text>

			<Sticker color="paper" rotate={-0.6} radius={14} style={styles.addCard}>
				<View style={styles.addRow}>
					<TextInput
						style={styles.input}
						placeholder="add by name"
						placeholderTextColor={WHIMSY.muteSoft}
						value={searchInput}
						onChangeText={(t) => {
							setSearchInput(t);
							if (feedback) setFeedback("");
						}}
						autoCapitalize="none"
						autoCorrect={false}
						maxLength={24}
						editable={!sending}
					/>
					<Pressable
						onPress={handleSendRequest}
						disabled={sending}
						style={({ pressed }) => [
							styles.addButton,
							sending && styles.addButtonDisabled,
							pressed && { opacity: 0.7 },
						]}
					>
						<Text style={styles.addButtonText}>
							{sending ? "..." : "Add"}
						</Text>
					</Pressable>
				</View>
				{feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
			</Sticker>

			{pending.length > 0 && (
				<View style={styles.section}>
					<Text style={styles.subheading}>★ pending requests</Text>
					{pending.map((p, i) => (
						<View
							key={p.requester_id}
							style={[styles.rowWrap, { marginVertical: 4 }]}
						>
							<Sticker
								color="cream"
								rotate={ROW_TILTS[i % ROW_TILTS.length]}
								radius={10}
								style={styles.row}
							>
								<Text style={styles.rowName} numberOfLines={1}>
									{p.requester?.username ?? "Anonymous"}
								</Text>
								<View style={styles.actions}>
									<Pressable
										onPress={() => handleAccept(p.requester_id)}
										style={({ pressed }) => [
											styles.miniBtn,
											styles.acceptBtn,
											pressed && { opacity: 0.7 },
										]}
									>
										<Text style={styles.miniBtnText}>accept</Text>
									</Pressable>
									<Pressable
										onPress={() => handleDecline(p.requester_id)}
										style={({ pressed }) => [
											styles.miniBtn,
											styles.declineBtn,
											pressed && { opacity: 0.7 },
										]}
									>
										<Text style={styles.miniBtnTextDecline}>decline</Text>
									</Pressable>
								</View>
							</Sticker>
						</View>
					))}
				</View>
			)}

			<View style={styles.section}>
				<Text style={styles.subheading}>
					★ your friends ({friends.length})
				</Text>
				{friends.length === 0 ? (
					<Text style={styles.empty}>No friends yet. Add one above.</Text>
				) : (
					friends.map((f, i) => (
						<View key={f.id} style={[styles.rowWrap, { marginVertical: 4 }]}>
							<Pressable onLongPress={() => handleUnfriend(f)}>
								<Sticker
									color="paper"
									rotate={ROW_TILTS[i % ROW_TILTS.length]}
									radius={10}
									style={styles.row}
								>
									<Text style={styles.rowName} numberOfLines={1}>
										{f.username ?? "Anonymous"}
									</Text>
									<Text style={styles.rowCounter}>
										{f.tickles_earned.toLocaleString()} ♥
									</Text>
								</Sticker>
							</Pressable>
						</View>
					))
				)}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		paddingHorizontal: 4,
		paddingTop: 4,
	},
	heading: {
		fontFamily: FONTS.whimsy,
		fontSize: 22,
		color: WHIMSY.ink,
		marginBottom: 12,
	},
	subheading: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.accent,
		letterSpacing: 0.4,
		marginBottom: 10,
	},
	addCard: {
		paddingHorizontal: 12,
		paddingVertical: 10,
	},
	addRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	input: {
		flex: 1,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 10,
		paddingHorizontal: 12,
		height: 40,
		fontSize: 15,
		fontFamily: FONTS.hand,
		color: WHIMSY.ink,
		backgroundColor: WHIMSY.cream,
	},
	addButton: {
		backgroundColor: WHIMSY.sun,
		paddingHorizontal: 18,
		height: 40,
		borderRadius: 10,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	addButtonDisabled: {
		opacity: 0.5,
	},
	addButtonText: {
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
		fontSize: 14,
	},
	feedback: {
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		fontSize: 13,
		marginTop: 8,
	},
	section: {
		marginTop: 20,
	},
	rowWrap: {},
	row: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: 10,
		paddingHorizontal: 12,
		gap: 8,
	},
	rowName: {
		flex: 1,
		fontFamily: FONTS.whimsy,
		fontSize: 15,
		color: WHIMSY.ink,
	},
	rowCounter: {
		fontFamily: FONTS.whimsy,
		fontSize: 14,
		color: WHIMSY.ink,
	},
	actions: {
		flexDirection: "row",
		gap: 6,
	},
	miniBtn: {
		paddingHorizontal: 10,
		paddingVertical: 5,
		borderRadius: 8,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	acceptBtn: {
		backgroundColor: WHIMSY.sun,
	},
	declineBtn: {
		backgroundColor: WHIMSY.cream,
	},
	miniBtnText: {
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
		fontSize: 12,
	},
	miniBtnTextDecline: {
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		fontSize: 12,
	},
	empty: {
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		fontSize: 14,
		paddingVertical: 8,
	},
});

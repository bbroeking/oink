import React, { useCallback, useState } from "react";
import {
	StyleSheet,
	View,
	TextInput,
	TouchableOpacity,
	FlatList,
	Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../utils/supabase";
import { ThemedText } from "./ThemedText";
import { PRIMARY_COLOR } from "./SupaAuth";

interface Profile {
	id: string;
	username: string | null;
	counter: number;
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
				.select("id, username, counter")
				.in("id", ids);
			setFriends((data as Profile[]) ?? []);
		} else {
			setFriends([]);
		}

		const { data: pendingRows } = await supabase
			.from("friendships")
			.select("requester_id, profiles!friendships_requester_id_fkey(id, username, counter)")
			.eq("receiver_id", userId)
			.eq("status", "pending");
		// The fkey-style join syntax may or may not work depending on schema relationship setup.
		// Fall back: fetch requester profiles separately.
		if (pendingRows && pendingRows.length > 0) {
			const rows = pendingRows as { requester_id: string }[];
			const requesterIds = rows.map((r) => r.requester_id);
			const { data: profs } = await supabase
				.from("profiles")
				.select("id, username, counter")
				.in("id", requesterIds);
			const profById = new Map(((profs as Profile[]) ?? []).map((p) => [p.id, p]));
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
		setFeedback(
			result.state === "accepted" ? "Friends! 🎉" : "Request sent."
		);
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
			<ThemedText style={styles.heading}>Friends</ThemedText>

			<View style={styles.addRow}>
				<TextInput
					style={styles.input}
					placeholder="Add by name"
					placeholderTextColor="#999"
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
				<TouchableOpacity
					style={[styles.addButton, sending && styles.addButtonDisabled]}
					onPress={handleSendRequest}
					disabled={sending}
				>
					<ThemedText style={styles.addButtonText}>
						{sending ? "..." : "Add"}
					</ThemedText>
				</TouchableOpacity>
			</View>
			{feedback ? (
				<ThemedText style={styles.feedback}>{feedback}</ThemedText>
			) : null}

			{pending.length > 0 && (
				<View style={styles.section}>
					<ThemedText style={styles.subheading}>
						Pending requests
					</ThemedText>
					{pending.map((p) => (
						<View key={p.requester_id} style={styles.row}>
							<ThemedText style={styles.rowName}>
								{p.requester?.username ?? "Anonymous"}
							</ThemedText>
							<View style={styles.actions}>
								<TouchableOpacity
									style={[styles.smallButton, styles.acceptButton]}
									onPress={() => handleAccept(p.requester_id)}
								>
									<ThemedText style={styles.smallButtonText}>
										Accept
									</ThemedText>
								</TouchableOpacity>
								<TouchableOpacity
									style={[styles.smallButton, styles.declineButton]}
									onPress={() => handleDecline(p.requester_id)}
								>
									<ThemedText style={styles.declineButtonText}>
										Decline
									</ThemedText>
								</TouchableOpacity>
							</View>
						</View>
					))}
				</View>
			)}

			<View style={styles.section}>
				<ThemedText style={styles.subheading}>
					Your friends ({friends.length})
				</ThemedText>
				{friends.length === 0 ? (
					<ThemedText style={styles.empty}>
						No friends yet. Add one above.
					</ThemedText>
				) : (
					friends.map((f) => (
						<TouchableOpacity
							key={f.id}
							style={styles.row}
							onLongPress={() => handleUnfriend(f)}
						>
							<ThemedText style={styles.rowName}>
								{f.username ?? "Anonymous"}
							</ThemedText>
							<ThemedText style={styles.rowCounter}>
								{f.counter} 🐷
							</ThemedText>
						</TouchableOpacity>
					))
				)}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		paddingHorizontal: 16,
		paddingTop: 8,
	},
	heading: {
		fontSize: 22,
		fontWeight: "700",
		color: "#1A1A1A",
		marginBottom: 16,
	},
	subheading: {
		fontSize: 12,
		fontWeight: "800",
		color: "#9A9A9A",
		marginBottom: 8,
		textTransform: "uppercase",
		letterSpacing: 1.2,
	},
	addRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginBottom: 8,
	},
	input: {
		flex: 1,
		borderWidth: 1.5,
		borderColor: "#EAE2D6",
		borderRadius: 10,
		paddingHorizontal: 12,
		height: 42,
		fontSize: 15,
		color: "#1A1A1A",
		backgroundColor: "#FFF",
	},
	addButton: {
		backgroundColor: PRIMARY_COLOR,
		paddingHorizontal: 18,
		height: 42,
		borderRadius: 10,
		alignItems: "center",
		justifyContent: "center",
	},
	addButtonDisabled: {
		opacity: 0.5,
	},
	addButtonText: {
		color: "white",
		fontWeight: "600",
		fontSize: 14,
	},
	feedback: {
		color: "#6B6B6B",
		fontSize: 13,
		marginBottom: 8,
	},
	section: {
		marginTop: 20,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: 10,
		paddingHorizontal: 8,
		borderBottomWidth: 1,
		borderBottomColor: "rgba(0,0,0,0.06)",
	},
	rowName: {
		fontSize: 16,
		color: "#1A1A1A",
		flex: 1,
		fontWeight: "700",
	},
	rowCounter: {
		fontSize: 14,
		color: "#6B6B6B",
		fontWeight: "700",
	},
	actions: {
		flexDirection: "row",
		gap: 6,
	},
	smallButton: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 8,
	},
	acceptButton: {
		backgroundColor: PRIMARY_COLOR,
	},
	declineButton: {
		backgroundColor: "#EAE2D6",
	},
	smallButtonText: {
		color: "white",
		fontSize: 13,
		fontWeight: "600",
	},
	declineButtonText: {
		color: "#3A3A3A",
		fontSize: 13,
		fontWeight: "600",
	},
	empty: {
		color: "#9A9A9A",
		fontSize: 14,
		paddingVertical: 8,
	},
});

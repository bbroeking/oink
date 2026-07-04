// SounderCard — crew management on the Friends hub (the "Sounder"
// segment, dark-launched behind the `mud_wars` server flag).
//
// No crew  → join-first: incoming invites + open-Sounder list lead;
//             founding your own demotes to a secondary form below.
// In a crew → roster pips where every empty slot is a "+" button that
//             opens FriendInvitePicker (any member can invite; server
//             enforces are_friends + cap), pending invites, a Mud Scuffle
//             CTA that routes to /mud-war, standings link, leadership
//             handoff on member rows, and Leave.
//
// All war flow (challenge / accept / sling / resolve) lives on the
// /mud-war screen; this card is crew bookkeeping only.

import { useEffect, useState } from "react";
import {
	View,
	Text,
	TextInput,
	Pressable,
	StyleSheet,
	ScrollView,
	ActivityIndicator,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { supabase } from "@/utils/supabase";
import { kickCrewMember, transferCrewLeadership } from "@/utils/mudWars";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import { JoinableSounders } from "./JoinableSounders";
import { FriendInvitePicker } from "./FriendInvitePicker";
import { UserSheet } from "./UserSheet";
import { useCrew, useJoinableCrews } from "@/hooks/useCrew";
import { CREW_CAP } from "@/constants/mudFights";
import { FONTS, WHIMSY } from "@/constants/theme";

export function SounderCard() {
	const router = useRouter();
	const crewHook = useCrew();
	const { crew, loading, create, accept, decline, leave } = crewHook;
	const joinable = useJoinableCrews(!crew.crew);
	const [name, setName] = useState("");
	const [busy, setBusy] = useState(false);
	const [note, setNote] = useState<string | null>(null);
	const [pickerOpen, setPickerOpen] = useState(false);
	// Tapping a member row opens UserSheet — the one door for bless (and,
	// for friends, ask/curse/visit). Crewmates get the bless-only panel.
	const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
	// Leadership handoff / kick: first tap arms ("sure?"), second tap acts.
	const [handoffArmedId, setHandoffArmedId] = useState<string | null>(null);
	const [kickArmedId, setKickArmedId] = useState<string | null>(null);
	const [me, setMe] = useState<string | null>(null);

	useEffect(() => {
		supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
	}, []);

	const inCrew = !!crew.crew;
	const isLeader = !!me && crew.crew?.leader_id === me;
	const memberCount = crew.members.length;

	async function onHandoff(userId: string) {
		if (handoffArmedId !== userId) {
			setHandoffArmedId(userId);
			setKickArmedId(null);
			return;
		}
		setHandoffArmedId(null);
		setNote(null);
		const r = await transferCrewLeadership(userId);
		if (!r.ok) {
			setNote(
				r.reason === "not_leader"
					? "Only the leader can hand off the crown."
					: "Couldn't hand off the crown — try again."
			);
		}
		await crewHook.refresh();
	}

	async function onKick(userId: string) {
		if (kickArmedId !== userId) {
			setKickArmedId(userId);
			setHandoffArmedId(null);
			return;
		}
		setKickArmedId(null);
		setNote(null);
		const r = await kickCrewMember(userId);
		if (!r.ok) {
			setNote(
				r.reason === "in_war"
					? "The scuffle holds the roster — kick once it's settled."
					: "Couldn't remove them — try again."
			);
		}
		await crewHook.refresh();
	}

	async function onCreate() {
		if (busy) return;
		setBusy(true);
		setNote(null);
		const r = await create(name.trim());
		setBusy(false);
		if (!r.ok) setNote(createError(r.reason));
		else setName("");
	}

	if (loading && !crew.crew && crew.invitesIn.length === 0) {
		return (
			<View style={styles.center}>
				<ActivityIndicator color={WHIMSY.accent} />
			</View>
		);
	}

	return (
		<ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
			{/* Incoming invites — shown whether or not you have a crew (you can
			    only act on them when crewless; server enforces). */}
			{crew.invitesIn.length > 0 && (
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Invites</Text>
					{crew.invitesIn.map((i) => (
						<View key={i.id} style={styles.inviteRow}>
							<Text style={styles.inviteText}>
								<Text style={styles.bold}>{i.inviter_name ?? "A friend"}</Text>
								{" → "}
								{i.crew_name}
							</Text>
							<View style={styles.inviteBtns}>
								<Button size="sm" variant="primary" onPress={() => accept(i.id)}>
									Join
								</Button>
								<Button size="sm" variant="ghost" onPress={() => decline(i.id)}>
									Decline
								</Button>
							</View>
						</View>
					))}
				</View>
			)}

			{!inCrew ? (
				<>
					{/* Join-first: open Sounders lead, founding follows. */}
					{joinable.crews.length > 0 && (
						<View style={styles.section}>
							<Text style={styles.heading}>Join a Sounder</Text>
							<Text style={styles.sub}>
								Slip into an open Sounder — the war will introduce you.
							</Text>
							<JoinableSounders
								crews={joinable.crews}
								crewHook={crewHook}
								onStale={joinable.refresh}
							/>
						</View>
					)}
					<View style={styles.section}>
						<Text style={styles.heading}>
							{joinable.crews.length > 0 ? "Or start your own" : "Start your Sounder"}
						</Text>
						<Text style={styles.sub}>
							Rally up to {CREW_CAP} friends, then take on another Sounder in a
							Mud Scuffle.
						</Text>
						<TextInput
							style={styles.input}
							placeholder="Name your Sounder"
							placeholderTextColor={WHIMSY.muteSoft}
							value={name}
							onChangeText={setName}
							maxLength={24}
						/>
						<Button
							variant="primary"
							full
							disabled={busy || name.trim().length < 1}
							onPress={onCreate}
							style={{ marginTop: 4 }}
						>
							{busy ? "Creating…" : "Create your Sounder"}
						</Button>
					</View>
				</>
			) : (
				<>
					<View style={styles.section}>
						<View style={styles.crewHeader}>
							<Text style={styles.heading}>{crew.crew!.name}</Text>
							<Text style={styles.count}>
								{memberCount}/{CREW_CAP}
							</Text>
						</View>
						{/* Filled pips for members; every open slot is a "+" that
						    opens the friends picker — inviting should be one tap
						    from the roster, not a hunt through search. */}
						<View style={styles.pips}>
							{Array.from({ length: CREW_CAP }).map((_, i) =>
								i < memberCount ? (
									<View key={i} style={[styles.pip, styles.pipFilled]} />
								) : (
									<Pressable
										key={i}
										testID={`sounder-slot-plus-${i}`}
										onPress={() => setPickerOpen(true)}
										style={styles.plusSlot}
										hitSlop={6}
									>
										<Icon name="plus" size={12} color={WHIMSY.ink} strokeWidth={3} />
									</Pressable>
								)
							)}
						</View>
						{crew.members.map((m) => (
							<Pressable
								key={m.user_id}
								onPress={() => setSelectedUserId(m.user_id)}
								style={styles.memberRow}
							>
								<Icon
									name={m.role === "leader" ? "crown" : "friends"}
									size={14}
									color={WHIMSY.ink}
								/>
								<Text style={styles.memberName}>{m.username ?? "Pig"}</Text>
								{m.role === "leader" && <Text style={styles.leaderTag}>leader</Text>}
								{/* Leadership handoff + kick — leader-only, on other
								    members, two-tap confirms so a stray tap can't
								    crown or boot anyone. */}
								{isLeader && m.user_id !== me && (
									<>
										<Pressable onPress={() => onHandoff(m.user_id)} hitSlop={8}>
											<Text
												style={[
													styles.handoffLink,
													handoffArmedId === m.user_id && styles.handoffArmed,
												]}
											>
												{handoffArmedId === m.user_id ? "hand crown? sure ›" : "make leader"}
											</Text>
										</Pressable>
										<Pressable onPress={() => onKick(m.user_id)} hitSlop={8}>
											<Text
												style={[
													styles.handoffLink,
													kickArmedId === m.user_id && styles.handoffArmed,
												]}
											>
												{kickArmedId === m.user_id ? "kick? sure ›" : "kick"}
											</Text>
										</Pressable>
									</>
								)}
							</Pressable>
						))}
					</View>

					{/* Mud Scuffle CTA */}
					<View style={styles.section}>
						<Button
							variant="gold"
							full
							icon={<Icon name="trophy" size={16} color="#5A3F00" />}
							// Cast: expo-router regenerates the typed-routes union to
							// include /mud-war on the next `expo start`; cast keeps tsc green now.
							onPress={() => router.push("/mud-war" as Href)}
						>
							{crew.inWar ? "View the Mud Scuffle" : "Start a Mud Scuffle"}
						</Button>
					</View>

					{crew.invitesOut.length > 0 && (
						<View style={styles.section}>
							<Text style={styles.sectionTitle}>Pending invites</Text>
							{crew.invitesOut.map((i) => (
								<Text key={i.id} style={styles.pendingText}>
									{i.invitee_name ?? "Someone"} — waiting…
								</Text>
							))}
						</View>
					)}

					{/* Spirit standings — the kindest, most active Sounders. */}
					<View style={styles.section}>
						<Pressable
							onPress={() => router.push("/clan-ladder" as Href)}
							style={styles.standingsRow}
							hitSlop={6}
						>
							<Icon name="trophy" size={16} color={WHIMSY.ink} />
							<Text style={styles.standingsText}>Sounder standings</Text>
							<Text style={styles.standingsChevron}>›</Text>
						</Pressable>
					</View>

					<View style={styles.section}>
						<Button variant="ghost" full onPress={() => leave()}>
							Leave Sounder
						</Button>
					</View>

					<FriendInvitePicker
						visible={pickerOpen}
						onDismiss={() => setPickerOpen(false)}
						crewHook={crewHook}
					/>

					<UserSheet
						targetUserId={selectedUserId}
						onDismiss={() => setSelectedUserId(null)}
						onFriendshipChanged={crewHook.refresh}
					/>
				</>
			)}

			{note && <Text style={styles.note}>{note}</Text>}
		</ScrollView>
	);
}

function createError(reason?: string): string {
	switch (reason) {
		case "already_in_crew":
			return "You're already in a Sounder.";
		case "bad_name":
			return "Pick a name (1–24 characters).";
		default:
			return "Couldn't create your Sounder.";
	}
}

const styles = StyleSheet.create({
	scroll: { flex: 1 },
	content: { padding: 18, paddingBottom: 60, gap: 4 },
	center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 40 },
	section: {
		backgroundColor: WHIMSY.paper,
		borderRadius: 18,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		padding: 14,
		marginBottom: 12,
		gap: 8,
	},
	heading: { fontFamily: FONTS.whimsy, fontSize: 22, color: WHIMSY.ink },
	sub: { fontFamily: FONTS.body, fontSize: 13, color: WHIMSY.mute, marginBottom: 4 },
	sectionTitle: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		letterSpacing: 1.4,
		textTransform: "uppercase",
		color: WHIMSY.mute,
	},
	input: {
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 14,
		paddingHorizontal: 12,
		paddingVertical: 10,
		fontFamily: FONTS.body,
		fontSize: 15,
		color: WHIMSY.ink,
		backgroundColor: WHIMSY.cream,
	},
	crewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
	count: { fontFamily: FONTS.bodyExtra, fontSize: 14, color: WHIMSY.mute },
	pips: { flexDirection: "row", alignItems: "center", gap: 6, marginVertical: 2 },
	plusSlot: {
		width: 22,
		height: 22,
		borderRadius: 11,
		borderWidth: 1.5,
		borderStyle: "dashed",
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream,
		alignItems: "center",
		justifyContent: "center",
	},
	standingsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
	standingsText: { flex: 1, fontFamily: FONTS.bodyExtra, fontSize: 14, color: WHIMSY.ink },
	standingsChevron: { fontFamily: FONTS.whimsy, fontSize: 18, color: WHIMSY.mute },
	pip: {
		width: 16,
		height: 16,
		borderRadius: 8,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream,
	},
	pipFilled: { backgroundColor: WHIMSY.sun },
	memberRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 },
	memberName: { fontFamily: FONTS.body, fontSize: 15, color: WHIMSY.ink, flex: 1 },
	leaderTag: { fontFamily: FONTS.bodyExtra, fontSize: 10, color: WHIMSY.accent, textTransform: "uppercase" },
	handoffLink: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		textDecorationLine: "underline",
	},
	handoffArmed: { color: WHIMSY.accent },
	inviteRow: { gap: 6, paddingVertical: 4 },
	inviteText: { fontFamily: FONTS.body, fontSize: 14, color: WHIMSY.ink },
	bold: { fontFamily: FONTS.bodyExtra },
	inviteBtns: { flexDirection: "row", gap: 8 },
	resultRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 8,
		borderTopWidth: 1,
		borderTopColor: WHIMSY.cream2,
	},
	inviteCta: { fontFamily: FONTS.bodyExtra, fontSize: 13, color: WHIMSY.accent },
	pendingText: { fontFamily: FONTS.body, fontSize: 13, color: WHIMSY.mute },
	note: { fontFamily: FONTS.body, fontSize: 13, color: WHIMSY.accent, textAlign: "center", marginTop: 4 },
});

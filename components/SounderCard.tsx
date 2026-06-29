// SounderCard — crew management on the Friends hub (the "Sounder"
// segment, dark-launched behind MUD_FIGHTS_VISIBLE).
//
// No crew  → name input + "Create your Sounder" + any incoming invites.
// In a crew → roster pips, leader invite picker (searchUsers — server
//             enforces are_friends), pending invites, a Mud Fight CTA
//             that routes to /mud-war, and Leave.
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
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import { useCrew } from "@/hooks/useCrew";
import { searchUsers, Profile } from "@/utils/friendships";
import { CREW_CAP } from "@/constants/mudFights";
import { FONTS, WHIMSY } from "@/constants/theme";

export function SounderCard() {
	const router = useRouter();
	const { crew, loading, create, invite, accept, decline, leave } = useCrew();
	const [me, setMe] = useState<string | null>(null);
	const [name, setName] = useState("");
	const [busy, setBusy] = useState(false);
	const [note, setNote] = useState<string | null>(null);

	// Invite picker (leader only).
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<Profile[]>([]);

	useEffect(() => {
		supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
	}, []);

	const inCrew = !!crew.crew;
	const isLeader = !!me && crew.crew?.leader_id === me;
	const memberCount = crew.members.length;

	async function onCreate() {
		if (busy) return;
		setBusy(true);
		setNote(null);
		const r = await create(name.trim());
		setBusy(false);
		if (!r.ok) setNote(createError(r.reason));
		else setName("");
	}

	async function onSearch(text: string) {
		setQuery(text);
		if (text.trim().length < 2) {
			setResults([]);
			return;
		}
		const rows = (await searchUsers(text.trim(), 8)) ?? [];
		// Drop people already in the crew.
		const here = new Set(crew.members.map((m) => m.user_id));
		setResults(rows.filter((p) => !here.has(p.id)));
	}

	async function onInvite(p: Profile) {
		setNote(null);
		const r = await invite(p.id);
		if (!r.ok) setNote(inviteError(r.reason, p.username));
		else {
			setNote(`Invited ${p.username ?? "them"}.`);
			setQuery("");
			setResults([]);
		}
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
				<View style={styles.section}>
					<Text style={styles.heading}>Start your Sounder</Text>
					<Text style={styles.sub}>
						Rally up to {CREW_CAP} friends, then take on another Sounder in a
						Mud Fight.
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
			) : (
				<>
					<View style={styles.section}>
						<View style={styles.crewHeader}>
							<Text style={styles.heading}>{crew.crew!.name}</Text>
							<Text style={styles.count}>
								{memberCount}/{CREW_CAP}
							</Text>
						</View>
						<View style={styles.pips}>
							{Array.from({ length: CREW_CAP }).map((_, i) => (
								<View
									key={i}
									style={[styles.pip, i < memberCount && styles.pipFilled]}
								/>
							))}
						</View>
						{crew.members.map((m) => (
							<View key={m.user_id} style={styles.memberRow}>
								<Icon
									name={m.role === "leader" ? "crown" : "friends"}
									size={14}
									color={WHIMSY.ink}
								/>
								<Text style={styles.memberName}>{m.username ?? "Pig"}</Text>
								{m.role === "leader" && <Text style={styles.leaderTag}>leader</Text>}
							</View>
						))}
					</View>

					{/* Mud Fight CTA */}
					<View style={styles.section}>
						<Button
							variant="gold"
							full
							icon={<Icon name="trophy" size={16} color="#5A3F00" />}
							// Cast: expo-router regenerates the typed-routes union to
							// include /mud-war on the next `expo start`; cast keeps tsc green now.
							onPress={() => router.push("/mud-war" as Href)}
						>
							{crew.inWar ? "View the Mud Fight" : "Start a Mud Fight"}
						</Button>
					</View>

					{/* Leader invite picker */}
					{isLeader && memberCount < CREW_CAP && (
						<View style={styles.section}>
							<Text style={styles.sectionTitle}>Invite a friend</Text>
							<TextInput
								style={styles.input}
								placeholder="Search a friend's name"
								placeholderTextColor={WHIMSY.muteSoft}
								value={query}
								onChangeText={onSearch}
								autoCapitalize="none"
							/>
							{results.map((p) => (
								<Pressable
									key={p.id}
									style={styles.resultRow}
									onPress={() => onInvite(p)}
								>
									<Text style={styles.memberName}>
										{p.username ?? "Pig"}
										{p.discriminator ? `#${p.discriminator}` : ""}
									</Text>
									<Text style={styles.inviteCta}>Invite</Text>
								</Pressable>
							))}
						</View>
					)}

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

					<View style={styles.section}>
						<Button variant="ghost" full onPress={() => leave()}>
							Leave Sounder
						</Button>
					</View>
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

function inviteError(reason: string | undefined, name: string | null): string {
	const who = name ?? "them";
	switch (reason) {
		case "not_friends":
			return `You can only invite friends. Add ${who} first.`;
		case "invitee_in_crew":
			return `${who} is already in a Sounder.`;
		case "crew_full":
			return "Your Sounder is full.";
		case "already_invited":
			return `${who} already has a pending invite.`;
		default:
			return "Couldn't send that invite.";
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
	pips: { flexDirection: "row", gap: 6, marginVertical: 2 },
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

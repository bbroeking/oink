// Player invite picker — a LEADER-only bottom sheet for recruiting beyond the
// friends list. It opens on the "Recruit any snout" CTA and shows, by default,
// the all-time truffle diggers (via sounder_invite_candidates); a search box
// filters to any username. Unlike FriendInvitePicker it can reach STRANGERS and
// players already in another Sounder (a POACH) — the ask is still just a request:
// the invitee accepts & switches, or declines & stays.
//
// Each row is one of:
//   free    — no Sounder yet, free to ride  → sun "Invite" pill
//   poach   — rides another Sounder         → sub "in {crew}", sun "Invite" pill
//   pending — waiting on your last ask…      → "take it back" (frees the seat)
//   full    — your banner has no open slot   → status "sounder full"
// Invites go through useCrew.invite (the server enforces leader power + block +
// the 24h decline cooldown + the combined seat cap).

import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, TextInput } from "react-native";
import * as Haptics from "expo-haptics";
import { CrewSheet } from "./CrewSheet";
import {
	AccentNote,
	CrewPortrait,
	CrewRow,
	DiscText,
	HandLink,
	RowStatus,
	SunPill,
} from "./CrewRow";
import { EmptyState, LoadingBeat } from "./ui/EmptyState";
import type { UseCrew } from "@/hooks/useCrew";
import { fetchInviteCandidates, type InviteCandidate } from "@/utils/crews";
import { CREW_CAP } from "@/constants/crews";
import { FONTS, RADII, SPACE, TYPE, WHIMSY } from "@/constants/theme";

function inviteError(reason?: string): string {
	switch (reason) {
		case "crew_full":
			return "Your Sounder is full.";
		case "already_invited":
			return "They already have a pending invite.";
		case "recently_declined":
			return "They passed recently — give it a day before asking again.";
		case "blocked":
			return "You can't invite that pig.";
		case "no_crew":
			return "You're not in a Sounder.";
		default:
			return "Couldn't send that invite.";
	}
}

export function PlayerInvitePicker({
	visible,
	onDismiss,
	crewHook,
}: {
	visible: boolean;
	onDismiss: () => void;
	crewHook: UseCrew;
}) {
	const [search, setSearch] = useState("");
	const [rows, setRows] = useState<InviteCandidate[] | null>(null);
	const [note, setNote] = useState<string | null>(null);
	const [busyId, setBusyId] = useState<string | null>(null);

	// Debounced fetch: default (empty) → the leaderboard; typing → username match.
	useEffect(() => {
		if (!visible) return;
		let cancelled = false;
		setRows(null);
		const q = search.trim();
		const t = setTimeout(async () => {
			const data = await fetchInviteCandidates(q);
			if (!cancelled) setRows(data);
		}, q ? 300 : 0);
		return () => {
			cancelled = true;
			clearTimeout(t);
		};
	}, [visible, search]);

	// Reset the search each time the sheet reopens.
	const wasVisible = useRef(false);
	useEffect(() => {
		if (visible && !wasVisible.current) setSearch("");
		wasVisible.current = visible;
	}, [visible]);

	// invitee_id → outgoing invite row id, so a "waiting" row can take the ask back.
	const waitingInviteByPlayer = useMemo(
		() => new Map(crewHook.crew.invitesOut.map((i) => [i.invitee_id, i.id])),
		[crewHook.crew.invitesOut]
	);
	// Members + pending-out fill the roster (the server's combined cap); once full
	// every remaining Invite is dead — disable with a quiet hint.
	const seatsFull =
		crewHook.crew.members.length + crewHook.crew.invitesOut.length >= CREW_CAP;

	const invite = async (playerId: string) => {
		if (busyId) return;
		setBusyId(playerId);
		setNote(null);
		const r = await crewHook.invite(playerId);
		setBusyId(null);
		if (r.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
		} else {
			setNote(inviteError(r.reason));
		}
	};

	const cancel = async (inviteId: string) => {
		if (busyId) return;
		setBusyId(inviteId);
		setNote(null);
		const r = await crewHook.cancel(inviteId);
		setBusyId(null);
		if (!r.ok) setNote("Couldn't take that ask back — try again.");
	};

	return (
		<CrewSheet
			visible={visible}
			onDismiss={onDismiss}
			title="Recruit any snout"
			sub="ranked by all-time truffles dug — or search a name"
		>
			<TextInput
				value={search}
				onChangeText={setSearch}
				placeholder="search a username…"
				placeholderTextColor={WHIMSY.mute}
				autoCapitalize="none"
				autoCorrect={false}
				style={styles.search}
			/>

			{rows === null ? (
				<LoadingBeat />
			) : rows.length === 0 ? (
				<EmptyState
					glyph="friends"
					title={search.trim() ? "No pig by that name" : "No diggers to show"}
					sub={search.trim() ? "try another spelling." : "check back once the bog fills up."}
				/>
			) : (
				<ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
					{rows.map((p, idx) => {
						const waitingInvite = waitingInviteByPlayer.get(p.id);
						const waiting = waitingInvite != null;
						const dug = `${p.truffles_dug.toLocaleString()} ${
							p.truffles_dug === 1 ? "truffle" : "truffles"
						} dug all-time`;
						const sub = waiting
							? `${dug} • waiting on your last ask…`
							: p.in_crew
								? `${dug} • in ${p.crew_name ?? "another Sounder"} — invite to switch`
								: seatsFull
									? `${dug} • the banner's full`
									: `${dug} • no crew yet — free to ride`;
						const right = waiting ? (
							<HandLink
								onPress={() => cancel(waitingInvite)}
								textStyle={busyId === waitingInvite ? styles.dim : undefined}
							>
								take it back
							</HandLink>
						) : seatsFull ? (
							<RowStatus>sounder full</RowStatus>
						) : (
							<SunPill onPress={() => invite(p.id)} disabled={busyId !== null}>
								{busyId === p.id ? "Inviting…" : "Invite"}
							</SunPill>
						);
						return (
							<CrewRow
								key={p.id}
								divider={idx > 0}
								left={<CrewPortrait />}
								title={
									<>
										{p.username ?? "—"}
										{p.discriminator ? <DiscText> #{p.discriminator}</DiscText> : null}
									</>
								}
								sub={sub}
								right={right}
							/>
						);
					})}
				</ScrollView>
			)}

			{!!note && <AccentNote style={styles.note}>{note}</AccentNote>}

			<HandLink onPress={onDismiss} style={styles.done}>
				Done
			</HandLink>
		</CrewSheet>
	);
}

const styles = StyleSheet.create({
	search: {
		...TYPE.body,
		fontFamily: FONTS.hand,
		color: WHIMSY.ink,
		backgroundColor: WHIMSY.cream2,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.sm,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.sm,
		marginBottom: SPACE.sm,
	},
	list: { maxHeight: 360 },
	dim: { opacity: 0.5 },
	note: { textAlign: "center", marginTop: SPACE.sm },
	done: { alignSelf: "center", marginTop: SPACE.md, paddingHorizontal: SPACE.lg },
});

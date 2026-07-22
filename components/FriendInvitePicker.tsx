// Friend invite picker — tapping a "+" slot or the "Call a snout to your
// banner" CTA on the Sounder card slides this BOTTOM SHEET up: the caller's
// whole friends list in the crew row grammar (Frame C of the
// invite-matchmaking mockup), each row one of four states:
//   crewmate — rides with you            → status "crewmate"
//   free     — no crew yet, free to ride → sun "Invite" pill
//   taken    — in another Sounder        → status "taken"
//   pending  — waiting on your last ask… → status "waiting…"
// Invites go through useCrew.invite — any crew member can rally friends
// (the server enforces are_friends + the cap).

import { useEffect, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "@/utils/supabase";
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
import { fetchFriendsCrews, type FriendCrew } from "@/utils/crews";
import { getFriendIds, FRIEND_CAP_LIMIT, type Profile } from "@/utils/friendships";
import { CREW_CAP } from "@/constants/crews";
import { SPACE } from "@/constants/theme";

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
	// invitee_id → the outgoing invite's row id, so a "waiting" row can take the
	// ask back (and free its reserved seat).
	const waitingInviteByFriend = new Map(
		crewHook.crew.invitesOut.map((i) => [i.invitee_id, i.id])
	);
	// Members + pending-out invites fill the roster (server's combined cap), so
	// once they hit CREW_CAP every remaining Invite is dead — disable them with a
	// quiet "full" hint rather than let the server bounce each ask.
	const seatsFull =
		crewHook.crew.members.length + crewHook.crew.invitesOut.length >= CREW_CAP;

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
			title="Call a snout to your banner"
			sub="tap a friend to pin them to an open slot"
		>
			{friends === null ? (
				<LoadingBeat />
			) : friends.length === 0 ? (
				<EmptyState
					glyph="friends"
					title="No friends yet"
					sub="add some pigs on the Friends tab first."
				/>
			) : (
				<ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
					{friends.map((f, idx) => {
						const fc = crewsByFriend.get(f.id);
						const crewmate = !!fc && fc.crew_id === myCrewId;
						const waitingInvite = waitingInviteByFriend.get(f.id);
						const waiting = waitingInvite != null;
						const sub = crewmate
							? "rides with you"
							: fc
								? `in ${fc.crew_name}`
								: waiting
									? "waiting on your last ask…"
									: seatsFull
										? "the banner's full"
										: "no crew yet — free to ride";
						const right = crewmate ? (
							<RowStatus>crewmate</RowStatus>
						) : fc ? (
							<RowStatus>taken</RowStatus>
						) : waiting ? (
							// The ask is out — offer to take it back (frees the seat).
							<HandLink
								onPress={() => cancel(waitingInvite)}
								textStyle={busyId === waitingInvite ? styles.dim : undefined}
							>
								take it back
							</HandLink>
						) : seatsFull ? (
							<RowStatus>Sounder full</RowStatus>
						) : (
							<SunPill onPress={() => invite(f.id)} disabled={busyId !== null}>
								{busyId === f.id ? "Inviting…" : "Invite"}
							</SunPill>
						);
						return (
							<CrewRow
								key={f.id}
								divider={idx > 0}
								left={<CrewPortrait hatId={f.active_hat_id ?? null} />}
								title={
									<>
										{f.username ?? "—"}
										{f.discriminator ? <DiscText> #{f.discriminator}</DiscText> : null}
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
	list: { maxHeight: 380 },
	dim: { opacity: 0.5 },
	note: { textAlign: "center", marginTop: SPACE.sm },
	done: { alignSelf: "center", marginTop: SPACE.md, paddingHorizontal: SPACE.lg },
});

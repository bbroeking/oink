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
import { StyleSheet } from "react-native";
import { Sheet } from "./ui/Sheet";
import {
	AccentNote,
	CrewPortrait,
	CrewRow,
	DiscText,
	HandLink,
	RowStatus,
	SunPill,
} from "./ui";
import { Button } from "./ui/Button";
import { EmptyState, LoadingBeat } from "./ui/EmptyState";
import { TextField } from "./ui/TextField";
import { useInviteActions, type UseCrew } from "@/hooks/useCrew";
import { fetchInviteCandidates, type InviteCandidate } from "@/utils/crews";
import { SOUNDER_RECRUITING_COPY } from "@/utils/sounderMessages";
import { MOTION, SPACE } from "@/constants/theme";

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
		case "leader_only":
			return "Only the Sounder leader can send a recruiting Oink.";
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
	const { note, busyId, inviteWithRecruiting, cancel, seatsFull } = useInviteActions(
		crewHook,
		inviteError
	);

	// Debounced fetch: default (empty) → the leaderboard; typing → username match.
	useEffect(() => {
		if (!visible) return;
		let cancelled = false;
		setRows(null);
		const q = search.trim();
		const t = setTimeout(async () => {
			const data = await fetchInviteCandidates(q);
			if (!cancelled) setRows(data);
		}, q ? MOTION.debounce : 0);
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
	return (
		<Sheet
			open={visible}
			onClose={onDismiss}
			title="Recruit any snout"
			subtitle="ranked by all-time truffles dug — or search a name"
			closeLabel="Done"
			keyboardAware
			footer={
				<Button variant="handLink" full onPress={onDismiss} accessibilityHint="Closes the recruiting list">
					Done
				</Button>
			}
		>
			<TextField
				label="Search for a pig by username"
				labelHidden
				value={search}
				onChangeText={setSearch}
				placeholder="search a username…"
				autoCapitalize="none"
				autoCorrect={false}
			/>
			<AccentNote style={styles.recruitingCopy}>
				Recruiting Oink: “{SOUNDER_RECRUITING_COPY}”
			</AccentNote>

			{rows === null ? (
				<LoadingBeat label="finding diggers" />
			) : rows.length === 0 ? (
				<EmptyState
					glyph="friends"
					title={search.trim() ? "No pig by that name" : "No diggers to show"}
					sub={search.trim() ? "try another spelling." : "check back once the bog fills up."}
				/>
			) : (
				rows.map((p, idx) => {
					const waitingInvite = waitingInviteByPlayer.get(p.id);
					const waiting = waitingInvite != null;
					const name = p.username ?? "this pig";
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
							disabled={busyId === waitingInvite}
							accessibilityLabel={`Take back the invite to ${name}`}
							accessibilityHint="Cancels the ask and frees the seat it was holding"
						>
							take it back
						</HandLink>
					) : seatsFull ? (
						<RowStatus>sounder full</RowStatus>
					) : (
						<SunPill
							onPress={() => inviteWithRecruiting(p.id)}
							disabled={busyId !== null}
							accessibilityLabel={`Invite ${name} and send the recruiting Oink`}
							accessibilityHint="Holds a seat on your banner until they answer"
						>
							{busyId === p.id ? "Inviting…" : "Invite + Oink"}
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
				})
			)}

			{!!note && <AccentNote style={styles.note}>{note}</AccentNote>}
		</Sheet>
	);
}

const styles = StyleSheet.create({
	note: { textAlign: "center", marginTop: SPACE.sm },
	recruitingCopy: { textAlign: "left", marginTop: SPACE.sm, marginBottom: SPACE.sm },
});

// Pass-the-crown sheet — leadership handoff behind Frame E of the
// invite-matchmaking mockup. The leader row wears the crown; each crewmate
// row carries a sun "Crown them" pill wired to transfer_crew_leadership.
// One tap crowns them ("the crown passes at once") and the old leader
// stays in the crew as a rider.

import { useState } from "react";
import { Text, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { CrewSheet } from "./CrewSheet";
import {
	AccentNote,
	CrewPortrait,
	CrewRow,
	DiscText,
	RowStatus,
	SunPill,
	theCrew,
} from "./CrewRow";
import { transferCrewLeadership } from "@/utils/mudWars";
import type { UseCrew } from "@/hooks/useCrew";
import { useRosterHats } from "@/hooks/useRosterHats";
import { SPACE, TYPE, WHIMSY } from "@/constants/theme";

export function TransferLeadershipSheet({
	visible,
	onDismiss,
	crewHook,
}: {
	visible: boolean;
	onDismiss: () => void;
	crewHook: UseCrew;
}) {
	const [busyId, setBusyId] = useState<string | null>(null);
	const [note, setNote] = useState<string | null>(null);

	const crewName = crewHook.crew.crew?.name ?? "Sounder";
	const leader = crewHook.crew.members.find((m) => m.role === "leader") ?? null;
	const riders = crewHook.crew.members.filter((m) => m.role !== "leader");
	// Match the Leaderboard/roster PigAvatar look — crew_state carries no hat.
	const rosterHats = useRosterHats(crewHook.crew.members.map((m) => m.user_id));

	const crownThem = async (userId: string) => {
		if (busyId) return;
		setBusyId(userId);
		setNote(null);
		const r = await transferCrewLeadership(userId);
		await crewHook.refresh();
		setBusyId(null);
		if (r.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
			onDismiss();
		} else {
			setNote(
				r.reason === "not_leader"
					? "Only the leader can hand off the crown."
					: "Couldn't hand off the crown — try again."
			);
		}
	};

	return (
		<CrewSheet
			visible={visible}
			onDismiss={onDismiss}
			title="Pass the crown"
			sub={`one pig wears it — hand ${theCrew(crewName)} to a crewmate`}
		>
			{leader && (
				<CrewRow
					left={<CrewPortrait crowned hatId={rosterHats.get(leader.user_id) ?? null} />}
					title={
						<>
							{leader.username ?? "Pig"} <DiscText>you</DiscText>
						</>
					}
					sub="wearing the crown now"
					right={<RowStatus accent>leader</RowStatus>}
				/>
			)}
			{riders.map((m) => (
				<CrewRow
					key={m.user_id}
					divider
					left={<CrewPortrait hatId={rosterHats.get(m.user_id) ?? null} />}
					title={m.username ?? "Pig"}
					sub="rides with you"
					right={
						<SunPill onPress={() => crownThem(m.user_id)} disabled={busyId !== null}>
							{busyId === m.user_id ? "Crowning…" : "Crown them"}
						</SunPill>
					}
				/>
			))}
			{!!note && <AccentNote style={styles.note}>{note}</AccentNote>}
			<Text style={styles.footer}>
				the crown passes at once — you stay in the crew as a rider.
			</Text>
		</CrewSheet>
	);
}

const styles = StyleSheet.create({
	note: { textAlign: "center", marginTop: SPACE.sm },
	footer: {
		...TYPE.hand,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: SPACE.md,
	},
});

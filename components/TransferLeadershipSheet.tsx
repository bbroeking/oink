// Pass-the-crown sheet — leadership handoff behind Frame E of the
// invite-matchmaking mockup. The leader row wears the crown; each crewmate
// row carries a sun "Crown them" pill wired to transfer_crew_leadership.
// The crown passes at once and the old leader stays in the crew as a rider.
//
// The handoff cannot be undone by the pill that performed it — only the NEW
// leader can pass it back — so it confirms first [B-03]. The tone is `warm`,
// not `destructive`: handing your crew to a friend is a generous act, not a
// shameful one, and the dialog says what it costs rather than scolding.

import { useState } from "react";
import { StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { Sheet } from "./ui/Sheet";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import {
	AccentNote,
	CrewPortrait,
	CrewRow,
	RowStatus,
	SunPill,
	theCrew,
} from "./ui";
import { transferCrewLeadership } from "@/utils/crews";
import type { UseCrew } from "@/hooks/useCrew";
import { useRosterProfiles } from "@/hooks/useRosterHats";
import { ProfileIdentity } from "./ui/ProfileIdentity";
import { Hand } from "./ui/Text";
import { SPACE } from "@/constants/theme";

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
	// The crewmate the leader has chosen but not yet confirmed.
	const [pending, setPending] = useState<{ id: string; name: string } | null>(null);

	const crewName = crewHook.crew.crew?.name ?? "Sounder";
	const leader = crewHook.crew.members.find((m) => m.role === "leader") ?? null;
	const riders = crewHook.crew.members.filter((m) => m.role !== "leader");
	// Match the Leaderboard/roster PigAvatar look — crew_state carries no hat.
	const rosterProfiles = useRosterProfiles(crewHook.crew.members.map((m) => m.user_id));

	const crownThem = async (userId: string) => {
		if (busyId) return;
		setBusyId(userId);
		setNote(null);
		const r = await transferCrewLeadership(userId);
		await crewHook.refresh();
		setBusyId(null);
		setPending(null);
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
		<Sheet
			open={visible}
			onClose={onDismiss}
			title="Pass the crown"
			subtitle={`one pig wears it — hand ${theCrew(crewName)} to a crewmate`}
			bottomInset="safe"
			footer={
				<Hand tone="secondary" align="center">
					the crown passes at once — you stay in the crew as a rider.
				</Hand>
			}
			overlay={
				// Presents INLINE, inside this sheet's own Modal — iOS will not
				// reliably present a nested native one.
				<ConfirmDialog
					open={pending !== null}
					presentation="inline"
					tone="warm"
					title={pending ? `Crown ${pending.name}?` : "Crown them?"}
					body={`The crown passes at once. ${pending?.name ?? "They"} lead ${theCrew(crewName)} from here; you stay on as a rider and can't take it back yourself.`}
					confirmLabel={pending ? `Crown ${pending.name}` : "Crown them"}
					confirmHint={`Makes ${pending?.name ?? "them"} leader right away. Only they can pass it back.`}
					cancelLabel="Keep it"
					cancelHint="Leaves the crown where it is"
					onConfirm={() => pending && crownThem(pending.id)}
					onCancel={() => setPending(null)}
					busy={busyId !== null}
				/>
			}
		>
			{leader && (
				<CrewRow
					left={
						<CrewPortrait
							crowned
							hatId={rosterProfiles.get(leader.user_id)?.hatId ?? null}
							bowId={rosterProfiles.get(leader.user_id)?.bowId ?? null}
							prestigeLevel={rosterProfiles.get(leader.user_id)?.wallowCount ?? 0}
						/>
					}
					title={leader.username ?? "Pig"}
					titleNode={
						<ProfileIdentity
							username={leader.username}
							title={rosterProfiles.get(leader.user_id)?.title}
							suffix="you"
						/>
					}
					sub="wearing the crown now"
					accessibilityLabel={`${leader.username ?? "Pig"}, you, wearing the crown now`}
					right={<RowStatus accent>leader</RowStatus>}
				/>
			)}
			{riders.map((m) => {
				const name = m.username ?? "Pig";
				return (
					<CrewRow
						key={m.user_id}
						divider
						left={
							<CrewPortrait
								hatId={rosterProfiles.get(m.user_id)?.hatId ?? null}
								bowId={rosterProfiles.get(m.user_id)?.bowId ?? null}
								prestigeLevel={rosterProfiles.get(m.user_id)?.wallowCount ?? 0}
							/>
						}
						title={name}
						titleNode={
							<ProfileIdentity
								username={m.username}
								title={rosterProfiles.get(m.user_id)?.title}
							/>
						}
						sub="rides with you"
						accessibilityLabel={`${name}, rides with you`}
						right={
							<SunPill
								onPress={() => setPending({ id: m.user_id, name })}
								disabled={busyId !== null}
								accessibilityLabel={`Crown ${name}`}
								accessibilityHint="Asks you to confirm before the crown passes"
							>
								{busyId === m.user_id ? "Crowning…" : "Crown them"}
							</SunPill>
						}
					/>
				);
			})}
			{!!note && <AccentNote style={styles.note}>{note}</AccentNote>}
		</Sheet>
	);
}

const styles = StyleSheet.create({
	note: { textAlign: "center", marginTop: SPACE.sm },
});

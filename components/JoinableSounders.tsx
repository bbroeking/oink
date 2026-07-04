// Joinable-Sounders list — the join-first path into a crew. Renders the
// open Sounders from useJoinableCrews (free slot, not mid-war) with a
// one-tap Join. Shared by the Season-2 stepper and the Friends-hub
// SounderCard; founding demotes to a secondary path beside this list.
//
// Renders nothing while empty — parents own the "no open Sounders" state
// (they show the founding form instead).

import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { Glyph } from "./ui/Glyph";
import type { UseCrew } from "@/hooks/useCrew";
import type { JoinableCrew } from "@/utils/mudWars";
import { CREW_CAP } from "@/constants/mudFights";
import { FONTS, RADII, SPACE, TYPE, WHIMSY } from "@/constants/theme";

function joinError(reason?: string): string {
	switch (reason) {
		case "crew_full":
			return "Just filled up — the bog moves fast.";
		case "crew_in_war":
			return "They're mid-war — catch them after.";
		case "already_in_crew":
			return "You're already in a Sounder.";
		default:
			return "Couldn't join — try another Sounder.";
	}
}

export function JoinableSounders({
	crews,
	crewHook,
	onStale,
}: {
	crews: JoinableCrew[];
	crewHook: UseCrew;
	/** A join failed because the list is out of date — re-fetch it. */
	onStale: () => void;
}) {
	const [busyId, setBusyId] = useState<string | null>(null);
	const [note, setNote] = useState<string | null>(null);

	const join = async (crew: JoinableCrew) => {
		if (busyId) return;
		setBusyId(crew.id);
		setNote(null);
		const r = await crewHook.join(crew.id);
		setBusyId(null);
		if (r.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
		} else {
			setNote(joinError(r.reason));
			onStale();
		}
	};

	if (crews.length === 0) return null;

	return (
		<View style={styles.wrap}>
			{crews.map((c) => (
				<View key={c.id} style={styles.row}>
					<Glyph name="friends" size={18} />
					<View style={styles.textCol}>
						<Text style={styles.name} numberOfLines={1}>
							{c.name}
						</Text>
						<Text style={styles.meta}>
							{c.memberCount} of {CREW_CAP} snouts
							{c.leaderName ? ` · ${c.leaderName}'s banner` : ""}
						</Text>
					</View>
					<Pressable
						onPress={() => join(c)}
						disabled={busyId !== null}
						style={[styles.joinBtn, busyId === c.id && styles.joinBtnBusy]}
						hitSlop={6}
					>
						<Text style={styles.joinBtnText}>
							{busyId === c.id ? "Joining…" : "Join"}
						</Text>
					</Pressable>
				</View>
			))}
			{!!note && <Text style={styles.note}>{note}</Text>}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { gap: SPACE.sm },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		backgroundColor: WHIMSY.cream2,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.sm,
	},
	textCol: { flex: 1, minWidth: 0 },
	name: { ...TYPE.bodySm, fontFamily: FONTS.bodyExtra, color: WHIMSY.ink },
	meta: { ...TYPE.kicker, fontFamily: FONTS.hand, color: WHIMSY.mute },
	joinBtn: {
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		paddingHorizontal: SPACE.md,
		paddingVertical: 5,
		minHeight: 32,
		justifyContent: "center",
	},
	joinBtnBusy: { opacity: 0.6 },
	joinBtnText: { fontFamily: FONTS.whimsy, fontSize: 13, color: WHIMSY.ink },
	note: {
		...TYPE.hand,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		textAlign: "center",
	},
});

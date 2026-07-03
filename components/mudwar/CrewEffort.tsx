// My clan's additive progress — one row per member, replacing the anonymous
// pips row. Every pig's solo effort (throws, runs, rootings) sums here; the
// row shows name · mud · a truffle dot when they dug the current feeding
// (windowDiggers — wired by the Truffle Patch hook once it lands) · the
// leader's crown. The QUIET PIG IS NEVER SHAMED: no red, no bold zero — a
// soft row and a gift-framed hand-line that later becomes the Cover
// affordance's mount point (idea A9; copy only for now).
// The crew's kept artifact (fort / stamp card) renders below via the
// `artifact` slot so the sum is VISIBLE, not just numeric.
// EXPORT-ONLY: mounted by app/mud-war.tsx (docs/mudwar-ui-integration.md).

import { type ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Glyph } from "@/components/ui/Glyph";
import { FONTS, SPACE, TYPE, WHIMSY } from "@/constants/theme";
import type { WarSideMember } from "@/utils/mudWars";

interface Props {
	members: WarSideMember[]; // server-sorted slings desc (war_side)
	myUserId?: string | null;
	leaderId?: string | null;
	windowDiggers?: string[]; // user_ids who rooted this feeding (Patch read)
	artifact?: ReactNode; // the kept crew artifact (fort stage / stamp card)
}

export function CrewEffort({ members, myUserId, leaderId, windowDiggers, artifact }: Props) {
	if (members.length === 0) return null;
	const quiet = members.filter((m) => m.slings === 0);

	return (
		<View style={styles.wrap}>
			<Text style={styles.heading}>The crew's pile</Text>
			{members.map((m) => {
				const isQuiet = m.slings === 0;
				const dug = windowDiggers?.includes(m.user_id);
				return (
					<View key={m.user_id} style={[styles.row, isQuiet && styles.rowQuiet]}>
						{leaderId && m.user_id === leaderId ? (
							<Glyph name="crown" size={14} />
						) : (
							<View style={styles.crownSpace} />
						)}
						<Text style={styles.name} numberOfLines={1}>
							{m.username ?? "a quiet pig"}
							{myUserId && m.user_id === myUserId ? " (you)" : ""}
						</Text>
						{dug && <View style={styles.truffleDot} />}
						{isQuiet ? (
							<Text style={styles.quietHint}>hasn't reached the bog yet</Text>
						) : (
							<Text style={styles.mud}>{m.slings}</Text>
						)}
					</View>
				);
			})}
			{quiet.length === 1 && quiet[0].username && (
				<Text style={styles.coverLine}>
					{quiet[0].username} hasn't rooted yet — cover their line?
				</Text>
			)}
			{artifact ? <View style={styles.artifact}>{artifact}</View> : null}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		backgroundColor: WHIMSY.paper,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 14,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.sm + 2,
		marginTop: SPACE.md,
	},
	heading: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		letterSpacing: 1.4,
		textTransform: "uppercase",
		color: WHIMSY.mute,
		marginBottom: SPACE.sm,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		paddingVertical: 3,
	},
	rowQuiet: { opacity: 0.6 },
	crownSpace: { width: 14 },
	name: { ...TYPE.body, color: WHIMSY.ink, flexShrink: 1 },
	truffleDot: {
		width: 10,
		height: 10,
		borderRadius: 5,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
	},
	mud: { ...TYPE.numeral, color: WHIMSY.ink, marginLeft: "auto" },
	quietHint: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		marginLeft: "auto",
	},
	coverLine: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.accent,
		textAlign: "center",
		marginTop: SPACE.xs,
	},
	artifact: { marginTop: SPACE.sm },
});

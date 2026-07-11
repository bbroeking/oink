// The tap-to-expand breakdown under the Mud Scuffle scoreboard. Tapping either
// per-pig tally reveals who's behind that number:
//   • YOUR herd  → one row per member (name · points · dug-in/quiet · crown),
//                  a per-point legend, and the cooperative "cover their line"
//                  nudge. The quiet pig is never shamed (soft row, gift line).
//   • THEIR herd → the house shows a LABELED synthetic pace (no pigs behind it,
//                  never fake names); a real rival shows a pace with its diggers
//                  fogged (the double-blind).
// A "dev data" tag pins to the panel whenever the __DEV__ override harness is
// driving fake numbers, so synthetic values can never read as a real scuffle.
// All copy comes from pure fns in warCopy.ts (unit-tested); this file is layout.
// EXPORT-ONLY: mounted by app/mud-war.tsx.

import { View, Text, Pressable, StyleSheet } from "react-native";
import { Glyph } from "@/components/ui/Glyph";
import { FONTS, RADII, SPACE, TYPE, WHIMSY } from "@/constants/theme";
import type { WarState } from "@/utils/mudWars";
import {
	memberBreakdown,
	activeCount,
	theirBreakdown,
	pointMetaLine,
	devDataTagLabel,
	scoringLinkLabel,
} from "./warCopy";

interface Props {
	side: "mine" | "them";
	war: Pick<WarState, "mine" | "them" | "isBotWar">;
	myUserId?: string | null;
	leaderId?: string | null;
	/** __DEV__ override harness is driving the displayed numbers. */
	devActive?: boolean;
	/** Open the explainer at its scoring section. */
	onScoringPress?: () => void;
}

export function ScoreboardBreakdown({
	side,
	war,
	myUserId,
	leaderId,
	devActive,
	onScoringPress,
}: Props) {
	return (
		<View style={styles.wrap}>
			{devActive ? (
				<View style={styles.devTag}>
					<Text style={styles.devTagText}>{devDataTagLabel()}</Text>
				</View>
			) : null}
			{side === "mine" ? (
				<MineBreakdown
					war={war}
					myUserId={myUserId}
					leaderId={leaderId}
				/>
			) : (
				<ThemBreakdown war={war} />
			)}
			<Pressable onPress={onScoringPress} hitSlop={8} style={styles.scoringLink}>
				<Text style={styles.scoringLinkText}>{scoringLinkLabel()}</Text>
			</Pressable>
		</View>
	);
}

// ── Your herd — the full roster, gift-framed ─────────────────────────────────
function MineBreakdown({
	war,
	myUserId,
	leaderId,
}: {
	war: Pick<Props["war"], "mine">;
	myUserId?: string | null;
	leaderId?: string | null;
}) {
	const rows = memberBreakdown(war.mine.members, myUserId, leaderId);
	const active = activeCount(war.mine.members);
	const quietOne = rows.filter((r) => r.state === "quiet");

	if (rows.length === 0) {
		return <Text style={styles.emptyLine}>No pigs on this side yet.</Text>;
	}

	return (
		<View>
			<Text style={styles.heading}>
				your herd · {active} of {rows.length} in the mud
			</Text>
			{rows.map((r) => (
				<View
					key={r.userId}
					style={[styles.row, r.state === "quiet" && styles.rowQuiet]}
				>
					{r.isLeader ? (
						<Glyph name="crown" size={14} />
					) : (
						<View style={styles.crownSpace} />
					)}
					<Text style={styles.name} numberOfLines={1}>
						{r.name}
						{r.isYou ? " (you)" : ""}
					</Text>
					{r.state === "quiet" ? (
						<Text style={styles.quietHint}>{r.note}</Text>
					) : (
						<Text style={styles.points}>{r.points}</Text>
					)}
				</View>
			))}
			<Text style={styles.meta}>{pointMetaLine()}</Text>
			{quietOne.length === 1 && quietOne[0].name !== "a quiet pig" ? (
				<Text style={styles.coverLine}>
					{quietOne[0].name} hasn't rooted yet — cover their line?
				</Text>
			) : null}
		</View>
	);
}

// ── Their side — synthetic pace (house) or fogged rival ──────────────────────
function ThemBreakdown({ war }: { war: Pick<Props["war"], "them" | "isBotWar"> }) {
	const b = theirBreakdown(war);
	if (b.kind === "synthetic") {
		return (
			<View>
				<Text style={styles.heading}>their herd</Text>
				<View style={styles.row}>
					<Glyph name="ghost" size={14} />
					<Text style={styles.name} numberOfLines={2}>
						{b.label}
					</Text>
					<Text style={styles.points}>{b.total}</Text>
				</View>
				<Text style={styles.meta}>
					A house pace — steady, synthetic, and no roster to read.
				</Text>
			</View>
		);
	}
	return (
		<View>
			<Text style={styles.heading}>their herd</Text>
			<View style={styles.row}>
				<Glyph name="friends" size={14} />
				<Text style={styles.name} numberOfLines={1}>
					{b.activeCount > 0
						? `${b.activeCount} ${b.activeCount === 1 ? "pig" : "pigs"} in the mud`
						: "nobody in the mud yet"}
				</Text>
				<Text style={styles.points}>{b.perCapita}</Text>
			</View>
			<Text style={styles.meta}>{b.note}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		backgroundColor: WHIMSY.paper,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.lg,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.sm + 2,
		marginTop: SPACE.sm,
	},
	devTag: {
		alignSelf: "flex-start",
		backgroundColor: WHIMSY.sun,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 999,
		paddingHorizontal: SPACE.sm,
		paddingVertical: 1,
		marginBottom: SPACE.xs,
	},
	devTagText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		letterSpacing: 1,
		textTransform: "uppercase",
		color: WHIMSY.ink,
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
	name: { ...TYPE.body, color: WHIMSY.ink, flexShrink: 1, flex: 1 },
	points: { ...TYPE.numeral, color: WHIMSY.ink, marginLeft: "auto" },
	quietHint: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		marginLeft: "auto",
	},
	meta: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		marginTop: SPACE.sm,
	},
	coverLine: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.accent,
		marginTop: SPACE.xs,
	},
	emptyLine: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
	},
	scoringLink: {
		alignSelf: "flex-start",
		marginTop: SPACE.sm,
	},
	scoringLinkText: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.accent,
		textDecorationLine: "underline",
	},
});

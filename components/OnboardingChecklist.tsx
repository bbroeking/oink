// First-Week Checklist ("Rosie's chores") — the cozy onboarding card.
//
// Renders the player's onboarding milestones (migration 20260649). On appear (and
// whenever `refreshKey` changes) it calls claim_onboarding() — the server grants
// any done-but-unclaimed milestone idempotently — then reads back fresh progress.
// Newly-claimed rows flash their reward; `onClaimed` lets the parent refresh the
// snout counter. Retires itself once every milestone is claimed, or when dismissed.
//
// Design: docs/wiki/onboarding-and-guidance.md (approach #3, the recommended spine).
import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Sticker } from "./ui/Sticker";
import { SnoutCoin } from "./ui/SnoutCoin";
import { FONTS, WHIMSY, SPACE, PAGE_PAD, RADII, KICKER_TEXT } from "@/constants/theme";
import {
	getOnboardingProgress,
	claimOnboarding,
	allOnboardingDone,
	type OnboardingMilestone,
} from "@/utils/onboarding";

interface Props {
	// Bump from the parent (e.g. after a tickle / visit / friend-add) to re-check.
	refreshKey?: number;
	// Fired when a claim granted snouts, so the parent can refresh its counter.
	onClaimed?: (snouts: number) => void;
}

export function OnboardingChecklist({ refreshKey = 0, onClaimed }: Props) {
	const [rows, setRows] = useState<OnboardingMilestone[] | null>(null);
	const [dismissed, setDismissed] = useState(false);
	// Ids granted on the most recent load — used to flash "+N" on those rows.
	const [justClaimed, setJustClaimed] = useState<Set<string>>(new Set());

	const load = useCallback(async () => {
		// Grant first (idempotent), then read back the fresh done/claimed state.
		const res = await claimOnboarding();
		if (res.ok && res.snouts_granted > 0) {
			setJustClaimed(new Set(res.claimed.map((c) => c.id)));
			onClaimed?.(res.snouts_granted);
		}
		setRows(await getOnboardingProgress());
	}, [onClaimed]);

	useEffect(() => {
		load();
	}, [load, refreshKey]);

	if (dismissed || !rows || rows.length === 0 || allOnboardingDone(rows)) {
		return null;
	}

	const doneCount = rows.filter((m) => m.claimed).length;

	return (
		<Sticker color="paper" rotate={-0.4} radius={18} style={styles.card}>
			<View style={styles.header}>
				<View style={{ flexShrink: 1 }}>
					<Text style={styles.kicker}>★ rosie's chores</Text>
					<Text style={styles.title}>Your first week</Text>
				</View>
				<View style={styles.progressPill}>
					<Text style={styles.progressText}>
						{doneCount}/{rows.length}
					</Text>
				</View>
				<Pressable onPress={() => setDismissed(true)} hitSlop={10} style={styles.close}>
					<Text style={styles.closeText}>✕</Text>
				</Pressable>
			</View>

			{rows === null ? (
				<ActivityIndicator color={WHIMSY.mute} style={{ marginVertical: 18 }} />
			) : (
				rows.map((m) => {
					const flashing = justClaimed.has(m.id);
					return (
						<View key={m.id} style={styles.row}>
							<View style={[styles.checkbox, m.claimed && styles.checkboxDone]}>
								<Text style={styles.checkMark}>{m.claimed ? "✓" : m.icon ?? ""}</Text>
							</View>
							<View style={{ flex: 1 }}>
								<Text style={[styles.rowName, m.claimed && styles.rowNameDone]}>
									{m.name}
								</Text>
								<Text style={styles.rowDesc} numberOfLines={1}>
									{m.description}
								</Text>
							</View>
							<View style={styles.reward}>
								{flashing && <Text style={styles.flash}>+{m.reward_snouts}</Text>}
								<SnoutCoin size={15} />
								<Text style={[styles.rewardNum, m.claimed && styles.rewardNumDone]}>
									{m.reward_snouts}
								</Text>
							</View>
						</View>
					);
				})
			)}
		</Sticker>
	);
}

const INK = WHIMSY.ink;
const styles = StyleSheet.create({
	// marginHorizontal matches the Barn content inset (PAGE_PAD) so the card
	// lines up with the stat cards / effects strip bands above it.
	card: { paddingHorizontal: 16, paddingVertical: 14, marginHorizontal: PAGE_PAD },
	header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
	kicker: {
		...KICKER_TEXT,
		marginBottom: 2,
	},
	title: { fontFamily: FONTS.whimsy, fontSize: 20, color: INK },
	progressPill: {
		borderWidth: 2,
		borderColor: INK,
		borderRadius: 999,
		backgroundColor: WHIMSY.sun,
		paddingHorizontal: 10,
		paddingVertical: 3,
	},
	progressText: { fontFamily: FONTS.whimsy, fontSize: 13, color: INK },
	close: { padding: 2 },
	closeText: { fontFamily: FONTS.body, fontSize: 16, color: WHIMSY.mute },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		paddingVertical: SPACE.sm,
		borderTopWidth: 1,
		borderTopColor: "rgba(42,31,21,0.08)",
	},
	checkbox: {
		width: 30,
		height: 30,
		borderRadius: RADII.sm,
		borderWidth: 2,
		borderColor: INK,
		backgroundColor: WHIMSY.cream,
		alignItems: "center",
		justifyContent: "center",
	},
	checkboxDone: { backgroundColor: WHIMSY.sage },
	checkMark: { fontSize: 15, color: INK },
	rowName: { fontFamily: FONTS.whimsy, fontSize: 15, color: INK },
	rowNameDone: { textDecorationLine: "line-through", color: WHIMSY.mute },
	rowDesc: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.mute, marginTop: 1 },
	reward: { flexDirection: "row", alignItems: "center", gap: 3 },
	rewardNum: { fontFamily: FONTS.whimsy, fontSize: 14, color: INK },
	rewardNumDone: { color: WHIMSY.mute, opacity: 0.6 },
	flash: { fontFamily: FONTS.whimsy, fontSize: 13, color: WHIMSY.roseDeep, marginRight: 2 },
});

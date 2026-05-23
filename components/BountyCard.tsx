// A single weekly-bounty row for the season-tab bounty board. Shows
// name, description, a progress bar, and a state-aware CTA: Claim
// (ready), Claimed (done), or the bare progress count (in progress).
import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "../utils/supabase";
import { SnoutCoin } from "./ui/SnoutCoin";
import { FONTS, WHIMSY } from "@/constants/theme";

export interface WeeklyBounty {
	code: string;
	name: string;
	description: string;
	goal: number;
	progress: number;
	reward_snouts: number;
	claimed: boolean;
}

interface Props {
	bounty: WeeklyBounty;
	tilt: number;
	// Fired after a successful claim so the board can refresh.
	onClaimed?: () => void;
}

export function BountyCard({ bounty, tilt, onClaimed }: Props) {
	const [busy, setBusy] = useState(false);
	const [feedback, setFeedback] = useState<string | null>(null);

	const ready = bounty.progress >= bounty.goal && !bounty.claimed;
	const pct = Math.min(100, Math.round((bounty.progress / bounty.goal) * 100));

	const claim = async () => {
		if (busy || !ready) return;
		setBusy(true);
		const { data } = await supabase.rpc("claim_bounty", {
			bounty_code: bounty.code,
		});
		const r = data as { ok?: boolean; reason?: string } | null;
		setBusy(false);
		if (r?.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
				() => {}
			);
			onClaimed?.();
		} else {
			setFeedback("Couldn't claim. Try again.");
		}
	};

	return (
		<View
			style={[
				styles.card,
				{ transform: [{ rotate: `${tilt}deg` }] },
				bounty.claimed && styles.cardClaimed,
			]}
		>
			<View style={styles.headerRow}>
				<Text style={styles.name} numberOfLines={1}>
					{bounty.name}
				</Text>
				<View style={styles.rewardChip}>
					<SnoutCoin size={13} />
					<Text style={styles.rewardText}>{bounty.reward_snouts}</Text>
				</View>
			</View>
			<Text style={styles.desc} numberOfLines={2}>
				{bounty.description}
			</Text>

			<View style={styles.progressRow}>
				<View style={styles.track}>
					<View style={[styles.fill, { width: `${pct}%` }]} />
				</View>
				<Text style={styles.count}>
					{Math.min(bounty.progress, bounty.goal)} / {bounty.goal}
				</Text>
			</View>

			{bounty.claimed ? (
				<View style={[styles.cta, styles.ctaClaimed]}>
					<Text style={styles.ctaClaimedText}>Claimed ✓</Text>
				</View>
			) : ready ? (
				<Pressable
					testID={`bounty-claim-${bounty.code}`}
					onPress={claim}
					disabled={busy}
					style={({ pressed }) => [
						styles.cta,
						styles.ctaReady,
						(pressed || busy) && { opacity: 0.7 },
					]}
				>
					<Text style={styles.ctaReadyText}>
						{busy ? "…" : "Claim reward"}
					</Text>
				</Pressable>
			) : (
				<View style={[styles.cta, styles.ctaProgress]}>
					<Text style={styles.ctaProgressText}>In progress</Text>
				</View>
			)}
			{!!feedback && <Text style={styles.feedback}>{feedback}</Text>}
		</View>
	);
}

const styles = StyleSheet.create({
	card: {
		backgroundColor: WHIMSY.paper,
		borderRadius: 14,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		padding: 12,
		marginVertical: 5,
	},
	cardClaimed: { opacity: 0.85 },
	headerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 8,
	},
	name: { fontFamily: FONTS.whimsy, fontSize: 17, color: WHIMSY.ink, flex: 1 },
	rewardChip: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		backgroundColor: WHIMSY.cream,
		borderRadius: 999,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		paddingHorizontal: 8,
		paddingVertical: 3,
	},
	rewardText: { fontFamily: FONTS.whimsy, fontSize: 13, color: WHIMSY.ink },
	desc: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		marginTop: 3,
		marginBottom: 10,
	},
	progressRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
	track: {
		flex: 1,
		height: 8,
		backgroundColor: WHIMSY.cream,
		borderRadius: 4,
		borderWidth: 1,
		borderColor: WHIMSY.ink,
		overflow: "hidden",
	},
	fill: { height: "100%", backgroundColor: WHIMSY.lilac },
	count: {
		fontFamily: FONTS.hand,
		fontSize: 11,
		color: WHIMSY.mute,
		minWidth: 42,
		textAlign: "right",
	},
	cta: {
		borderRadius: 12,
		paddingVertical: 9,
		alignItems: "center",
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	ctaReady: { backgroundColor: WHIMSY.sun },
	ctaReadyText: { fontFamily: FONTS.whimsy, fontSize: 14, color: WHIMSY.ink },
	ctaClaimed: { backgroundColor: WHIMSY.cream },
	ctaClaimedText: { fontFamily: FONTS.whimsy, fontSize: 14, color: WHIMSY.mute },
	ctaProgress: { backgroundColor: WHIMSY.paper },
	ctaProgressText: { fontFamily: FONTS.hand, fontSize: 13, color: WHIMSY.mute },
	feedback: {
		fontFamily: FONTS.hand,
		fontSize: 11,
		color: WHIMSY.accent,
		textAlign: "center",
		marginTop: 6,
	},
});

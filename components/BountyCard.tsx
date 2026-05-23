// A single weekly-bounty row for the season-tab bounty board. Shows
// a sun-tinted icon well + name + progress bar + reward, and a
// state-aware CTA: Claim (ready), Claimed (done), or … (in progress).
//
// Layout matches the redesign: row of [icon well 52×52, body grow,
// Claim button], with the progress bar above the count·reward line.
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

// Best-effort emoji per bounty type. The schema doesn't expose an
// icon field; derive from the bounty code so each card has a visual
// anchor in the icon well.
function bountyEmoji(code: string): string {
	const c = code.toLowerCase();
	if (c.includes("trade") || c.includes("fulfill") || c.includes("ask")) return "🤝";
	if (c.includes("bless") || c.includes("halo")) return "✦";
	if (c.includes("curse") || c.includes("itch")) return "☁";
	if (c.includes("tickle") || c.includes("tap")) return "♥";
	if (c.includes("friend") || c.includes("sounder")) return "🐷";
	if (c.includes("shop") || c.includes("buy") || c.includes("equip")) return "🎩";
	return "🎯";
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
			<View style={styles.row}>
				{/* Sun-tinted icon well — visual anchor at the left edge */}
				<View style={styles.iconWell}>
					<Text style={styles.iconGlyph}>{bountyEmoji(bounty.code)}</Text>
				</View>

				<View style={styles.body}>
					<Text style={styles.name} numberOfLines={2}>
						{bounty.name}
					</Text>

					{/* Progress bar — ink-bordered pill, sage when claimable */}
					<View style={styles.track}>
						<View
							style={[
								styles.fill,
								ready ? styles.fillReady : null,
								{ width: `${pct}%` },
							]}
						/>
					</View>

					{/* Meta line — N/G · | · 🪙 +R snouts */}
					<View style={styles.metaRow}>
						<Text style={styles.count}>
							{Math.min(bounty.progress, bounty.goal)}/{bounty.goal}
						</Text>
						<View style={styles.dot} />
						<View style={styles.rewardChip}>
							<SnoutCoin size={13} />
							<Text style={styles.rewardText}>
								+{bounty.reward_snouts} snouts
							</Text>
						</View>
					</View>
				</View>

				{/* State-aware CTA at the right */}
				{bounty.claimed ? (
					<View style={[styles.cta, styles.ctaClaimed]}>
						<Text style={styles.ctaClaimedText}>✓</Text>
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
							{busy ? "…" : "Claim"}
						</Text>
					</Pressable>
				) : (
					<View style={[styles.cta, styles.ctaProgress]}>
						<Text style={styles.ctaProgressText}>…</Text>
					</View>
				)}
			</View>

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
		padding: 14,
		marginVertical: 6,
		// Hard sticker drop shadow — matches Sticker primitive
		shadowColor: WHIMSY.ink,
		shadowOffset: { width: 3, height: 3 },
		shadowOpacity: 1,
		shadowRadius: 0,
		elevation: 3,
	},
	cardClaimed: { opacity: 0.78 },
	row: { flexDirection: "row", alignItems: "center", gap: 12 },
	iconWell: {
		width: 52,
		height: 52,
		borderRadius: 12,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
		alignItems: "center",
		justifyContent: "center",
		shadowColor: WHIMSY.ink,
		shadowOffset: { width: 1.5, height: 1.5 },
		shadowOpacity: 1,
		shadowRadius: 0,
		elevation: 2,
	},
	iconGlyph: { fontSize: 22 },
	body: { flex: 1, minWidth: 0 },
	name: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		lineHeight: 19,
		color: WHIMSY.ink,
	},
	track: {
		height: 14,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 999,
		backgroundColor: WHIMSY.paper,
		overflow: "hidden",
		marginTop: 6,
	},
	fill: {
		height: "100%",
		backgroundColor: WHIMSY.lilacDeep,
	},
	fillReady: {
		backgroundColor: WHIMSY.sage,
	},
	metaRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		marginTop: 6,
	},
	count: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 12,
		color: WHIMSY.mute,
	},
	dot: {
		width: 1,
		height: 10,
		backgroundColor: WHIMSY.muteSoft,
	},
	rewardChip: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
	},
	rewardText: { fontFamily: FONTS.bodyExtra, fontSize: 12, color: WHIMSY.ink },
	cta: {
		minWidth: 56,
		borderRadius: 999,
		paddingVertical: 8,
		paddingHorizontal: 12,
		alignItems: "center",
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		shadowColor: WHIMSY.ink,
		shadowOffset: { width: 2, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 0,
		elevation: 2,
	},
	ctaReady: { backgroundColor: WHIMSY.sun },
	ctaReadyText: { fontFamily: FONTS.bodyExtra, fontSize: 13, color: WHIMSY.ink },
	ctaClaimed: { backgroundColor: WHIMSY.sage, shadowOpacity: 0, elevation: 0 },
	ctaClaimedText: { fontFamily: FONTS.bodyExtra, fontSize: 14, color: WHIMSY.ink },
	ctaProgress: {
		backgroundColor: "transparent",
		borderColor: WHIMSY.muteSoft,
		shadowOpacity: 0,
		elevation: 0,
	},
	ctaProgressText: { fontFamily: FONTS.bodyExtra, fontSize: 13, color: WHIMSY.mute },
	feedback: {
		fontFamily: FONTS.hand,
		fontSize: 11,
		color: WHIMSY.accent,
		textAlign: "center",
		marginTop: 6,
	},
});

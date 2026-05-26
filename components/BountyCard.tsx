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
import { Icon, type IconName } from "./ui/Icon";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { FONTS, WHIMSY } from "@/constants/theme";

export interface WeeklyBounty {
	code: string;
	// Original rotation slot identity — immutable per week. Differs
	// from `code` when the user has rerolled this slot.
	slot_code: string;
	// True if the user has already used their one reroll on this
	// slot this week (the visible `code` is the replacement).
	rerolled: boolean;
	name: string;
	description: string;
	goal: number;
	progress: number;
	reward_snouts: number;
	claimed: boolean;
}

// Cost in snouts to swap a bounty you don't want. Server enforces
// this same value in reroll_bounty(); keep them in sync.
const REROLL_COST = 25;

interface Props {
	bounty: WeeklyBounty;
	tilt: number;
	// Fired after a successful claim so the board can refresh.
	onClaimed?: () => void;
}

// Best-effort visual per bounty type. The schema doesn't expose an
// icon field; derive from the bounty code so each card has an
// anchor in the icon well. Returns either an Icon name (for the
// glyphs that have SVG equivalents) or a typographic character
// (★ ✦ ♥ ☁ — print characters, not Unicode emojis).
type BountyVisual =
	| { kind: "icon"; name: IconName }
	| { kind: "char"; text: string };

function bountyVisual(code: string): BountyVisual {
	const c = code.toLowerCase();
	if (c.includes("trade") || c.includes("fulfill") || c.includes("ask"))
		return { kind: "icon", name: "handshake" };
	if (c.includes("bless") || c.includes("halo"))
		return { kind: "char", text: "✦" };
	if (c.includes("curse") || c.includes("itch"))
		return { kind: "char", text: "☁" };
	if (c.includes("tickle") || c.includes("tap"))
		return { kind: "char", text: "♥" };
	if (c.includes("friend") || c.includes("sounder"))
		return { kind: "icon", name: "pig" };
	if (c.includes("shop") || c.includes("buy") || c.includes("equip"))
		return { kind: "icon", name: "hat" };
	return { kind: "icon", name: "target" };
}

export function BountyCard({ bounty, tilt, onClaimed }: Props) {
	const [busy, setBusy] = useState(false);
	const [feedback, setFeedback] = useState<string | null>(null);

	const ready = bounty.progress >= bounty.goal && !bounty.claimed;
	const pct = Math.min(100, Math.round((bounty.progress / bounty.goal) * 100));

	// Reroll affordances: only shown for in-progress bounties that
	// haven't been rerolled yet this week. Ready / claimed / already-
	// rerolled bounties hide the option entirely.
	const canReroll = !bounty.claimed && !ready && !bounty.rerolled;
	const [confirmOpen, setConfirmOpen] = useState(false);

	const doReroll = async () => {
		setConfirmOpen(false);
		if (busy) return;
		setBusy(true);
		const { data } = await supabase.rpc("reroll_bounty", {
			bounty_code: bounty.code,
		});
		const r = data as { ok?: boolean; reason?: string } | null;
		setBusy(false);
		if (r?.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
				() => {}
			);
			onClaimed?.();
		} else if (r?.reason === "insufficient_snouts") {
			setFeedback(`Not enough snouts — reroll costs ${REROLL_COST}.`);
		} else if (r?.reason === "already_rerolled") {
			setFeedback("This slot's already been rerolled this week.");
		} else {
			setFeedback("Couldn't swap. Try again.");
		}
	};

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
					{(() => {
						const v = bountyVisual(bounty.code);
						return v.kind === "icon" ? (
							<Icon name={v.name} size={26} color={WHIMSY.ink} filled />
						) : (
							<Text style={styles.iconGlyph}>{v.text}</Text>
						);
					})()}
				</View>

				<View style={styles.body}>
					<Text style={styles.name} numberOfLines={2}>
						{bounty.name}
					</Text>

					{/* Server-side description — WHAT to do ("Fulfill 3
					    trade requests this week."). Was previously
					    in the data but never rendered, so players
					    only saw the cryptic title. */}
					{!!bounty.description && (
						<Text style={styles.description} numberOfLines={2}>
							{bounty.description}
						</Text>
					)}

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

					{/* Reroll pill — only on in-progress, not-yet-rerolled
					    bounties. Description above already tells you
					    WHAT to do; players can find their way to the
					    right tab. Earlier draft also rendered a how-to
					    hint + deep-link button, but that read too
					    heavy-handed against the card's small frame. */}
					{canReroll && (
						<View style={styles.rerollRow}>
							<Pressable
								onPress={() => setConfirmOpen(true)}
								disabled={busy}
								style={({ pressed }) => [
									styles.rerollBtn,
									(pressed || busy) && { opacity: 0.7 },
								]}
							>
								<Text style={styles.rerollBtnText}>
									{busy ? "…" : `Swap · ${REROLL_COST}`}
								</Text>
								<SnoutCoin size={11} />
							</Pressable>
						</View>
					)}
					{bounty.rerolled && !bounty.claimed && !ready && (
						<Text style={styles.rerolledTag}>
							★ swapped this week
						</Text>
					)}
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
			<ConfirmDialog
				open={confirmOpen}
				title="Swap this bounty?"
				body={`Replace "${bounty.name}" with a random one. Costs ${REROLL_COST} snouts; one swap per slot per week.`}
				confirmLabel={`Swap · ${REROLL_COST}`}
				confirmCoin
				onConfirm={doReroll}
				onCancel={() => setConfirmOpen(false)}
				busy={busy}
			/>
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
	// Server-side description (what to do) — sits directly under
	// the title in muted hand-script, so the title still leads but
	// the player immediately sees the requirement.
	description: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		lineHeight: 15,
		color: WHIMSY.mute,
		marginTop: 2,
	},
	// Reroll pill — right-aligned, small + muted so it doesn't
	// compete with the description text above. Carries its own
	// snout-coin badge so the cost reads at a glance.
	rerollRow: {
		flexDirection: "row",
		justifyContent: "flex-end",
		marginTop: 6,
	},
	rerollBtn: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		paddingHorizontal: 9,
		paddingVertical: 4,
		borderRadius: 999,
		borderWidth: 1.5,
		borderColor: WHIMSY.muteSoft,
		backgroundColor: "transparent",
	},
	rerollBtnText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		color: WHIMSY.mute,
	},
	// After-the-reroll receipt — replaces the pill once used.
	rerolledTag: {
		fontFamily: FONTS.hand,
		fontSize: 10,
		color: WHIMSY.mute,
		textAlign: "right",
		marginTop: 6,
		opacity: 0.8,
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

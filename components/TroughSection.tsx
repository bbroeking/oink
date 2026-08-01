// The Trough — friend-funded item drives, surfaced as a section in the Shop.
// Lists open Troughs from your Sounder (my_drives) and lets you chip in snouts
// toward a friend's item. Rewards credit immediately at donation time; funded
// drives show a receipt, never a manual claim button.
import { useEffect, useState } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { rpcAction } from "@/utils/rpc";
import {
	type TroughDrive as Drive,
	type TroughReceipt,
} from "@/hooks/useTroughDrives";
import { observeFieldGuide } from "@/utils/fieldGuide";
import { remainingMs } from "@/utils/duration";
import { HAT_IMAGES } from "@/constants/hats";
import { RADII, SHADOW_SM, SPACE, TYPE, WHIMSY } from "@/constants/theme";
import { SnoutCoin } from "./ui/SnoutCoin";
import { Glyph } from "./ui/Glyph";
import * as Haptics from "expo-haptics";

const PRESETS = [10, 25, 50];

function hoursLeft(iso: string): string {
	const ms = remainingMs(iso);
	if (ms <= 0) return "closing";
	const h = Math.floor(ms / 3_600_000);
	const m = Math.floor((ms % 3_600_000) / 60_000);
	return h > 0 ? `${h}h left` : `${m}m left`;
}

function donateError(reason: string | undefined, have?: number): string {
	switch (reason) {
		case "insufficient":
			return `Not enough snouts — you have ${have ?? 0}.`;
		case "donate_cooldown":
			return "You've chipped into this Trough recently — once per 12h per Trough.";
		case "donor_cap":
			return "You've filled your quarter — leave room for the rest of the sounder.";
		case "already_funded":
			return "Already funded!";
		case "drive_closed":
			return "This Trough has closed.";
		case "not_friends":
			return "Only the opener's Sounder can chip in.";
		default:
			return "Couldn't chip in. Try again.";
	}
}

export function TroughSection({
	data,
	onBalance,
}: {
	data: {
		drives: Drive[];
		claimable: TroughReceipt[];
		balance: number;
		donatedToday: boolean;
		loaded: boolean;
		refresh: () => Promise<unknown>;
	};
	onBalance?: (balance: number) => void;
}) {
	const {
		drives,
		claimable,
		balance,
		donatedToday,
		loaded,
		refresh: load,
	} = data;
	const [amounts, setAmounts] = useState<Record<string, number>>({});
	const [busy, setBusy] = useState<string | null>(null);
	const [note, setNote] = useState<Record<string, string>>({});

	useEffect(() => {
		if (!loaded) return;
		onBalance?.(balance);
	}, [balance, loaded, onBalance]);

	const donate = async (d: Drive, amt: number) => {
		if (busy || amt <= 0) return;
		setBusy(d.id);
		setNote((n) => ({ ...n, [d.id]: "" }));
		Haptics.selectionAsync().catch(() => {});
		const r = await rpcAction<{ reward?: number; funded?: boolean; xp?: number; have?: number }>(
			"donate_to_drive",
			{ drive_id: d.id, snouts: amt }
		);
		if (r.ok) {
			// Field Guide: your first donation meets the Trough page (fail-soft).
			observeFieldGuide("trough");
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
			setNote((n) => ({
				...n,
				[d.id]: r.funded
					? "Funded! You landed it for them."
					: "Chipped in! Thanks",
			}));
		} else {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
			setNote((n) => ({ ...n, [d.id]: donateError(r.reason, r.have) }));
		}
		await load();
		setBusy(null);
	};

	const nudge = async (d: Drive) => {
		if (busy) return;
		setBusy(d.id);
		setNote((n) => ({ ...n, [d.id]: "" }));
		Haptics.selectionAsync().catch(() => {});
		const r = await rpcAction<{ sent?: number }>("nudge_trough", { p_drive_id: d.id });
		if (r.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
			setNote((n) => ({
				...n,
				[d.id]: r.sent
					? `Asked ${r.sent} ${r.sent === 1 ? "friend" : "friends"} to chip in`
					: "No Sounder yet to ask.",
			}));
		} else {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
			setNote((n) => ({
				...n,
				[d.id]:
					r.reason === "nudge_cooldown"
						? "You asked recently — give it a few hours."
						: "Couldn't send the ask.",
			}));
		}
		setBusy(null);
	};

	if (drives.length === 0 && claimable.length === 0) return null;

	return (
		<View style={styles.wrap}>
			<View style={styles.explainer}>
				<Text style={styles.explainerTitle}>How the Trough works</Text>
				<Text style={styles.explainerBody}>
					Your Sounder pitches in snouts. When a Trough fills, the item lands
					with the friend who opened it.
				</Text>
			</View>

			{/* Funded-drive receipts — celebratory, no claim step (reward retired). */}
			{claimable.map((c) => (
				<View key={c.donation_id} style={styles.claimCard}>
					<Glyph name="pigface" size={16} />
					<Text style={styles.claimText}>
						You helped land the {c.item_name ?? c.item_id} — the herd came through!
					</Text>
				</View>
			))}

			{drives.map((d) => {
				const gap = d.target - d.raised;
				const pct = Math.min(1, d.raised / d.target);
				// Quarter cap (founder 2026-07-20): no pig funds more than 25%
				// of a Trough, cumulative. Fold the donor's remaining headroom
				// into every chip amount so the UI never offers — or labels a
				// button with — more than the server will actually take. Data's
				// already at hand (my_contribution, target); no extra fetch.
				const cap = Math.ceil(d.target * 0.25);
				const headroom = Math.max(0, cap - d.my_contribution);
				const effGap = Math.min(gap, headroom);
				const maxAmt = Math.min(effGap, balance);
				const sel = amounts[d.id] ?? 25;
				const amt = Math.min(sel, effGap);
				const canAfford = amt > 0 && amt <= balance;
				// Chip UI hides once you've filled your quarter (headroom 0),
				// even while the drive still has a gap for others to close.
				const open = !d.is_mine && gap > 0 && headroom > 0;

				// Reward caption: XP (first donation/day) + the small immediate
				// tickle thank-you configured by the current server function.
				const rewardBits: string[] = [];
				rewardBits.push("helps your Sounder land it");
				if (!donatedToday) rewardBits.push("+5 XP now");
				if (amt >= 100) rewardBits.push(`+${Math.floor(amt / 100)} tickle now`);

				return (
					<View key={d.id} style={styles.card}>
						<View style={styles.cardTop}>
							{HAT_IMAGES[d.item_id] ? (
								<Image
									source={HAT_IMAGES[d.item_id]}
									style={styles.itemImg}
									resizeMode="contain"
								/>
							) : (
								<View style={styles.itemImg} />
							)}
							<View style={{ flex: 1, minWidth: 0 }}>
								<Text style={styles.cardTitle} numberOfLines={1}>
									{d.is_mine
										? "Your Trough"
										: `${d.opener_name ?? "A friend"}'s Trough`}
								</Text>
								{d.item_name && (
									<Text style={styles.unlocking} numberOfLines={1}>
										Unlocking: {d.item_name}
									</Text>
								)}
								<Text style={styles.cardSub}>{hoursLeft(d.closes_at)}</Text>
							</View>
						</View>

						<View style={styles.track}>
							<View style={[styles.fill, { width: `${Math.round(pct * 100)}%` }]} />
						</View>
						<View style={styles.statRow}>
							<Text style={styles.raised}>
								{d.raised} / {d.target} snouts
							</Text>
							{gap > 0 && <Text style={styles.toGo}>{gap} to go</Text>}
						</View>

						{/* social proof — biggest nudge to chip in */}
						{(d.donor_count > 0 || d.my_contribution > 0) && (
							<View style={styles.socialRow}>
								<Glyph name="pigface" size={13} />
								<Text style={styles.social}>
									{d.donor_count > 0
										? `${d.donor_count} ${d.donor_count === 1 ? "friend" : "friends"} in`
										: "be the first to chip in"}
									{d.my_contribution > 0 && ` · you've chipped ${d.my_contribution}`}
								</Text>
							</View>
						)}

						{open && (
							<>
								<View style={styles.amountHeader}>
									<Text style={styles.amountLabel}>How much?</Text>
									<View style={styles.balanceTag}>
										<SnoutCoin size={12} />
										<Text style={styles.balanceText}>{balance}</Text>
									</View>
								</View>
								<View style={styles.presetRow}>
									{PRESETS.map((p) => {
										const v = Math.min(p, effGap);
										const on = amt === v;
										const afford = v <= balance && v > 0;
										return (
											<Pressable
												key={p}
												onPress={() => setAmounts((a) => ({ ...a, [d.id]: p }))}
												disabled={!afford}
												style={[
													styles.preset,
													on && styles.presetOn,
													!afford && { opacity: 0.4 },
												]}
											>
												<Text style={[styles.presetText, on && styles.presetTextOn]}>
													{p}
												</Text>
											</Pressable>
										);
									})}
									{maxAmt > 0 && (
										<Pressable
											onPress={() => setAmounts((a) => ({ ...a, [d.id]: maxAmt }))}
											style={[styles.preset, amt === maxAmt && styles.presetOn]}
										>
											<Text
												style={[
													styles.presetText,
													amt === maxAmt && styles.presetTextOn,
												]}
											>
												Max
											</Text>
										</Pressable>
									)}
								</View>

								<Pressable
									onPress={() => donate(d, amt)}
									disabled={!canAfford || busy === d.id}
									style={({ pressed }) => [
										styles.donateBtn,
										(pressed || !canAfford || busy === d.id) && { opacity: 0.7 },
									]}
								>
									<Text style={styles.donateBtnText}>
										{busy === d.id ? "…" : `Chip in ${amt}`}
									</Text>
								</Pressable>
								{rewardBits.length > 0 && (
									<Text style={styles.reward}>{rewardBits.join(" · ")}</Text>
								)}
							</>
						)}

						{/* your own Trough — ask your Sounder to help fill it */}
						{d.is_mine && gap > 0 && (
							<Pressable
								onPress={() => nudge(d)}
								disabled={busy === d.id}
								style={({ pressed }) => [
									styles.nudgeBtn,
									(pressed || busy === d.id) && { opacity: 0.7 },
								]}
							>
								<Glyph name="pigface" size={15} />
								<Text style={styles.nudgeBtnText}>
									{busy === d.id ? "asking…" : "Ask your Sounder to chip in"}
								</Text>
							</Pressable>
						)}

						{!!note[d.id] && <Text style={styles.note}>{note[d.id]}</Text>}
					</View>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { gap: SPACE.md },
	explainer: {
		gap: SPACE.xs,
		paddingBottom: SPACE.sm,
	},
	explainerTitle: {
		...TYPE.cardTitle,
		color: WHIMSY.ink,
	},
	explainerBody: {
		...TYPE.bodySm,
		color: WHIMSY.mute,
	},
	card: {
		gap: SPACE.sm,
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.lg,
		padding: SPACE.md,
		...SHADOW_SM,
	},
	cardTop: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	itemImg: { width: 44, height: 44 },
	cardTitle: { ...TYPE.cardTitle, color: WHIMSY.ink },
	unlocking: {
		...TYPE.label,
		color: WHIMSY.accent,
	},
	cardSub: { ...TYPE.kicker, color: WHIMSY.mute },
	track: {
		height: 14,
		borderRadius: RADII.pill,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream2,
		overflow: "hidden",
	},
	fill: { height: "100%", backgroundColor: WHIMSY.sun },
	statRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	raised: { ...TYPE.label, color: WHIMSY.mute },
	toGo: { ...TYPE.label, color: WHIMSY.ink },
	socialRow: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
	social: { ...TYPE.kicker, flex: 1, color: WHIMSY.ink },
	amountHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginTop: SPACE.xs,
	},
	amountLabel: { ...TYPE.label, color: WHIMSY.mute },
	balanceTag: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
	balanceText: { ...TYPE.label, color: WHIMSY.ink },
	presetRow: { flexDirection: "row", gap: SPACE.sm },
	preset: {
		flex: 1,
		minHeight: 44,
		justifyContent: "center",
		borderRadius: RADII.md,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream,
		alignItems: "center",
	},
	presetOn: { backgroundColor: WHIMSY.sun },
	presetText: { ...TYPE.label, color: WHIMSY.mute },
	presetTextOn: { color: WHIMSY.ink },
	donateBtn: {
		minHeight: 44,
		justifyContent: "center",
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		alignItems: "center",
	},
	donateBtnText: { ...TYPE.label, color: WHIMSY.ink },
	nudgeBtn: {
		minHeight: 44,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.sm,
		backgroundColor: WHIMSY.lilac,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		paddingHorizontal: SPACE.sm,
	},
	nudgeBtnText: { ...TYPE.label, color: WHIMSY.ink, textAlign: "center" },
	reward: {
		...TYPE.kicker,
		color: WHIMSY.ink,
		textAlign: "center",
	},
	note: {
		...TYPE.kicker,
		color: WHIMSY.mute,
		textAlign: "center",
	},
	claimCard: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		backgroundColor: WHIMSY.sage,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.lg,
		padding: SPACE.md,
	},
	claimText: { ...TYPE.bodySm, flex: 1, color: WHIMSY.ink },
});

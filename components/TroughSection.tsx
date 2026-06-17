// The Trough — friend-funded item drives, surfaced as a section in the Shop.
// Lists open Troughs from your Sounder (my_drives), lets you chip in snouts
// (10 snouts → 1 tickle, paid straight to snouts + tickles-earned/leaderboard
// when the drive funds — NOT the tap bank; see 20260628), and claim rewards from
// drives that funded. The card spells out what's being unlocked, who's chipped
// in, what you've put in, and what you get back (tickles when it lands + XP now).
import { useCallback, useRef, useState } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { rpc, rpcAction } from "@/utils/rpc";
import { HAT_IMAGES } from "@/constants/hats";
import { FONTS, WHIMSY } from "@/constants/theme";
import { SectionHeader } from "./ui";
import { SnoutCoin } from "./ui/SnoutCoin";
import { Glyph } from "./ui/Glyph";
import * as Haptics from "expo-haptics";

interface Drive {
	id: string;
	item_id: string;
	item_name: string | null;
	opener_id: string;
	opener_name: string | null;
	target: number;
	raised: number;
	status: string;
	closes_at: string;
	is_mine: boolean;
	donor_count: number;
	my_contribution: number;
}
interface Claimable {
	donation_id: string;
	drive_id: string;
	tickle_reward: number;
	item_id: string;
	item_name: string | null;
}

// Snouts → tickles: 10 to 1, rounding down. Mirrors donate_to_drive's
// floor(snouts/10). Paid out only when the drive funds.
const TICKLES_PER = (snouts: number) => Math.floor(snouts / 10);
const PRESETS = [10, 25, 50];

function hoursLeft(iso: string): string {
	const ms = new Date(iso).getTime() - Date.now();
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
	onBalance,
}: {
	// Reports every fresh server balance up to the host screen (the
	// Shop header chip). my_drives re-runs after each chip-in/claim, so
	// wiring this makes the chip update the moment snouts move instead
	// of waiting for the next focus refetch.
	onBalance?: (balance: number) => void;
} = {}) {
	const [drives, setDrives] = useState<Drive[]>([]);
	const [claimable, setClaimable] = useState<Claimable[]>([]);
	const [balance, setBalance] = useState(0);
	const [donatedToday, setDonatedToday] = useState(false);
	const [amounts, setAmounts] = useState<Record<string, number>>({});
	const [busy, setBusy] = useState<string | null>(null);
	const [note, setNote] = useState<Record<string, string>>({});

	// Ref so load()'s identity stays stable even if the parent passes
	// a fresh closure each render (it feeds a useFocusEffect).
	const onBalanceRef = useRef(onBalance);
	onBalanceRef.current = onBalance;

	const load = useCallback(async () => {
		const r = await rpc<{
			ok?: boolean;
			balance?: number;
			donated_today?: boolean;
			drives: Drive[];
			claimable: Claimable[];
		}>("my_drives");
		if (r?.ok) {
			setDrives(r.drives ?? []);
			setClaimable(r.claimable ?? []);
			setBalance(r.balance ?? 0);
			setDonatedToday(!!r.donated_today);
			if (typeof r.balance === "number") onBalanceRef.current?.(r.balance);
		}
	}, []);

	useFocusEffect(
		useCallback(() => {
			load();
		}, [load])
	);

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
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
			setNote((n) => ({
				...n,
				[d.id]: r.funded
					? "Funded! Claim your reward below."
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

	const claim = async (c: Claimable) => {
		if (busy) return;
		setBusy(c.donation_id);
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
		await rpc("claim_drive_reward", { donation_id: c.donation_id });
		await load();
		setBusy(null);
	};

	if (drives.length === 0 && claimable.length === 0) return null;

	return (
		<View style={styles.wrap}>
			<SectionHeader kicker="the trough" title="Group drives" ruleWidth={110} />

			{/* how it works — so the mechanic isn't a mystery */}
			<View style={styles.explainer}>
				<Text style={styles.explainerTitle}>How the Trough works</Text>
				<Text style={styles.explainerBody}>
					Open a drive for any shop item you want, and your Sounder pitches in
					snouts. When it fills, you get the item — and everyone who chipped in
					gets snouts & leaderboard score back, plus XP for helping.
				</Text>
			</View>

			{claimable.map((c) => (
				<View key={c.donation_id} style={styles.claimCard}>
					<Text style={styles.claimText}>
						You helped land the {c.item_name ?? c.item_id} — claim{" "}
						+{c.tickle_reward} snouts & score
					</Text>
					<Pressable
						onPress={() => claim(c)}
						style={({ pressed }) => [styles.claimBtn, pressed && { opacity: 0.7 }]}
					>
						<Text style={styles.claimBtnText}>
							{busy === c.donation_id ? "…" : "Claim"}
						</Text>
					</Pressable>
				</View>
			))}

			{drives.map((d) => {
				const gap = d.target - d.raised;
				const pct = Math.min(1, d.raised / d.target);
				const maxAmt = Math.min(gap, balance);
				const sel = amounts[d.id] ?? 25;
				const amt = Math.min(sel, gap);
				const canAfford = amt > 0 && amt <= balance;
				const tickles = TICKLES_PER(amt);
				const open = !d.is_mine && gap > 0;

				// Reward caption: tickles (when it lands) + XP (now, first/day).
				const rewardBits: string[] = [];
				if (tickles > 0) rewardBits.push(`+${tickles} snouts & score when it fills`);
				if (!donatedToday) rewardBits.push("+5 XP now");

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
										const v = Math.min(p, gap);
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
	wrap: { marginTop: 8 },
	explainer: {
		backgroundColor: WHIMSY.cream,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 12,
		padding: 10,
		marginBottom: 10,
	},
	explainerTitle: {
		fontFamily: FONTS.whimsy,
		fontSize: 13,
		color: WHIMSY.ink,
		marginBottom: 3,
	},
	explainerBody: {
		fontFamily: FONTS.hand,
		fontSize: 12.5,
		color: WHIMSY.mute,
		lineHeight: 17,
	},
	card: {
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 16,
		padding: 12,
		marginBottom: 10,
	},
	cardTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
	itemImg: { width: 44, height: 44 },
	cardTitle: { fontFamily: FONTS.whimsy, fontSize: 16, color: WHIMSY.ink },
	unlocking: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 12,
		color: WHIMSY.accent,
		marginTop: 1,
	},
	cardSub: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.mute, marginTop: 1 },
	track: {
		height: 14,
		borderRadius: 999,
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
		marginTop: 4,
	},
	raised: { fontFamily: FONTS.bodyExtra, fontSize: 11, color: WHIMSY.mute },
	toGo: { fontFamily: FONTS.bodyExtra, fontSize: 11, color: WHIMSY.ink },
	socialRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 7 },
	social: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.ink },
	amountHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginTop: 12,
		marginBottom: 6,
	},
	amountLabel: { fontFamily: FONTS.bodyExtra, fontSize: 11, color: WHIMSY.mute },
	balanceTag: { flexDirection: "row", alignItems: "center", gap: 4 },
	balanceText: { fontFamily: FONTS.bodyExtra, fontSize: 12, color: WHIMSY.ink },
	presetRow: { flexDirection: "row", gap: 7, marginBottom: 9 },
	preset: {
		flex: 1,
		paddingVertical: 7,
		borderRadius: 10,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream,
		alignItems: "center",
	},
	presetOn: { backgroundColor: WHIMSY.sun },
	presetText: { fontFamily: FONTS.whimsy, fontSize: 14, color: WHIMSY.mute },
	presetTextOn: { color: WHIMSY.ink },
	donateBtn: {
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 12,
		paddingVertical: 10,
		alignItems: "center",
	},
	donateBtnText: { fontFamily: FONTS.whimsy, fontSize: 15, color: WHIMSY.ink },
	nudgeBtn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
		marginTop: 10,
		backgroundColor: WHIMSY.lilac,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 12,
		paddingVertical: 9,
	},
	nudgeBtnText: { fontFamily: FONTS.whimsy, fontSize: 14, color: WHIMSY.ink },
	reward: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.ink,
		textAlign: "center",
		marginTop: 6,
	},
	note: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: 8,
	},
	claimCard: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		backgroundColor: WHIMSY.sage,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 14,
		padding: 10,
		marginBottom: 10,
	},
	claimText: { flex: 1, fontFamily: FONTS.hand, fontSize: 13, color: WHIMSY.ink },
	claimBtn: {
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 6,
	},
	claimBtnText: { fontFamily: FONTS.whimsy, fontSize: 14, color: WHIMSY.ink },
});

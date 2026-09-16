// The Trough — friend-funded item drives, surfaced as a section in the Shop.
// Lists open Troughs from your Sounder (my_drives) and lets you chip in snouts
// toward a friend's item. Rewards credit immediately at donation time; funded
// drives show a receipt, never a manual claim button.
//
// THE QUARTER RULE (2026-09-16, server 20260916120000). The old 1-tickle-per-
// 100-snouts thank-you is retired. A giver now earns once their CUMULATIVE
// contribution to a Trough (`my_contribution`) reaches the quarter cap the UI
// already clamps every chip against — and only the first time in an ISO week,
// across every Trough. The prize is one design from the week's featured
// collection (a tickle purse when they own the whole collection). The caption
// says which of those a chip is about to do; trough_reward_state() tells us
// whether the week's draw has already been taken.
import { useCallback, useEffect, useState } from "react";
import { View, Image, StyleSheet } from "react-native";
import { rpcAction } from "@/utils/rpc";
import { fetchTroughRewardState, parseBarnPrize } from "@/utils/barnDraw";
import {
	type TroughDrive as Drive,
	type TroughReceipt,
} from "@/hooks/useTroughDrives";
import { observeFieldGuide } from "@/utils/fieldGuide";
import { remainingMs } from "@/utils/duration";
import { HAT_IMAGES } from "@/constants/hats";
import { SPACE } from "@/constants/theme";
import {
	Button,
	CardTitle,
	Chip,
	Hand,
	Label,
	Glyph,
	ProgressTrack,
	SnoutCoin,
	Sticker,
	T,
} from "./ui";
import * as Haptics from "expo-haptics";

const PRESETS = [10, 25, 50];

// ── Drawing constants ───────────────────────────────────────────────────────
/** The item thumbnail on a drive card. */
const ITEM_ART = 44;
/** The pig mark on the social-proof row, and the bigger one on a receipt. */
const SOCIAL_MARK = 13;
const RECEIPT_MARK = 16;
/** The coin riding the balance readout. */
const COIN_MARK = 12;

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
	// Has this week's one giver reward already been drawn? Unknown (a pre-push
	// server, an offline read) reads as "not yet" — the caption then promises
	// the draw the server will honour or quietly skip, never a false denial.
	const [rewardTaken, setRewardTaken] = useState(false);

	const readRewardTaken = useCallback(async () => {
		const r = await fetchTroughRewardState();
		return r.ok ? r.state.taken : false;
	}, []);

	useEffect(() => {
		if (!loaded) return;
		onBalance?.(balance);
	}, [balance, loaded, onBalance]);

	useEffect(() => {
		let alive = true;
		readRewardTaken().then((taken) => {
			if (alive) setRewardTaken(taken);
		});
		return () => {
			alive = false;
		};
	}, [readRewardTaken]);

	const donate = async (d: Drive, amt: number) => {
		if (busy || amt <= 0) return;
		setBusy(d.id);
		setNote((n) => ({ ...n, [d.id]: "" }));
		Haptics.selectionAsync().catch(() => {});
		const r = await rpcAction<{
			reward?: unknown;
			funded?: boolean;
			xp?: number;
			have?: number;
			quarter_reached?: boolean;
			weekly_reward_taken?: boolean;
		}>("donate_to_drive", { drive_id: d.id, snouts: amt });
		if (r.ok) {
			// Field Guide: your first donation meets the Trough page (fail-soft).
			observeFieldGuide("trough");
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
			// The quarter's prize, when this chip crossed it. Anything else keeps
			// today's notes — a chip that only helps is still a good chip.
			const prize = parseBarnPrize(r.reward);
			setNote((n) => ({
				...n,
				[d.id]: prize
					? prize.kind === "habitat"
						? `Past a quarter! ${prize.itemName ?? "A new design"} is yours — hang it in the Barn.`
						: `Past a quarter! A purse of ${prize.amount} tickles.`
					: r.funded
						? "Funded! You landed it for them."
						: "Chipped in! Thanks",
			}));
			if (r.weekly_reward_taken === true || prize) setRewardTaken(true);
		} else {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
			setNote((n) => ({ ...n, [d.id]: donateError(r.reason, r.have) }));
		}
		await load();
		setRewardTaken(await readRewardTaken());
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
				<CardTitle>How the Trough works</CardTitle>
				<T role="bodySm" tone="secondary">
					Your Sounder pitches in snouts. When a Trough fills, the item lands
					with the friend who opened it.
				</T>
			</View>

			{/* Funded-drive receipts — celebratory, no claim step (reward retired). */}
			{claimable.map((c) => (
				<Sticker
					key={c.donation_id}
					color="sage"
					rotate={0}
					shadow="none"
					style={styles.claimCard}
				>
					<Glyph name="pigface" size={RECEIPT_MARK} />
					<T role="bodySm" style={styles.claimText}>
						You helped land the {c.item_name ?? c.item_id} — the herd came through!
					</T>
				</Sticker>
			))}

			{drives.map((d) => {
				const gap = d.target - d.raised;
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

				// Reward caption: XP (first donation/day) + the quarter rule. The
				// quarter is cumulative per drive, so it reads my_contribution,
				// not this one chip. One draw a week, whichever Trough earns it.
				const reachesQuarter = d.my_contribution + amt >= cap;
				const rewardBits: string[] = [];
				rewardBits.push("helps your Sounder land it");
				if (!donatedToday) rewardBits.push("+5 XP now");
				if (reachesQuarter) {
					rewardBits.push(
						rewardTaken
							? "you've had this week's draw"
							: "reaches a quarter · draws a Barn design",
					);
				}

				const troughName = d.is_mine
					? "Your Trough"
					: `${d.opener_name ?? "A friend"}'s Trough`;

				return (
					<Sticker key={d.id} rotate={0} shadow="sm" style={styles.card}>
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
							<View style={styles.cardTopText}>
								<CardTitle numberOfLines={1}>{troughName}</CardTitle>
								{d.item_name && (
									<Label tone="accent" numberOfLines={1}>
										Unlocking: {d.item_name}
									</Label>
								)}
								<Hand tone="secondary">{hoursLeft(d.closes_at)}</Hand>
							</View>
						</View>

						<ProgressTrack
							value={d.raised}
							max={d.target}
							tone="sun"
							accessibilityLabel={`${troughName}: ${d.raised} of ${d.target} snouts raised`}
						/>
						<View style={styles.statRow}>
							<Label tone="secondary">
								{d.raised} / {d.target} snouts
							</Label>
							{gap > 0 && <Label>{gap} to go</Label>}
						</View>

						{/* social proof — biggest nudge to chip in */}
						{(d.donor_count > 0 || d.my_contribution > 0) && (
							<View style={styles.socialRow}>
								<Glyph name="pigface" size={SOCIAL_MARK} />
								<T role="kicker" style={styles.social}>
									{d.donor_count > 0
										? `${d.donor_count} ${d.donor_count === 1 ? "friend" : "friends"} in`
										: "be the first to chip in"}
									{d.my_contribution > 0 && ` · you've chipped ${d.my_contribution}`}
								</T>
							</View>
						)}

						{open && (
							<>
								<View style={styles.amountHeader}>
									<Label tone="secondary">How much?</Label>
									<View style={styles.balanceTag}>
										<SnoutCoin size={COIN_MARK} />
										<Label>{balance}</Label>
									</View>
								</View>
								<View style={styles.presetRow}>
									{PRESETS.map((p) => {
										const v = Math.min(p, effGap);
										const on = amt === v;
										const afford = v <= balance && v > 0;
										return (
											<Chip
												key={p}
												label={String(p)}
												tone={on ? "sun" : "paper"}
												selected={on}
												disabled={!afford}
												onPress={() => setAmounts((a) => ({ ...a, [d.id]: p }))}
												accessibilityLabel={`Chip in ${p} snouts`}
												accessibilityHint={
													afford
														? `Sets the amount to ${p} snouts`
														: "More than you can give to this Trough right now"
												}
												style={styles.preset}
											/>
										);
									})}
									{maxAmt > 0 && (
										<Chip
											label="Max"
											tone={amt === maxAmt ? "sun" : "paper"}
											selected={amt === maxAmt}
											onPress={() =>
												setAmounts((a) => ({ ...a, [d.id]: maxAmt }))
											}
											accessibilityLabel={`Chip in the most you can, ${maxAmt} snouts`}
											accessibilityHint={`Sets the amount to ${maxAmt} snouts`}
											style={styles.preset}
										/>
									)}
								</View>

								{/* The spend. One primary button, wearing the cost on its
								    face and naming the consequence to a screen reader.
								    [D-04, D-09] (2026-09-11) */}
								<Button
									variant="gold"
									size="md"
									full
									icon={<SnoutCoin size={COIN_MARK} />}
									onPress={() => donate(d, amt)}
									disabled={!canAfford}
									loading={busy === d.id}
									accessibilityLabel={`Chip in ${amt} snouts`}
									accessibilityHint={
										canAfford
											? `Spends ${amt} snouts toward ${troughName}`
											: "You don't have enough snouts for this amount"
									}
								>
									Chip in {amt}
								</Button>
								{rewardBits.length > 0 && (
									<T role="kicker" align="center">
										{rewardBits.join(" · ")}
									</T>
								)}
							</>
						)}

						{/* your own Trough — ask your Sounder to help fill it */}
						{d.is_mine && gap > 0 && (
							<Button
								variant="lilac"
								size="md"
								full
								icon={<Glyph name="pigface" size={SOCIAL_MARK} />}
								onPress={() => nudge(d)}
								loading={busy === d.id}
								accessibilityLabel="Ask your Sounder to chip in"
								accessibilityHint="Sends one ask to your Sounder; you can ask again in a few hours"
							>
								Ask your Sounder to chip in
							</Button>
						)}

						{!!note[d.id] && (
							<T
								role="kicker"
								tone="secondary"
								align="center"
								accessibilityLiveRegion="polite"
							>
								{note[d.id]}
							</T>
						)}
					</Sticker>
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
	card: {
		gap: SPACE.sm,
		padding: SPACE.md,
	},
	cardTop: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	cardTopText: { flex: 1, minWidth: 0 },
	itemImg: { width: ITEM_ART, height: ITEM_ART },
	statRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	socialRow: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
	social: { flex: 1 },
	amountHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginTop: SPACE.xs,
	},
	balanceTag: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
	presetRow: { flexDirection: "row", gap: SPACE.sm },
	preset: { flex: 1 },
	claimCard: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		padding: SPACE.md,
	},
	claimText: { flex: 1 },
});

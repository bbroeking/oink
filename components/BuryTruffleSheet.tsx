// "Bury a truffle" — a bottom-sheet dialogue for staking snouts as a buried
// truffle on your own barn (10/20/50). It lives in a modal (opaque sheet) so it
// reads on ANY equipped background, unlike the old inline band. Opened from the
// truffle spot by the pig's feet. On a successful bury it fires onBuried (the
// parent plays the mound's dig animation + refreshes) and closes itself.
//
// Wave-4 conformance pass: the panel is the `Sheet` primitive, the stake grid is
// `Chip` (coin + a real selected state on `BORDER.heavy` rather than a sun fill,
// and an unaffordable chip keeps its shape instead of dissolving to 0.4), and
// the bury CTA is a `Button` in the pinned footer carrying its cost in the label
// and its consequence in the hint. [C-03, C-07, C-09, C-18]
import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { rpcAction } from "@/utils/rpc";
import { Button, Chip, Sheet, SnoutCoin, T } from "./ui";
import { SPACE } from "@/constants/theme";
import { maxBuryStake, MIN_STAKE } from "@/utils/burySnouts";
import { usePotStake } from "@/hooks/usePotStake";

// The two fixed chips; the third chip is "Max" (fills to the 50-snout pot cap,
// bounded by the host's balance — resolved live in maxBuryStake).
const FIXED_STAKES = [10, 20];

// Cap-height match for the footer button's label.
const COIN_SIZE = 14;

interface Props {
	open: boolean;
	balance: number; // live snout balance (profiles.counter) — bounds the "Max" chip
	onClose: () => void;
	onBuried: () => void; // fired after a fresh successful bury (parent animates + refreshes)
	onResynced?: () => void; // a truffle was already down — just resync, no celebration
}

export function BuryTruffleSheet({ open, balance, onClose, onBuried, onResynced }: Props) {
	// A chip is either a fixed amount or "max" (resolves to a concrete number
	// against the live balance) — the confirm button always restates the number.
	// The shared stake machine: floor = server min, ceiling = live balance, Max
	// fills to the pot cap bounded by balance (maxBuryStake).
	const { sel, select, busy, setBusy, note, setNote, stake, maxOk, canSubmit: canBury } =
		usePotStake({ defaultSel: 20, maxStake: maxBuryStake(balance), floor: MIN_STAKE, ceiling: balance });

	useEffect(() => {
		if (!open) return;
		setNote(null);
	}, [open]);

	if (!open) return null;

	const bury = async () => {
		if (busy) return;
		setBusy(true);
		setNote(null);
		// `next_at` rides only the reclaim_cooldown refusal (Partial<T> on failure).
		const r = await rpcAction<{ next_at?: string }>("bury_truffle", { p_amount: stake });
		setBusy(false);
		if (r.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
			onBuried();
			onClose();
		} else if (r.reason === "already_buried") {
			// A truffle's already down (e.g. buried on another device) — nothing was
			// staked, so don't play the fresh-bury celebration. Just resync + close
			// so the existing mound takes over.
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
			onResynced?.();
			onClose();
		} else if (r.reason === "too_poor") {
			setNote(`Need ${stake} snouts to bury this truffle.`);
		} else if (r.reason === "bad_amount") {
			// A new client can outrun the server: the range-relaxing migration
			// isn't pushed yet, so a Max amount off the old {10,20,50} whitelist
			// bounces. Nudge back to a set stake — ship order stays harmless.
			setNote("Couldn't bury that amount — pick a set stake for now.");
		} else if (r.reason === "reclaim_cooldown") {
			// Host dug up their own truffle — 12h settle before the next bury
			// (server-enforced; see 20260738400000_truffle_reclaim_cooldown).
			const nextAt = Date.parse(r.next_at ?? "");
			const hours = Number.isFinite(nextAt)
				? Math.max(1, Math.ceil((nextAt - Date.now()) / 3.6e6))
				: 12;
			setNote(
				`You dug this spot up yourself — the patch needs ${hours}h to settle before another bury.`
			);
		} else {
			// Transient network / SQL failure — keep the sheet open + retryable.
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
			setNote("Couldn't bury that truffle — try again in a moment.");
		}
	};

	return (
		<Sheet
			open={open}
			onClose={onClose}
			kicker="your truffle"
			title="Bury a truffle"
			testID="bury-truffle-sheet"
			footer={
				<Button
					full
					variant="gold"
					onPress={bury}
					disabled={!canBury}
					loading={busy}
					accessibilityLabel={`Bury for visitors · ${stake} snouts`}
					accessibilityHint="Stakes those snouts as a shared pot visitors can dig shares of"
					testID="bury-truffle-confirm"
				>
					<>
						{`Bury for visitors · ${stake} snouts`}
						<SnoutCoin size={COIN_SIZE} />
					</>
				</Button>
			}
		>
			<T role="body" tone="secondary" style={styles.blurb}>
				Leave a truffle on your barn for visitors. The stake becomes a shared pot
				— friends who drop by dig shares of it for snouts.
			</T>

			<T role="label" tone="secondary" style={styles.label}>
				Stake
			</T>
			<View style={styles.stakes} accessibilityRole="radiogroup">
				{FIXED_STAKES.map((s) => {
					const on = sel === s;
					const tooPoor = balance < s; // can't afford this chip
					return (
						<Chip
							key={s}
							label={`${s}`}
							coin
							tone={on ? "sun" : "paper"}
							selected={on}
							disabled={tooPoor}
							onPress={() => select(s)} // select clears any stale "need N snouts" note
							accessibilityLabel={`Stake ${s} snouts`}
							accessibilityHint={
								tooPoor
									? "You don't have that many snouts"
									: "Sets the pot this bury stakes"
							}
							testID={`bury-stake-${s}`}
							style={styles.chip}
						/>
					);
				})}
				{/* Max — fills to the 50-snout pot cap, bounded by balance; rests
				    below the server min stake. */}
				<Chip
					label="Max"
					coin
					tone={sel === "max" ? "sun" : "paper"}
					selected={sel === "max"}
					disabled={!maxOk}
					onPress={() => select("max")}
					accessibilityLabel={`Stake the most you can · ${maxBuryStake(balance)} snouts`}
					accessibilityHint={
						maxOk
							? "Fills the pot to its cap, bounded by your balance"
							: "You don't have enough snouts for a valid stake"
					}
					testID="bury-stake-max"
					style={styles.chip}
				/>
			</View>

			{note && (
				<T role="hand" tone="accent" align="center" style={styles.note}>
					{note}
				</T>
			)}
		</Sheet>
	);
}

const styles = StyleSheet.create({
	blurb: { marginBottom: SPACE.lg },
	label: { marginBottom: SPACE.sm },
	stakes: { flexDirection: "row", gap: SPACE.md },
	chip: { flex: 1 },
	note: { marginTop: SPACE.md },
});

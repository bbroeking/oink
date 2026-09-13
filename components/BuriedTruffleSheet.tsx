// "Check on your truffle" — a bottom sheet showing how much of your buried
// truffle is left and which visitors have been digging it up, plus two host
// actions: top up the pot, or dig it back up (reclaim the unspent remainder).
//
// Wave-4 conformance pass: the panel is the `Sheet` primitive, the pot meter is
// `ProgressTrack`, each digger is a `ListRow` with a coin `Tag`, the stake grid
// is `Chip` (selected = BORDER.heavy; an unaffordable chip keeps its shape), and
// both host actions are `Button`s in the pinned footer stating their cost and
// their consequence. Reclaiming — the irreversible, larger action — now goes
// through `ConfirmDialog` like every other currency-moving control, so the
// feature no longer teaches two confirmation grammars. [C-01, C-03, C-07, C-09,
// C-17, C-18, C-22]
//
// This is the ONE sheet in the area that is PopupQueue-slotted, so it takes the
// queue's `visible`/`open` split (PopupQueue.tsx, TIMING CONTRACT: the native
// Modal's `visible` drops the frame release() fires, the mount gate clears a
// POPUP_TEARDOWN_MS beat later) through `Sheet`'s `modalVisible`. The reclaim
// dialog presents INLINE, inside this sheet's own Modal — iOS will not reliably
// present a nested native one.
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { rpcAction } from "@/utils/rpc";
import {
	Button,
	Chip,
	ConfirmDialog,
	Divider,
	ListRow,
	ProgressTrack,
	Sheet,
	SnoutCoin,
	T,
	Tag,
} from "./ui";
import { SPACE } from "@/constants/theme";
import { maxTopUp, POT_CAP } from "@/utils/burySnouts";
import { usePotStake } from "@/hooks/usePotStake";
import type { TruffleStatus } from "@/hooks/useBuriedTruffle";

// The two fixed chips; the third chip is "Max" (tops the pot to the 50-snout
// cap, bounded by the host's balance — resolved live in maxTopUp).
const FIXED_STAKES = [10, 20];

// Cap-height match for the big pot numeral and for the footer button labels.
const POT_COIN = 22;
const BUTTON_COIN = 14;

interface Props {
	open: boolean;
	balance: number; // live snout balance (profiles.counter) — bounds the "Max" chip
	// Queue-slotted (id 'truffleSheet', pri 5). `open` is the MOUNT gate and
	// must stay true through the POPUP_TEARDOWN_MS beat so this native Modal
	// stays mounted while its dismissal runs (PopupQueue "keep it mounted"
	// contract); `visible` drives the native Modal's visible so release() hides
	// it the same frame. Defaults to `open` if omitted.
	visible?: boolean;
	onClose: () => void;
	status: TruffleStatus | null;
	onChanged?: () => void; // top-up landed — re-fetch status (sheet stays open)
}

// "just now" / "12m ago" / "3h ago" / "2d ago"
function ago(iso: string): string {
	const ms = Date.now() - new Date(iso).getTime();
	if (ms < 60_000) return "just now";
	const m = Math.floor(ms / 60_000);
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ago`;
	return `${Math.floor(h / 24)}d ago`;
}

export function BuriedTruffleSheet({ open, balance, visible, onClose, status, onChanged }: Props) {
	const [confirmReclaim, setConfirmReclaim] = useState(false);
	// Fires onClose exactly once per open-session so the two-phase teardown
	// below isn't re-triggered every render while `open` lingers through the beat.
	const closingRef = useRef(false);

	// A chip is either a fixed amount or "max" (resolves to a concrete number
	// against balance + headroom) — the top-up button always restates the number.
	// Computed null-safe so the shared stake hook can be called unconditionally
	// (before the not-buried early return); the values below are unused when the
	// sheet renders null. floor = 1 (any positive top-up), ceiling = whatever
	// fits both the pot's headroom and the live balance, Max = maxTopUp.
	const remaining = status?.buried ? status.remaining : 0;
	const headroom = POT_CAP - remaining; // how many more snouts fit (cap 50)
	const maxTop = maxTopUp(balance, remaining); // Max = min(balance, headroom)
	const { sel, select, busy, setBusy, note, setNote, stake: topUpStake, maxOk, canSubmit: canTopUp } =
		usePotStake({ defaultSel: 10, maxStake: maxTop, floor: 1, ceiling: Math.min(headroom, balance) });

	useEffect(() => {
		if (!open) return;
		setNote(null);
		setConfirmReclaim(false);
	}, [open]);

	// The slot (id 'truffleSheet', pri 5 — highest in the app) may never sit
	// PRESENTED while this sheet renders null: that wedges the queue and silently
	// suppresses every other popup for the session (issue #3). If we're open but
	// there's nothing buried to show — reclaimed / fully dug elsewhere, or a
	// fail-soft truffle_status fetch (useBuriedTruffle → buried:false on RPC
	// failure) — close quietly through the normal onClose so the slot releases.
	// onClose is two-phase (release() now, clears `open` a POPUP_TEARDOWN_MS beat
	// later); we DON'T cut `open` here same-frame. The ref latches it to one fire.
	useEffect(() => {
		if (!open) {
			closingRef.current = false;
			return;
		}
		if (!status?.buried && !closingRef.current) {
			closingRef.current = true;
			onClose();
		}
	}, [open, status?.buried, onClose]);

	if (!open || !status?.buried) return null;

	const dugTotal = status.total - status.remaining;

	const topUp = async () => {
		if (busy) return;
		setBusy(true);
		setNote(null);
		const r = await rpcAction("top_up_truffle", { p_amount: topUpStake });
		setBusy(false);
		if (r.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
			setNote(`Added ${topUpStake} to the pot.`);
			onChanged?.(); // re-fetch — the pot/bar update in place
		} else if (r.reason === "too_poor") {
			setNote(`Need ${topUpStake} snouts to top up.`);
		} else if (r.reason === "max_reached") {
			setNote(`The pot maxes out at ${POT_CAP} snouts.`);
		} else if (r.reason === "bad_amount") {
			// A new client can outrun the server: the range-relaxing migration
			// isn't pushed yet, so a Max amount off the old {10,20,50} whitelist
			// bounces. Nudge back to a set stake — ship order stays harmless.
			setNote("Couldn't add that amount — pick a set stake for now.");
		} else if (r.reason === "none") {
			// Truffle was reclaimed / fully dug elsewhere — nothing charged. Resync + close.
			onChanged?.();
			onClose();
		} else {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
			setNote("Couldn't top up — try again in a moment.");
		}
	};

	// Currency-moving and irreversible, so it asks through `ConfirmDialog` — the
	// one confirmation grammar this feature now speaks. [C-22]
	const askReclaim = () => {
		if (busy) return;
		setNote(null);
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
		setConfirmReclaim(true);
	};

	const reclaim = async () => {
		setConfirmReclaim(false);
		if (busy) return;
		setBusy(true);
		setNote(null);
		const r = await rpcAction("reclaim_truffle");
		setBusy(false);
		if (r.ok || r.reason === "none") {
			// none = already closed elsewhere; either way the truffle's gone.
			if (r.ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
			onChanged?.(); // status flips to not-buried; the bury spot returns
			onClose();
		} else {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
			setNote("Couldn't dig it back up — try again in a moment.");
		}
	};

	const footer = (
		<View style={styles.footer}>
			{headroom >= 1 && (
				<Button
					full
					variant="gold"
					onPress={topUp}
					disabled={!canTopUp}
					loading={busy}
					accessibilityLabel={`Top up · ${topUpStake} snouts`}
					accessibilityHint={`Adds ${topUpStake} snouts to the pot visitors dig from`}
					testID="truffle-top-up"
				>
					<>
						{`Top up · ${topUpStake} snouts`}
						<SnoutCoin size={BUTTON_COIN} />
					</>
				</Button>
			)}
			{/* Dig it back up — reclaim the unspent remainder + close the truffle.
			    The commit lives in the ConfirmDialog below. */}
			<Button
				full
				variant="ghost"
				onPress={askReclaim}
				disabled={busy}
				accessibilityLabel={`Dig it back up · refund ${status.remaining} snouts`}
				accessibilityHint="Asks to confirm, then closes the truffle and refunds the unspent pot"
				testID="truffle-reclaim"
			>
				{`Dig it back up · refund ${status.remaining}`}
			</Button>
		</View>
	);

	return (
		<Sheet
			open={open}
			onClose={onClose}
			// The queue's visible/open split: the native Modal hides the frame
			// release() fires, the mount gate clears a teardown beat later.
			modalVisible={visible ?? open}
			title="Your buried truffle"
			footer={footer}
			testID="buried-truffle-sheet"
			overlay={
				// Presents INLINE, inside this sheet's own Modal — iOS will not
				// reliably present a nested native one.
				<ConfirmDialog
					open={confirmReclaim}
					presentation="inline"
					tone="destructive"
					title="Dig it back up?"
					body={`Closes the truffle and refunds the ${status.remaining} snouts nobody dug. You can't bury another for 12h.`}
					confirmLabel={`Dig it up · ${status.remaining}`}
					confirmCoin
					confirmHint={`Refunds ${status.remaining} snouts and blocks a new bury for 12 hours. This cannot be undone.`}
					cancelHint="Leaves the truffle buried"
					onConfirm={reclaim}
					onCancel={() => setConfirmReclaim(false)}
					busy={busy}
				/>
			}
		>
			{/* remaining pot — one glanceable line + bar */}
			<View style={styles.potRow}>
				<SnoutCoin size={POT_COIN} />
				<T role="numeralLg">{status.remaining}</T>
				<T role="label" tone="secondary">
					of {status.total} snouts left
				</T>
			</View>
			<ProgressTrack
				value={status.remaining}
				max={status.total}
				tone="sun"
				height="sm"
				accessibilityLabel="Pot remaining"
				style={styles.track}
			/>
			<T role="hand" tone="secondary" style={styles.sub}>
				{dugTotal > 0
					? `Visitors have dug up ${dugTotal} snout${dugTotal === 1 ? "" : "s"} so far.`
					: "No one's dug it up yet — waiting for a visitor."}
			</T>

			{/* diggers — the receipt for the pot, one row each */}
			{status.diggers.length > 0 && (
				<View style={styles.list}>
					{status.diggers.map((d, i) => (
						<ListRow
							key={i}
							index={i}
							title={d.username}
							sub={ago(d.dug_at)}
							trailing={
								<Tag
									label={`+${d.amount}`}
									coin
									accessibilityLabel={`dug ${d.amount} snouts`}
								/>
							}
							accessibilityLabel={`${d.username} dug ${d.amount} snouts ${ago(d.dug_at)}`}
						/>
					))}
				</View>
			)}

			{/* Top up — add more snouts to the pot, capped at 50 */}
			<Divider space="lg" />
			{headroom < 1 ? (
				<T role="body" tone="secondary" align="center" style={styles.maxNote}>
					Pot&apos;s at the {POT_CAP}-snout max.
				</T>
			) : (
				<>
					<T role="label" tone="secondary" style={styles.actLabel}>
						Add to the pot · up to {POT_CAP}
					</T>
					<View style={styles.stakes} accessibilityRole="radiogroup">
						{FIXED_STAKES.map((s) => {
							const on = sel === s;
							const tooMuch = s > headroom || s > balance; // past the cap, or can't afford
							return (
								<Chip
									key={s}
									label={`${s}`}
									coin
									tone={on ? "sun" : "paper"}
									selected={on}
									disabled={tooMuch}
									onPress={() => select(s)} // select clears any stale note
									accessibilityLabel={`Add ${s} snouts`}
									accessibilityHint={
										tooMuch
											? "That would pass the pot cap, or you can't afford it"
											: "Sets how much the top-up adds"
									}
									testID={`truffle-topup-${s}`}
									style={styles.chip}
								/>
							);
						})}
						{/* Max — tops the pot to exactly 50, bounded by balance; rests
						    when there's nothing to add. */}
						<Chip
							label="Max"
							coin
							tone={sel === "max" ? "sun" : "paper"}
							selected={sel === "max"}
							disabled={!maxOk}
							onPress={() => select("max")}
							accessibilityLabel={`Add the most you can · ${maxTop} snouts`}
							accessibilityHint={
								maxOk
									? "Fills the pot to its cap, bounded by your balance"
									: "There's nothing left to add"
							}
							testID="truffle-topup-max"
							style={styles.chip}
						/>
					</View>
				</>
			)}

			{note && (
				<T role="hand" tone="accent" align="center" style={styles.note}>
					{note}
				</T>
			)}
		</Sheet>
	);
}

const styles = StyleSheet.create({
	potRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	track: { marginTop: SPACE.sm },
	sub: { marginTop: SPACE.sm },

	list: { marginTop: SPACE.lg, gap: SPACE.sm },

	actLabel: { marginBottom: SPACE.sm },
	stakes: { flexDirection: "row", gap: SPACE.md },
	chip: { flex: 1 },

	maxNote: { paddingVertical: SPACE.xs },
	note: { marginTop: SPACE.md },

	footer: { gap: SPACE.sm },
});

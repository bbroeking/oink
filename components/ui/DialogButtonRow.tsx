// DialogButtonRow — the confirm/cancel pair every decision dialog wears.
//
// Four copies of this row existed (ConfirmDialog, CleanseModal,
// AlignmentSchismModal, the paid-rename dialog), each with its own gap, its own
// radius and its own idea of which side "yes" lives on. The ruling:
//
//   · CANCEL is on the LEFT and is a ghost — the quiet way out is never the
//     loudest thing in the dialog;
//   · CONFIRM is on the RIGHT and carries the weight (purple for a warm
//     decision, the destructive ramp for an irreversible one);
//   · both are `flex: 1` so the pair reads as one balanced bar, never as a
//     wide primary next to a squeezed "no".
//
// A control that spends states its cost on its own face: `confirmCoin` renders
// a SnoutCoin after the label, inline with it.

import { StyleSheet, View } from "react-native";
import { SPACE } from "@/constants/theme";
import { Button } from "./Button";
import { SnoutCoin } from "./SnoutCoin";

// The coin sits INSIDE the label text so it wraps and centers with it. 13pt is
// the cap-height match for the md button's label.
const COIN_SIZE = 13;

export type DialogTone = "warm" | "destructive";

interface Props {
	confirmLabel: string;
	cancelLabel?: string;
	onConfirm: () => void;
	onCancel: () => void;
	tone?: DialogTone;
	busy?: boolean;
	confirmCoin?: boolean;
	confirmDisabled?: boolean;
	/**
	 * Spoken consequence of confirming ("Spends 5 snouts and lifts every
	 * curse"). A spend/cast dialog must name it (spec §3.5, audit A-05); the
	 * generic fallback is for dialogs whose label already says everything.
	 */
	confirmHint?: string;
	cancelHint?: string;
}

export function DialogButtonRow({
	confirmLabel,
	cancelLabel = "Not now",
	onConfirm,
	onCancel,
	tone = "warm",
	busy,
	confirmCoin,
	confirmDisabled,
	confirmHint,
	cancelHint,
}: Props) {
	const confirmVariant = tone === "destructive" ? "destructive" : "purple";
	const working = !!busy;

	return (
		<View style={styles.row}>
			<Button
				variant="ghost"
				style={styles.half}
				onPress={onCancel}
				disabled={working}
				accessibilityLabel={cancelLabel}
				accessibilityHint={cancelHint ?? "Closes this dialog without changing anything"}
				accessibilityState={{ disabled: working }}
				testID="dialog-cancel"
			>
				{cancelLabel}
			</Button>
			<Button
				variant={confirmVariant}
				style={styles.half}
				onPress={onConfirm}
				loading={working}
				disabled={!!confirmDisabled}
				accessibilityLabel={confirmLabel}
				accessibilityHint={
					confirmHint ??
					(tone === "destructive"
						? "This cannot be undone"
						: "Confirms this choice")
				}
				testID="dialog-confirm"
			>
				<>
					{confirmLabel}
					{confirmCoin ? <SnoutCoin size={COIN_SIZE} /> : null}
				</>
			</Button>
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignSelf: "stretch",
		gap: SPACE.sm,
	},
	half: {
		flex: 1,
	},
});

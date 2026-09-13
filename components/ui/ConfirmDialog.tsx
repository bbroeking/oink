// Reusable confirm-spend dialog matching the storybook UI.
//
// Replaces React Native's bare Alert.alert for in-app actions that cost snouts
// or are otherwise irreversible. The system Alert is jarring inside the
// paper-sticker / ink-border world the rest of the app lives in.
//
// Rebuilt (design-system spec §2, row 05) as the three pieces it always was:
//   AdaptiveModalScaffold (safe-area-aware frame, fade, scroll path, the a11y
//   modal flags) + a paper `Sticker` + `DialogButtonRow`. It no longer hand-rolls
//   a Modal, a backdrop, a card or a button pair.
//
// API mirrors Alert.alert's mental model:
//   <ConfirmDialog
//      open={open}
//      title="Swap this bounty?"
//      body="Replace 'Generous Hoof' with a random one."
//      confirmLabel="Swap · 25"
//      confirmCoin              // optional: render a SnoutCoin after the label
//      onConfirm={...}
//      onCancel={...}
//   />

import React from "react";
import { StyleSheet, View } from "react-native";
import { RADII, SPACE, STICKER_SHADOW, TILT } from "@/constants/theme";
import { AdaptiveModalScaffold } from "./AdaptiveModalScaffold";
import { DialogButtonRow, type DialogTone } from "./DialogButtonRow";
import { Sticker } from "./Sticker";
import { BodySm, CardTitle } from "./Text";

interface Props {
	open: boolean;
	// PopupQueue consumers only: decouples the NATIVE modal's `visible` from
	// `open` (the mount gate). When this dialog is queue-slotted, `open` must
	// stay true through the POPUP_TEARDOWN_MS beat so the modal stays MOUNTED
	// while its native dismissal runs (PopupQueue TIMING CONTRACT: "keep it
	// mounted"), but `visible` must drop to false the same frame release() is
	// called. Pass `visible={slot.visible}` + a teardown-deferred `open` clear.
	// Direct-tap callers omit it: `visible` defaults to `open`, so mount ==
	// visible and nothing changes for them.
	visible?: boolean;
	title: string;
	body?: string;
	confirmLabel: string;
	confirmCoin?: boolean;
	cancelLabel?: string;
	// The decision's weight. `warm` is the default spend/choice; `destructive`
	// paints the confirm on the irreversible ramp and says so in its hint.
	tone?: DialogTone;
	onConfirm: () => void;
	onCancel: () => void;
	busy?: boolean;
	// Spoken consequence of confirming / cancelling (spec §3.5): a spend or
	// reclaim dialog names what happens. Forwarded to DialogButtonRow.
	confirmHint?: string;
	cancelHint?: string;
	// "inline" for a dialog that opens from inside another native Modal (a
	// reclaim confirm over a sheet). Forwarded to AdaptiveModalScaffold.
	presentation?: "native" | "inline";
}

export function ConfirmDialog({
	open,
	visible,
	title,
	body,
	confirmLabel,
	confirmCoin,
	cancelLabel = "Cancel",
	tone = "warm",
	onConfirm,
	onCancel,
	busy,
	confirmHint,
	cancelHint,
	presentation = "native",
}: Props) {
	if (!open) return null;
	// visible defaults to open (direct-tap callers). Queue consumers pass a
	// slot-driven visible so release() hides the native modal a beat before
	// `open` unmounts it.
	const nativeVisible = visible ?? open;

	return (
		<AdaptiveModalScaffold
			visible={nativeVisible}
			onRequestClose={onCancel}
			animationType="fade"
			bare
			presentation={presentation}
			testID="confirm-dialog"
			contentContainerStyle={styles.content}
		>
			<Sticker
				color="paper"
				rotate={TILT.dialog}
				radius={RADII.xl}
				style={[styles.card, STICKER_SHADOW]}
			>
				<CardTitle accessibilityRole="header" align="center">
					{title}
				</CardTitle>
				{!!body && (
					<BodySm tone="secondary" align="center" style={styles.body}>
						{body}
					</BodySm>
				)}
				<View style={styles.buttons}>
					<DialogButtonRow
						confirmLabel={confirmLabel}
						cancelLabel={cancelLabel}
						onConfirm={onConfirm}
						onCancel={onCancel}
						tone={tone}
						busy={busy}
						confirmCoin={confirmCoin}
						confirmHint={confirmHint}
						cancelHint={cancelHint}
					/>
				</View>
			</Sticker>
		</AdaptiveModalScaffold>
	);
}

const styles = StyleSheet.create({
	content: {
		// The sticker tilts and wears the hard 4,4 shadow; give both room inside
		// the (bare, overflow-visible) scaffold frame.
		padding: SPACE.sm,
	},
	card: {
		padding: SPACE.card,
		alignItems: "center",
	},
	body: {
		marginTop: SPACE.sm,
	},
	buttons: {
		alignSelf: "stretch",
		marginTop: SPACE.lg,
	},
});

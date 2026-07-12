// Reusable confirm-spend dialog matching the storybook UI.
//
// Replaces React Native's bare Alert.alert for in-app actions that
// cost snouts or are otherwise irreversible. The system Alert is
// jarring inside the paper-sticker / ink-border world the rest of
// the app lives in; this component carries the same paper tilt +
// shadow + button shape as CleanseModal / AlignmentSchismModal.
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
import {
	Modal,
	View,
	Text,
	Pressable,
	StyleSheet,
} from "react-native";
import { Sticker } from "./Sticker";
import { SnoutCoin } from "./SnoutCoin";
import {
	FONTS,
	MODAL_BACKDROP_BG,
	STICKER_SHADOW,
	WHIMSY,
} from "@/constants/theme";

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
	// Optional destructive flag — paints confirm in the accent
	// (rose-deep) instead of the standard lilac, for permanent
	// deletes etc. Not used by the default snout-spend path.
	destructive?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
	busy?: boolean;
}

export function ConfirmDialog({
	open,
	visible,
	title,
	body,
	confirmLabel,
	confirmCoin,
	cancelLabel = "Cancel",
	destructive,
	onConfirm,
	onCancel,
	busy,
}: Props) {
	if (!open) return null;
	// visible defaults to open (direct-tap callers). Queue consumers pass a
	// slot-driven visible so release() hides the native modal a beat before
	// `open` unmounts it.
	const nativeVisible = visible ?? open;
	return (
		<Modal
			visible={nativeVisible}
			transparent
			animationType="fade"
			onRequestClose={onCancel}
		>
			<Pressable style={styles.backdrop} onPress={onCancel}>
				<Pressable style={styles.cardWrap} onPress={() => {}}>
					<Sticker
						color="paper"
						rotate={-0.8}
						radius={18}
						style={[styles.card, STICKER_SHADOW]}
					>
						<Text style={styles.title}>{title}</Text>
						{!!body && <Text style={styles.body}>{body}</Text>}
						<View style={styles.btnRow}>
							<Pressable
								onPress={onCancel}
								disabled={busy}
								style={({ pressed }) => [
									styles.btn,
									styles.btnGhost,
									pressed && { opacity: 0.7 },
								]}
							>
								<Text style={styles.btnGhostText}>{cancelLabel}</Text>
							</Pressable>
							<Pressable
								onPress={onConfirm}
								disabled={busy}
								style={({ pressed }) => [
									styles.btn,
									destructive ? styles.btnDestructive : styles.btnConfirm,
									(pressed || busy) && { opacity: 0.7 },
								]}
							>
								<View style={styles.btnInner}>
									<Text
										style={
											destructive
												? styles.btnDestructiveText
												: styles.btnConfirmText
										}
									>
										{busy ? "…" : confirmLabel}
									</Text>
									{!busy && confirmCoin && <SnoutCoin size={13} />}
								</View>
							</Pressable>
						</View>
					</Sticker>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: MODAL_BACKDROP_BG,
		padding: 28,
	},
	cardWrap: { width: "100%", maxWidth: 340 },
	card: { paddingHorizontal: 22, paddingVertical: 20, alignItems: "center" },
	title: {
		fontFamily: FONTS.whimsy,
		fontSize: 20,
		color: WHIMSY.ink,
		textAlign: "center",
		marginBottom: 8,
	},
	body: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		lineHeight: 19,
		color: WHIMSY.ink,
		textAlign: "center",
		marginBottom: 18,
		opacity: 0.85,
	},
	btnRow: {
		flexDirection: "row",
		gap: 10,
		alignSelf: "stretch",
	},
	btn: {
		flex: 1,
		paddingHorizontal: 14,
		paddingVertical: 11,
		borderRadius: 12,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	btnGhost: {
		backgroundColor: "transparent",
		borderColor: WHIMSY.muteSoft,
	},
	btnGhostText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 14,
		color: WHIMSY.mute,
	},
	btnConfirm: { backgroundColor: WHIMSY.lilac },
	btnConfirmText: { fontFamily: FONTS.whimsy, fontSize: 15, color: WHIMSY.ink },
	btnDestructive: { backgroundColor: WHIMSY.rose },
	btnDestructiveText: {
		fontFamily: FONTS.whimsy,
		fontSize: 15,
		color: WHIMSY.ink,
	},
	btnInner: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
});

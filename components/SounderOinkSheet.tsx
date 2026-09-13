import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Sheet } from "./ui/Sheet";
import { Button } from "./ui/Button";
import { EmptyState, LoadingBeat } from "./ui/EmptyState";
import { T } from "./ui/Text";
import {
	SOUNDER_COORDINATION_PRESETS,
	fetchSounderMessageState,
	sendSounderCoordination,
	type SounderCoordinationPreset,
	type SounderMessageState,
} from "@/utils/sounderMessages";
import {
	BORDER,
	DISABLED,
	DISABLED_TEXT,
	FONTS,
	PRESSED,
	RADII,
	SHADOW_SM,
	SPACE,
	WHIMSY,
} from "@/constants/theme";

function failureCopy(reason?: string): string {
	switch (reason) {
		case "already_sent":
			return "That Oink already went out this Feeding.";
		case "patch_closed":
			return "That Oink only makes sense while the Patch is open.";
		case "bonus_condition_not_met":
			return "That bonus Oink unlocks only when exactly one pig has dug.";
		case "no_digs_yet":
			return "Save the fine-digging Oink until somebody has dug.";
		case "no_recipients":
			return "No other unblocked crewmates can receive this Oink yet.";
		case "no_crew":
			return "Join a Sounder before you Oink the herd.";
		default:
			return "That Oink didn't leave the barn. Try again.";
	}
}

function unavailableCopy(preset: SounderCoordinationPreset): string {
	if (preset === "one_more_bonus") return "available when exactly one pig has dug";
	if (preset === "fine_digging") return "available after the first dig";
	return "available while the Patch is open";
}

export function SounderOinkSheet({
	visible,
	onDismiss,
}: {
	visible: boolean;
	onDismiss: () => void;
}) {
	const [state, setState] = useState<SounderMessageState | null>(null);
	const [loading, setLoading] = useState(false);
	const [busy, setBusy] = useState<SounderCoordinationPreset | null>(null);
	const [note, setNote] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setState(await fetchSounderMessageState());
		setLoading(false);
	}, []);

	useEffect(() => {
		if (!visible) return;
		load();
	}, [visible, load]);

	function close() {
		setNote(null);
		onDismiss();
	}

	async function send(preset: SounderCoordinationPreset) {
		if (busy) return;
		setBusy(preset);
		setNote(null);
		const result = await sendSounderCoordination(preset);
		setBusy(null);
		if (!result.ok) {
			setNote(failureCopy(result.reason));
			await load();
			return;
		}
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
		setNote(`Oinked ${result.recipients} ${result.recipients === 1 ? "pig" : "pigs"}.`);
		await load();
	}

	return (
		<Sheet
			open={visible}
			onClose={close}
			title="Oink the Sounder"
			subtitle="preset notes only · one of each per Feeding"
			closeLabel="Done"
			footer={
				<Button variant="handLink" full onPress={close} accessibilityHint="Closes the Oink list">
					Done
				</Button>
			}
		>
			{loading && !state ? (
				<LoadingBeat label="listening for the herd" />
			) : !state ? (
				// A null read is "we don't know", not "there's nothing" [B-14].
				<EmptyState
					kind="error"
					sub="Couldn't read this Feeding."
					action={
						<Button
							variant="ghost"
							size="sm"
							onPress={() => void load()}
							accessibilityHint="Asks the herd again"
						>
							Try again
						</Button>
					}
				/>
			) : (
				SOUNDER_COORDINATION_PRESETS.map((preset) => {
					const sent = state.sent_presets.includes(preset.id);
					const available = state.available[preset.id] === true;
					const disabled = sent || !available || busy !== null;
					const status = sent
						? "sent this Feeding"
						: available
							? "ready to send"
							: unavailableCopy(preset.id);
					return (
						<Pressable
							key={preset.id}
							onPress={() => send(preset.id)}
							disabled={disabled}
							accessibilityRole="button"
							accessibilityLabel={`Oink: ${preset.body}`}
							accessibilityHint={
								sent
									? "Already sent this Feeding"
									: available
										? "Sends this note to every crewmate — one of each per Feeding"
										: status
							}
							accessibilityState={{ disabled }}
							style={({ pressed }) => [
								styles.message,
								disabled && styles.messageDisabled,
								!disabled && pressed && PRESSED,
							]}
						>
							<View style={styles.messageBody}>
								<T role="bodySm" style={disabled ? DISABLED_TEXT : undefined}>
									{preset.body}
								</T>
								<T role="kicker" tone={disabled ? "disabled" : "secondary"} style={styles.status}>
									{status}
								</T>
							</View>
							<T
								role="bodySm"
								tone={disabled ? "disabled" : "accent"}
								style={styles.sendLabel}
							>
								{busy === preset.id ? "Oinking…" : sent ? "Sent" : "Oink"}
							</T>
						</Pressable>
					);
				})
			)}

			{!!note && (
				<T role="bodySm" tone="accent" align="center" style={styles.note}>
					{note}
				</T>
			)}
		</Sheet>
	);
}

const styles = StyleSheet.create({
	message: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		backgroundColor: WHIMSY.cream,
		borderWidth: BORDER.thin,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.sm,
		marginBottom: SPACE.sm,
		...SHADOW_SM,
	},
	messageBody: { flex: 1, minWidth: 0 },
	// "A button, asleep": the fill mutes and the outline stays. No opacity
	// crush — an unavailable Oink is still a readable Oink. [B-08]
	messageDisabled: { ...DISABLED, shadowOpacity: 0, elevation: 0 },
	status: { marginTop: SPACE.xxs },
	sendLabel: { fontFamily: FONTS.display },
	note: { marginTop: SPACE.xs },
});

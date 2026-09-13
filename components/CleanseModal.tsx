// Cleanse. Shows the caller's active curses and confirms spending
// 5 snouts to wipe them all. Pure UI — the mutation lives in the
// useActiveEffects hook; this modal awaits its onConfirm result and
// renders the success/failure UX (haptics, dismiss, feedback line).
//
// Rebuilt on the dialog primitives (design-system spec §2 row 05): the raw
// `Modal` + hand-rolled backdrop + hand-rolled button pair are now
// `AdaptiveModalScaffold` (safe-area frame, fade, scroll path, the a11y modal
// flags) + a paper `Sticker` + `DialogButtonRow`. Not `ConfirmDialog`, because
// the decision is not title-and-body: the player has to SEE which curses are on
// them before spending, so the list is the body.
//
// Audit A-05: this is a spend path. The confirm carries the number on its face
// and a SnoutCoin beside it, names the cost in its accessibility label and the
// consequence in its hint, and reports `busy` as a disabled state instead of
// dissolving to `opacity: 0.7` (A-15).
import React, { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { DialogButtonRow } from "./ui/DialogButtonRow";
import { AdaptiveModalScaffold } from "./ui/AdaptiveModalScaffold";
import { Sticker } from "./ui/Sticker";
import { Hand, Kicker, SectionTitle, T } from "./ui/Text";
import { CURSE_META, type CurseKind, type RitualMeta } from "../utils/rituals";
import { type Effect } from "../utils/activeEffects";
import { type CleanseResult } from "../hooks/useActiveEffects";
import { useUnmanagedModalHold } from "./ui/PopupQueue";
import {
	BORDER,
	RADII,
	SPACE,
	STICKER_SHADOW,
	TILT,
	WHIMSY,
} from "@/constants/theme";

// What a cleanse costs — on the button's face, and again in its label.
const CLEANSE_COST = 5;
// The ritual art inside a curse row. A drawing constant, not spacing: it is the
// size the 32px icon assets were cut at.
const CURSE_ICON = 32;

interface Props {
	curses: Effect[];
	onDismiss: () => void;
	// Fires the mutation. Returns the RPC result so the modal can
	// render success/failure UX without owning the Supabase call.
	onConfirm: () => Promise<CleanseResult>;
}

export function CleanseModal({ curses, onDismiss, onConfirm }: Props) {
	// Unmanaged native Modal (mounted only while open, from HoofprintsSheet or the
	// Inbox's ActiveEffects strip): hold the queue for its lifetime so a foreground
	// poll can't present a queued popup over it — the #50152 wedge (issue #4).
	// (The HoofprintsSheet parent already holds; this refcounts harmlessly and also
	// covers the ActiveEffects path, which has no outer hold.)
	useUnmanagedModalHold(true);
	const [busy, setBusy] = useState(false);
	const [feedback, setFeedback] = useState<string | null>(null);

	const onPress = async () => {
		if (busy) return;
		setBusy(true);
		const r = await onConfirm();
		setBusy(false);
		if (r.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
				() => {}
			);
			onDismiss();
		} else if (r.reason === "insufficient_snouts") {
			setFeedback("Not enough snouts — you need 5.");
		} else {
			setFeedback("Couldn't cleanse. Try again.");
		}
	};

	const headline =
		curses.length === 1
			? "A curse clings to you"
			: `${curses.length} curses cling to you`;

	return (
		<AdaptiveModalScaffold
			visible
			onRequestClose={onDismiss}
			animationType="fade"
			bare
			testID="cleanse-modal"
			contentContainerStyle={styles.content}
		>
			<Sticker
				color="paper"
				rotate={TILT.dialog}
				radius={RADII.xl}
				style={[styles.card, STICKER_SHADOW]}
			>
				<Kicker align="center" style={styles.kicker}>
					you&apos;ve been cursed
				</Kicker>
				<SectionTitle accessibilityRole="header" align="center">
					{headline}
				</SectionTitle>

				<View style={styles.list}>
					{curses.map((c, i) => {
						// Raw server string → the lookup can miss; annotated so the
						// `meta?.` guards below stay type-enforced.
						const meta: RitualMeta | undefined = CURSE_META[c.kind as CurseKind];
						return (
							<Sticker
								key={i}
								color={WHIMSY.curseSurface}
								rotate={0}
								radius={RADII.md}
								border={BORDER.thin}
								shadow="none"
								style={styles.curseRow}
							>
								{meta ? (
									<Image source={meta.icon} style={styles.curseIcon} />
								) : (
									<View style={styles.curseIcon} />
								)}
								<View style={styles.curseText}>
									<T role="cardTitleSm">{meta?.name ?? c.kind}</T>
									{!!meta?.blurb && <Hand>{meta.blurb}</Hand>}
								</View>
							</Sticker>
						);
					})}
				</View>

				<View style={styles.buttons}>
					<DialogButtonRow
						confirmLabel={`Cleanse for ${CLEANSE_COST}`}
						confirmCoin
						confirmHint={`Spends ${CLEANSE_COST} snouts and lifts every curse on you.`}
						cancelLabel="Wait it out"
						cancelHint="Keeps the curses and closes."
						onConfirm={onPress}
						onCancel={onDismiss}
						busy={busy}
					/>
				</View>
				{!!feedback && (
					<Hand tone="accent" align="center" style={styles.feedback}>
						{feedback}
					</Hand>
				)}
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
		padding: SPACE.xl,
		alignItems: "center",
	},
	kicker: {
		marginBottom: SPACE.sm,
	},
	list: {
		width: "100%",
		gap: SPACE.sm,
		marginTop: SPACE.card,
		marginBottom: SPACE.lg,
	},
	curseRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		padding: SPACE.sm,
	},
	curseIcon: {
		width: CURSE_ICON,
		height: CURSE_ICON,
		resizeMode: "contain",
	},
	curseText: {
		flex: 1,
		minWidth: 0,
	},
	buttons: {
		alignSelf: "stretch",
	},
	feedback: {
		marginTop: SPACE.sm,
	},
});

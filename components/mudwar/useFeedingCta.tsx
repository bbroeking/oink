// The feeding dig hook — the 8h dig heartbeat entry point.
//
// `useFeedingCta` is the reusable core: it owns the current-feeding countdown,
// the "already rooted" state, and the Truffle Patch modal (open/submit) — so any
// surface can render its OWN trigger (a Button, a line) and drop the returned
// `modal` element beside it. The SounderHomeCard consumes the hook directly for
// its play/cooldown line.
//
// Digging is crew-gated and purely co-op vs the Great Hungerer: one rooting per
// member per feeding; a missed feeding costs nothing and is never displayed as a
// loss (gift-not-guilt).

import { ReactNode, useEffect, useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { useRooting } from "@/hooks/useRooting";
import {
	nextOpenCountdown,
	patchPhaseOpen,
	phaseClosesCountdown,
} from "@/utils/rooting";
import { TrufflePatch } from "./TrufflePatch";
import {
	FONTS,
	WHIMSY,
	SPACE,
	RADII,
	SHADOW_SM,
	MODAL_BACKDROP_BG,
} from "@/constants/theme";

export interface FeedingCta {
	/** True once the caller has rooted this feeding window. */
	dugThisWindow: boolean;
	/** True when the caller has no Sounder (digging is crew-gated). */
	noCrew: boolean;
	/** True while the patch is diggable (first 4h of the window); GUARDED after. */
	phaseOpen: boolean;
	/**
	 * The live line for the current state:
	 *  open + not dug → time until the patch closes;
	 *  otherwise      → time until the patch next opens.
	 */
	countdown: string;
	/** A gentle inline note after a failed open (already rooted / no crew / retry). */
	note: string | null;
	/** Open the Truffle Patch dig for this feeding. */
	start: () => Promise<void>;
	/**
	 * Open a PRACTICE dig — a fresh board that mints nothing (the onboarding
	 * "taste"). Crewless players use this to try the dig before joining; the
	 * season-tab onboarding card calls it directly. Ignores the phase gate.
	 */
	openPractice: () => void;
	/** DEV-ONLY alias of openPractice for testing outside onboarding. */
	startPractice?: () => void;
	/** The dig modal — render it once beside whatever trigger you show. */
	modal: ReactNode;
}

function ctaClock() {
	const open = patchPhaseOpen();
	return {
		phaseOpen: open,
		countdown: open ? phaseClosesCountdown() : nextOpenCountdown(),
	};
}

export function useFeedingCta(onDug?: () => void): FeedingCta {
	const { session, dugThisWindow, noCrew, open, openPractice, submit, clear } =
		useRooting();
	const [note, setNote] = useState<string | null>(null);
	const [clock, setClock] = useState(ctaClock);

	useEffect(() => {
		const t = setInterval(() => setClock(ctaClock()), 15000);
		return () => clearInterval(t);
	}, []);

	const start = async () => {
		setNote(null);
		Haptics.selectionAsync().catch(() => {});
		const r = await open();
		if (!r.ok) {
			setNote(
				r.reason === "already_rooted"
					? "You rooted this feeding — he gorges again soon."
					: r.reason === "no_crew"
					? "join a Sounder to dig for keeps — or try a practice dig first."
					: r.reason === "patch_closed"
					? `He's guarding the patch — it opens in ${nextOpenCountdown()}.`
					: "The patch is being stubborn — try again."
			);
		}
	};

	const { phaseOpen, countdown } = clock;

	const modal = (
		<Modal visible={!!session} transparent animationType="fade" onRequestClose={clear}>
			<View style={styles.backdrop}>
				<View style={styles.modalBody}>
					{/* Leave without submitting — the session keeps its seed
					    server-side, so coming back this feeding resumes the
					    same board. Rendered as a paper sticker-chip (not bare
					    underlined text) so the safe-to-leave affordance is
					    unmissable; the explainer says the board is kept. */}
					<Pressable
						onPress={clear}
						style={({ pressed }) => [
							styles.dismissChip,
							pressed && { opacity: 0.7 },
						]}
						hitSlop={8}
					>
						<Text style={styles.dismissText}>leave it for now ›</Text>
					</Pressable>
					{session && (
						<TrufflePatch
							session={session}
							onSubmit={async (finds, actions, missed) => {
								const r = await submit(finds, actions, missed);
								if (r.ok && r.outcome && !r.outcome.practice) onDug?.();
								return r.ok ? r.outcome : null;
							}}
							onClose={clear}
							phaseOpen={clock.phaseOpen}
						/>
					)}
				</View>
			</View>
		</Modal>
	);

	return {
		dugThisWindow,
		noCrew,
		phaseOpen,
		countdown,
		note,
		start,
		// The onboarding "taste": crewless players can practice-dig before joining.
		openPractice: () => {
			Haptics.selectionAsync().catch(() => {});
			openPractice();
		},
		// Dev escape hatch for testing the dig outside the 4h open band.
		startPractice: __DEV__ ? () => openPractice() : undefined,
		modal,
	};
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		backgroundColor: MODAL_BACKDROP_BG,
		justifyContent: "center",
		padding: SPACE.lg,
	},
	modalBody: { width: "100%" },
	// A paper sticker-chip in the same corner — ink border + hard offset shadow,
	// so "you can safely leave" reads as a real, tappable control.
	dismissChip: {
		alignSelf: "flex-end",
		marginBottom: SPACE.sm,
		backgroundColor: WHIMSY.paper,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.sm,
		paddingHorizontal: SPACE.sm,
		paddingVertical: 4,
		...SHADOW_SM,
	},
	dismissText: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.ink,
	},
});

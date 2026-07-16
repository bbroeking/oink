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
import { AppState, View, Text, Pressable, Modal, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { useRooting } from "@/hooks/useRooting";
import {
	nextOpenCountdown,
	patchPhaseOpen,
	phaseClosesCountdown,
} from "@/utils/rooting";
import {
	hydrateFeedingScheduleCache,
	refreshFeedingSchedule,
} from "@/utils/feedingConfig";
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
	 * The live countdown for the current PHASE (never the dug state):
	 *  open    → time until the patch closes;
	 *  guarded → time until the patch next opens.
	 * PAIRING RULE: never print this under "opens in" copy while the phase is
	 * open — it's a closes-in then (the founder's wrong-number bug). The banner
	 * footer reads bannerDigStatus (utils/rooting), which derives the words and
	 * the number together from the phase.
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
	const {
		session,
		dugThisWindow,
		noCrew,
		open,
		openPractice,
		submit,
		clear,
		reconcile,
	} = useRooting();
	const [note, setNote] = useState<string | null>(null);
	const [clock, setClock] = useState(ctaClock);

	useEffect(() => {
		const t = setInterval(() => setClock(ctaClock()), 15000);
		return () => clearInterval(t);
	}, []);

	// Server-authoritative schedule sync: cache-hydrate then fetch on mount
	// (the founder's "schedule changes propagate without a binary"). A confirmed
	// CHANGE re-derives the clock this frame and reconciles the dug state — a
	// re-anchor detaches window ids exactly like the 20260744 shift did, and
	// reconcile() heals the flag against the server. Both fail-soft.
	useEffect(() => {
		let alive = true;
		(async () => {
			await hydrateFeedingScheduleCache();
			if (!alive) return;
			setClock(ctaClock()); // cached schedule may differ from compiled defaults
			const changed = await refreshFeedingSchedule();
			if (!alive || !changed) return;
			setClock(ctaClock());
			reconcile();
		})().catch(() => {});
		return () => {
			alive = false;
		};
	}, [reconcile]);

	// Foreground heal — useFocusEffect never fires on background → active, so a
	// player who backgrounds on "opens in 2h" and returns hours later would sit
	// on a stale clock until the next 15s tick and a stale dug flag until a
	// navigation. On 'active': re-derive the clock THIS frame, fire the
	// fail-soft server reconcile (debounced inside useRooting, so rapid fg/bg
	// flips cost at most one feeding_state read), and re-check the server
	// schedule (its own debounce) — a remote shift lands on the next foreground.
	useEffect(() => {
		const sub = AppState.addEventListener("change", (s) => {
			if (s !== "active") return;
			setClock(ctaClock());
			reconcile();
			refreshFeedingSchedule()
				.then((changed) => {
					if (changed) {
						setClock(ctaClock());
						reconcile();
					}
				})
				.catch(() => {});
		});
		return () => sub.remove();
	}, [reconcile]);

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

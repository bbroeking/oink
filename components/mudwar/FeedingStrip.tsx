// The feeding dig — the 8h dig heartbeat entry point.
//
// `useFeedingCta` is the reusable core: it owns the current-feeding countdown,
// the "already rooted" state, and the Truffle Patch modal (open/submit) — so any
// surface can render its OWN trigger (a Button, a strip) and drop the returned
// `modal` element beside it. `FeedingStrip` is the original chrome (a cream strip
// with an inline "Root the patch" button); the SounderHomeCard consumes the hook
// directly for its play/cooldown line.
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
	RADII,
	SPACE,
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
	const { session, dugThisWindow, noCrew, open, submit, clear } = useRooting();
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
					? "Join a Sounder to dig at the feeding."
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
					    same board. */}
					<Pressable onPress={clear} style={styles.dismissRow} hitSlop={8}>
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
						/>
					)}
				</View>
			</View>
		</Modal>
	);

	return { dugThisWindow, noCrew, phaseOpen, countdown, note, start, modal };
}

export function FeedingStrip({
	onDug,
}: {
	// Fired after ANY successful real submit (banked or drained) — the season
	// tab uses it to refresh the meter / herd presence / milestones, which
	// otherwise sit stale under this modal (focus never changes).
	onDug?: () => void;
}) {
	const { dugThisWindow, noCrew, phaseOpen, countdown, note, start, modal } =
		useFeedingCta(onDug);

	return (
		<View style={styles.wrap}>
			<View style={styles.textCol}>
				<Text style={styles.kicker}>THE FEEDING</Text>
				<Text style={styles.line}>
					{dugThisWindow
						? `You rooted this feeding — the patch opens again in ${countdown}`
						: phaseOpen
						? `He's gorging — the patch is open. ${countdown} left`
						: `He's guarding the patch — it opens in ${countdown}`}
				</Text>
				{!!note && <Text style={styles.note}>{note}</Text>}
			</View>
			{!dugThisWindow && !noCrew && phaseOpen && (
				<Pressable onPress={start} style={styles.btn} hitSlop={8}>
					<Text style={styles.btnText}>Root the patch</Text>
				</Pressable>
			)}
			{modal}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		backgroundColor: WHIMSY.cream,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.lg,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.sm,
		marginTop: SPACE.lg,
		...SHADOW_SM,
	},
	textCol: { flex: 1 },
	kicker: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		letterSpacing: 1.4,
		textTransform: "uppercase",
		color: WHIMSY.mute,
	},
	line: { fontFamily: FONTS.hand, fontSize: 13, color: WHIMSY.ink, marginTop: 1 },
	note: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.accent, marginTop: 2 },
	btn: {
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.sm,
		...SHADOW_SM,
	},
	btnText: { fontFamily: FONTS.whimsy, fontSize: 13, color: WHIMSY.ink },
	backdrop: {
		flex: 1,
		backgroundColor: MODAL_BACKDROP_BG,
		justifyContent: "center",
		padding: SPACE.lg,
	},
	modalBody: { width: "100%" },
	dismissRow: { alignSelf: "flex-end", marginBottom: SPACE.xs, paddingHorizontal: 4 },
	dismissText: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.paper,
		textDecorationLine: "underline",
	},
});

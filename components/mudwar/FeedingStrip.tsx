// The feeding strip — the war screen's 8h heartbeat entry point.
//
// Shows the current feeding's countdown ("He gorges again in 2h 10m"), whether
// you've rooted this feeding, and opens THIS FEEDING'S GAME as a modal card.
// Scuffles are a SET of games: each 8h window deterministically rotates
// through the three lab games (windowIndex % 3 — same for the whole
// barnyard, so crewmates share the same game each feeding):
//   0 → The Truffle Patch (scratch the soil quietly)
//   1 → The Deep Root     (root downward on your wind)
//   2 → The Snout Hook    (drop the hook on the sweep)
// All three run the same server session (seeded board, validated submit),
// so the economy, co-op depth, and blessed digs are identical across games.
// One rooting per member per feeding; a missed feeding costs nothing and is
// never displayed as a loss (gift-not-guilt).

import { useEffect, useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { useRooting } from "@/hooks/useRooting";
import { feedingCountdown, windowIndex } from "@/utils/rooting";
import { TrufflePatch } from "./TrufflePatch";
import { DeepRoot } from "./DeepRoot";
import { SnoutHook } from "./SnoutHook";

const GAMES = [
	{ name: "The Truffle Patch", verb: "Root the patch" },
	{ name: "The Deep Root", verb: "Root deep" },
	{ name: "The Snout Hook", verb: "Drop the hook" },
] as const;

export function feedingGameIndex(win: number = windowIndex()): number {
	return ((win % 3) + 3) % 3;
}
import {
	FONTS,
	WHIMSY,
	RADII,
	SPACE,
	SHADOW_SM,
	MODAL_BACKDROP_BG,
} from "@/constants/theme";

export function FeedingStrip({
	warId,
	onReclaim,
}: {
	warId: string;
	// Fired when a dig banks joy back — the war page ticks the Hunger down.
	onReclaim?: () => void;
}) {
	const { session, dugThisWindow, open, submit, clear } = useRooting(warId);
	const [note, setNote] = useState<string | null>(null);
	const [countdown, setCountdown] = useState(feedingCountdown());
	const game = GAMES[feedingGameIndex(session?.windowIndex ?? windowIndex())];

	useEffect(() => {
		const t = setInterval(() => setCountdown(feedingCountdown()), 30000);
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
					: r.reason === "war_over" || r.reason === "war_not_active"
					? "The mire has settled — no patch to root."
					: "The patch is being stubborn — try again."
			);
		}
	};

	return (
		<View style={styles.wrap}>
			<View style={styles.textCol}>
				<Text style={styles.kicker}>THE FEEDING</Text>
				<Text style={styles.line}>
					{dugThisWindow
						? `You rooted this feeding — next in ${countdown}`
						: `He's gorging — ${game.name} is on. ${countdown} left`}
				</Text>
				{!!note && <Text style={styles.note}>{note}</Text>}
			</View>
			{!dugThisWindow && (
				<Pressable onPress={start} style={styles.btn} hitSlop={8}>
					<Text style={styles.btnText}>{game.verb}</Text>
				</Pressable>
			)}

			<Modal
				visible={!!session}
				transparent
				animationType="fade"
				onRequestClose={clear}
			>
				<View style={styles.backdrop}>
					<View style={styles.modalBody}>
						{/* Leave without submitting — the session keeps its seed
						    server-side, so coming back this feeding resumes the
						    same board. One dismiss for all three games. */}
						<Pressable onPress={clear} style={styles.dismissRow} hitSlop={8}>
							<Text style={styles.dismissText}>leave it for now ›</Text>
						</Pressable>
						{session &&
							(() => {
								// This feeding's game — all three share the session
								// contract, so the swap is presentation-only.
								const props = {
									session,
									onSubmit: async (
										finds: Parameters<typeof submit>[0],
										actions: number
									) => {
										const r = await submit(finds, actions);
										// A dig that banked joy ticks the Hunger down on the war page.
										if (r.ok && r.outcome && r.outcome.mud > 0) onReclaim?.();
										return r.ok ? r.outcome : null;
									},
									onClose: clear,
								};
								switch (feedingGameIndex(session.windowIndex)) {
									case 1:
										return <DeepRoot {...props} />;
									case 2:
										return <SnoutHook {...props} />;
									default:
										return <TrufflePatch {...props} />;
								}
							})()}
					</View>
				</View>
			</Modal>
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

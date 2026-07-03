// The feeding strip — the war screen's 8h heartbeat entry point.
//
// Shows the current feeding's countdown ("He gorges again in 2h 10m"), whether
// you've rooted this feeding, and opens the Truffle Patch as a modal card.
// One rooting per member per feeding; a missed feeding costs nothing and is
// never displayed as a loss (gift-not-guilt).

import { useEffect, useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { useRooting } from "@/hooks/useRooting";
import { feedingCountdown } from "@/utils/rooting";
import { TrufflePatch } from "./TrufflePatch";
import {
	FONTS,
	WHIMSY,
	RADII,
	SPACE,
	SHADOW_SM,
	MODAL_BACKDROP_BG,
} from "@/constants/theme";

export function FeedingStrip({ warId }: { warId: string }) {
	const { session, dugThisWindow, open, submit, clear } = useRooting(warId);
	const [note, setNote] = useState<string | null>(null);
	const [countdown, setCountdown] = useState(feedingCountdown());

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
						: `He's gorging — the patch is soft. ${countdown} left`}
				</Text>
				{!!note && <Text style={styles.note}>{note}</Text>}
			</View>
			{!dugThisWindow && (
				<Pressable onPress={start} style={styles.btn} hitSlop={8}>
					<Text style={styles.btnText}>Root the patch</Text>
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
						{session && (
							<TrufflePatch
								session={session}
								onSubmit={async (finds, actions) => {
									const r = await submit(finds, actions);
									return r.ok ? r.outcome : null;
								}}
								onClose={clear}
							/>
						)}
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
});

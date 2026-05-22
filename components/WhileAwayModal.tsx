// "While you were away" — a sign-in dialog that surfaces the
// blessings + curses a player received since they last opened the
// app. _layout.tsx polls for un-seen received rituals on launch and
// mounts this; the events also live in the Friends-tab Inbox, this
// is just the can't-miss-it announcement.
import React from "react";
import {
	Modal,
	View,
	Text,
	Image,
	Pressable,
	ScrollView,
	StyleSheet,
} from "react-native";
import { Sticker } from "./ui/Sticker";
import {
	BLESSING_META,
	CURSE_META,
	type BlessingKind,
	type CurseKind,
} from "../utils/rituals";
import {
	FONTS,
	KICKER_TEXT,
	MODAL_BACKDROP_BG,
	STICKER_SHADOW,
	WHIMSY,
} from "@/constants/theme";

export interface RitualEvent {
	source: "blessing" | "curse";
	kind: string;
	from: string | null;
}

export function WhileAwayModal({
	events,
	onDismiss,
}: {
	events: RitualEvent[];
	onDismiss: () => void;
}) {
	const blessings = events.filter((e) => e.source === "blessing").length;
	const curses = events.length - blessings;
	const headline =
		curses === 0
			? blessings === 1
				? "A friend blessed you"
				: "Friends blessed you"
			: blessings === 0
				? curses === 1
					? "You were cursed"
					: "You were cursed"
				: "Blessings & curses landed";

	return (
		<Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
			<View style={styles.backdrop}>
				<Sticker
					color="paper"
					rotate={-1}
					radius={20}
					style={[styles.sheet, STICKER_SHADOW]}
				>
					<Text style={styles.kicker}>★ while you were away</Text>
					<Text style={styles.headline}>{headline}</Text>

					<ScrollView
						style={{ maxHeight: 270 }}
						showsVerticalScrollIndicator={false}
					>
						{events.map((e, i) => {
							const blessed = e.source === "blessing";
							const meta = blessed
								? BLESSING_META[e.kind as BlessingKind]
								: CURSE_META[e.kind as CurseKind];
							return (
								<View
									key={i}
									style={[
										styles.row,
										blessed ? styles.rowBless : styles.rowCurse,
									]}
								>
									{meta && (
										<Image source={meta.icon} style={styles.icon} />
									)}
									<View style={{ flex: 1, minWidth: 0 }}>
										<Text style={styles.rowName} numberOfLines={1}>
											{e.from ?? (blessed ? "A friend" : "Someone")}{" "}
											{blessed ? "blessed" : "cursed"} you
										</Text>
										<Text style={styles.rowBlurb} numberOfLines={2}>
											{meta?.name ?? e.kind}
											{meta?.blurb ? ` — ${meta.blurb}` : ""}
										</Text>
									</View>
								</View>
							);
						})}
					</ScrollView>

					<Pressable
						onPress={onDismiss}
						style={({ pressed }) => [
							styles.btn,
							pressed && { opacity: 0.7 },
						]}
					>
						<Text style={styles.btnText}>Got it</Text>
					</Pressable>
					<Text style={styles.foot}>
						See the full activity in the Friends tab.
					</Text>
				</Sticker>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		justifyContent: "center",
		padding: 24,
		backgroundColor: MODAL_BACKDROP_BG,
	},
	sheet: { padding: 20 },
	kicker: { ...KICKER_TEXT, fontSize: 11, marginBottom: 4 },
	headline: {
		fontFamily: FONTS.whimsy,
		fontSize: 24,
		color: WHIMSY.ink,
		marginBottom: 14,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		borderRadius: 12,
		borderWidth: 1.5,
		paddingHorizontal: 10,
		paddingVertical: 9,
		marginBottom: 8,
	},
	rowBless: { backgroundColor: WHIMSY.sun, borderColor: WHIMSY.ink },
	rowCurse: { backgroundColor: "#D5E4C9", borderColor: WHIMSY.ink },
	icon: { width: 36, height: 36, resizeMode: "contain" },
	rowName: { fontFamily: FONTS.whimsy, fontSize: 15, color: WHIMSY.ink },
	rowBlurb: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.ink,
		marginTop: 1,
	},
	btn: {
		backgroundColor: WHIMSY.lilac,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 14,
		paddingVertical: 12,
		alignItems: "center",
		marginTop: 6,
	},
	btnText: { fontFamily: FONTS.whimsy, fontSize: 16, color: WHIMSY.ink },
	foot: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: 8,
	},
});

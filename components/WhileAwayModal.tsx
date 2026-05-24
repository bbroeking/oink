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

// Discriminated union — blessings + curses + trades + system
// announcements all surface in the same launch modal so the player
// gets ONE "what landed" moment instead of N separate ones. Old
// name was RitualEvent; trades aren't rituals, system announcements
// aren't either, so the type was renamed. Kept the RitualEvent
// alias below so existing imports keep working through the rename.
export type WhileAwayEvent =
	| { source: "blessing"; kind: string; from: string | null }
	| { source: "curse"; kind: string; from: string | null }
	| { source: "trade_fulfilled"; amount: number; from: string | null }
	| { source: "system"; announcementId: number; title: string; body: string };

export type RitualEvent = WhileAwayEvent; // legacy alias

export function WhileAwayModal({
	events,
	onDismiss,
}: {
	events: WhileAwayEvent[];
	onDismiss: () => void;
}) {
	const blessings = events.filter((e) => e.source === "blessing").length;
	const curses = events.filter((e) => e.source === "curse").length;
	const trades = events.filter((e) => e.source === "trade_fulfilled").length;
	const systems = events.filter((e) => e.source === "system").length;
	// Pick the headline from whichever event class dominates — the
	// modal isn't going to summarize a mix perfectly, so lean on the
	// most-numerous one. System announcements take precedence when
	// present + numerous because they're admin-issued and usually
	// the most important thing in the batch.
	const headline =
		systems > 0 && systems >= trades && systems >= blessings && systems >= curses
			? systems === 1
				? "A note from the barn"
				: "Notes from the barn"
			: trades >= blessings && trades >= curses && trades > 0
				? trades === 1
					? "A trade was answered"
					: "Trades landed in your barn"
				: curses === 0
					? blessings === 1
						? "A friend blessed you"
						: "Friends blessed you"
					: blessings === 0
						? "You were cursed"
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
							if (e.source === "system") {
								return (
									<View key={i} style={[styles.row, styles.rowSystem]}>
										<View style={styles.systemGlyphWell}>
											<Text style={styles.systemGlyph}>★</Text>
										</View>
										<View style={{ flex: 1, minWidth: 0 }}>
											<Text style={styles.rowName} numberOfLines={1}>
												{e.title}
											</Text>
											<Text style={styles.rowBlurb} numberOfLines={3}>
												{e.body}
											</Text>
										</View>
									</View>
								);
							}
							if (e.source === "trade_fulfilled") {
								return (
									<View key={i} style={[styles.row, styles.rowTrade]}>
										<View style={styles.tradeGlyphWell}>
											<Text style={styles.tradeGlyph}>♥</Text>
										</View>
										<View style={{ flex: 1, minWidth: 0 }}>
											<Text style={styles.rowName} numberOfLines={1}>
												{e.from ?? "A friend"} answered your trade
											</Text>
											<Text style={styles.rowBlurb} numberOfLines={2}>
												+{e.amount * 2} tickles landed in your barn.
											</Text>
										</View>
									</View>
								);
							}
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
	rowTrade: { backgroundColor: WHIMSY.rose, borderColor: WHIMSY.ink },
	tradeGlyphWell: {
		width: 36,
		height: 36,
		borderRadius: 18,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		alignItems: "center",
		justifyContent: "center",
	},
	tradeGlyph: { fontFamily: FONTS.whimsy, fontSize: 18, color: WHIMSY.roseDeep },
	// System announcement row — cream (paper-toned) so it reads as
	// "from the barn" rather than from any specific friend or kind.
	rowSystem: { backgroundColor: WHIMSY.cream, borderColor: WHIMSY.ink },
	systemGlyphWell: {
		width: 36,
		height: 36,
		borderRadius: 18,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
		alignItems: "center",
		justifyContent: "center",
	},
	systemGlyph: { fontFamily: FONTS.whimsy, fontSize: 18, color: WHIMSY.ink },
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

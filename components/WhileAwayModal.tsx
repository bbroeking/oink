// "While you were away" — a sign-in dialog that surfaces the
// blessings + curses a player received since they last opened the
// app. _layout.tsx polls for un-seen received rituals on launch and
// mounts this; the events also live in the Friends-tab Inbox, this
// is just the can't-miss-it announcement.
import React from "react";
import { Modal, View, Text, ScrollView, StyleSheet, Pressable, Image } from "react-native";
import { Sticker } from "./ui/Sticker";
import { Button } from "./ui/Button";
import { Glyph } from "./ui/Glyph";
import { Icon } from "./ui/Icon";
import { RitualIconWell } from "./ui/RitualIconWell";
import { BLESSING_META, CURSE_META, type BlessingKind, type CurseKind } from "../utils/rituals";
import {
	FONTS,
	KICKER_TEXT,
	MODAL_BACKDROP_BG,
	STICKER_SHADOW,
	TYPE,
	WHIMSY,
	RADII,
} from "@/constants/theme";
import { VISIT_EMOTE_IMAGES, type VisitEmoteId } from "@/utils/visitEmotes";

// Discriminated union — blessings + curses + trades + system
// announcements all surface in the same launch modal so the player
// gets ONE "what landed" moment instead of N separate ones. (Trades
// aren't rituals and system announcements aren't either, so this is
// named for the modal — "what landed while away" — not "rituals".)
export type WhileAwayEvent =
	| { source: "blessing"; kind: string; from: string | null }
	| { source: "curse"; kind: string; from: string | null }
	| { source: "trade_fulfilled"; amount: number; from: string | null }
	| {
			source: "system";
			announcementId: number;
			title: string;
			body: string;
			// Deep-link target for a tap-through, or null when the announcement
			// has no destination (e.g. an admin note) — such rows stay
			// non-pressable so there's no dead affordance. Set by
			// systemAnnouncementRoute() in utils/whileAway.
			route?: string | null;
			// Member visit notes carry a commissioned sticker. Unknown ids fail
			// soft to the normal barn star while old binaries roll forward.
			emoteId?: string | null;
	  };

export function WhileAwayModal({
	visible,
	events,
	onDismiss,
	onNavigate,
}: {
	// Driven by the popup-queue slot in _layout. The native Modal must
	// animate out on visible=false BEFORE the parent unmounts it, or the
	// next queued popup can present into a mid-teardown window and come
	// up invisible (see PopupQueue.tsx).
	visible: boolean;
	events: WhileAwayEvent[];
	onDismiss: () => void;
	// Tap-through for a system row that carries a deep-link `route`. The
	// parent owns dismissal + delayed navigation as one PopupQueue operation.
	// Rows without a route stay non-pressable.
	onNavigate?: (route: string) => void;
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
		<Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
			<View style={styles.backdrop}>
				<Sticker
					color="paper"
					rotate={-1}
					radius={RADII.xxl}
					style={[styles.sheet, STICKER_SHADOW]}
				>
					<Text style={styles.kicker}>★ while you were away</Text>
					<Text style={styles.headline}>{headline}</Text>

					<ScrollView style={{ maxHeight: 270 }} showsVerticalScrollIndicator={false}>
						{events.map((e, i) => {
							if (e.source === "system") {
								const route = e.route ?? null;
								const tappable = !!route && !!onNavigate;
								const emoteSource =
									e.emoteId && Object.prototype.hasOwnProperty.call(VISIT_EMOTE_IMAGES, e.emoteId)
										? VISIT_EMOTE_IMAGES[e.emoteId as VisitEmoteId]
										: null;
								const inner = (
									<>
										{emoteSource ? (
											<View style={styles.systemEmoteWell}>
												<Image
													source={emoteSource}
													style={styles.systemEmote}
													resizeMode="contain"
												/>
											</View>
										) : (
											<View style={styles.systemGlyphWell}>
												<Text style={styles.systemGlyph}>★</Text>
											</View>
										)}
										<View style={{ flex: 1, minWidth: 0 }}>
											<Text style={styles.rowName} numberOfLines={1}>
												{e.title}
											</Text>
											<Text style={styles.rowBlurb} numberOfLines={3}>
												{e.body}
											</Text>
										</View>
										{tappable && <Icon name="arrowRight" size={18} color={WHIMSY.ink} />}
									</>
								);
								if (tappable) {
									return (
										<Pressable
											key={i}
											style={({ pressed }) => [
												styles.row,
												styles.rowSystem,
												pressed && styles.rowPressed,
											]}
											onPress={() => {
												// The parent persists the batch marker, releases
												// the popup, then routes after native teardown.
												onNavigate!(route!);
											}}
										>
											{inner}
										</Pressable>
									);
								}
								return (
									<View key={i} style={[styles.row, styles.rowSystem]}>
										{inner}
									</View>
								);
							}
							if (e.source === "trade_fulfilled") {
								return (
									<View key={i} style={[styles.row, styles.rowTrade]}>
										<View style={styles.tradeGlyphWell}>
											<Glyph name="heart" size={18} />
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
								<View key={i} style={[styles.row, blessed ? styles.rowBless : styles.rowCurse]}>
									<RitualIconWell icon={meta?.icon} blessed={blessed} size={40} />
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

					<Button variant="purple" size="md" full onPress={onDismiss} style={{ marginTop: 6 }}>
						Got it
					</Button>
					<Text style={styles.foot}>See the full activity in the Friends tab.</Text>
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
		...TYPE.pageTitle,
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
	rowCurse: { backgroundColor: WHIMSY.sage, borderColor: WHIMSY.ink },
	rowTrade: { backgroundColor: WHIMSY.rose, borderColor: WHIMSY.ink },
	// 40pt to match the bless/curse RitualIconWell so all four row
	// kinds share one left-column height.
	tradeGlyphWell: {
		width: 40,
		height: 40,
		borderRadius: 20,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		alignItems: "center",
		justifyContent: "center",
	},
	// System announcement row — cream (paper-toned) so it reads as
	// "from the barn" rather than from any specific friend or kind.
	rowSystem: { backgroundColor: WHIMSY.cream, borderColor: WHIMSY.ink },
	// Press feedback for a tappable (deep-linking) system row.
	rowPressed: { opacity: 0.7 },
	systemGlyphWell: {
		width: 40,
		height: 40,
		borderRadius: 20,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
		alignItems: "center",
		justifyContent: "center",
	},
	systemGlyph: { fontFamily: FONTS.whimsy, fontSize: 18, color: WHIMSY.ink },
	systemEmoteWell: {
		width: 52,
		height: 52,
		borderRadius: 16,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		alignItems: "center",
		justifyContent: "center",
	},
	systemEmote: { width: 48, height: 48 },
	rowName: { fontFamily: FONTS.whimsy, fontSize: 15, color: WHIMSY.ink },
	rowBlurb: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.ink,
		marginTop: 1,
	},
	foot: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: 8,
	},
});

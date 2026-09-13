// "While you were away" — a sign-in dialog that surfaces the
// blessings + curses a player received since they last opened the
// app. _layout.tsx polls for un-seen received rituals on launch and
// mounts this; the events also live in the Friends-tab Inbox, this
// is just the can't-miss-it announcement.
import React from "react";
import { View, ScrollView, StyleSheet, Image } from "react-native";
import {
	AdaptiveModalScaffold,
	Avatar,
	Button,
	Hand,
	Icon,
	Kicker,
	ListRow,
	PageTitle,
	RitualIconWell,
	Sticker,
} from "./ui";
import {
	BLESSING_META,
	CURSE_META,
	type BlessingKind,
	type CurseKind,
	type RitualMeta,
} from "../utils/rituals";
import {
	AVATAR_SIZE,
	BORDER,
	RADII,
	SPACE,
	STICKER_SHADOW,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import { VISIT_EMOTE_IMAGES, type VisitEmoteId } from "@/utils/visitEmotes";

// Drawing constants, not spacing steps: the interface mark inside a 40pt well
// (one step under the well's own glyph so an Icon reads as a companion to the
// row, not as art), and the commissioned visit sticker's square well — a
// sticker is not a portrait, so it keeps its own rounded-square frame instead
// of being cropped into an Avatar's circle.
const WELL_ICON = 18;
const EMOTE_WELL = 52;
const EMOTE_ART = 48;
// How much of the dialog the recap list may claim before it scrolls.
const RECAP_MAX_H = 270;

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
			source: "sounder";
			messageId: string;
			from: string | null;
			crewName: string;
			body: string;
	  }
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
	// up invisible (see PopupQueue.tsx). AdaptiveModalScaffold keeps its
	// Modal mounted and drives `visible` straight through, so the slot's
	// contract survives the scaffold.
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
	const sounders = events.filter((e) => e.source === "sounder").length;
	// Pick the headline from whichever event class dominates — the
	// modal isn't going to summarize a mix perfectly, so lean on the
	// most-numerous one. System announcements take precedence when
	// present + numerous because they're admin-issued and usually
	// the most important thing in the batch.
	const headline =
		sounders > 0 &&
		sounders >= systems &&
		sounders >= trades &&
		sounders >= blessings &&
		sounders >= curses
			? sounders === 1
				? "Your Sounder Oinked"
				: "Oinks from your Sounder"
			: systems > 0 && systems >= trades && systems >= blessings && systems >= curses
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
		<AdaptiveModalScaffold
			visible={visible}
			onRequestClose={onDismiss}
			animationType="fade"
			bare
			contentContainerStyle={styles.frame}
		>
			<Sticker
				color="paper"
				rotate={-1}
				radius={RADII.xxl}
				style={[styles.sheet, STICKER_SHADOW]}
			>
				<Kicker>while you were away</Kicker>
				<PageTitle style={styles.headline}>{headline}</PageTitle>

				<ScrollView
					style={styles.list}
					showsVerticalScrollIndicator={false}
				>
					{events.map((e, i) => {
						if (e.source === "sounder") {
							return (
								<ListRow
									key={e.messageId || i}
									index={i}
									leading={
										<Avatar fill="paper" label="Your Sounder">
											<Icon
												name="bell"
												size={WELL_ICON}
												color={UI_COLORS.textPrimary}
											/>
										</Avatar>
									}
									title={`${e.from ?? "A crewmate"} · ${e.crewName}`}
									sub={e.body}
									style={[styles.row, styles.rowSounder]}
								/>
							);
						}
						if (e.source === "system") {
							const route = e.route ?? null;
							const tappable = !!route && !!onNavigate;
							const emoteSource =
								e.emoteId && Object.prototype.hasOwnProperty.call(VISIT_EMOTE_IMAGES, e.emoteId)
									? VISIT_EMOTE_IMAGES[e.emoteId as VisitEmoteId]
									: null;
							return (
								<ListRow
									key={i}
									index={i}
									leading={
										emoteSource ? (
											<View style={styles.emoteWell}>
												<Image
													source={emoteSource}
													style={styles.emote}
													resizeMode="contain"
												/>
											</View>
										) : (
											<Avatar fill="sun" label="From the barn">
												<Icon
													name="star"
													size={WELL_ICON}
													color={UI_COLORS.textPrimary}
												/>
											</Avatar>
										)
									}
									title={e.title}
									sub={e.body}
									trailing={
										tappable ? (
											<Icon
												name="arrowRight"
												size={WELL_ICON}
												color={UI_COLORS.textPrimary}
											/>
										) : undefined
									}
									// The parent persists the batch marker, releases the
									// popup, then routes after native teardown.
									onPress={tappable ? () => onNavigate!(route!) : undefined}
									accessibilityLabel={`${e.title}. ${e.body}`}
									accessibilityHint={
										tappable ? "Opens this note from the barn" : undefined
									}
									style={[styles.row, styles.rowSystem]}
								/>
							);
						}
						if (e.source === "trade_fulfilled") {
							return (
								<ListRow
									key={i}
									index={i}
									leading={
										<Avatar fill="paper" glyph="heart" label="Trade answered" />
									}
									title={`${e.from ?? "A friend"} answered your trade`}
									sub={`+${e.amount * 2} tickles landed in your barn.`}
									style={[styles.row, styles.rowTrade]}
								/>
							);
						}
						const blessed = e.source === "blessing";
						// Raw server string → the lookup can miss; annotated so the
						// `meta?.` guards below stay type-enforced.
						const meta: RitualMeta | undefined = blessed
							? BLESSING_META[e.kind as BlessingKind]
							: CURSE_META[e.kind as CurseKind];
						return (
							<ListRow
								key={i}
								index={i}
								leading={
									<RitualIconWell
										icon={meta?.icon}
										blessed={blessed}
										size={AVATAR_SIZE[1]}
									/>
								}
								title={`${e.from ?? (blessed ? "A friend" : "Someone")} ${
									blessed ? "blessed" : "cursed"
								} you`}
								sub={`${meta?.name ?? e.kind}${
									meta?.blurb ? ` — ${meta.blurb}` : ""
								}`}
								style={[styles.row, blessed ? styles.rowBless : styles.rowCurse]}
							/>
						);
					})}
				</ScrollView>

				<Button
					variant="purple"
					size="md"
					full
					onPress={onDismiss}
					style={styles.dismiss}
					accessibilityLabel="Got it"
					accessibilityHint="Closes this recap"
				>
					Got it
				</Button>
				<Hand tone="secondary" align="center" style={styles.foot}>
					See the full activity in the Friends tab.
				</Hand>
			</Sticker>
		</AdaptiveModalScaffold>
	);
}

const styles = StyleSheet.create({
	frame: { padding: SPACE.xs },
	sheet: { padding: SPACE.lg },
	headline: { marginBottom: SPACE.md },
	list: { maxHeight: RECAP_MAX_H },
	// Each row keeps its event class's fill; the drawing (border, radius,
	// shadow, tilt, text roles) is ListRow's.
	row: { marginBottom: SPACE.sm },
	rowBless: { backgroundColor: WHIMSY.sun },
	rowCurse: { backgroundColor: WHIMSY.sage },
	rowTrade: { backgroundColor: WHIMSY.rose },
	rowSounder: { backgroundColor: WHIMSY.sun },
	// System announcement row — cream (paper-toned) so it reads as
	// "from the barn" rather than from any specific friend or kind.
	rowSystem: { backgroundColor: WHIMSY.cream },
	emoteWell: {
		width: EMOTE_WELL,
		height: EMOTE_WELL,
		borderRadius: RADII.xl,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		backgroundColor: UI_COLORS.surface,
		alignItems: "center",
		justifyContent: "center",
	},
	emote: { width: EMOTE_ART, height: EMOTE_ART },
	dismiss: { marginTop: SPACE.sm },
	foot: { marginTop: SPACE.sm },
});

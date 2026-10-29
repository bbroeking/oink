// "While you were away" — a sign-in dialog that surfaces the
// blessings + curses a player received since they last opened the
// app. _layout.tsx polls for un-seen received rituals on launch and
// mounts this; the events also live in the Friends-tab Inbox, this
// is just the can't-miss-it announcement.
import React, { useState } from "react";
import {
	View,
	ScrollView,
	StyleSheet,
	Image,
	useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	AdaptiveModalScaffold,
	Avatar,
	Button,
	Divider,
	Icon,
	Kicker,
	ListRow,
	PageTitle,
	RitualIconWell,
} from "./ui";
import { groupBarnVisits, visitGroupCopy } from "@/utils/whileAway";
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
	LIST_BLEED,
	RADII,
	SPACE,
	TAP_MIN,
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
// The least the recap list may claim on a short window (an SE): one full row
// plus its bleed. Below that the outer sheet scrolls the whole recap rather
// than the list scrolling a sliver.
const RECAP_MIN_H = TAP_MIN + SPACE.sm * 2 + LIST_BLEED * 2;
// Everything in the dialog that is NOT the list, at default type: the window
// gutters and frame border, the close rail with its kicker + one-line title,
// the gap, the primary and the sheet's bottom inset. The list may claim
// everything else, so the dialog grows with its notes instead of scrolling a
// 270pt window while a quarter of the screen sits empty above it (the fixed
// cap this replaced, polish 2026-10-04); the sheet's own ScrollView is the
// safety net when Dynamic Type grows the rail past this estimate.
const RECAP_CHROME_H = 200;
// The recap's frame: the reveal family's width (docs/reveal-family-spec.md).
const RECAP_MAX_W = 390;

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
			// The announcement's kind (`barn_visit`, `trough_nudge`, …). Optional
			// so a caller that predates it still type-checks; the recap folds a
			// run of plain `barn_visit` rows into one (utils/whileAway).
			kind?: string;
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
	// The list's cap follows the window so a short screen still shows the
	// primary under the rows instead of pushing it below the fold.
	const { height } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const listMaxHeight = Math.max(
		RECAP_MIN_H,
		height - insets.top - insets.bottom - RECAP_CHROME_H,
	);
	// A list that still runs past its cap gets a crease under its clip edge, so
	// the cut reads as a fold the rows continue behind rather than rows sliced
	// in mid-air. Measured, because only a long recap needs it.
	const [listBoxH, setListBoxH] = useState(0);
	const [listContentH, setListContentH] = useState(0);
	const listOverflows = listBoxH > 0 && listContentH > listBoxH + 1;
	// The rows the recap draws: the events in order, with a run of plain Barn
	// visits folded into one row that names who came.
	const rows = groupBarnVisits(events);
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
		// The scaffold's paper frame with the close rail, and the heading IN the
		// rail's row: kicker + title on the left, × on the right. Stacked under a
		// 52pt rail the recap opened on a band of nothing; sharing the row gives
		// that back and the first note sits one step under the title.
		<AdaptiveModalScaffold
			visible={visible}
			onRequestClose={onDismiss}
			animationType="fade"
			maxWidth={RECAP_MAX_W}
			showCloseButton
			closeLabel="Close"
			closeRowContent={
				<View style={styles.heading}>
					<Kicker>while you were away</Kicker>
					<PageTitle>{headline}</PageTitle>
				</View>
			}
			contentContainerStyle={styles.sheet}
		>
				{/* THE BLEED GUTTER. Each row is a tilted sticker with a hard shadow,
				    and a ScrollView clips at its own edge — so the list is pulled
				    out by LIST_BLEED on every side and its content padded back by
				    the same amount. The rows stay on the sheet's inset; the clip
				    edge lands past the shadow and the tilt's overhang. The two
				    values must stay equal or the rows shift off the inset. */}
				<ScrollView
					style={[styles.list, { maxHeight: listMaxHeight }]}
					contentContainerStyle={styles.listContent}
					bounces={false}
					showsVerticalScrollIndicator={false}
					onLayout={(ev) => setListBoxH(ev.nativeEvent.layout.height)}
					onContentSizeChange={(_w, h) => setListContentH(h)}
				>
					{rows.map((e, i) => {
						if (e.source === "visits") {
							// Two or more plain Barn visits, folded: one row that names
							// who came, each name once.
							const copy = visitGroupCopy(e);
							const route = e.route;
							const tappable = !!route && !!onNavigate;
							return (
								<ListRow
									key={e.key}
									index={i}
									fill={WHIMSY.cream}
									leading={<BarnStar />}
									title={copy.title}
									sub={copy.body}
									trailing={tappable ? <RowArrow /> : undefined}
									onPress={route && onNavigate ? () => onNavigate(route) : undefined}
									accessibilityLabel={spoken(copy.title, copy.body)}
									accessibilityHint={
										tappable ? "Opens this note from the barn" : undefined
									}
								/>
							);
						}
						if (e.source === "sounder") {
							return (
								<ListRow
									key={e.messageId || `sounder-${i}`}
									index={i}
									// Sky, the Inbox's Sounder fill. Sun is the blessing's, and
									// two kinds are never told apart by their mark alone.
									fill={WHIMSY.sky}
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
									key={`system-${e.announcementId}-${i}`}
									index={i}
									// Cream (paper-toned), so it reads as "from the barn" rather
									// than from any one friend or kind.
									fill={WHIMSY.cream}
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
											<BarnStar />
										)
									}
									title={e.title}
									sub={e.body}
									trailing={tappable ? <RowArrow /> : undefined}
									// The parent persists the batch marker, releases the
									// popup, then routes after native teardown.
									onPress={route && onNavigate ? () => onNavigate(route) : undefined}
									accessibilityLabel={spoken(e.title, e.body)}
									accessibilityHint={
										tappable ? "Opens this note from the barn" : undefined
									}
								/>
							);
						}
						if (e.source === "trade_fulfilled") {
							return (
								<ListRow
									key={`trade-${i}`}
									index={i}
									fill={WHIMSY.rose}
									leading={
										<Avatar fill="paper" glyph="heart" label="Trade answered" />
									}
									title={`${e.from ?? "A friend"} answered your trade`}
									sub={`+${e.amount * 2} tickles landed in your barn.`}
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
								key={`${e.source}-${i}`}
								index={i}
								// A blessing is the bless door's sun; a curse sits on the
								// curse pair's own surface, the paper an Inbox curse row and
								// the friend row's curse door wear. It used to borrow sage,
								// the app's "owned / done" fill, and read as good news.
								fill={blessed ? WHIMSY.sun : WHIMSY.curseSurface}
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
									meta?.blurb ? ` · ${meta.blurb}` : ""
								}`}
							/>
						);
					})}
				</ScrollView>
				{/* The crease under a list that still runs past its cap: the rows
				    continue behind the fold, they are not cut off. */}
				{listOverflows && <Divider space="xxs" />}

				{/* The family's one primary. The foot note that hung under it ("See
				    the full activity in the Friends tab") is gone: the rows already
				    navigate on tap, and nothing sits below the primary. */}
				<Button
					variant="gold"
					size="md"
					full
					onPress={onDismiss}
					accessibilityLabel="Got it"
					accessibilityHint="Closes this recap"
				>
					Got it
				</Button>
		</AdaptiveModalScaffold>
	);
}

// A note's title and body read as two sentences. The server's titles usually
// end in "!", and "Barn!. the piggler…" is not a sentence a voice can say.
function spoken(title: string, body: string): string {
	return /[.!?]$/.test(title) ? `${title} ${body}` : `${title}. ${body}`;
}

// The barn's own mark on a note from the barn, and the arrow a note that
// opens somewhere wears. Shared by the single note and the folded visits.
function BarnStar() {
	return (
		<Avatar fill="sun" label="From the barn">
			<Icon name="star" size={WELL_ICON} color={UI_COLORS.textPrimary} />
		</Avatar>
	);
}

function RowArrow() {
	return <Icon name="arrowRight" size={WELL_ICON} color={UI_COLORS.textPrimary} />;
}

const styles = StyleSheet.create({
	// The sheet's inset: sides and bottom; the top is the close rail's row.
	// The top pad is exactly the list's bleed: the list pulls itself up by
	// LIST_BLEED, so this is what keeps its clip edge INSIDE the sheet's own
	// ScrollView. Without it the first row's tilted top corner and border were
	// sliced flat by the outer clip. (2026-09-15)
	sheet: {
		paddingTop: LIST_BLEED,
		paddingHorizontal: SPACE.xl,
		paddingBottom: SPACE.xl,
		gap: SPACE.md,
	},
	heading: { gap: SPACE.xxs },
	// Bleed: the clip edge sits LIST_BLEED outside the rows on all four sides.
	// (The height cap is set inline from the window.)
	list: {
		marginHorizontal: -LIST_BLEED,
		marginVertical: -LIST_BLEED,
	},
	// Each row keeps its event class's fill (ListRow's `fill`); the drawing
	// (border, radius, shadow, tilt, text roles) is ListRow's. Spacing is the
	// list's `gap`, so no per-row margin doubles up at the bleed edge.
	listContent: {
		paddingHorizontal: LIST_BLEED,
		paddingVertical: LIST_BLEED,
		gap: SPACE.sm,
	},
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
});

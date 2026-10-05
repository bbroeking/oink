// Sheet — the bottom-sheet PANEL (design-system spec §2, row 05).
//
// `SlideUpSheet` owns the chrome (transparent Modal, decoupled scrim fade, the
// slide, the bottom anchoring); this owns the PAPER PANEL that rides on it, the
// shape seven sheets hand-rolled independently: grabber, a `sectionTitle` +
// close-button title row, an optional hand-voice sub line, a scrolling body and
// an optional pinned footer.
//
// Shape rules that are NOT negotiable per surface:
//   · top corners only (RADII.xl) — the panel is flush to the bottom edge, so a
//     bottom radius would float a sticker that isn't floating;
//   · no tilt — a sheet is anchored furniture, not a stuck-on sticker;
//   · PAGE_PAD sides / SPACE.md top / SPACE.xl + home-indicator bottom (the
//     panel rides a native Modal above the tab bar — no tab clearance), and
//     that bottom safety is spent by whatever is LAST: the pinned footer when
//     there is one, the scroll content when there isn't;
//   · exactly one scroller, and it bounces — a body that stops dead at its end
//     reads as clipped even when it isn't;
//   · the header owns its scroll edge: the scroller clips a hair of paper
//     BELOW the title block (never at the title's own line box), and the
//     app's one scroll-edge rule (`ScrollEdge`: the crown's TITLE_RULE ink,
//     panel-wide) shows on that edge the moment a row has scrolled under it. A
//     pinned footer owns its top edge the same way while there is more body
//     below it. Nothing moves: the rule is always laid out and only its
//     opacity changes. (2026-10-04 polish: rows slid up into "6 finds" /
//     "all you've done" with no paper between them and the title.)
//   · the body bleeds LIST_BLEED past the panel's side inset and pads back by
//     the same, so a full-width sticker's hard shadow and a tilted row's
//     corner land inside the clip instead of being cut at it; the content sits
//     exactly where it did. (2026-10-04, Friends ask A-2)
//
// It is an UNMANAGED native Modal (through SlideUpSheet), so it takes the
// `useUnmanagedModalHold` latch: while open the popup queue admits nothing and
// drains anything presented, so a foreground poll can't wedge a queued popup
// over it (#50152).

import { useCallback, useRef, useState, type ReactNode } from "react";
import {
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	StyleSheet,
	View,
	useWindowDimensions,
	type LayoutChangeEvent,
	type NativeScrollEvent,
	type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	BORDER,
	LIST_BLEED,
	PAGE_PAD,
	RADII,
	SPACE,
} from "@/constants/theme";
import { IconButton } from "./IconButton";
import { useUnmanagedModalHold } from "./PopupQueue";
import { SCROLL_EDGE_EPSILON, ScrollEdge } from "./ScrollEdge";
import { SheetGrabber, SlideUpSheet } from "./SlideUpSheet";
import { Sticker } from "./Sticker";
import { Hand, Kicker, SectionTitle } from "./Text";

// How much of the window the panel may claim before its body starts scrolling.
const DEFAULT_MAX_HEIGHT_FRAC = 0.85;

// Which of the body's two edges have content running under them.
interface Edges {
	top: boolean;
	bottom: boolean;
}

interface Props {
	open: boolean;
	onClose: () => void;
	/** Accent hand-voice line ABOVE the title ("★ left by your friends"). */
	kicker?: string;
	title?: string;
	/** Hand-voice secondary line under the title. */
	subtitle?: string;
	closeLabel?: string;
	children: ReactNode;
	/** Pinned under the scrolling body — a CTA row that must never scroll away. */
	footer?: ReactNode;
	maxHeightFrac?: number;
	/**
	 * Rendered as a SIBLING of the panel inside the same native Modal — for a
	 * nested Modal that must present over this sheet (iOS won't reliably present
	 * one mounted outside the presenting Modal).
	 */
	overlay?: ReactNode;
	/** Lifts the panel above the keyboard — required for a sheet holding a TextField. */
	keyboardAware?: boolean;
	/** "inline" for a sheet that opens from inside another native Modal. */
	presentation?: "native" | "inline";
	/**
	 * PopupQueue consumers only — SlideUpSheet's `modalVisible` escape hatch,
	 * so a queue-slotted sheet can drop its native Modal the frame the slot
	 * releases while staying mounted. Direct-tap sheets omit it.
	 */
	modalVisible?: boolean;
	/**
	 * This sheet IS a PopupQueue slot (usePopupSlot drives `modalVisible`). A
	 * slotted sheet must not take the unmanaged-modal latch: the latch holds
	 * the queue, the queue then never presents the slot, and the sheet sits
	 * mounted-but-hidden holding every other popup with it. The queue already
	 * serializes it. Direct-tap sheets omit it and keep the latch.
	 */
	slotted?: boolean;
	testID?: string;
}

export function Sheet({
	open,
	onClose,
	kicker,
	title,
	subtitle,
	closeLabel = "Close",
	children,
	footer,
	maxHeightFrac = DEFAULT_MAX_HEIGHT_FRAC,
	overlay,
	keyboardAware = false,
	presentation = "native",
	modalVisible,
	slotted = false,
	testID,
}: Props) {
	// An inline sheet lives inside a presenting Modal that already holds the
	// popup-queue latch; taking a second one would be harmless but misleading.
	// A slotted sheet is the queue's own — latching would deadlock it.
	useUnmanagedModalHold(open && presentation === "native" && !slotted);
	const { height } = useWindowDimensions();

	return (
		<SlideUpSheet
			open={open}
			onClose={onClose}
			// No backdropLabel: the header's × is the sheet's one "Close" for
			// VoiceOver, and its escape gesture closes too (the panel's
			// onAccessibilityEscape). The scrim still closes on a tap.
			overlay={overlay}
			presentation={presentation}
			modalVisible={modalVisible}
			flush
		>
			{/* SlideUpSheet renders its children only while open, so the panel —
			    and the scroll-edge state it keeps — is fresh on every opening: a
			    sheet closed while scrolled never reopens wearing a crease. */}
			<SheetPanel
				onClose={onClose}
				kicker={kicker}
				title={title}
				subtitle={subtitle}
				closeLabel={closeLabel}
				footer={footer}
				maxHeight={height * maxHeightFrac}
				keyboardAware={keyboardAware}
				testID={testID}
			>
				{children}
			</SheetPanel>
		</SlideUpSheet>
	);
}

interface PanelProps {
	onClose: () => void;
	kicker?: string;
	title?: string;
	subtitle?: string;
	closeLabel: string;
	children: ReactNode;
	footer?: ReactNode;
	maxHeight: number;
	keyboardAware: boolean;
	testID?: string;
}

function SheetPanel({
	onClose,
	kicker,
	title,
	subtitle,
	closeLabel,
	children,
	footer,
	maxHeight,
	keyboardAware,
	testID,
}: PanelProps) {
	const insets = useSafeAreaInsets();

	// The scroll edges' state. Updated from the scroller's own events, and set
	// only when an edge FLIPS — a scroll never re-renders the panel per frame,
	// and the body (the caller's `children`, the same element every render)
	// bails out of the re-render the flip does cause.
	const [edges, setEdges] = useState<Edges>({ top: false, bottom: false });
	const metrics = useRef({ offset: 0, viewport: 0, content: 0 });
	const hasFooter = !!footer;
	const syncEdges = useCallback(() => {
		const { offset, viewport, content } = metrics.current;
		const top = offset > SCROLL_EDGE_EPSILON;
		// Only a pinned footer has a top edge for the body to run under; without
		// one the body ends at the panel's own floor.
		const bottom =
			hasFooter && viewport > 0 && content - viewport - offset > SCROLL_EDGE_EPSILON;
		setEdges((prev) =>
			prev.top === top && prev.bottom === bottom ? prev : { top, bottom },
		);
	}, [hasFooter]);
	const onScroll = useCallback(
		(e: NativeSyntheticEvent<NativeScrollEvent>) => {
			const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
			metrics.current = {
				offset: contentOffset.y,
				viewport: layoutMeasurement.height,
				content: contentSize.height,
			};
			syncEdges();
		},
		[syncEdges],
	);
	const onLayout = useCallback(
		(e: LayoutChangeEvent) => {
			metrics.current.viewport = e.nativeEvent.layout.height;
			syncEdges();
		},
		[syncEdges],
	);
	const onContentSizeChange = useCallback(
		(_w: number, h: number) => {
			metrics.current.content = h;
			syncEdges();
		},
		[syncEdges],
	);

	return (
		<KeyboardAvoidingView
			enabled={keyboardAware}
			behavior={Platform.OS === "ios" ? "padding" : undefined}
			pointerEvents="box-none"
			style={styles.shrinkable}
		>
			{/* A plain View, on purpose. The scrim is a SIBLING under the panel, not
			    an ancestor, so a tap here never reaches it — no swallowing Pressable
			    is needed, and one was the bug: it became the JS responder for every
			    touch on non-pressable body content (a catalog tile, a hand line),
			    and Fabric's scroll view refuses to cancel content touches while an
			    ANCESTOR holds the JS responder (`_shouldDisableScrollInteraction`).
			    A slow drag over the satchel's field guide never scrolled; only a
			    fling — too quick for JS to claim the touch — did. (2026-09-15) */}
			<View
				testID={testID}
				accessibilityViewIsModal
				// VoiceOver's escape gesture (the two-finger Z) is a close, like
				// the × and the scrim. (2026-10-04)
				onAccessibilityEscape={onClose}
				style={styles.shrinkable}
			>
				<Sticker
					color="paper"
					rotate={0}
					radius={0}
					border={BORDER.ink}
					style={[
						styles.panel,
						{
							maxHeight,
							// The panel rides a native Modal, ABOVE the tab bar — the only
							// thing under its footer is the home indicator. (The old
							// `bottomInset="tab"` default padded TAB_SAFE here: ~108pt
							// of dead paper under every sheet's footer. 2026-09-13)
							//
							// The safety belongs to whatever is LAST in the panel. With a
							// pinned footer that is the footer, and the pad stays here;
							// without one the last thing is the scrolling body, and a
							// fixed band under it is dead paper that shortens the
							// scrollable viewport — so it moves onto the scroll content
							// and travels with the last row. (2026-09-14)
							paddingBottom: footer ? SPACE.xl + insets.bottom : 0,
						},
					]}
				>
					<SheetGrabber />
					{/* The header owns the body's top edge: it ends a hair of paper
					    below the title block, and the crease sits on that line. */}
					<View style={styles.header}>
						<View style={styles.titleRow}>
							<View style={styles.titleCol}>
								{!!kicker && <Kicker>{kicker}</Kicker>}
								{!!title && (
									<SectionTitle accessibilityRole="header">{title}</SectionTitle>
								)}
								{!!subtitle && (
									<Hand tone="secondary" style={styles.subtitle}>
										{subtitle}
									</Hand>
								)}
							</View>
							<IconButton
								name="x"
								label={closeLabel}
								accessibilityHint="Closes this sheet"
								onPress={onClose}
								visualSize={SPACE.xxl}
							/>
						</View>
					</View>
					{/* Always laid out (its 2pt is half of the header's breath), so
					    it appears without moving the body; bled past the panel's
					    PAGE_PAD so it runs ink border to ink border. */}
					<ScrollEdge visible={edges.top} bleed={PAGE_PAD} testID="sheet-edge-top" />
					{/* The body must be allowed to SHRINK inside the height-capped panel,
					    or a long sheet (a friend's profile on its Bless tab) grows to its
					    content, the panel clips it, and nothing scrolls — the Cast button
					    sat below the fold on a 17 Pro. (2026-09-12)

					    `flexShrink: 1` alone was not enough: a flex item's automatic
					    minimum size is its content, so the scroller measured at its full
					    body height and pushed the footer — Report · Block on a friend's
					    profile — past the panel's floor and off the bottom of a short
					    window. `minHeight: 0` is what releases it, and every link between
					    the height cap and this scroller carries the same pair, so a cap
					    anywhere in the chain reaches the thing that scrolls. (2026-09-14) */}
					<ScrollView
						style={styles.scroll}
						showsVerticalScrollIndicator={false}
						keyboardShouldPersistTaps="handled"
						onScroll={onScroll}
						scrollEventThrottle={16}
						onLayout={onLayout}
						onContentSizeChange={onContentSizeChange}
						contentContainerStyle={[
							styles.body,
							{ paddingBottom: footer ? SPACE.sm : SPACE.xl + insets.bottom },
						]}
					>
						{children}
					</ScrollView>
					{!!footer && (
						<View style={styles.footer}>
							<ScrollEdge
								visible={edges.bottom}
								overlay="top"
								bleed={PAGE_PAD}
								testID="sheet-edge-bottom"
							/>
							{footer}
						</View>
					)}
				</Sticker>
			</View>
		</KeyboardAvoidingView>
	);
}

// The header's descender room, and what the body keeps of the title's 12pt
// (see `header` below).
const HEADER_BREATH = SPACE.xs;
const BODY_TOP = SPACE.md - HEADER_BREATH - BORDER.ink;

const styles = StyleSheet.create({
	panel: {
		// Top corners only: the panel is flush to the bottom edge.
		borderTopLeftRadius: RADII.xl,
		borderTopRightRadius: RADII.xl,
		paddingHorizontal: PAGE_PAD,
		paddingTop: SPACE.md,
	},
	// The title block plus the paper it keeps between itself and the body's
	// clip edge. The 12pt the title used to get from the scroll content's own
	// top padding is split three ways: HEADER_BREATH here + the scroll-edge
	// rule's BORDER.ink (always laid out) + BODY_TOP in the body. The breath is
	// the title's descenders' room: Caprasimo's "y" and "g" reach 4.2pt below
	// the baseline at 22pt, ~1pt short of the line box's floor, and with
	// SPACE.xxs here the rule sat 3pt under them and read as touching ("All
	// you've done", after/074). At SPACE.xs it sits 5pt clear. The body keeps
	// the rest, so at rest the first row sits exactly where it always did, and
	// its 6pt still clears a tilted first sticker (≤ 1.2°, about 3.6pt at a
	// full-width corner). (2026-10-04)
	header: {
		paddingBottom: HEADER_BREATH,
	},
	titleRow: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: SPACE.sm,
	},
	titleCol: {
		flex: 1,
		minWidth: 0,
		// Optically centers the title block against the 44pt close target.
		paddingTop: SPACE.sm,
	},
	subtitle: {
		marginTop: SPACE.xxs,
	},
	// Every wrapper between the window and the scrolling body. A link that
	// cannot shrink turns the panel's height cap into a clip.
	shrinkable: { flexShrink: 1, minHeight: 0 },
	// The scroller runs LIST_BLEED past the panel's inset on each side...
	scroll: { flexGrow: 0, flexShrink: 1, minHeight: 0, marginHorizontal: -LIST_BLEED },
	// ...and its content pads back by the same, so rows keep the PAGE_PAD
	// inset while shadows and tilted corners fit inside the clip. BODY_TOP on
	// top + the header's breath + the edge rule's 2pt = the 12pt (SPACE.md)
	// the first row has always sat below the title.
	body: {
		paddingTop: BODY_TOP,
		paddingHorizontal: LIST_BLEED,
	},
	footer: {
		paddingTop: SPACE.md,
	},
});

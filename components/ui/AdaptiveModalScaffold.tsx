import React from "react";
import {
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	View,
	useWindowDimensions,
	type ModalProps,
	type ScrollViewProps,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	BORDER,
	MODAL_BACKDROP_BG,
	RADII,
	SHADOW_SM,
	SPACE,
	STICKER_SHADOW,
	TILT,
	UI_COLORS,
} from "@/constants/theme";
import { DialogCloseRow } from "./DialogCloseRow";
import { ScrollEdge, useScrollEdge } from "./ScrollEdge";

interface Props {
	visible: boolean;
	onRequestClose: () => void;
	children: React.ReactNode;
	maxWidth?: number;
	animationType?: ModalProps["animationType"];
	keyboardAware?: boolean;
	showCloseButton?: boolean;
	closeLabel?: string;
	/** A heading that shares the close rail's row (see DialogCloseRow). */
	closeRowContent?: React.ReactNode;
	bare?: boolean;
	/**
	 * A full-screen MODE, not a dialog: the frame is the whole window (safe
	 * areas as padding, no gutter, no border, no radius, no shadow) and it
	 * slides up like a screen. For the things a player steps INTO — the dig —
	 * rather than a card they answer. (2026-09-13)
	 */
	fullScreen?: boolean;
	/**
	 * A bottom SHEET: full width, hung from the bottom edge, top corners only,
	 * as tall as its content up to the window minus the top inset. For a
	 * ledger with an unknown number of rows — the dig's tally — where a
	 * centred card would clip or scroll a short list. Slides up. (2026-09-14)
	 */
	sheet?: boolean;
	/**
	 * The sanctioned STICKER-CARD frame: the dialog is a paper card with the
	 * heavy ink border, the dialog lean (TILT.dialog) and the hard sticker
	 * shadow, its × pinned on the card above the scroller (`showCloseButton`
	 * defaults on). The frame does not clip — a clip would erase the shadow —
	 * so the scroller clips the words itself, and the side inset belongs to
	 * the scrolling body, where a tilted sticker inside keeps its overhang.
	 * Folds the Season's tale / guide / story card (seasonCard.ts) into the
	 * primitive. (2026-10-04, Season ask 4)
	 */
	card?: boolean;
	frameStyle?: StyleProp<ViewStyle>;
	contentContainerStyle?: StyleProp<ViewStyle>;
	scrollViewProps?: Omit<
		ScrollViewProps,
		"contentContainerStyle" | "children"
	>;
	testID?: string;
	presentation?: "native" | "inline";
	/**
	 * Tapping the scrim closes the dialog. Inline dialogs always do (they have
	 * no hardware back); native ones opt in — a spend/decision dialog should
	 * NOT dismiss on a stray tap, an explainer may. (2026-09-11)
	 */
	dismissOnBackdrop?: boolean;
	/**
	 * The native Modal has finished its exit animation (iOS; Android has no
	 * exit animation and never calls it). A host that keeps its last screen
	 * mounted through the slide-out releases it here. (2026-09-16)
	 */
	onDismiss?: () => void;
}

/**
 * Phone-first modal shell that remains usable on compact-height windows and
 * with accessibility text sizes. The frame is sized from the current window
 * (not a module snapshot), respects safe areas, and always gives dense content
 * a scroll path.
 */
export function AdaptiveModalScaffold({
	visible,
	onRequestClose,
	children,
	maxWidth = 430,
	animationType = "fade",
	keyboardAware = false,
	showCloseButton,
	closeLabel = "Close",
	closeRowContent,
	bare = false,
	fullScreen = false,
	sheet = false,
	card = false,
	frameStyle,
	contentContainerStyle,
	scrollViewProps,
	testID,
	presentation = "native",
	dismissOnBackdrop,
	onDismiss,
}: Props) {
	const { width, height } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const gutter = width < 360 ? SPACE.sm : SPACE.md;
	const availableWidth = Math.max(280, width - gutter * 2);
	const availableHeight = Math.max(
		240,
		height - insets.top - insets.bottom - gutter * 2,
	);
	// A card's × is part of the card; every other frame opts in.
	const showClose = showCloseButton ?? card;

	const body = (
		<View
			testID={testID}
			accessibilityViewIsModal
			onAccessibilityEscape={onRequestClose}
			style={[
				styles.frame,
				fullScreen
					? styles.fullFrame
					: sheet
						? styles.sheetFrame
						: card
							? styles.cardFrame
							: bare
								? styles.bareFrame
								: styles.paperFrame,
				fullScreen
					? { width, height, paddingTop: insets.top, paddingBottom: insets.bottom }
					: sheet
						? {
								width,
								maxHeight: height - insets.top - gutter,
								paddingBottom: insets.bottom,
							}
						: {
								width: Math.min(maxWidth, availableWidth),
								maxHeight: availableHeight,
							},
				frameStyle,
			]}
		>
			<RailAndScroll
				showCloseButton={showClose}
				onRequestClose={onRequestClose}
				closeLabel={closeLabel}
				closeRowContent={closeRowContent}
				scrollViewProps={scrollViewProps}
				contentContainerStyle={[card && styles.cardBody, contentContainerStyle]}
			>
				{children}
			</RailAndScroll>
		</View>
	);

	const backdrop = (
		<KeyboardAvoidingView
			enabled={keyboardAware}
			behavior={Platform.OS === "ios" ? "padding" : undefined}
			style={[
				styles.backdrop,
				presentation === "inline" && styles.inlineBackdrop,
				fullScreen
					? styles.fullBackdrop
					: sheet
						? styles.sheetBackdrop
						: {
							paddingTop: insets.top + gutter,
							paddingBottom: insets.bottom + gutter,
							paddingHorizontal: gutter,
						},
			]}
		>
			{presentation === "inline" || dismissOnBackdrop ? (
				<Pressable
					accessible={false}
					onPress={onRequestClose}
					style={StyleSheet.absoluteFill}
				/>
			) : null}
			{body}
		</KeyboardAvoidingView>
	);

	if (!visible && presentation === "inline") return null;
	if (presentation === "inline") return backdrop;
	return (
		<Modal
			visible={visible}
			transparent
			animationType={animationType}
			onRequestClose={onRequestClose}
			onDismiss={onDismiss}
			statusBarTranslucent
		>
			{backdrop}
		</Modal>
	);
}

/**
 * The pinned close rail and the one scroller under it. When the rail is shown
 * it owns the scroller's top edge the way `Sheet`'s header does: the app's
 * scroll-edge rule lies on the rail's bottom edge while a row has scrolled
 * under it, so dialog content never slides up into the × with nothing between
 * them. Its own component so the edge state lives inside the Modal and is
 * fresh on every opening. (2026-10-04)
 */
function RailAndScroll({
	showCloseButton,
	onRequestClose,
	closeLabel,
	closeRowContent,
	scrollViewProps,
	contentContainerStyle,
	children,
}: {
	showCloseButton: boolean;
	onRequestClose: () => void;
	closeLabel: string;
	closeRowContent?: React.ReactNode;
	scrollViewProps?: Props["scrollViewProps"];
	contentContainerStyle?: StyleProp<ViewStyle>;
	children: React.ReactNode;
}) {
	const callerOnScroll = scrollViewProps?.onScroll;
	const edge = useScrollEdge({ onScroll: callerOnScroll });
	return (
		<>
			{showCloseButton && (
				<View>
					<DialogCloseRow onPress={onRequestClose} label={closeLabel}>
						{closeRowContent}
					</DialogCloseRow>
					{/* On the rail's own bottom edge, taking no room. */}
					<ScrollEdge visible={edge.edgeVisible} overlay="bottom" testID="dialog-edge-top" />
				</View>
			)}
			<ScrollView
				bounces={false}
				showsVerticalScrollIndicator={false}
				keyboardShouldPersistTaps="handled"
				contentInsetAdjustmentBehavior="automatic"
				{...scrollViewProps}
				// Only a dialog with a pinned rail listens; the caller's own
				// handler (if any) still runs.
				onScroll={showCloseButton ? edge.onScroll : callerOnScroll}
				scrollEventThrottle={
					scrollViewProps?.scrollEventThrottle ??
					(showCloseButton ? edge.scrollEventThrottle : undefined)
				}
				contentContainerStyle={[styles.content, contentContainerStyle]}
			>
				{children}
			</ScrollView>
		</>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: MODAL_BACKDROP_BG,
	},
	inlineBackdrop: {
		position: "absolute",
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		zIndex: 1000,
		elevation: 1000,
	},
	frame: {
		overflow: "hidden",
	},
	paperFrame: {
		borderWidth: 2,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.xxl,
		backgroundColor: UI_COLORS.surface,
		...SHADOW_SM,
	},
	bareFrame: {
		overflow: "visible",
	},
	// The sticker card: paper, the heavy ink border, the dialog lean, the hard
	// sticker shadow. Unclipped (the shadow lives outside the box); a small
	// paper strip under a line the scroller cuts mid-scroll. (Season's card,
	// tokens unchanged.)
	cardFrame: {
		overflow: "visible",
		backgroundColor: UI_COLORS.surface,
		borderWidth: BORDER.heavy,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.xxl,
		paddingBottom: SPACE.sm,
		transform: [{ rotate: `${TILT.dialog}deg` }],
		...STICKER_SHADOW,
	},
	// The card's side inset rides the scrolling body, so tilted stickers in it
	// keep their overhang inside the clip.
	cardBody: {
		paddingHorizontal: SPACE.lg,
		paddingBottom: SPACE.sm,
	},
	// The full-screen mode: the page's own cream, edge to edge.
	fullFrame: {
		backgroundColor: UI_COLORS.surfaceMuted,
	},
	fullBackdrop: {
		backgroundColor: UI_COLORS.surfaceMuted,
	},
	// The bottom sheet: hung from the bottom edge, top corners only, the ink
	// border on three sides (the fourth is the screen's edge).
	sheetBackdrop: {
		justifyContent: "flex-end",
	},
	sheetFrame: {
		borderWidth: BORDER.ink,
		borderBottomWidth: 0,
		borderColor: UI_COLORS.border,
		borderTopLeftRadius: RADII.xxl,
		borderTopRightRadius: RADII.xxl,
		backgroundColor: UI_COLORS.surface,
		...SHADOW_SM,
	},
	content: {
		flexGrow: 1,
	},
});

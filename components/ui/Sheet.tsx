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
//     reads as clipped even when it isn't.
//
// It is an UNMANAGED native Modal (through SlideUpSheet), so it takes the
// `useUnmanagedModalHold` latch: while open the popup queue admits nothing and
// drains anything presented, so a foreground poll can't wedge a queued popup
// over it (#50152).

import type { ReactNode } from "react";
import {
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	View,
	useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	BORDER,
	PAGE_PAD,
	RADII,
	SPACE,
} from "@/constants/theme";
import { IconButton } from "./IconButton";
import { useUnmanagedModalHold } from "./PopupQueue";
import { SheetGrabber, SlideUpSheet } from "./SlideUpSheet";
import { Sticker } from "./Sticker";
import { Hand, Kicker, SectionTitle } from "./Text";

// How much of the window the panel may claim before its body starts scrolling.
const DEFAULT_MAX_HEIGHT_FRAC = 0.85;

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
	const insets = useSafeAreaInsets();

	return (
		<SlideUpSheet
			open={open}
			onClose={onClose}
			backdropLabel={closeLabel}
			overlay={overlay}
			presentation={presentation}
			modalVisible={modalVisible}
			flush
		>
			<KeyboardAvoidingView
				enabled={keyboardAware}
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				pointerEvents="box-none"
				style={styles.shrinkable}
			>
			{/* Swallows taps on the panel so they don't reach the dismissing scrim. */}
			<Pressable
				onPress={() => {}}
				testID={testID}
				accessibilityViewIsModal
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
							maxHeight: height * maxHeightFrac,
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
						contentContainerStyle={[
							styles.body,
							{ paddingBottom: footer ? SPACE.sm : SPACE.xl + insets.bottom },
						]}
					>
						{children}
					</ScrollView>
					{!!footer && <View style={styles.footer}>{footer}</View>}
				</Sticker>
			</Pressable>
			</KeyboardAvoidingView>
		</SlideUpSheet>
	);
}

const styles = StyleSheet.create({
	panel: {
		// Top corners only: the panel is flush to the bottom edge.
		borderTopLeftRadius: RADII.xl,
		borderTopRightRadius: RADII.xl,
		paddingHorizontal: PAGE_PAD,
		paddingTop: SPACE.md,
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
	scroll: { flexGrow: 0, flexShrink: 1, minHeight: 0 },
	body: {
		paddingTop: SPACE.md,
	},
	footer: {
		paddingTop: SPACE.md,
	},
});

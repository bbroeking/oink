// The scroll edge: the rule a fixed header (a page crown, a sheet's title, a
// dialog's close rail, a pinned segment row) shows on its bottom edge once the
// content under it has scrolled — and a pinned footer on its top edge while
// there is more to come. ONE drawing app-wide, so a crown on the cream page
// and a title on a paper sheet own their edges the same way:
//
//   · the crown's own rule, run full width — `TITLE_RULE`'s ink at
//     OPACITY.rule, BORDER.ink tall. It reads on cream and on paper alike
//     (≈1.9:1, a rule, not a word), where a barkMute hairline vanished on the
//     cream pages, and it says "the title's rule, extended" rather than
//     inventing a separator. No blur, no shadow, no gradient;
//   · ALWAYS LAID OUT: the rule is in the tree at rest and only its opacity
//     changes, so showing it never moves anything by a point (or, with
//     `overlay`, it is absolutely placed on its parent's edge and takes no
//     room at all);
//   · a STATE, not a motion: it appears with the first row that slides under
//     and leaves when the list is back at the top, tracking the finger the
//     way the system nav-bar edge does;
//   · decoration: out of the accessibility tree.
//
//   const edge = useScrollEdge();
//   <PageHeader … />
//   <ScrollEdge visible={edge.edgeVisible} />
//   <FlatList onScroll={edge.onScroll} scrollEventThrottle={edge.scrollEventThrottle} … />
//
// A sticky header inside the scroller passes `threshold` = its own y in the
// content (measure it with onLayout): the edge shows once the list has
// scrolled past where the header pins. A list that already has an onScroll
// passes it as `onScroll` and gets one composed handler back; an
// `Animated.event` takes `edge.onScroll` as its `listener`.
//
// (2026-10-04 polish: Sheet / AdaptiveModalScaffold use it built in; the
// Friends, Season, Shop and Barn asks A-4 / a / 3 are this.)
import React, { useCallback, useRef, useState } from "react";
import {
	StyleSheet,
	View,
	type LayoutChangeEvent,
	type NativeScrollEvent,
	type NativeSyntheticEvent,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import { BORDER, OPACITY, TITLE_RULE } from "@/constants/theme";

/** A scroll edge counts as covered past this many points (ignores a sub-pixel settle). */
export const SCROLL_EDGE_EPSILON = 1;

/** Report scroll often enough that the edge lands with the first row. */
const SCROLL_EDGE_THROTTLE = 16;

type ScrollHandler = (e: NativeSyntheticEvent<NativeScrollEvent>) => void;

export interface ScrollEdgeState {
	/** True once content has scrolled under the edge. */
	edgeVisible: boolean;
	/** Hand to the scroller's `onScroll` (it calls the caller's own handler too). */
	onScroll: ScrollHandler;
	/** Hand to the scroller's `scrollEventThrottle`. */
	scrollEventThrottle: number;
}

/**
 * Tracks whether a scroller's content has moved under the fixed header above
 * it. Sets state only when that FLIPS, so a scroll never re-renders the host
 * per frame.
 */
export function useScrollEdge({
	threshold = 0,
	onScroll,
}: {
	/** Content offset (pt) past which the edge shows — a sticky header's own y. */
	threshold?: number;
	/** The scroller's existing handler, composed into the returned one. */
	onScroll?: ScrollHandler;
} = {}): ScrollEdgeState {
	const [edgeVisible, setEdgeVisible] = useState(false);
	const handler = useCallback<ScrollHandler>(
		(e) => {
			const next = e.nativeEvent.contentOffset.y > threshold + SCROLL_EDGE_EPSILON;
			setEdgeVisible((prev) => (prev === next ? prev : next));
			onScroll?.(e);
		},
		[threshold, onScroll],
	);
	return { edgeVisible, onScroll: handler, scrollEventThrottle: SCROLL_EDGE_THROTTLE };
}

export interface ScrollEdgeBelowState {
	/** True while the scroller has more content below its viewport. */
	edgeVisible: boolean;
	onScroll: ScrollHandler;
	/** Hand to the scroller's `onLayout` (the viewport). */
	onLayout: (e: LayoutChangeEvent) => void;
	/** Hand to the scroller's `onContentSizeChange` (the content). */
	onContentSizeChange: (width: number, height: number) => void;
	scrollEventThrottle: number;
}

/**
 * The pinned footer's twin of `useScrollEdge`: true while the scroller has
 * more content BELOW its viewport, so the footer pinned under it shows the
 * rule on its top edge and a row cut there reads as "more below" rather than
 * as a card half under the bar (the dig's pouch, after/093). `Sheet` keeps
 * the same rule for its own footer. Sets state only when that FLIPS.
 * (2026-10-04)
 *
 *   const below = useScrollEdgeBelow();
 *   <ScrollView onScroll={below.onScroll} onLayout={below.onLayout}
 *     onContentSizeChange={below.onContentSizeChange}
 *     scrollEventThrottle={below.scrollEventThrottle} … />
 *   <View style={footer}><ScrollEdge visible={below.edgeVisible} overlay="top" />…</View>
 */
export function useScrollEdgeBelow(): ScrollEdgeBelowState {
	const [edgeVisible, setEdgeVisible] = useState(false);
	const metrics = useRef({ offset: 0, viewport: 0, content: 0 });
	const sync = useCallback(() => {
		const { offset, viewport, content } = metrics.current;
		const next = viewport > 0 && content - viewport - offset > SCROLL_EDGE_EPSILON;
		setEdgeVisible((prev) => (prev === next ? prev : next));
	}, []);
	const onScroll = useCallback<ScrollHandler>(
		(e) => {
			const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
			metrics.current = {
				offset: contentOffset.y,
				viewport: layoutMeasurement.height,
				content: contentSize.height,
			};
			sync();
		},
		[sync],
	);
	const onLayout = useCallback(
		(e: LayoutChangeEvent) => {
			metrics.current.viewport = e.nativeEvent.layout.height;
			sync();
		},
		[sync],
	);
	const onContentSizeChange = useCallback(
		(_width: number, height: number) => {
			metrics.current.content = height;
			sync();
		},
		[sync],
	);
	return {
		edgeVisible,
		onScroll,
		onLayout,
		onContentSizeChange,
		scrollEventThrottle: SCROLL_EDGE_THROTTLE,
	};
}

interface Props {
	/** Shown once content runs under the edge — `useScrollEdge().edgeVisible`. */
	visible: boolean;
	/**
	 * Absolutely place the rule on this edge of its parent instead of laying it
	 * out in flow — for a host that must not grow by the rule's 2pt (a sheet's
	 * footer, a dialog's close rail).
	 */
	overlay?: "top" | "bottom";
	/** How far it runs past the host's sides (a padded panel's PAGE_PAD), so it spans ink border to ink border. */
	bleed?: number;
	style?: StyleProp<ViewStyle>;
	testID?: string;
}

/** The scroll-edge rule. Always rendered; `visible` only changes its opacity. */
export function ScrollEdge({ visible, overlay, bleed = 0, style, testID }: Props) {
	return (
		<View
			testID={testID}
			pointerEvents="none"
			accessible={false}
			importantForAccessibility="no-hide-descendants"
			style={[
				styles.rule,
				overlay
					? [styles.overlay, overlay === "top" ? styles.top : styles.bottom, { left: -bleed, right: -bleed }]
					: bleed
						? { marginHorizontal: -bleed }
						: null,
				{ opacity: visible ? OPACITY.rule : 0 },
				style,
			]}
		/>
	);
}

const styles = StyleSheet.create({
	// TITLE_RULE's ink, full width, BORDER.ink tall. Its opacity is the state.
	rule: {
		height: BORDER.ink,
		backgroundColor: TITLE_RULE.backgroundColor,
	},
	overlay: { position: "absolute" },
	top: { top: 0 },
	bottom: { bottom: 0 },
});

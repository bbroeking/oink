// Field Guide ceremony reveal — the Book-style unlock a page gets the first time
// the player MEETS its economy object (spec 16). Mounted ONCE (app/_layout); it
// listens to the module reveal queue (utils/fieldGuide) and drains it one page
// at a time through the popup queue.
//
// Queue-slotted (id 'fieldGuide', priority 50 — below the real ceremonies
// schism/finale/rituals so a page reveal never preempts a season moment) and
// visible-driven per the PopupQueue contract: the native Modal stays mounted,
// `visible` comes from the slot, and dismiss is two-phase — release() hides the
// modal, then the backing state clears (and the queue advances) a
// POPUP_TEARDOWN_MS beat later. Multiple unlocks in one session present one at a
// time through this same slot.
//
// PLACEHOLDER ASSET: pages without a fitting sprite show a drawn ink-silhouette
// (see docs/specs/reports/16-field-guide-art-todo.md), never emoji.
import { useCallback, useEffect, useRef, useState } from "react";
import {
	Animated,
	Easing,
	Image,
	Modal,
	StyleSheet,
	Text,
	View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Glyph } from "./ui/Glyph";
import { Button } from "./ui/Button";
import { usePopupSlot, POPUP_TEARDOWN_MS } from "./ui/PopupQueue";
import {
	dequeueReveal,
	peekPendingReveal,
	subscribeFieldGuideReveals,
	type FieldGuidePageId,
} from "@/utils/fieldGuide";
import {
	fieldGuideNumbers,
	refreshFieldGuideNumbers,
} from "@/utils/fieldGuideConfig";
import { FIELD_GUIDE_ENTRIES } from "@/constants/fieldGuide";
import {
	FONTS,
	KICKER_TEXT,
	MODAL_BACKDROP_BG,
	RADII,
	STICKER_SHADOW,
	SPACE,
	WHIMSY,
} from "@/constants/theme";

const ENTRY_BY_ID = Object.fromEntries(
	FIELD_GUIDE_ENTRIES.map((e) => [e.id, e])
) as Record<FieldGuidePageId, (typeof FIELD_GUIDE_ENTRIES)[number]>;

export function FieldGuideReveal() {
	// The page currently being revealed — mirrors the head of the reveal queue.
	const [pageId, setPageId] = useState<FieldGuidePageId | null>(() =>
		peekPendingReveal()
	);
	const slot = usePopupSlot("fieldGuide", pageId != null, 50);
	const pop = useRef(new Animated.Value(0)).current;
	const teardown = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Follow the queue: any enqueue/dequeue re-reads the head. While a reveal is
	// on screen we DON'T swap it out from under the player — only advance once
	// the current one has been dismissed (pageId is cleared in handleDone).
	useEffect(() => {
		const sync = () => setPageId((cur) => cur ?? peekPendingReveal());
		const unsub = subscribeFieldGuideReveals(sync);
		sync();
		return unsub;
	}, []);

	// Freshen the config numbers so the printed value line is never stale.
	useEffect(() => {
		if (slot.visible) refreshFieldGuideNumbers().catch(() => {});
	}, [slot.visible]);

	// Pop-in when presented; reset when not (a re-present replays the beat).
	useEffect(() => {
		if (slot.visible) {
			Haptics.notificationAsync(
				Haptics.NotificationFeedbackType.Success
			).catch(() => {});
			Animated.spring(pop, {
				toValue: 1,
				tension: 80,
				friction: 6,
				useNativeDriver: true,
			}).start();
		} else {
			pop.setValue(0);
		}
	}, [slot.visible, pop]);

	useEffect(
		() => () => {
			if (teardown.current) clearTimeout(teardown.current);
		},
		[]
	);

	// Two-phase dismiss per the PopupQueue contract: hide now, then a beat later
	// dequeue this page and advance to whatever's next in line.
	const handleDone = useCallback(() => {
		slot.release();
		const done = pageId;
		teardown.current = setTimeout(() => {
			if (done) dequeueReveal(done);
			setPageId(peekPendingReveal());
		}, POPUP_TEARDOWN_MS);
	}, [slot, pageId]);

	const entry = pageId ? ENTRY_BY_ID[pageId] : null;
	const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

	return (
		<Modal
			visible={slot.visible}
			transparent
			animationType="fade"
			onRequestClose={handleDone}
		>
			<View style={styles.backdrop}>
				{entry && (
					<View style={styles.card}>
						<Text style={styles.kicker}>★ a new page ★</Text>
						<Animated.View style={[styles.well, { transform: [{ scale }] }]}>
							{entry.image ? (
								<Image
									source={entry.image}
									style={styles.art}
									resizeMode="contain"
								/>
							) : entry.glyph ? (
								<Glyph name={entry.glyph} size={92} />
							) : (
								// Drawn ink-silhouette placeholder (no sprite yet).
								<View style={styles.placeholder} />
							)}
						</Animated.View>
						<Text style={styles.title}>{entry.name}</Text>
						<Text style={styles.whimsy}>{entry.whimsy}</Text>
						<View style={styles.rule} />
						<Text style={styles.value}>{entry.value(fieldGuideNumbers())}</Text>
						<Button
							variant="dark"
							size="md"
							onPress={handleDone}
							style={{ marginTop: SPACE.md }}
						>
							Oink!
						</Button>
					</View>
				)}
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: MODAL_BACKDROP_BG,
		padding: SPACE.xl,
	},
	card: {
		width: "100%",
		maxWidth: 340,
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.xxl,
		paddingHorizontal: SPACE.xl,
		paddingVertical: SPACE.xl,
		alignItems: "center",
		...STICKER_SHADOW,
	},
	kicker: {
		...KICKER_TEXT,
		marginBottom: SPACE.sm,
	},
	well: {
		width: 132,
		height: 132,
		borderRadius: RADII.pill,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream,
		alignItems: "center",
		justifyContent: "center",
		marginVertical: SPACE.xs,
	},
	art: { width: 96, height: 96 },
	// A soft ink blob — reads as "art coming soon", not a broken image.
	placeholder: {
		width: 84,
		height: 84,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.ink,
		opacity: 0.18,
	},
	title: {
		...({ fontFamily: FONTS.whimsy } as const),
		fontSize: 24,
		color: WHIMSY.ink,
		textAlign: "center",
		marginTop: SPACE.sm,
	},
	whimsy: {
		fontFamily: FONTS.hand,
		fontSize: 15,
		lineHeight: 21,
		color: WHIMSY.ink,
		textAlign: "center",
		marginTop: SPACE.xs,
	},
	rule: {
		height: 2,
		width: 48,
		backgroundColor: WHIMSY.ink,
		opacity: 0.25,
		borderRadius: 1,
		marginVertical: SPACE.sm,
	},
	value: {
		fontFamily: FONTS.body,
		fontSize: 14,
		lineHeight: 20,
		color: WHIMSY.mute,
		textAlign: "center",
	},
});

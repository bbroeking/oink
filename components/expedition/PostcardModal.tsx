import React, { useEffect, useMemo } from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";
import {
	ART_SIZE,
	BORDER,
	RADII,
	SPACE,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { Sticker, Tape } from "@/components/ui/Sticker";
import { AdaptiveModalScaffold } from "@/components/ui/AdaptiveModalScaffold";
import { DialogCloseRow } from "@/components/ui/DialogCloseRow";
import { Button } from "@/components/ui/Button";
import { Glyph } from "@/components/ui/Glyph";
import { T } from "@/components/ui/Text";
import { RosiePose } from "./RosiePose";
import { useSpringEntrance } from "./Ceremony";
import type { TripReport } from "@/utils/expedition";

// The return ceremony — a postcard, itemized and honest. A centered dialog
// (`AdaptiveModalScaffold`, bare so the tape can hang off the card's edge) that
// springs up and settles, pinned by a strip of tape; the finds stagger in one
// after another; shiny (quality-2) finds wear a sparkle frame. One comedy beat
// per trip. All motion routes through the reduced-motion policy.

// Drawing geometry: the postcard's stamp-sized Rosie, and the tape's half-width
// used to centre it over the card's top edge.
const POSTCARD_ROSIE = 150;
const TAPE_W = 64;
const TAPE_TOP = -7;

export function PostcardModal({
	report,
	onClose,
}: {
	report: TripReport;
	onClose: () => void;
}) {
	const policy = useMotionPolicy();
	const stalled = !!report.wallStory;

	// Shared ceremony entrance (Fix 5) — the same spring-up the chapter-clear and
	// boss-victory cards use. The finds stagger stays local (postcard-specific).
	const cardStyle = useSpringEntrance();
	const findAnims = useMemo(
		() => report.finds.map(() => new Animated.Value(0)),
		[report.finds]
	);

	useEffect(() => {
		if (policy.reduceMotion) {
			findAnims.forEach((a) => a.setValue(1));
			return;
		}
		findAnims.forEach((a) => a.setValue(0));
		Animated.stagger(
			60,
			findAnims.map((a) =>
				Animated.timing(a, {
					toValue: 1,
					duration: 220,
					easing: Easing.out(Easing.quad),
					useNativeDriver: true,
				})
			)
		).start();
	}, [policy.reduceMotion, findAnims]);

	return (
		<AdaptiveModalScaffold
			visible
			onRequestClose={onClose}
			bare
			contentContainerStyle={styles.scroll}
		>
			<Animated.View style={cardStyle}>
				<Sticker color="paper" rotate={-1} radius={RADII.md} style={styles.card}>
					<DialogCloseRow onPress={onClose} label="Tuck the postcard away" />
					<T role="kicker" tone="accent" align="center">
						★ a postcard from the road
					</T>
					<View style={styles.art}>
						<RosiePose
							mood={stalled ? "tired" : "happy"}
							size={POSTCARD_ROSIE}
						/>
					</View>

					<T role="sectionTitle" align="center">
						{stalled ? "She came home for a little help" : "Rosie rambled on!"}
					</T>
					<T role="bodySm" tone="secondary" align="center" style={styles.meta}>
						{report.segmentsWalked} segment
						{report.segmentsWalked === 1 ? "" : "s"} walked · {report.cappedH}h of{" "}
						{report.elapsedH}h away
					</T>

					{report.wallStory && (
						<Sticker
							color="cream"
							rotate={0}
							radius={RADII.md}
							shadow="none"
							style={styles.storyBox}
						>
							<T role="hand">{report.wallStory}</T>
						</Sticker>
					)}

					<T role="kickerPillSm" tone="accent" style={styles.sectionKicker}>
						★ satchel
					</T>
					{report.finds.length === 0 ? (
						<T role="bodySm" tone="secondary">
							Nothing in the satchel this time — just a good walk.
						</T>
					) : (
						<View style={styles.finds}>
							{report.finds.map((f, i) => (
								<Animated.View
									key={`${f.id}-${i}`}
									style={[
										styles.find,
										f.quality === 2 && styles.findShiny,
										{
											opacity: findAnims[i],
											transform: [
												{
													translateY: findAnims[i].interpolate({
														inputRange: [0, 1],
														outputRange: [8, 0],
													}),
												},
											],
										},
									]}
								>
									{f.quality === 2 && (
										<Glyph name="sparkle" size={ART_SIZE.mark} />
									)}
									<T role="body" style={styles.findName}>
										{f.name}
									</T>
									<T role="kickerPillSm" tone="secondary">
										{f.kind}
									</T>
								</Animated.View>
							))}
						</View>
					)}

					{report.gearMoments.length > 0 && (
						<View style={styles.moments}>
							{report.gearMoments.map((m, i) => (
								<T key={i} role="bodySm">
									• {m}
								</T>
							))}
						</View>
					)}

					{report.tuckedHome && (
						<T role="hand" tone="secondary" style={styles.tuckedHome}>
							{report.tuckedHome} is back in her deck, a little muddier.
						</T>
					)}

					<View style={styles.comedy}>
						<T role="hand" tone="secondary" align="center" style={styles.italic}>
							{report.comedyBeat}
						</T>
					</View>

					<Button
						variant="primary"
						full
						onPress={onClose}
						accessibilityHint="Closes the postcard and returns to the journal."
					>
						Tuck the postcard away
					</Button>
				</Sticker>
				{/* Pinned to the road journal with a strip of tape. */}
				<Tape
					color="sun"
					rotate={-8}
					width={TAPE_W}
					style={[styles.tape, { marginLeft: -TAPE_W / 2 }]}
				/>
			</Animated.View>
		</AdaptiveModalScaffold>
	);
}

const styles = StyleSheet.create({
	scroll: { justifyContent: "center" },
	// The close rail carries the card's top inset, so the sticker only pads its
	// sides and foot.
	card: {
		paddingHorizontal: SPACE.lg,
		paddingBottom: SPACE.lg,
	},
	tape: {
		position: "absolute",
		top: TAPE_TOP,
		left: "50%",
	},
	art: {
		alignItems: "center",
		backgroundColor: WHIMSY.sky,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.md,
		marginVertical: SPACE.sm,
		paddingVertical: SPACE.sm,
	},
	meta: { marginTop: SPACE.xs },
	storyBox: {
		padding: SPACE.md,
		marginTop: SPACE.md,
	},
	sectionKicker: {
		marginTop: SPACE.md,
		marginBottom: SPACE.sm,
	},
	finds: { gap: SPACE.xs },
	find: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		paddingVertical: SPACE.xs,
		paddingHorizontal: SPACE.sm,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.sm,
		backgroundColor: WHIMSY.paper,
	},
	findShiny: { backgroundColor: WHIMSY.slopBand },
	findName: { flex: 1 },
	moments: { marginTop: SPACE.md, gap: SPACE.xs },
	tuckedHome: {
		marginTop: SPACE.md,
	},
	comedy: {
		marginTop: SPACE.md,
		marginBottom: SPACE.lg,
		paddingTop: SPACE.md,
		borderTopWidth: BORDER.hair,
		borderColor: UI_COLORS.uiMuted,
	},
	italic: {
		fontStyle: "italic",
	},
});

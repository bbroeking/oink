import React, { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Animated, Easing } from "react-native";
import {
	MODAL_BACKDROP_BG,
	PAGE_PAD,
	RADII,
	SPACE,
	STICKER_SHADOW,
	TYPE,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { Sticker, Tape } from "@/components/ui/Sticker";
import { Button } from "@/components/ui/Button";
import { Glyph } from "@/components/ui/Glyph";
import { RosiePose } from "./RosiePose";
import { useSpringEntrance } from "./Ceremony";
import type { TripReport } from "@/utils/expedition";

// The return ceremony — a postcard, itemized and honest. It springs up and
// settles, pinned by a strip of tape; the finds stagger in one after another;
// shiny (quality-2) finds wear a sparkle frame. One comedy beat per trip. All
// motion routes through the reduced-motion policy (instant + crossfade when off).
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
		<View style={styles.backdrop}>
			<ScrollView
				contentContainerStyle={styles.scroll}
				showsVerticalScrollIndicator={false}
			>
				<Animated.View style={cardStyle}>
					<Sticker color="paper" rotate={-1} radius={RADII.md} style={styles.card}>
						<Text style={styles.kicker}>★ a postcard from the road</Text>
						<View style={styles.art}>
							<RosiePose mood={stalled ? "tired" : "happy"} size={150} />
						</View>

						<Text style={styles.title}>
							{stalled ? "She came home for a little help" : "Rosie rambled on!"}
						</Text>
						<Text style={styles.meta}>
							{report.segmentsWalked} segment
							{report.segmentsWalked === 1 ? "" : "s"} walked · {report.cappedH}h of{" "}
							{report.elapsedH}h away
						</Text>

						{report.wallStory && (
							<View style={styles.storyBox}>
								<Text style={styles.storyText}>{report.wallStory}</Text>
							</View>
						)}

						<Text style={styles.sectionKicker}>★ satchel</Text>
						{report.finds.length === 0 ? (
							<Text style={styles.emptyFinds}>
								Nothing in the satchel this time — just a good walk.
							</Text>
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
											<Glyph name="sparkle" size={14} style={styles.findGlyph} />
										)}
										<Text style={styles.findName}>
											{f.name}
										</Text>
										<Text style={styles.findKind}>{f.kind}</Text>
									</Animated.View>
								))}
							</View>
						)}

						{report.gearMoments.length > 0 && (
							<View style={styles.moments}>
								{report.gearMoments.map((m, i) => (
									<Text key={i} style={styles.moment}>
										• {m}
									</Text>
								))}
							</View>
						)}

						{report.tuckedHome && (
							<Text style={styles.tuckedHome}>
								{report.tuckedHome} is back in her deck, a little muddier.
							</Text>
						)}

						<View style={styles.comedy}>
							<Text style={styles.comedyText}>{report.comedyBeat}</Text>
						</View>

						<Button variant="primary" full onPress={onClose}>
							Tuck the postcard away
						</Button>
					</Sticker>
					{/* Pinned to the road journal with a strip of tape. */}
					<Tape color="sun" rotate={-8} width={64} style={styles.tape} />
				</Animated.View>
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: MODAL_BACKDROP_BG,
		justifyContent: "center",
		zIndex: 50,
	},
	scroll: { padding: PAGE_PAD, paddingVertical: SPACE.xl, flexGrow: 1, justifyContent: "center" },
	card: { padding: SPACE.lg, ...STICKER_SHADOW },
	tape: {
		position: "absolute",
		top: -7,
		left: "50%",
		marginLeft: -32,
	},
	kicker: { ...TYPE.kicker, color: UI_COLORS.action, textAlign: "center" },
	art: {
		alignItems: "center",
		backgroundColor: WHIMSY.sky,
		borderWidth: 2,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.md,
		marginVertical: SPACE.sm,
		paddingVertical: SPACE.sm,
	},
	title: { ...TYPE.sectionTitle, color: UI_COLORS.textPrimary, textAlign: "center" },
	meta: {
		...TYPE.bodySm,
		color: UI_COLORS.textSecondary,
		textAlign: "center",
		marginTop: SPACE.xs,
	},
	storyBox: {
		backgroundColor: WHIMSY.cream,
		borderWidth: 2,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.md,
		padding: SPACE.md,
		marginTop: SPACE.md,
	},
	storyText: { ...TYPE.hand, color: UI_COLORS.textPrimary },
	sectionKicker: {
		...TYPE.kickerPillSm,
		color: UI_COLORS.action,
		marginTop: SPACE.md,
		marginBottom: SPACE.sm,
	},
	emptyFinds: { ...TYPE.bodySm, color: UI_COLORS.textSecondary },
	finds: { gap: SPACE.xs },
	find: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		paddingVertical: SPACE.xs,
		paddingHorizontal: SPACE.sm,
		borderWidth: 2,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.sm,
		backgroundColor: WHIMSY.paper,
	},
	findShiny: { backgroundColor: WHIMSY.slopBand },
	findGlyph: {},
	findName: { ...TYPE.body, color: UI_COLORS.textPrimary, flex: 1 },
	findKind: { ...TYPE.kickerPillSm, color: UI_COLORS.textSecondary },
	moments: { marginTop: SPACE.md, gap: SPACE.xs },
	moment: { ...TYPE.bodySm, color: UI_COLORS.textPrimary },
	tuckedHome: {
		...TYPE.hand,
		color: UI_COLORS.textSecondary,
		marginTop: SPACE.md,
	},
	comedy: {
		marginTop: SPACE.md,
		marginBottom: SPACE.lg,
		paddingTop: SPACE.md,
		borderTopWidth: 1,
		borderColor: WHIMSY.muteSoft,
	},
	comedyText: {
		...TYPE.hand,
		color: UI_COLORS.textSecondary,
		fontStyle: "italic",
		textAlign: "center",
	},
});

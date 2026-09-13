import { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { PigPortrait } from "./ui/PigPortrait";
import { Glyph } from "./ui/Glyph";
import {
	BORDER,
	PIG_ACCENT,
	RADII,
	SPACE,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import { PIGS } from "@/utils/pigs";
import {
	AdaptiveModalScaffold,
	Button,
	HandLg,
	PageTitle,
	T,
	Tape,
	TicketButton,
} from "./ui";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";

const FRIENDS = PIGS.filter((pig) => pig.id !== "rosie");

// ── Drawing constants ───────────────────────────────────────────────────────
// The reveal's own geometry — a row of tilted pig cards, each with a strip of
// tape and a nameplate. Art, not spacing. (2026-09-11)
/** One pig card and the portrait standing on it. */
const CARD_MIN_W = 92;
const CARD_MIN_H = 126;
const CARD_PIG = 96;
/** The scrapbook lean the cards alternate between. */
const CARD_TILT = 3;
/** The strip of tape pinning each card, and how far it overhangs the top. */
const TAPE_W = 34;
const TAPE_H = 12;
const TAPE_LIFT = -5;
/** The nameplate across a card's foot. */
const NAMEPLATE_MIN_W = 74;
const NAMEPLATE_DROP = 5;
/** The kicker's mark. */
const KICKER_MARK = 20;

interface Props {
	visible: boolean;
	isMember: boolean;
	onDismiss: () => void;
	onAction: () => void;
}

export function PigFriendsLaunchModal({ visible, isMember, onDismiss, onAction }: Props) {
	const motionPolicy = useMotionPolicy();
	const reveal = useRef(FRIENDS.map(() => new Animated.Value(0))).current;
	const copy = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (!visible) {
			reveal.forEach((value) => value.setValue(0));
			copy.setValue(0);
			return;
		}
		if (motionPolicy.reduceMotion) {
			reveal.forEach((value) => value.setValue(1));
			copy.setValue(1);
			return;
		}
		Animated.sequence([
			Animated.stagger(
				120,
				reveal.map((value) =>
					Animated.spring(value, {
						toValue: 1,
						friction: 7,
						tension: 72,
						useNativeDriver: true,
					})
				)
			),
			Animated.timing(copy, {
				toValue: 1,
				duration: 280,
				useNativeDriver: true,
			}),
		]).start();
	}, [copy, motionPolicy.reduceMotion, reveal, visible]);

	const cards = useMemo(
		() =>
			FRIENDS.map((pig, index) => ({
				...pig,
				value: reveal[index],
			})),
		[reveal]
	);

	return (
		<AdaptiveModalScaffold
			visible={visible}
			onRequestClose={onDismiss}
			showCloseButton
			closeLabel="Not now"
			maxWidth={430}
			contentContainerStyle={styles.panelContent}
			testID="pig-friends-launch-modal"
		>
					<View style={styles.kickerRow}>
						<Glyph name="friends" size={KICKER_MARK} />
						<T role="kickerPill" tone="accent">
							New in the Slop Club
						</T>
					</View>
					<PageTitle align="center" style={styles.title}>
						Rosie’s friends have arrived!
					</PageTitle>
					<HandLg tone="secondary" align="center">
						Meet the pigs waiting in Rosie’s new Pen.
					</HandLg>

					<View style={styles.cardRow}>
						{cards.map((pig, index) => {
							const rotate = index % 2 === 0 ? -CARD_TILT : CARD_TILT;
							return (
								<Animated.View
									key={pig.id}
									style={[
										styles.card,
										{
											backgroundColor: PIG_ACCENT[pig.id].tint,
											opacity: pig.value,
											transform: [
												{
													translateY: pig.value.interpolate({
														inputRange: [0, 1],
														outputRange: [42, 0],
													}),
												},
												{
													scale: pig.value.interpolate({
														inputRange: [0, 1],
														outputRange: [0.72, 1],
													}),
												},
												{ rotate: `${rotate}deg` },
											],
										},
									]}
								>
									<Tape
										color={WHIMSY.slopBand}
										rotate={0}
										width={TAPE_W}
										height={TAPE_H}
										style={styles.tape}
									/>
									<PigPortrait pigId={pig.id} size={CARD_PIG} />
									<View style={[styles.nameplate, { backgroundColor: pig.accent }]}>
										<HandLg>{pig.name}</HandLg>
									</View>
								</Animated.View>
							);
						})}
					</View>

					<Animated.View
						style={[
							styles.pitchWrap,
							{
								opacity: copy,
								transform: [
									{
										translateY: copy.interpolate({
											inputRange: [0, 1],
											outputRange: [10, 0],
										}),
									},
								],
							},
						]}
					>
						<T role="handDisplay" align="center" style={styles.pitch}>
							{isMember
								? "Your membership includes one long-term companion. Choose carefully—your pick is locked for now."
								: "Join the Slop Club to choose Rosie one long-term friend."}
						</T>
						{isMember ? (
							<TicketButton
								label="Choose Rosie’s friend"
								stub="P"
								stubCaption="The Pen"
								tone="companion"
								showChevron
								onPress={onAction}
								style={styles.cta}
							/>
						) : (
							<Button
								onPress={onAction}
								variant="gold"
								size="md"
								full
								style={styles.cta}
								accessibilityLabel="Join the Slop Club"
								accessibilityHint="Opens the Slop Club membership offer"
							>
								Join the Slop Club
							</Button>
						)}
						<Button
							variant="link"
							size="sm"
							onPress={onDismiss}
							accessibilityLabel="Maybe later"
							accessibilityHint="Closes this without joining"
							style={styles.later}
						>
							Maybe later
						</Button>
					</Animated.View>
		</AdaptiveModalScaffold>
	);
}

const styles = StyleSheet.create({
	panelContent: {
		flexGrow: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: SPACE.md,
		paddingTop: SPACE.sm,
		paddingBottom: SPACE.lg,
	},
	kickerRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	title: {
		marginTop: SPACE.xs,
	},
	cardRow: {
		width: "100%",
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: SPACE.sm,
		marginVertical: SPACE.md,
	},
	card: {
		width: "30%",
		minWidth: CARD_MIN_W,
		minHeight: CARD_MIN_H,
		alignItems: "center",
		justifyContent: "flex-end",
		paddingBottom: SPACE.md,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.sm,
		backgroundColor: WHIMSY.cream,
	},
	tape: {
		position: "absolute",
		top: TAPE_LIFT,
		zIndex: 2,
	},
	nameplate: {
		position: "absolute",
		bottom: NAMEPLATE_DROP,
		minWidth: NAMEPLATE_MIN_W,
		alignItems: "center",
		paddingHorizontal: SPACE.sm,
		paddingVertical: 1,
		borderWidth: BORDER.hair,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.sm,
	},
	pitchWrap: { width: "100%" },
	pitch: {
		paddingHorizontal: SPACE.sm,
	},
	cta: {
		marginTop: SPACE.md,
	},
	later: {
		alignSelf: "center",
		marginTop: SPACE.xs,
	},
});

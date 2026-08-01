import { useEffect, useMemo, useRef } from "react";
import {
	Animated,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { PigPortrait } from "./ui/PigPortrait";
import { Glyph } from "./ui/Glyph";
import { RADII, SHADOW_SM, SPACE, TYPE, WHIMSY } from "@/constants/theme";
import { PIGS } from "@/utils/pigs";
import { AdaptiveModalScaffold, Button, TicketButton } from "./ui";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";

const FRIENDS = PIGS.filter((pig) => pig.id !== "rosie");

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
						<Glyph name="friends" size={20} />
						<Text style={styles.kicker}>NEW IN THE SLOP CLUB</Text>
					</View>
					<Text style={styles.title}>Rosie’s friends have arrived!</Text>
					<Text style={styles.intro}>Meet the pigs waiting in Rosie’s new Pen.</Text>

					<View style={styles.cardRow}>
						{cards.map((pig, index) => {
							const rotate = index % 2 === 0 ? "-3deg" : "3deg";
							return (
								<Animated.View
									key={pig.id}
									style={[
										styles.card,
										{
											backgroundColor: pig.accent + "33",
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
												{ rotate },
											],
										},
									]}
								>
									<View style={styles.tape} />
									<PigPortrait
										pigId={pig.id}
										size={96}
									/>
									<View style={[styles.nameplate, { backgroundColor: pig.accent }]}>
										<Text style={styles.name}>{pig.name}</Text>
									</View>
								</Animated.View>
							);
						})}
					</View>

					<Animated.View
						style={{
							width: "100%",
							opacity: copy,
							transform: [
								{
									translateY: copy.interpolate({
										inputRange: [0, 1],
										outputRange: [10, 0],
									}),
								},
							],
						}}
					>
						<Text style={styles.pitch}>
							{isMember
								? "Your membership includes one long-term companion. Choose carefully—your pick is locked for now."
								: "Join the Slop Club to choose Rosie one long-term friend."}
						</Text>
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
							>
								Join the Slop Club
							</Button>
						)}
						<Pressable
							onPress={onDismiss}
							style={styles.later}
							accessibilityRole="button"
							accessibilityLabel="Maybe later"
						>
							<Text style={styles.laterText}>Maybe later</Text>
						</Pressable>
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
	kickerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
	kicker: { ...TYPE.kickerPill, color: WHIMSY.accent },
	title: {
		...TYPE.pageTitle,
		lineHeight: undefined,
		color: WHIMSY.ink,
		textAlign: "center",
		marginTop: SPACE.xs,
	},
	intro: {
		...TYPE.handLg,
		color: WHIMSY.mute,
		textAlign: "center",
	},
	cardRow: {
		width: "100%",
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: 8,
		marginVertical: SPACE.md,
	},
	card: {
		width: "30%",
		minWidth: 92,
		minHeight: 126,
		alignItems: "center",
		justifyContent: "flex-end",
		paddingBottom: 12,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.sm,
		backgroundColor: WHIMSY.cream,
		...SHADOW_SM,
	},
	tape: {
		position: "absolute",
		top: -5,
		width: 34,
		height: 12,
		borderWidth: 1,
		borderColor: WHIMSY.goblin,
		backgroundColor: WHIMSY.slopBand,
		zIndex: 2,
	},
	nameplate: {
		position: "absolute",
		bottom: 5,
		minWidth: 74,
		alignItems: "center",
		paddingHorizontal: 6,
		paddingVertical: 1,
		borderWidth: 1,
		borderColor: WHIMSY.ink,
		borderRadius: 3,
	},
	name: {
		...TYPE.handLg,
		color: WHIMSY.ink,
	},
	pitch: {
		...TYPE.handDisplay,
		color: WHIMSY.ink,
		textAlign: "center",
		paddingHorizontal: SPACE.sm,
	},
	cta: {
		marginTop: SPACE.md,
	},
	later: {
		alignSelf: "center",
		minHeight: 44,
		justifyContent: "center",
		marginTop: SPACE.xs,
		paddingHorizontal: SPACE.md,
	},
	laterText: {
		...TYPE.bodySm,
		lineHeight: undefined,
		color: WHIMSY.mute,
		textDecorationLine: "underline",
	},
});

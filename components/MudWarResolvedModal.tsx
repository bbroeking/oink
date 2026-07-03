// Mud Fight resolved — the celebratory reveal staged when a war ends.
// app/mud-war.tsx triggers it screen-local the first time a player views a
// resolved war (AsyncStorage-gated per war); the quiet ResolvedWar recap
// sits underneath. A WIN reveals the war-exclusive cosmetic you earned (if
// any) over a rarity-tinted hero — the payoff the plain announcement never
// showed; draw/loss get a quieter beat. No emoji: art via HAT_IMAGES,
// Icon for the draw, print-glyph kicker.
import { useEffect, useRef } from "react";
import {
	Animated,
	Easing,
	Image,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Icon } from "./ui/Icon";
import { Sticker } from "./ui/Sticker";
import { HAT_IMAGES, RARITY_COLORS } from "@/constants/hats";
import { WonCosmetic } from "@/utils/mudWars";
import {
	FONTS,
	KICKER_TEXT,
	MODAL_BACKDROP_BG,
	RARITY_BG_SOLID,
	STICKER_SHADOW,
	WHIMSY,
} from "@/constants/theme";

export type WarResult = "win" | "loss" | "draw";

interface Props {
	visible: boolean;
	result: WarResult;
	isBotWar: boolean;
	wonCosmetic: WonCosmetic | null;
	// Golden-Truffle purse paid at resolve (Season 2 P4). Optional — only
	// rendered when the server actually returned an amount, so the modal
	// degrades cleanly on pre-Exchange servers.
	truffles?: number | null;
	onClose: () => void;
}

export function MudWarResolvedModal({
	visible,
	result,
	isBotWar,
	wonCosmetic,
	truffles,
	onClose,
}: Props) {
	const pop = useRef(new Animated.Value(0)).current;
	const gloat = useRef(new Animated.Value(0)).current; // the Goblin King's taunt-bob on a loss

	useEffect(() => {
		if (!visible) {
			pop.setValue(0);
			return;
		}
		Animated.spring(pop, {
			toValue: 1,
			tension: 80,
			friction: 6,
			useNativeDriver: true,
		}).start();
		Haptics.notificationAsync(
			result === "win"
				? Haptics.NotificationFeedbackType.Success
				: Haptics.NotificationFeedbackType.Warning
		).catch(() => {});
		// On a loss the Goblin King gloats — a slow taunt-bob loop.
		let loop: Animated.CompositeAnimation | undefined;
		if (result === "loss") {
			gloat.setValue(0);
			loop = Animated.loop(
				Animated.sequence([
					Animated.timing(gloat, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
					Animated.timing(gloat, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
				])
			);
			loop.start();
		}
		return () => loop?.stop();
	}, [visible, result, pop, gloat]);

	if (!visible) return null;

	const win = result === "win";
	const rarity = wonCosmetic?.rarity ?? "common";
	const heroScale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
	const heroBg =
		win && wonCosmetic ? RARITY_BG_SOLID[rarity] ?? WHIMSY.paper : WHIMSY.paper;

	const title = win
		? isBotWar
			? "The Mudlarks are routed!"
			: "The horde is routed!"
		: result === "draw"
		? "A stalemate in the mire"
		: "Driven into the mire";

	return (
		<Modal visible transparent animationType="fade" onRequestClose={onClose}>
			<View style={styles.backdrop}>
				<Sticker
					color={win ? "sun" : "paper"}
					rotate={-1.5}
					radius={20}
					style={styles.card}
				>
					<Text style={styles.kicker}>★ the siege ends ★</Text>

					<Animated.View
						style={[
							styles.hero,
							{ backgroundColor: heroBg, transform: [{ scale: heroScale }] },
						]}
					>
						{win ? (
							wonCosmetic && HAT_IMAGES[wonCosmetic.id] ? (
								// The earned cosmetic IS the payoff — show it plainly.
								<Image source={HAT_IMAGES[wonCosmetic.id]} style={styles.heroImg} resizeMode="contain" />
							) : (
								// No cosmetic to reveal — a routed goblin tumbling off instead.
								<Animated.Image
									source={HAT_IMAGES.goblin_grunt_hit}
									style={[
										styles.heroImg,
										{ transform: [{ rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ["40deg", "0deg"] }) }] },
									]}
									resizeMode="contain"
								/>
							)
						) : result === "draw" ? (
							<Icon name="handshake" size={84} color={WHIMSY.mute} />
						) : (
							// The Goblin King gloats over the mire.
							<Animated.Image
								source={HAT_IMAGES.goblin_warboss}
								style={[
									styles.heroImg,
									{
										transform: [
											{ translateY: gloat.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
											{ rotate: gloat.interpolate({ inputRange: [0, 1], outputRange: ["-3deg", "3deg"] }) },
										],
									},
								]}
								resizeMode="contain"
							/>
						)}
					</Animated.View>

					<Text style={styles.title}>{title}</Text>

					{win && wonCosmetic ? (
						<>
							<View
								style={[
									styles.rarityStripe,
									{ backgroundColor: RARITY_COLORS[rarity] ?? RARITY_COLORS.common },
								]}
							>
								<Text style={styles.rarityText}>{rarity}</Text>
							</View>
							<Text style={styles.cosmeticName}>{wonCosmetic.name}</Text>
							<Text style={styles.subtitle}>
								A war-exclusive cosmetic — wear it in the Closet. Snouts and a
								72-hour regen buff are yours too.
							</Text>
						</>
					) : (
						<Text style={styles.subtitle}>
							{win
								? "The horde flees the bog — snouts paid and a 72-hour regen buff is on you."
								: result === "draw"
								? "The rope held dead even — neither side broke."
								: "The Mudlarks hold the field. Rally and raid again."}
						</Text>
					)}

					{typeof truffles === "number" && truffles > 0 ? (
						<View style={styles.truffleRow}>
							{HAT_IMAGES.golden_truffle ? (
								<Image source={HAT_IMAGES.golden_truffle} style={styles.truffleImg} resizeMode="contain" />
							) : null}
							<Text style={styles.truffleText}>
								{`+${truffles} golden truffles for your pouch`}
							</Text>
						</View>
					) : null}

					<Pressable
						onPress={onClose}
						style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.7 }]}
					>
						<Text style={styles.doneText}>{win ? "Oink!" : "Onward"}</Text>
					</Pressable>
				</Sticker>
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
		padding: 24,
	},
	card: {
		width: "100%",
		maxWidth: 360,
		paddingHorizontal: 24,
		paddingVertical: 24,
		alignItems: "center",
		...STICKER_SHADOW,
	},
	kicker: { ...KICKER_TEXT, marginBottom: 8 },
	hero: {
		width: 160,
		height: 160,
		borderRadius: 999,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
		marginVertical: 6,
	},
	heroImg: { width: 118, height: 118 },
	title: {
		fontFamily: FONTS.whimsy,
		fontSize: 26,
		color: WHIMSY.ink,
		textAlign: "center",
		marginTop: 6,
	},
	rarityStripe: {
		marginTop: 8,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 999,
		paddingHorizontal: 14,
		paddingVertical: 3,
	},
	rarityText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		letterSpacing: 1.2,
		textTransform: "uppercase",
		color: WHIMSY.paper,
	},
	cosmeticName: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 16,
		color: WHIMSY.ink,
		textAlign: "center",
		marginTop: 8,
	},
	subtitle: {
		fontFamily: FONTS.hand,
		fontSize: 15,
		color: WHIMSY.ink,
		textAlign: "center",
		lineHeight: 22,
		marginTop: 8,
		marginBottom: 4,
	},
	truffleRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		marginTop: 8,
	},
	truffleImg: { width: 20, height: 20 },
	truffleText: { fontFamily: FONTS.bodyExtra, fontSize: 13, color: WHIMSY.ink },
	doneBtn: {
		marginTop: 14,
		paddingHorizontal: 28,
		paddingVertical: 11,
		borderRadius: 14,
		backgroundColor: WHIMSY.ink,
	},
	doneText: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.paper,
		letterSpacing: 0.4,
	},
});

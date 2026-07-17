import React, { useRef, useState } from "react";
import {
	View,
	Text,
	Pressable,
	StyleSheet,
	Dimensions,
	ScrollView,
	NativeSyntheticEvent,
	NativeScrollEvent,
	SafeAreaView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { markStorybookSeenServer } from "@/utils/onboarding";
import { SpritePig, PigAnimation } from "./ui/SpritePig";
import { Sticker } from "./ui/Sticker";
import { FONTS, KICKER_TEXT, WHIMSY } from "@/constants/theme";

const { width: SCREEN_W } = Dimensions.get("window");

const STEPS: {
	animation: PigAnimation;
	kicker: string;
	title: string;
	body: string;
}[] = [
	{
		animation: "wave", // celebratory wave — arms_up was removed when
		kicker: "★ welcome",
		title: "Hi, I'm Rosie!",
		body: "Tap me on the home screen to give me a tickle. The more tickles you give, the more we both grow.",
	},
	{
		animation: "idle", // calm 4-frame breathing
		kicker: "★ how it works",
		title: "Earn & dress me up",
		body: "Each tickle earns a heart. Spend hearts in the shop on hats, glasses, capes, and more — then come back and dress me however you like.",
	},
];

interface Props {
	onDone: () => void;
}

export function Onboarding({ onDone }: Props) {
	const [page, setPage] = useState(0);
	const scrollRef = useRef<ScrollView>(null);

	// Persist storybook-seen BOTH locally and on the server. The local flag
	// gates offline; the server mirror survives a reinstall so a veteran doesn't
	// replay the storybook (issue #11). Both fail soft — a dropped write just
	// means the gate leans on whichever flag did land.
	const markSeen = () => {
		AsyncStorage.setItem("seen_onboarding", "1").catch(() => {});
		markStorybookSeenServer().catch(() => {});
	};

	const goNext = () => {
		if (page < STEPS.length - 1) {
			scrollRef.current?.scrollTo({ x: SCREEN_W * (page + 1), animated: true });
		} else {
			markSeen();
			onDone();
		}
	};

	const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
		const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
		if (idx !== page) setPage(idx);
	};

	return (
		<View style={styles.container}>
			<SafeAreaView style={styles.safe}>
				<ScrollView
					ref={scrollRef}
					horizontal
					pagingEnabled
					showsHorizontalScrollIndicator={false}
					onMomentumScrollEnd={onScroll}
				>
					{STEPS.map((step, i) => (
						<View key={i} style={[styles.page, { width: SCREEN_W }]}>
							<View style={styles.pigWrap}>
								<SpritePig animation={step.animation} size={260} />
							</View>
							<Sticker
								color="paper"
								rotate={-0.5}
								radius={18}
								style={styles.card}
							>
								<Text style={styles.kicker}>{step.kicker}</Text>
								<Text style={styles.title}>{step.title}</Text>
								<Text style={styles.body}>{step.body}</Text>
							</Sticker>
						</View>
					))}
				</ScrollView>

				<View style={styles.dotsRow}>
					{STEPS.map((_, i) => (
						<View
							key={i}
							style={[
								styles.dot,
								i === page && styles.dotActive,
							]}
						/>
					))}
				</View>

				<View style={styles.ctaRow}>
					{page < STEPS.length - 1 && (
						<Pressable
							onPress={() => {
								markSeen();
								onDone();
							}}
						>
							<Text style={styles.skipLink}>Skip</Text>
						</Pressable>
					)}
					<View style={{ flex: 1 }} />
					<Pressable onPress={goNext} style={styles.cta}>
						<Text style={styles.ctaText}>
							{page < STEPS.length - 1 ? "Next" : "Get started"}
						</Text>
					</Pressable>
				</View>
			</SafeAreaView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: WHIMSY.cream },
	safe: { flex: 1 },
	page: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 28,
	},
	pigWrap: {
		marginBottom: 18,
	},
	card: {
		paddingHorizontal: 22,
		paddingVertical: 20,
		width: "100%",
		alignItems: "center",
	},
	kicker: {
		...KICKER_TEXT,
		marginBottom: 6,
	},
	title: {
		fontFamily: FONTS.whimsy,
		fontSize: 26,
		color: WHIMSY.ink,
		lineHeight: 30,
		textAlign: "center",
		marginBottom: 8,
	},
	body: {
		fontFamily: FONTS.hand,
		fontSize: 16,
		color: WHIMSY.ink,
		opacity: 0.8,
		lineHeight: 22,
		textAlign: "center",
	},
	dotsRow: {
		flexDirection: "row",
		justifyContent: "center",
		gap: 6,
		paddingVertical: 14,
	},
	dot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: WHIMSY.muteSoft,
	},
	dotActive: {
		backgroundColor: WHIMSY.ink,
		width: 24,
	},
	ctaRow: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 24,
		paddingBottom: 24,
		gap: 10,
	},
	skipLink: {
		fontFamily: FONTS.hand,
		fontSize: 15,
		color: WHIMSY.mute,
		textDecorationLine: "underline",
	},
	cta: {
		paddingHorizontal: 28,
		paddingVertical: 12,
		borderRadius: 14,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
	},
	ctaText: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.ink,
	},
});

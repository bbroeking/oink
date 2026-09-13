// The storybook — three pages that hand a brand-new player the Barn, the dig
// and the herd. Third stop in the pre-shell gate chain (SupaAuth →
// UsernameSetup → ReferralCodeEntry → here), so it wears the same cream ground
// and the same Rosie hero: one continuous storybook, never a black flash.
//
// Rebuilt on the design system 2026-09-11 (wave 3 · area E): the hand-rolled
// CTA is `Button`, the page copy speaks through the text roles, and the dot row
// announces "page 2 of 3" instead of being three silent squares. [E24]
// Wave 4: those dots graduated into the `PageDots` primitive.
import React, { useRef, useState } from "react";
import {
	View,
	StyleSheet,
	ScrollView,
	NativeSyntheticEvent,
	NativeScrollEvent,
	SafeAreaView,
	useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { markStorybookSeenServer } from "@/utils/onboarding";
import type { PigAnimation } from "./ui/pigRendererContract";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import {
	Button,
	Kicker,
	PageDots,
	PageTitle,
	PigRenderer,
	RIVE_PIG_SOURCE,
	Sticker,
	T,
} from "./ui";
import { RADII, SPACE, UI_COLORS } from "@/constants/theme";

// The Rosie hero on a storybook page — drawing geometry (the art's box), not a
// spacing step, and larger than any ART_SIZE entry because this page is mostly
// pig. (2026-09-11)
const HERO_SIZE = 260;

const STEPS: {
	animation: PigAnimation;
	kicker: string;
	title: string;
	body: string;
}[] = [
	{
		animation: "wave", // celebratory wave — arms_up was removed when
		kicker: "care for rosie",
		title: "Meet Rosie",
		body: "Give Rosie a tickle in the Barn. Tickling earns snouts to spend in the Shop.",
	},
	{
		animation: "idle", // calm 4-frame breathing
		kicker: "follow the feeding",
		title: "Dig when it opens",
		body: "See Dig now? The Truffle Patch is open. When it closes, Opening in tells you when to come back.",
	},
	{
		animation: "wave",
		kicker: "better together",
		title: "Help your herd",
		body: "Visit friends and join a Sounder. Every find helps your herd push back the Great Hungerer.",
	},
];

interface Props {
	onDone: () => void;
}

export function Onboarding({ onDone }: Props) {
	const [page, setPage] = useState(0);
	const motion = useMotionPolicy();
	const scrollRef = useRef<ScrollView>(null);
	const { width: screenWidth } = useWindowDimensions();
	const last = page === STEPS.length - 1;

	// Persist storybook-seen BOTH locally and on the server. The local flag
	// gates offline; the server mirror survives a reinstall so a veteran doesn't
	// replay the storybook (issue #11). Both fail soft — a dropped write just
	// means the gate leans on whichever flag did land.
	const markSeen = () => {
		AsyncStorage.setItem("seen_onboarding", "1").catch(() => {});
		markStorybookSeenServer().catch(() => {});
	};

	const finish = () => {
		markSeen();
		onDone();
	};

	const goNext = () => {
		if (!last) {
			scrollRef.current?.scrollTo({
				x: screenWidth * (page + 1),
				animated: !motion.reduceMotion,
			});
		} else {
			finish();
		}
	};

	const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
		const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
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
					onScroll={onScroll}
					// 16ms, not 100 — at 100 the active dot lagged the swipe by up
					// to a tenth of a second. [E24] (2026-09-11)
					scrollEventThrottle={16}
				>
					{STEPS.map((step, i) => (
						<View key={i} style={[styles.page, { width: screenWidth }]}>
							<View style={styles.pigWrap}>
								<PigRenderer animation={step.animation} size={HERO_SIZE} active={i === page} renderer="rive" riveSource={RIVE_PIG_SOURCE} rolloutEnabled />
							</View>
							<Sticker
								color="paper"
								rotate={-0.5}
								radius={RADII.xl}
								style={styles.card}
							>
								<Kicker>{step.kicker}</Kicker>
								<PageTitle align="center" style={styles.title}>
									{step.title}
								</PageTitle>
								<T role="handLg" tone="secondary" align="center">
									{step.body}
								</T>
							</Sticker>
						</View>
					))}
				</ScrollView>

				<PageDots
					count={STEPS.length}
					index={page}
					label="Introduction page"
				/>

				<View style={styles.ctaRow}>
					{!last && (
						<Button
							variant="handLink"
							onPress={finish}
							accessibilityLabel="Skip introduction"
							accessibilityHint="Goes straight to the Barn without the rest of the storybook"
						>
							Skip
						</Button>
					)}
					<View style={styles.spacer} />
					<Button
						variant="primary"
						onPress={goNext}
						accessibilityLabel={
							last ? "Finish introduction" : "Next introduction page"
						}
						accessibilityHint={
							last
								? "Opens the Barn"
								: `Shows page ${page + 2} of ${STEPS.length}`
						}
					>
						{last ? "Meet Rosie" : "Next"}
					</Button>
				</View>
			</SafeAreaView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: UI_COLORS.surfaceMuted },
	safe: { flex: 1 },
	page: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: SPACE.xxl,
	},
	pigWrap: {
		marginBottom: SPACE.lg,
	},
	card: {
		paddingHorizontal: SPACE.xl,
		paddingVertical: SPACE.xl,
		width: "100%",
		alignItems: "center",
		gap: SPACE.sm,
	},
	title: {
		// PageTitle's own lineHeight, plus the storybook's centred measure.
		paddingHorizontal: SPACE.sm,
	},
	ctaRow: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: SPACE.xl,
		paddingBottom: SPACE.xl,
		gap: SPACE.md,
	},
	spacer: { flex: 1 },
});

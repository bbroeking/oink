import React, { useEffect, useRef, useState } from "react";
import {
	Animated,
	Easing,
	StyleSheet,
	View,
	useWindowDimensions,
} from "react-native";
import type { HalloweenLoginGiftReceipt } from "@/features/cards/domain/halloweenLoginGift";
import type { RosieCostumeFit } from "@/features/cards/data/costumeFits";
import { CostumeRosieStage } from "@/components/prototypes/card-packs/CostumeRosieStage";
import { AdaptiveModalScaffold, Button, Glyph, Kicker, T } from "@/components/ui";
import { BORDER, RADII, SHADOW_SM, SPACE, UI_COLORS, WHIMSY } from "@/constants/theme";
import { MOTION_DURATION, useMotionPolicy } from "@/hooks/useMotionPolicy";

export interface HalloweenLoginGiftCostume {
	name: string;
	fit: RosieCostumeFit;
}

const PARCEL_STAGE_HEIGHT = 245;
const PARCEL_WIDTH = 210;
const PARCEL_HEIGHT = 160;
const RIBBON_WIDTH = 34;
const BOW_WIDTH = 56;
const BOW_HEIGHT = 42;
const SEAL_SIZE = 50;
const SEAL_GLYPH_SIZE = 24;

export interface HalloweenLoginGiftContentProps {
	receipt: HalloweenLoginGiftReceipt;
	costume: HalloweenLoginGiftCostume;
	busy?: boolean;
	error?: string | null;
	onContinue: () => Promise<boolean>;
	onLater?: () => void;
	onRetry?: () => void;
	/** Local workshop only until production has a costume equip path. */
	onTryOn?: () => void;
	reduceMotion?: boolean;
}

export function HalloweenLoginGiftContent({
	receipt,
	costume,
	busy = false,
	error,
	onContinue,
	onLater,
	onRetry,
	onTryOn,
	reduceMotion,
}: HalloweenLoginGiftContentProps) {
	const { width } = useWindowDimensions();
	const motion = useMotionPolicy();
	const still = reduceMotion ?? motion.reduceMotion;
	const [phase, setPhase] = useState<"sealed" | "result">("sealed");
	const [continuing, setContinuing] = useState(false);
	const [continueFailed, setContinueFailed] = useState(false);
	const continueInFlight = useRef(false);
	const mounted = useRef(true);
	const reveal = useRef(new Animated.Value(0)).current;
	// The modal's compact width also pays scaffold, modal-body, and card insets.
	// Subtract them before sizing the square so 320pt phones land at 230pt
	// instead of clipping a 280pt stage inside ~240pt of usable card width.
	const stageSize = Math.min(300, Math.max(210, width - 90));

	useEffect(() => {
		setPhase("sealed");
		setContinuing(false);
		setContinueFailed(false);
		continueInFlight.current = false;
		reveal.setValue(0);
	}, [receipt.receiptId, reveal]);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
			reveal.stopAnimation();
		};
	}, [reveal]);

	const handleReveal = () => {
		if (phase !== "sealed" || busy) return;
		setPhase("result");
		Animated.timing(reveal, {
			toValue: 1,
			duration: still ? MOTION_DURATION.crossfade : 400,
			easing: Easing.out(Easing.cubic),
			useNativeDriver: true,
		}).start();
	};

	const handleContinue = async () => {
		if (phase !== "result" || busy || continuing || continueInFlight.current) return;
		continueInFlight.current = true;
		setContinuing(true);
		setContinueFailed(false);
		let acknowledged = false;
		try {
			acknowledged = await onContinue();
		} catch {
			acknowledged = false;
		} finally {
			continueInFlight.current = false;
			if (mounted.current) {
				setContinuing(false);
				setContinueFailed(!acknowledged);
			}
		}
	};

	const resultScale = reveal.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });
	const failed = continueFailed || !!error;

	return (
		<View style={styles.content} testID="halloween-login-gift-content">
			<Kicker star={false}>A HALLOWEEN SOMETHING</Kicker>
			<T role="pageTitle" align="center" style={styles.title}>
				{phase === "sealed" ? "A parcel found you." : `${costume.name} is yours`}
			</T>
			<T role="body" align="center" tone="secondary" style={styles.copy}>
				{phase === "sealed"
					? "One costume, picked and tucked away just for you."
					: "Added to your wardrobe, not worn yet."}
			</T>

			{phase === "sealed" ? (
				<View style={styles.parcelStage} accessibilityLabel="A cream parcel tied with a lilac bow and moon seal">
					<View style={styles.parcel}>
						<View style={styles.ribbonVertical} />
						<View style={styles.ribbonHorizontal} />
						<View style={[styles.bowLoop, styles.bowLeft]} />
						<View style={[styles.bowLoop, styles.bowRight]} />
						<View style={styles.moonSeal}><Glyph name="sparkle" size={SEAL_GLYPH_SIZE} /></View>
					</View>
				</View>
			) : (
				<Animated.View
					testID="halloween-login-gift-result"
					style={[styles.resultCard, { opacity: reveal, transform: [{ scale: resultScale }] }]}
				>
					<View style={styles.ownedSeal}><T role="kickerPill">OWNED</T></View>
					<CostumeRosieStage
						fit={costume.fit}
						active
						reduceMotion={still}
						displaySize={stageSize}
						showControls={false}
					/>
				</Animated.View>
			)}

			{failed ? (
				<View style={styles.retry} accessibilityLiveRegion="polite">
					<T role="bodySm" align="center" tone="danger">That didn&apos;t stick. Your costume is safe.</T>
					{onRetry ? <Button variant="link" onPress={onRetry} testID="halloween-gift-retry">Try again</Button> : null}
				</View>
			) : null}

			<Button
				variant="lilac"
				size="lg"
				full
				loading={busy || continuing}
				loadingLabel={phase === "sealed" ? "Opening…" : "Saving…"}
				onPress={phase === "sealed" ? handleReveal : () => { void handleContinue(); }}
				testID={phase === "sealed" ? "halloween-gift-reveal" : "halloween-gift-continue"}
			>
				{phase === "sealed" ? "Reveal" : "Continue"}
			</Button>
			{phase === "sealed" && onLater ? (
				<Button variant="link" size="sm" onPress={onLater} testID="halloween-gift-later">Later</Button>
			) : null}
			{phase === "result" && onTryOn ? (
				<Button variant="ghost" size="sm" onPress={onTryOn} testID="halloween-gift-try-on">Try on in workshop</Button>
			) : null}
		</View>
	);
}

export interface HalloweenLoginGiftModalProps extends HalloweenLoginGiftContentProps {
	visible: boolean;
	presentation?: "native" | "inline";
}

export function HalloweenLoginGiftModal({ visible, presentation, ...content }: HalloweenLoginGiftModalProps) {
	return (
		<AdaptiveModalScaffold
			visible={visible}
			onRequestClose={content.onLater ?? (() => {})}
			bare
			maxWidth={390}
			presentation={presentation}
			contentContainerStyle={styles.modalBody}
			testID="halloween-login-gift-modal"
		>
			<View style={styles.card}>
				<HalloweenLoginGiftContent {...content} />
			</View>
		</AdaptiveModalScaffold>
	);
}

const styles = StyleSheet.create({
	modalBody: { padding: SPACE.sm },
	card: {
		backgroundColor: WHIMSY.lilac,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.xxl,
		padding: SPACE.lg,
		...SHADOW_SM,
	},
	content: { alignItems: "center", gap: SPACE.sm },
	title: { color: UI_COLORS.textPrimary, maxWidth: 320 },
	copy: { maxWidth: 310 },
	parcelStage: { minHeight: PARCEL_STAGE_HEIGHT, alignItems: "center", justifyContent: "center" },
	parcel: {
		width: PARCEL_WIDTH,
		height: PARCEL_HEIGHT,
		backgroundColor: WHIMSY.cream2,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.md,
		...SHADOW_SM,
	},
	ribbonVertical: { position: "absolute", left: 86, top: 0, width: RIBBON_WIDTH, height: "100%", backgroundColor: WHIMSY.lilacDeep },
	ribbonHorizontal: { position: "absolute", left: 0, top: 61, width: "100%", height: RIBBON_WIDTH, backgroundColor: WHIMSY.lilacDeep },
	bowLoop: { position: "absolute", top: -23, width: BOW_WIDTH, height: BOW_HEIGHT, borderWidth: BORDER.ink, borderColor: UI_COLORS.border, backgroundColor: WHIMSY.lilacDeep, borderRadius: RADII.pill },
	bowLeft: { left: 55, transform: [{ rotate: "-18deg" }] },
	bowRight: { right: 55, transform: [{ rotate: "18deg" }] },
	moonSeal: { position: "absolute", left: 80, top: 52, width: SEAL_SIZE, height: SEAL_SIZE, alignItems: "center", justifyContent: "center", borderRadius: RADII.pill, borderWidth: BORDER.ink, borderColor: UI_COLORS.border, backgroundColor: WHIMSY.sun },
	resultCard: { position: "relative", backgroundColor: WHIMSY.cream2, borderWidth: BORDER.ink, borderColor: UI_COLORS.border, borderRadius: RADII.lg, overflow: "hidden", ...SHADOW_SM },
	ownedSeal: { position: "absolute", zIndex: 2, right: SPACE.sm, top: SPACE.sm, paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xs, backgroundColor: WHIMSY.sun, borderWidth: BORDER.thin, borderColor: UI_COLORS.border, borderRadius: RADII.pill },
	retry: { alignItems: "center", gap: 0 },
});

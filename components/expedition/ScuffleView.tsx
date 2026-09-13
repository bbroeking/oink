import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, ScrollView, Animated, Easing } from "react-native";
import {
	PAGE_PAD,
	RADII,
	SPACE,
	TAB_SAFE,
} from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Sticker } from "@/components/ui/Sticker";
import { ProgressTrack } from "@/components/ui/ProgressTrack";
import { T } from "@/components/ui/Text";
import {
	CARDS,
	ENEMIES,
	ZOOMIES_MAX,
	cardAffectsFight,
	type ExpeditionState,
	type SwingResult,
} from "@/utils/expedition";
import { RosieCharged } from "./RosiePose";
import { EnemySilhouette, type SilhouetteId } from "./EnemySilhouette";
import { ZoomiesMeter } from "./ZoomiesMeter";
import { CeremonyCard } from "./Ceremony";

// The wall fight (prototype variant B, grown up): the wall's HP bar, Rosie
// squared up with her Zoomies escalating her pose, tickle→Zoomies bursts, and the
// one authored card tap. No pig HP — she is only ever stalled, never hurt. All
// motion routes through the reduced-motion policy.
export function ScuffleView({
	state,
	onTickle,
	onPlayCard,
	onBack,
}: {
	state: ExpeditionState;
	onTickle: () => SwingResult | null;
	onPlayCard: () => SwingResult | null;
	onBack: () => void;
}) {
	const policy = useMotionPolicy();
	const [log, setLog] = useState<string[]>([]);
	const enemyId = state.wallEnemyId;
	const defeated = !enemyId;
	// The boss falling earns the full ceremony beat (Fix 5a); a road wall gets the
	// quiet one-line send-off. `shownId` is the just-beaten character.

	// The just-defeated enemy: once wallEnemyId nulls on victory the fight must
	// still show the character she beat — not fall back to the boss goose. (Task 3.)
	const [shownId, setShownId] = useState<SilhouetteId>(
		(enemyId ?? "tollbooth_goose") as SilhouetteId
	);
	useEffect(() => {
		if (enemyId) setShownId(enemyId as SilhouetteId);
	}, [enemyId]);
	const shownEnemy = ENEMIES[shownId];

	const enemy = enemyId ? ENEMIES[enemyId] : null;
	const card = state.tuckedCardId ? CARDS[state.tuckedCardId] : null;
	const cardIsFightCard = card ? cardAffectsFight(card) : false;

	const hp = state.wallHp ?? 0;
	const maxHp = enemy ? enemy.hp : shownEnemy.hp;

	// ── Motion: the enemy recoils, Rosie reacts per tickle ──
	// The wall's meter is a `ProgressTrack`, which changes state rather than
	// tweening — the hit is felt in the recoil, which is the beat a Reduce-Motion
	// player can also opt out of.
	const recoil = useRef(new Animated.Value(0)).current; // enemy shake
	const pulse = useRef(new Animated.Value(0)).current; // Rosie per-tickle bump

	const impact = () => {
		if (!policy.allowDecorativeMotion) return;
		recoil.setValue(0);
		Animated.sequence([
			Animated.timing(recoil, { toValue: 1, duration: 60, useNativeDriver: true }),
			Animated.timing(recoil, { toValue: -1, duration: 60, useNativeDriver: true }),
			Animated.timing(recoil, { toValue: 0.5, duration: 60, useNativeDriver: true }),
			Animated.timing(recoil, { toValue: 0, duration: 60, useNativeDriver: true }),
		]).start();
	};

	const rosieReact = () => {
		if (!policy.allowDecorativeMotion) return;
		pulse.setValue(0);
		Animated.sequence([
			Animated.timing(pulse, { toValue: 1, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true }),
			Animated.timing(pulse, { toValue: 0, duration: 130, easing: Easing.in(Easing.quad), useNativeDriver: true }),
		]).start();
	};

	const handleTickle = () => {
		const r = onTickle();
		rosieReact();
		if (r && r.damage > 0) impact(); // a real burst landed
		if (r && r.lines.length) setLog((l) => [...r.lines, ...l].slice(0, 6));
		else
			setLog((l) =>
				[
					state.mockTickles <= 0
						? "Out of tickles for now — she waits, warmly."
						: "Rosie feels braver. The Zoomies charge.",
					...l,
				].slice(0, 6)
			);
	};

	const handlePlayCard = () => {
		const r = onPlayCard();
		if (r && r.lines.length) setLog((l) => [...r.lines, ...l].slice(0, 6));
		else if (card) setLog((l) => [`${card.name} is already in play.`, ...l].slice(0, 6));
	};

	const recoilX = recoil.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });
	const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.09] });

	return (
		<ScrollView
			style={styles.root}
			contentContainerStyle={styles.content}
			showsVerticalScrollIndicator={false}
		>
			<PageHeader
				kicker="a wall on the road"
				title={enemy ? enemy.name : "The road opens"}
				onBack={onBack}
			/>

			<Sticker color="sky" rotate={-0.6} radius={RADII.xl} style={styles.arena}>
				<View style={styles.arenaRow}>
					<Animated.View style={{ transform: [{ scale: pulseScale }] }}>
						<RosieCharged
							zoomies={state.zoomies}
							max={ZOOMIES_MAX}
							size={130}
							defeated={defeated}
						/>
					</Animated.View>
					<Animated.View style={{ transform: [{ translateX: recoilX }] }}>
						<EnemySilhouette id={shownId} size={120} defeated={defeated} />
					</Animated.View>
				</View>
			</Sticker>

			{enemy && (
				<>
					<ProgressTrack
						value={hp}
						max={maxHp}
						tone="rose"
						label={`${enemy.name} holding the road`}
					/>
					<T role="hand" align="center">
						{enemy.behaviorLine}
					</T>
					{state.openingHitPending && (
						<T role="bodySm" tone="accent" align="center">
							She flinches — the {enemy.name} pecks first. A lid or Warm Tea would
							block it.
						</T>
					)}
				</>
			)}

			{defeated && shownId !== "tollbooth_goose" && (
				<T role="hand" align="center">
					The {shownEnemy.name} stepped aside. Head back and send Rosie rambling on.
				</T>
			)}

			{defeated && shownId === "tollbooth_goose" && (
				<CeremonyCard color="sun" style={styles.victoryCard}>
					<T role="kickerPillSm" tone="accent" align="center">
						★ the road is won
					</T>
					<T role="sectionTitle" align="center">
						The Tollbooth Goose steps aside!
					</T>
					<T role="hand" align="center">
						Chapter one is hers. Head back and let Rosie savor the open road.
					</T>
				</CeremonyCard>
			)}

			<Sticker
				color="paper"
				rotate={0}
				radius={RADII.xl}
				shadow="none"
				style={styles.controls}
			>
				<ZoomiesMeter value={state.zoomies} />
				{!defeated && (
					<>
						<Button variant="gold" full onPress={handleTickle}>
							Tickle Rosie ({state.mockTickles} left)
						</Button>
						{card && cardIsFightCard && (
							<Button
								variant={state.cardPlayedThisFight ? "locked" : "ghost"}
								full
								disabled={state.cardPlayedThisFight}
								onPress={handlePlayCard}
							>
								{state.cardPlayedThisFight
									? `${card.name} played`
									: `Play ${card.name}`}
							</Button>
						)}
						{card && !cardIsFightCard && (
							<>
								<Button variant="locked" full disabled onPress={() => {}}>
									{card.name} is a road card
								</Button>
								<T role="bodySm" tone="secondary" align="center">
									Its charm shapes the walk, not the wall — save it for the
									send-off.
								</T>
							</>
						)}
					</>
				)}
				{defeated && (
					<Button variant="primary" full onPress={onBack}>
						Back to the journal
					</Button>
				)}
			</Sticker>

			{log.length > 0 && (
				<Sticker
					color="cream"
					rotate={0}
					radius={RADII.md}
					shadow="none"
					style={styles.log}
				>
					{log.map((line, i) => (
						<T key={i} role="bodySm" tone={i === 0 ? "primary" : "secondary"}>
							{line}
						</T>
					))}
				</Sticker>
			)}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1 },
	content: { paddingHorizontal: PAGE_PAD, paddingBottom: TAB_SAFE, gap: SPACE.md },
	arena: { padding: SPACE.md },
	arenaRow: {
		flexDirection: "row",
		alignItems: "flex-end",
		justifyContent: "space-between",
	},
	victoryCard: { padding: SPACE.lg, gap: SPACE.xs },
	controls: {
		gap: SPACE.sm,
		padding: SPACE.md,
	},
	log: {
		gap: SPACE.xs,
		padding: SPACE.md,
	},
});

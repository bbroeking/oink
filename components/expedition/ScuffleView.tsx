import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Animated, Easing } from "react-native";
import {
	PAGE_PAD,
	RADII,
	SPACE,
	STICKER_SHADOW,
	TAB_SAFE,
	TYPE,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Sticker } from "@/components/ui/Sticker";
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

	// ── Motion: HP bar drops on hit, the enemy recoils, Rosie reacts per tickle ──
	const hpAnim = useRef(new Animated.Value(maxHp > 0 ? hp / maxHp : 0)).current;
	const recoil = useRef(new Animated.Value(0)).current; // enemy shake
	const pulse = useRef(new Animated.Value(0)).current; // Rosie per-tickle bump

	useEffect(() => {
		const to = maxHp > 0 ? hp / maxHp : 0;
		if (policy.reduceMotion) {
			hpAnim.setValue(to);
			return;
		}
		Animated.timing(hpAnim, {
			toValue: to,
			duration: policy.duration(280),
			easing: Easing.out(Easing.quad),
			useNativeDriver: false, // animating width %
		}).start();
	}, [hp, maxHp, hpAnim, policy]);

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
					<View style={styles.hpRow}>
						<Text style={styles.hpLabel}>
							{hp}/{maxHp}
						</Text>
						<View style={styles.hpTrack}>
							<Animated.View
								style={[
									styles.hpFill,
									{
										width: hpAnim.interpolate({
											inputRange: [0, 1],
											outputRange: ["0%", "100%"],
										}),
									},
								]}
							/>
						</View>
					</View>
					<Text style={styles.behavior}>{enemy.behaviorLine}</Text>
					{state.openingHitPending && (
						<Text style={styles.warn}>
							She flinches — the {enemy.name} pecks first. A lid or Warm Tea would
							block it.
						</Text>
					)}
				</>
			)}

			{defeated && shownId !== "tollbooth_goose" && (
				<Text style={styles.victory}>
					The {shownEnemy.name} stepped aside. Head back and send Rosie rambling on.
				</Text>
			)}

			{defeated && shownId === "tollbooth_goose" && (
				<CeremonyCard color="sun" style={styles.victoryCard}>
					<Text style={styles.victoryKicker}>★ the road is won</Text>
					<Text style={styles.victoryTitle}>The Tollbooth Goose steps aside!</Text>
					<Text style={styles.victoryBody}>
						Chapter one is hers. Head back and let Rosie savor the open road.
					</Text>
				</CeremonyCard>
			)}

			<View style={styles.controls}>
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
								<Text style={styles.roadCardHint}>
									Its charm shapes the walk, not the wall — save it for the
									send-off.
								</Text>
							</>
						)}
					</>
				)}
				{defeated && (
					<Button variant="primary" full onPress={onBack}>
						Back to the journal
					</Button>
				)}
			</View>

			{log.length > 0 && (
				<View style={styles.log}>
					{log.map((line, i) => (
						<Text
							key={i}
							style={[styles.logLine, i === 0 && styles.logLineHead]}
						>
							{line}
						</Text>
					))}
				</View>
			)}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1 },
	content: { paddingHorizontal: PAGE_PAD, paddingBottom: TAB_SAFE, gap: SPACE.md },
	arena: { padding: SPACE.md, ...STICKER_SHADOW },
	arenaRow: {
		flexDirection: "row",
		alignItems: "flex-end",
		justifyContent: "space-between",
	},
	hpRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	hpLabel: { ...TYPE.label, color: UI_COLORS.action, width: 52 },
	hpTrack: {
		flex: 1,
		height: 14,
		borderWidth: 2,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.paper,
		overflow: "hidden",
	},
	hpFill: { height: "100%", backgroundColor: WHIMSY.accent },
	behavior: { ...TYPE.hand, color: UI_COLORS.textPrimary, textAlign: "center" },
	warn: { ...TYPE.bodySm, color: UI_COLORS.action, textAlign: "center" },
	victory: {
		...TYPE.hand,
		color: UI_COLORS.textPrimary,
		textAlign: "center",
	},
	victoryCard: { padding: SPACE.lg, gap: SPACE.xs },
	victoryKicker: { ...TYPE.kickerPillSm, color: UI_COLORS.action, textAlign: "center" },
	victoryTitle: {
		...TYPE.sectionTitle,
		color: UI_COLORS.textPrimary,
		textAlign: "center",
	},
	victoryBody: { ...TYPE.hand, color: UI_COLORS.textPrimary, textAlign: "center" },
	controls: {
		gap: SPACE.sm,
		padding: SPACE.md,
		borderWidth: 2,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.xl,
		backgroundColor: WHIMSY.paper,
	},
	roadCardHint: {
		...TYPE.bodySm,
		color: UI_COLORS.textSecondary,
		textAlign: "center",
	},
	log: {
		gap: SPACE.xs,
		padding: SPACE.md,
		borderWidth: 2,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.md,
		backgroundColor: WHIMSY.cream,
	},
	logLine: { ...TYPE.bodySm, color: UI_COLORS.textSecondary },
	logLineHead: { color: UI_COLORS.textPrimary },
});

// THROWAWAY PROTOTYPE — Rosie's Ramble.
//
// Question: which presentation makes "Rosie progresses while away; Tickles
// create Zoomies and help her overcome a wall" feel most like Tickle the Pig?
// Three structurally different UI variants share one in-memory state and are
// switchable with `?variant=A|B|C`. No persistence, network calls, or real rewards.
import React, { useMemo, useState } from "react";
import {
	Image,
	Pressable,
	SafeAreaView,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { Redirect, Stack, router, useLocalSearchParams } from "expo-router";

import { PrototypeSwitcher } from "@/components/prototypes/PrototypeSwitcher";
import {
	FONTS,
	PAGE_PAD,
	RADII,
	SHADOW_SM,
	SPACE,
	STICKER_SHADOW,
	TYPE,
	WHIMSY,
} from "@/constants/theme";

type VariantKey = "A" | "B" | "C";
type GearKey = "lid" | "spoon" | "clover";
type PlanKey = "boss" | "shiny" | "shortcut";

type Gear = {
	key: GearKey;
	icon: string;
	name: string;
	short: string;
	color: string;
	hit: number;
};

const GEAR: Gear[] = [
	{
		key: "lid",
		icon: "🥘",
		name: "Saucepan Lid",
		short: "Blocks the goose's opening peck.",
		color: WHIMSY.sky,
		hit: 1,
	},
	{
		key: "spoon",
		icon: "🥄",
		name: "Wooden Spoon",
		short: "Zoomies bonk for +2 extra.",
		color: WHIMSY.peach,
		hit: 2,
	},
	{
		key: "clover",
		icon: "☘️",
		name: "Lucky Clover",
		short: "Rosie brings home one extra find.",
		color: WHIMSY.sage,
		hit: 1,
	},
];

const PLANS: { key: PlanKey; icon: string; label: string; result: string }[] = [
	{ key: "boss", icon: "🪿", label: "Practice the goose", result: "Rosie studies the goose's peck." },
	{ key: "shiny", icon: "✨", label: "Look for shinies", result: "Rosie noses through every glittery hedge." },
	{ key: "shortcut", icon: "🪵", label: "Find a shortcut", result: "Rosie tries every suspicious little bridge." },
];

const VARIANTS = [
	{ key: "A", name: "Barn Return" },
	{ key: "B", name: "Live Scuffle" },
	{ key: "C", name: "Ramble Journal" },
];

type RambleState = {
	gear: GearKey;
	plan: PlanKey;
	tickles: number;
	zoomies: number;
	bossHp: number;
	progress: number;
	findCount: number;
	awayTrips: number;
	lastEvent: string;
};

type RambleActions = {
	equip: (gear: GearKey) => void;
	choosePlan: (plan: PlanKey) => void;
	tickle: () => void;
	simulateAway: () => void;
	reset: () => void;
};

type VariantProps = {
	state: RambleState;
	actions: RambleActions;
};

const INITIAL_STATE: RambleState = {
	gear: "lid",
	plan: "boss",
	tickles: 0,
	zoomies: 0,
	bossHp: 9,
	progress: 4,
	findCount: 2,
	awayTrips: 0,
	lastEvent: "Rosie reached the Tollbooth Goose and came home for a little help.",
};

function gearFor(key: GearKey) {
	return GEAR.find((gear) => gear.key === key) ?? GEAR[0];
}

function Rosie({ mood = "happy", size = 190 }: { mood?: "happy" | "tired" | "surprise"; size?: number }) {
	const source =
		mood === "tired"
			? require("../assets/images/sprites/rosie/tired_1.png")
			: mood === "surprise"
				? require("../assets/images/sprites/rosie/surprise_1.png")
				: require("../assets/images/sprites/rosie/happy_1.png");
	return <Image source={source} resizeMode="contain" style={{ width: size, height: size }} />;
}

function ZoomiesMeter({ value, compact = false }: { value: number; compact?: boolean }) {
	return (
		<View style={compact ? styles.zoomiesCompact : styles.zoomiesBlock}>
			<View style={styles.meterLabels}>
				<Text style={styles.meterTitle}>ZOOMIES</Text>
				<Text style={styles.meterCount}>{value}/5</Text>
			</View>
			<View style={styles.meterTrack}>
				<View style={[styles.meterFill, { width: `${(value / 5) * 100}%` }]} />
			</View>
			{!compact && (
				<Text style={styles.meterHint}>
					Tickles charge a burst. Rosie still rambles without them.
				</Text>
			)}
		</View>
	);
}

function GearChoices({
	selected,
	onSelect,
	compact = false,
}: {
	selected: GearKey;
	onSelect: (gear: GearKey) => void;
	compact?: boolean;
}) {
	return (
		<View style={compact ? styles.gearRowCompact : styles.gearRow}>
			{GEAR.map((gear) => {
				const active = selected === gear.key;
				return (
					<Pressable
						key={gear.key}
						onPress={() => onSelect(gear.key)}
						style={({ pressed }) => [
							compact ? styles.gearChip : styles.gearCard,
							{ backgroundColor: gear.color },
							active && styles.gearSelected,
							pressed && styles.pressed,
						]}
					>
						<Text style={compact ? styles.gearIconCompact : styles.gearIcon}>{gear.icon}</Text>
						<Text style={compact ? styles.gearNameCompact : styles.gearName}>{gear.name}</Text>
						{!compact && <Text style={styles.gearShort}>{gear.short}</Text>}
					</Pressable>
				);
			})}
		</View>
	);
}

function StateReadout({ state, onReset }: { state: RambleState; onReset: () => void }) {
	return (
		<View style={styles.stateReadout}>
			<View style={styles.stateHeader}>
				<Text style={styles.stateTitle}>LIVE PROTOTYPE STATE</Text>
				<Pressable onPress={onReset}><Text style={styles.resetText}>reset</Text></Pressable>
			</View>
			<Text style={styles.stateText}>
				path {state.progress}/12 · goose {state.bossHp}/9 hp · {state.findCount} finds
			</Text>
			<Text style={styles.stateText}>
				{state.tickles} tickles · zoomies {state.zoomies}/5 · gear {state.gear}
			</Text>
			<Text style={styles.stateText}>
				plan {state.plan} · away trips {state.awayTrips}
			</Text>
		</View>
	);
}

function PrimaryButton({
	label,
	sub,
	onPress,
	color = WHIMSY.rose,
}: {
	label: string;
	sub?: string;
	onPress: () => void;
	color?: string;
}) {
	return (
		<Pressable
			onPress={onPress}
			style={({ pressed }) => [
				styles.primaryButton,
				{ backgroundColor: color },
				pressed && styles.pressed,
			]}
		>
			<Text style={styles.primaryLabel}>{label}</Text>
			{sub && <Text style={styles.primarySub}>{sub}</Text>}
		</Pressable>
	);
}

function VariantA({ state, actions }: VariantProps) {
	const gear = gearFor(state.gear);
	const defeated = state.bossHp <= 0;
	return (
		<ScrollView style={styles.aRoot} contentContainerStyle={styles.aContent}>
			<View style={styles.aHeader}>
				<View>
					<Text style={styles.kicker}>VARIANT A · BARN RETURN</Text>
					<Text style={styles.pageTitle}>Rosie came home!</Text>
				</View>
				<View style={styles.tickleBank}>
					<Text style={styles.tickleBankIcon}>♡</Text>
					<Text style={styles.tickleBankValue}>{state.tickles}</Text>
				</View>
			</View>

			<View style={styles.barnScene}>
				<View style={styles.barnSun}><Text style={styles.barnSunText}>☀</Text></View>
				<View style={styles.barnShape}>
					<View style={styles.barnRoof} />
					<View style={styles.barnBody}><Text style={styles.barnDoor}>╳</Text></View>
				</View>
				<View style={styles.aRosie}>
					<Rosie mood={defeated ? "happy" : "tired"} size={218} />
					<View style={[styles.gearBadge, { backgroundColor: gear.color }]}>
						<Text style={styles.gearBadgeIcon}>{gear.icon}</Text>
						<Text style={styles.gearBadgeText}>{gear.name}</Text>
					</View>
				</View>
				<View style={styles.grassStrip} />
			</View>

			<View style={styles.returnNote}>
				<Text style={styles.noteTape}>ROSIE'S RAMBLE</Text>
				<Text style={styles.returnTitle}>
					{defeated ? "The goose has been thoroughly outfoxed." : "A goose blocked the little bridge."}
				</Text>
				<Text style={styles.returnBody}>{state.lastEvent}</Text>
				<View style={styles.haulRow}>
					<Text style={styles.haulText}>Satchel: {Array.from({ length: state.findCount }, () => "●").join(" ")}</Text>
					<Text style={styles.haulText}>Path: {state.progress}/12</Text>
				</View>
			</View>

			<ZoomiesMeter value={state.zoomies} />
			<PrimaryButton
				label="Tickle Rosie"
				sub={defeated ? "A happy victory tickle" : "Build Zoomies for the rematch"}
				onPress={actions.tickle}
			/>

			<View style={styles.section}>
				<Text style={styles.sectionKicker}>DRESS HER FOR THE NEXT TRY</Text>
				<GearChoices selected={state.gear} onSelect={actions.equip} />
			</View>

			<PrimaryButton
				label="Pretend 3 hours passed"
				sub="Rosie progresses even with zero Tickles"
				onPress={actions.simulateAway}
				color={WHIMSY.sage}
			/>
			<StateReadout state={state} onReset={actions.reset} />
		</ScrollView>
	);
}

function VariantB({ state, actions }: VariantProps) {
	const gear = gearFor(state.gear);
	const defeated = state.bossHp <= 0;
	return (
		<View style={styles.bRoot}>
			<View style={styles.bTop}>
				<Text style={styles.kicker}>VARIANT B · LIVE SCUFFLE</Text>
				<Text style={styles.bTitle}>Tollbooth Goose</Text>
				<View style={styles.bossHpRow}>
					<Text style={styles.bossHpLabel}>{defeated ? "OUTFOXED" : `${state.bossHp}/9`}</Text>
					<View style={styles.bossHpTrack}>
						<View style={[styles.bossHpFill, { width: `${(state.bossHp / 9) * 100}%` }]} />
					</View>
				</View>
			</View>

			<View style={styles.bBattlefield}>
				<Text style={styles.cloudOne}>☁</Text>
				<Text style={styles.cloudTwo}>☁</Text>
				<View style={styles.bridge}>
					{Array.from({ length: 7 }, (_, index) => <View key={index} style={styles.bridgePlank} />)}
				</View>
				<Pressable onPress={actions.tickle} style={styles.bRosie}>
					<Rosie mood={defeated ? "happy" : "surprise"} size={190} />
					<View style={[styles.equippedBubble, { backgroundColor: gear.color }]}>
						<Text style={styles.equippedBubbleText}>{gear.icon}</Text>
					</View>
				</Pressable>
				<View style={styles.gooseWrap}>
					<Text style={styles.goose}>{defeated ? "🪶" : "🪿"}</Text>
					<Text style={styles.gooseLine}>{defeated ? "HONK?!" : "NO PIGS PAST."}</Text>
				</View>
				<View style={styles.bGrass} />
			</View>

			<View style={styles.bControls}>
				<Text style={styles.battleEvent}>{state.lastEvent}</Text>
				<ZoomiesMeter value={state.zoomies} compact />
				<PrimaryButton
					label={defeated ? "Tickle the champion" : "Tickle to cheer Rosie"}
					sub={state.zoomies === 4 ? "One more unleashes Zoomies!" : `${gear.name} is equipped`}
					onPress={actions.tickle}
					color={WHIMSY.sun}
				/>
				<GearChoices selected={state.gear} onSelect={actions.equip} compact />
				<View style={styles.bActionRow}>
					<Pressable onPress={actions.simulateAway} style={styles.secondaryButton}>
						<Text style={styles.secondaryButtonText}>Let Rosie ramble 3h</Text>
					</Pressable>
					<Pressable onPress={actions.reset} style={styles.smallReset}>
						<Text style={styles.smallResetText}>↺</Text>
					</Pressable>
				</View>
				<StateReadout state={state} onReset={actions.reset} />
			</View>
		</View>
	);
}

function PathMap({ progress }: { progress: number }) {
	return (
		<View style={styles.pathMap}>
			<View style={styles.pathLine} />
			{[0, 3, 6, 9, 12].map((step, index) => {
				const done = progress >= step;
				return (
					<View key={step} style={styles.pathStop}>
						<View style={[styles.pathDot, done && styles.pathDotDone]}>
							<Text style={styles.pathDotIcon}>{["🏠", "🌳", "🪿", "🍄", "🏰"][index]}</Text>
						</View>
						<Text style={styles.pathStopLabel}>{step}</Text>
					</View>
				);
			})}
		</View>
	);
}

function VariantC({ state, actions }: VariantProps) {
	const gear = gearFor(state.gear);
	const defeated = state.bossHp <= 0;
	return (
		<ScrollView style={styles.cRoot} contentContainerStyle={styles.cContent}>
			<Text style={styles.kicker}>VARIANT C · RAMBLE JOURNAL</Text>
			<View style={styles.journalHeading}>
				<View>
					<Text style={styles.pageTitle}>Rosie's Ramble</Text>
					<Text style={styles.handText}>Chapter one · The Insolent Goose</Text>
				</View>
				<Text style={styles.journalStamp}>DAY {state.awayTrips + 1}</Text>
			</View>

			<PathMap progress={state.progress} />

			<View style={styles.postcard}>
				<View style={styles.postcardArt}>
					<Rosie mood={defeated ? "happy" : "tired"} size={178} />
					<Text style={styles.postcardGoose}>{defeated ? "🪶" : "🪿"}</Text>
				</View>
				<View style={styles.postcardCopy}>
					<Text style={styles.postcardKicker}>LATEST POSTCARD</Text>
					<Text style={styles.postcardTitle}>
						{defeated ? "The bridge is open!" : "Stopped at the little bridge"}
					</Text>
					<Text style={styles.postcardBody}>{state.lastEvent}</Text>
				</View>
			</View>

			<View style={styles.journalSection}>
				<Text style={styles.sectionKicker}>WHAT SHOULD ROSIE DO NEXT?</Text>
				<View style={styles.planList}>
					{PLANS.map((plan) => {
						const selected = state.plan === plan.key;
						return (
							<Pressable
								key={plan.key}
								onPress={() => actions.choosePlan(plan.key)}
								style={[styles.planRow, selected && styles.planRowSelected]}
							>
								<Text style={styles.planIcon}>{plan.icon}</Text>
								<View style={{ flex: 1 }}>
									<Text style={styles.planLabel}>{plan.label}</Text>
									<Text style={styles.planResult}>{plan.result}</Text>
								</View>
								<Text style={styles.planCheck}>{selected ? "✓" : ""}</Text>
							</Pressable>
						);
					})}
				</View>
			</View>

			<View style={styles.loadoutStrip}>
				<View style={[styles.loadoutIcon, { backgroundColor: gear.color }]}>
					<Text style={styles.loadoutEmoji}>{gear.icon}</Text>
				</View>
				<View style={{ flex: 1 }}>
					<Text style={styles.sectionKicker}>PACKED FOR THE TRIP</Text>
					<Text style={styles.loadoutTitle}>{gear.name}</Text>
					<Text style={styles.loadoutBody}>{gear.short}</Text>
				</View>
			</View>
			<GearChoices selected={state.gear} onSelect={actions.equip} compact />

			<View style={styles.sendoff}>
				<ZoomiesMeter value={state.zoomies} />
				<PrimaryButton
					label="Give Rosie a send-off tickle"
					sub="Affection helps; absence never hurts"
					onPress={actions.tickle}
				/>
				<Pressable onPress={actions.simulateAway} style={styles.leaveButton}>
					<Text style={styles.leaveButtonText}>Send Rosie rambling →</Text>
				</Pressable>
			</View>
			<StateReadout state={state} onReset={actions.reset} />
		</ScrollView>
	);
}

export default function IdleBattlerPrototype() {
	if (!__DEV__) return <Redirect href="/" />;
	return <IdleBattlerPrototypeLab />;
}

function IdleBattlerPrototypeLab() {
	const params = useLocalSearchParams<{ variant?: string }>();
	const variant: VariantKey = params.variant === "B" || params.variant === "C" ? params.variant : "A";
	const [state, setState] = useState<RambleState>(INITIAL_STATE);

	const actions = useMemo<RambleActions>(() => ({
		equip: (gear) => {
			setState((current) => ({
				...current,
				gear,
				lastEvent: `Rosie tries the ${gearFor(gear).name}. The goose looks concerned.`,
			}));
		},
		choosePlan: (plan) => {
			setState((current) => ({
				...current,
				plan,
				lastEvent: PLANS.find((item) => item.key === plan)?.result ?? current.lastEvent,
			}));
		},
		tickle: () => {
			setState((current) => {
				if (current.bossHp <= 0) {
					return {
						...current,
						tickles: current.tickles + 1,
						zoomies: Math.min(5, current.zoomies + 1),
						lastEvent: "Rosie kicks her feet and demands a victory tickle.",
					};
				}
				const nextZoomies = current.zoomies + 1;
				const bursts = nextZoomies >= 5;
				const gear = gearFor(current.gear);
				const openingBlock = current.gear === "lid" && current.tickles === 0 ? 1 : 0;
				const zoomieBonus = bursts ? (current.gear === "spoon" ? 4 : 2) : 0;
				const damage = gear.hit + openingBlock + zoomieBonus;
				const bossHp = Math.max(0, current.bossHp - damage);
				return {
					...current,
					tickles: current.tickles + 1,
					zoomies: bursts ? 0 : nextZoomies,
					bossHp,
					progress: bossHp === 0 ? Math.max(current.progress, 7) : current.progress,
					findCount: bossHp === 0 && current.bossHp > 0 ? current.findCount + 1 : current.findCount,
					lastEvent:
						bossHp === 0
							? `ZOOM! Rosie slips past the goose with her ${gear.name}.`
							: bursts
								? `Zoomies! The ${gear.name} changes Rosie's whole approach.`
								: `Rosie feels braver. The goose gives up ${damage} ground.`,
				};
			});
		},
		simulateAway: () => {
			setState((current) => {
				const finds = current.plan === "shiny" || current.gear === "clover" ? 3 : 2;
				const advance = current.bossHp > 0 ? 0 : current.plan === "shortcut" ? 3 : 2;
				return {
					...current,
					awayTrips: current.awayTrips + 1,
					findCount: finds,
					progress: Math.min(12, current.progress + advance),
					lastEvent:
						current.bossHp > 0
							? "Three hours passed. Rosie found two useful things, then waited at the goose—no progress was lost."
							: `Three hours passed. Rosie followed the ${current.plan} plan and padded farther down the path.`,
				};
			});
		},
		reset: () => setState(INITIAL_STATE),
	}), []);

	return (
		<SafeAreaView style={styles.root}>
			<Stack.Screen options={{ headerShown: false }} />
			{variant === "A" && <VariantA state={state} actions={actions} />}
			{variant === "B" && <VariantB state={state} actions={actions} />}
			{variant === "C" && <VariantC state={state} actions={actions} />}
			<PrototypeSwitcher
				current={variant}
				variants={VARIANTS}
				onChange={(key) => router.setParams({ variant: key })}
			/>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: WHIMSY.paper },
	kicker: { ...TYPE.kickerPill, color: WHIMSY.accent },
	pageTitle: { ...TYPE.pageTitle, color: WHIMSY.ink },
	sectionKicker: { ...TYPE.kickerPill, color: WHIMSY.accent },
	handText: { ...TYPE.hand, color: WHIMSY.mute },
	pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },

	zoomiesBlock: { gap: 5 },
	zoomiesCompact: { gap: 4 },
	meterLabels: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
	meterTitle: { ...TYPE.kickerPill, color: WHIMSY.accent },
	meterCount: { ...TYPE.label, color: WHIMSY.ink },
	meterTrack: { height: 12, borderRadius: RADII.pill, backgroundColor: WHIMSY.cream2, borderWidth: 2, borderColor: WHIMSY.ink, overflow: "hidden" },
	meterFill: { height: "100%", backgroundColor: WHIMSY.roseDeep },
	meterHint: { ...TYPE.bodySm, color: WHIMSY.mute },

	gearRow: { gap: SPACE.sm },
	gearRowCompact: { flexDirection: "row", gap: SPACE.sm },
	gearCard: { borderWidth: 2, borderColor: WHIMSY.ink, borderRadius: RADII.lg, padding: SPACE.md, minHeight: 84, ...SHADOW_SM },
	gearChip: { flex: 1, minWidth: 0, borderWidth: 2, borderColor: WHIMSY.ink, borderRadius: RADII.md, padding: SPACE.sm, alignItems: "center" },
	gearSelected: { borderWidth: 4, padding: 6 },
	gearIcon: { position: "absolute", right: 14, top: 13, fontSize: 30 },
	gearIconCompact: { fontSize: 24 },
	gearName: { ...TYPE.cardTitle, color: WHIMSY.ink, paddingRight: 48 },
	gearNameCompact: { fontFamily: FONTS.bodyExtra, color: WHIMSY.ink, fontSize: 10, textAlign: "center" },
	gearShort: { ...TYPE.bodySm, color: WHIMSY.mute, maxWidth: "82%", marginTop: 4 },

	stateReadout: { backgroundColor: WHIMSY.bark, borderRadius: RADII.lg, padding: SPACE.md, gap: 3 },
	stateHeader: { flexDirection: "row", justifyContent: "space-between" },
	stateTitle: { ...TYPE.kickerPill, color: WHIMSY.sun },
	stateText: { fontFamily: "SpaceMono-Regular", fontSize: 10, color: WHIMSY.barkText },
	resetText: { ...TYPE.label, color: WHIMSY.barkText, textDecorationLine: "underline" },

	primaryButton: { minHeight: 62, borderWidth: 2, borderColor: WHIMSY.ink, borderRadius: RADII.xl, justifyContent: "center", alignItems: "center", paddingHorizontal: SPACE.lg, ...STICKER_SHADOW },
	primaryLabel: { ...TYPE.cardTitle, color: WHIMSY.ink },
	primarySub: { ...TYPE.bodySm, color: WHIMSY.mute, textAlign: "center" },

	// Variant A — the adventure is subordinate to the familiar Barn.
	aRoot: { flex: 1, backgroundColor: WHIMSY.paper },
	aContent: { padding: PAGE_PAD, paddingTop: 20, paddingBottom: 110, gap: SPACE.lg },
	aHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
	tickleBank: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: WHIMSY.rose, borderWidth: 2, borderColor: WHIMSY.ink, borderRadius: RADII.pill, paddingHorizontal: 12, paddingVertical: 6 },
	tickleBankIcon: { fontFamily: FONTS.display, fontSize: 20, color: WHIMSY.accent },
	tickleBankValue: { ...TYPE.numeral, color: WHIMSY.ink },
	barnScene: { height: 310, borderWidth: 2, borderColor: WHIMSY.ink, borderRadius: RADII.xxl, backgroundColor: WHIMSY.sky, overflow: "hidden", ...SHADOW_SM },
	barnSun: { position: "absolute", right: 18, top: 15, width: 54, height: 54, borderRadius: 27, backgroundColor: WHIMSY.sun, alignItems: "center", justifyContent: "center" },
	barnSunText: { fontSize: 32, color: WHIMSY.ink },
	barnShape: { position: "absolute", left: 20, bottom: 38, width: 128, height: 144 },
	barnRoof: { width: 0, height: 0, borderLeftWidth: 74, borderRightWidth: 74, borderBottomWidth: 66, borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomColor: "#9f3c35", position: "absolute", top: -28, left: -10 },
	barnBody: { position: "absolute", bottom: 0, width: 128, height: 112, backgroundColor: "#c95449", borderWidth: 2, borderColor: WHIMSY.ink, alignItems: "center", justifyContent: "flex-end" },
	barnDoor: { width: 64, height: 74, backgroundColor: "#754b36", color: WHIMSY.paper, fontSize: 45, textAlign: "center", borderWidth: 2, borderColor: WHIMSY.ink },
	aRosie: { position: "absolute", right: 12, bottom: 17, alignItems: "center" },
	gearBadge: { position: "absolute", right: 0, top: 16, flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 2, borderColor: WHIMSY.ink, borderRadius: RADII.pill, paddingHorizontal: 8, paddingVertical: 4 },
	gearBadgeIcon: { fontSize: 17 },
	gearBadgeText: { fontFamily: FONTS.bodyExtra, fontSize: 10, color: WHIMSY.ink },
	grassStrip: { position: "absolute", bottom: 0, left: 0, right: 0, height: 42, backgroundColor: "#8fbd72", borderTopWidth: 2, borderColor: WHIMSY.ink },
	returnNote: { backgroundColor: WHIMSY.paper, borderWidth: 2, borderColor: WHIMSY.ink, borderRadius: RADII.md, padding: SPACE.lg, gap: SPACE.sm, transform: [{ rotate: "-0.7deg" }], ...SHADOW_SM },
	noteTape: { alignSelf: "center", marginTop: -30, backgroundColor: WHIMSY.sun, paddingHorizontal: 16, paddingVertical: 4, ...TYPE.kickerPill, color: WHIMSY.ink },
	returnTitle: { ...TYPE.cardTitle, color: WHIMSY.ink },
	returnBody: { ...TYPE.body, color: WHIMSY.mute },
	haulRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: SPACE.xs, borderTopWidth: 1, borderColor: WHIMSY.muteSoft },
	haulText: { ...TYPE.label, color: WHIMSY.ink },
	section: { gap: SPACE.sm },

	// Variant B — the battle is the primary surface and Rosie is the button.
	bRoot: { flex: 1, backgroundColor: "#dcecf1" },
	bTop: { paddingHorizontal: PAGE_PAD, paddingTop: 16, gap: 4 },
	bTitle: { ...TYPE.pageTitle, color: WHIMSY.ink },
	bossHpRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	bossHpLabel: { ...TYPE.label, color: WHIMSY.accent, width: 66 },
	bossHpTrack: { flex: 1, height: 13, borderWidth: 2, borderColor: WHIMSY.ink, borderRadius: RADII.pill, backgroundColor: WHIMSY.paper, overflow: "hidden" },
	bossHpFill: { height: "100%", backgroundColor: WHIMSY.accent },
	bBattlefield: { flex: 1, minHeight: 290, marginTop: SPACE.sm, position: "relative", overflow: "hidden" },
	cloudOne: { position: "absolute", left: 18, top: 24, fontSize: 46, opacity: 0.75 },
	cloudTwo: { position: "absolute", right: 75, top: 64, fontSize: 30, opacity: 0.6 },
	bridge: { position: "absolute", bottom: 35, left: "23%", right: "20%", height: 40, flexDirection: "row", gap: 2, transform: [{ rotate: "-2deg" }] },
	bridgePlank: { flex: 1, backgroundColor: "#a9794e", borderWidth: 1, borderColor: WHIMSY.ink },
	bRosie: { position: "absolute", left: "4%", bottom: 29 },
	equippedBubble: { position: "absolute", left: 5, top: 24, width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: WHIMSY.ink, alignItems: "center", justifyContent: "center" },
	equippedBubbleText: { fontSize: 24 },
	gooseWrap: { position: "absolute", right: "6%", bottom: 76, alignItems: "center" },
	goose: { fontSize: 88 },
	gooseLine: { ...TYPE.kickerPill, color: WHIMSY.ink, backgroundColor: WHIMSY.paper, borderWidth: 2, borderColor: WHIMSY.ink, paddingHorizontal: 8, paddingVertical: 4, transform: [{ rotate: "2deg" }] },
	bGrass: { position: "absolute", bottom: 0, left: 0, right: 0, height: 42, backgroundColor: "#7fa76d", borderTopWidth: 2, borderColor: WHIMSY.ink },
	bControls: { maxHeight: "51%", backgroundColor: WHIMSY.paper, borderTopWidth: 3, borderColor: WHIMSY.ink, borderTopLeftRadius: RADII.xxl, borderTopRightRadius: RADII.xxl, padding: PAGE_PAD, paddingBottom: 102, gap: SPACE.sm },
	battleEvent: { ...TYPE.hand, color: WHIMSY.ink, textAlign: "center", minHeight: 38 },
	bActionRow: { flexDirection: "row", gap: SPACE.sm },
	secondaryButton: { flex: 1, borderWidth: 2, borderColor: WHIMSY.ink, borderRadius: RADII.md, backgroundColor: WHIMSY.sage, padding: SPACE.sm, alignItems: "center" },
	secondaryButtonText: { ...TYPE.label, color: WHIMSY.ink },
	smallReset: { width: 42, borderWidth: 2, borderColor: WHIMSY.ink, borderRadius: RADII.md, alignItems: "center", justifyContent: "center" },
	smallResetText: { fontSize: 24, color: WHIMSY.ink },

	// Variant C — a calm plan/return journal; battle becomes a postcard.
	cRoot: { flex: 1, backgroundColor: "#f3e4cc" },
	cContent: { padding: PAGE_PAD, paddingTop: 18, paddingBottom: 112, gap: SPACE.lg },
	journalHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
	journalStamp: { ...TYPE.kickerPill, color: WHIMSY.accent, borderWidth: 2, borderColor: WHIMSY.accent, borderRadius: RADII.sm, paddingHorizontal: 7, paddingVertical: 5, transform: [{ rotate: "5deg" }] },
	pathMap: { height: 88, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", position: "relative", paddingTop: 7 },
	pathLine: { position: "absolute", left: 24, right: 24, top: 30, height: 4, backgroundColor: "#b9976c", borderRadius: RADII.pill },
	pathStop: { alignItems: "center", width: 52, zIndex: 2 },
	pathDot: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: WHIMSY.ink, backgroundColor: WHIMSY.paper, alignItems: "center", justifyContent: "center" },
	pathDotDone: { backgroundColor: WHIMSY.sun },
	pathDotIcon: { fontSize: 24 },
	pathStopLabel: { ...TYPE.label, color: WHIMSY.mute, marginTop: 3 },
	postcard: { backgroundColor: WHIMSY.paper, borderWidth: 2, borderColor: WHIMSY.ink, padding: SPACE.md, transform: [{ rotate: "-1deg" }], ...STICKER_SHADOW },
	postcardArt: { height: 188, backgroundColor: WHIMSY.sky, borderWidth: 1, borderColor: WHIMSY.ink, overflow: "hidden", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around" },
	postcardGoose: { fontSize: 72, paddingBottom: 22 },
	postcardCopy: { paddingTop: SPACE.md, gap: 3 },
	postcardKicker: { ...TYPE.kickerPill, color: WHIMSY.accent },
	postcardTitle: { ...TYPE.cardTitle, color: WHIMSY.ink },
	postcardBody: { ...TYPE.hand, color: WHIMSY.mute },
	journalSection: { gap: SPACE.sm },
	planList: { gap: SPACE.sm },
	planRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, backgroundColor: WHIMSY.paper, borderWidth: 2, borderColor: WHIMSY.ink, borderRadius: RADII.md, padding: SPACE.sm },
	planRowSelected: { backgroundColor: WHIMSY.sun, transform: [{ rotate: "0.5deg" }] },
	planIcon: { fontSize: 28 },
	planLabel: { ...TYPE.label, color: WHIMSY.ink },
	planResult: { ...TYPE.bodySm, color: WHIMSY.mute },
	planCheck: { ...TYPE.cardTitle, color: WHIMSY.ink, width: 22 },
	loadoutStrip: { flexDirection: "row", alignItems: "center", gap: SPACE.md, backgroundColor: WHIMSY.paper, borderWidth: 2, borderColor: WHIMSY.ink, borderRadius: RADII.lg, padding: SPACE.md },
	loadoutIcon: { width: 62, height: 62, borderRadius: RADII.md, borderWidth: 2, borderColor: WHIMSY.ink, alignItems: "center", justifyContent: "center" },
	loadoutEmoji: { fontSize: 36 },
	loadoutTitle: { ...TYPE.cardTitle, color: WHIMSY.ink },
	loadoutBody: { ...TYPE.bodySm, color: WHIMSY.mute },
	sendoff: { backgroundColor: WHIMSY.paper, borderWidth: 2, borderColor: WHIMSY.ink, borderRadius: RADII.xl, padding: SPACE.lg, gap: SPACE.md, ...SHADOW_SM },
	leaveButton: { alignItems: "center", padding: SPACE.sm },
	leaveButtonText: { ...TYPE.label, color: WHIMSY.accent, textDecorationLine: "underline" },
});

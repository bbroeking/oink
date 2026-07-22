// THROWAWAY PROTOTYPE — Slop Club member perks.
//
// Question: do the Dye Vat, Gilded Rosie, and Barn Reactions feel like three
// parts of one expressive membership, and which presentation makes their value
// clearest? Three UI structures share one in-memory state and are switchable
// with `?variant=A|B|C`. No database or AsyncStorage writes.
import React, { useMemo, useRef, useState } from "react";
import {
	Animated,
	Pressable,
	SafeAreaView,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { PigStage } from "@/components/ui/PigStage";
import { Glyph, type GlyphName } from "@/components/ui/Glyph";
import { Icon } from "@/components/ui/Icon";
import {
	FONTS,
	PAGE_PAD,
	RADII,
	SHADOW_SM,
	SPACE,
	TYPE,
	WHIMSY,
} from "@/constants/theme";

const SAMPLE_HAT = {
	id: "slop_club_laurel_cap",
	category: "hat",
	emoji: null,
};

const PALETTES = [
	{ key: "natural", name: "Natural", color: null },
	{ key: "rose", name: "Rose Gold", color: WHIMSY.roseDeep },
	{ key: "moss", name: "Bog Moss", color: WHIMSY.curseGreen },
	{ key: "sun", name: "Cream & Gold", color: WHIMSY.sun },
	{ key: "plum", name: "Deep Plum", color: WHIMSY.lilacDeep },
	{ key: "gilded", name: "Gilded", color: WHIMSY.slopGold },
] as const;

const REACTIONS: { glyph: GlyphName; label: string }[] = [
	{ glyph: "coffee", label: "Cozy" },
	{ glyph: "heart", label: "Love" },
	{ glyph: "sparkles", label: "Shine" },
	{ glyph: "party", label: "Party" },
];

type VariantKey = "A" | "B" | "C";
type Burst = { id: number; glyph: GlyphName; anim: Animated.Value };
type LabProps = {
	paletteKey: string;
	setPaletteKey: (key: string) => void;
	gilded: boolean;
	setGilded: (value: boolean) => void;
	lastReaction: string;
	reactionCount: number;
	playReaction: (reaction: { glyph: GlyphName; label: string }) => void;
	bursts: Burst[];
};

function RosiePreview({
	paletteKey,
	gilded,
	bursts,
	size = 250,
}: Pick<LabProps, "paletteKey" | "gilded" | "bursts"> & { size?: number }) {
	const palette = PALETTES.find((item) => item.key === paletteKey) ?? PALETTES[0];
	const scale = size / 300;
	return (
		<View style={[styles.preview, { width: size, height: size }]}>
			<View style={[styles.stageScale, { transform: [{ scale }] }]}>
				<PigStage
					pigAnimation="idle"
					equipped={SAMPLE_HAT}
					tints={palette.color ? { [SAMPLE_HAT.id]: palette.color } : {}}
					skinTintOverride={gilded ? WHIMSY.slopGold : null}
				/>
			</View>
			<View style={styles.burstLayer} pointerEvents="none">
				{bursts.map((burst) => (
					<Animated.View
						key={burst.id}
						style={[
							styles.burst,
							{
								opacity: burst.anim.interpolate({
									inputRange: [0, 0.15, 0.78, 1],
									outputRange: [0, 1, 1, 0],
								}),
								transform: [
									{
										translateY: burst.anim.interpolate({
											inputRange: [0, 1],
											outputRange: [30, -145],
										}),
									},
									{
										scale: burst.anim.interpolate({
											inputRange: [0, 0.18, 1],
											outputRange: [0.35, 1.15, 0.85],
										}),
									},
								],
							},
						]}
					>
						<Glyph name={burst.glyph} size={38} />
					</Animated.View>
				))}
			</View>
		</View>
	);
}

function PaletteControls({ paletteKey, setPaletteKey }: Pick<LabProps, "paletteKey" | "setPaletteKey">) {
	return (
		<View style={styles.paletteRow}>
			{PALETTES.map((palette) => {
				const selected = palette.key === paletteKey;
				return (
					<Pressable
						key={palette.key}
						onPress={() => setPaletteKey(palette.key)}
						style={({ pressed }) => [
							styles.swatch,
							palette.color
								? { backgroundColor: palette.color }
								: styles.swatchNatural,
							selected && styles.swatchSelected,
							pressed && { opacity: 0.7 },
						]}
						accessibilityRole="button"
						accessibilityLabel={`Use ${palette.name} dye`}
					>
						{selected && <Icon name="check" size={13} color={WHIMSY.ink} strokeWidth={3} />}
					</Pressable>
				);
			})}
		</View>
	);
}

function ReactionControls({ playReaction }: Pick<LabProps, "playReaction">) {
	return (
		<View style={styles.reactionRow}>
			{REACTIONS.map((reaction) => (
				<Pressable
					key={reaction.label}
					onPress={() => playReaction(reaction)}
					style={({ pressed }) => [styles.reactionButton, pressed && styles.pressed]}
				>
					<Glyph name={reaction.glyph} size={23} />
					<Text style={styles.reactionLabel}>{reaction.label}</Text>
				</Pressable>
			))}
		</View>
	);
}

function GildToggle({ gilded, setGilded }: Pick<LabProps, "gilded" | "setGilded">) {
	return (
		<Pressable
			onPress={() => setGilded(!gilded)}
			style={({ pressed }) => [
				styles.gildToggle,
				gilded && styles.gildToggleOn,
				pressed && styles.pressed,
			]}
		>
			<Glyph name="premium" size={20} />
			<View style={{ flex: 1 }}>
				<Text style={styles.gildTitle}>Gilded Rosie</Text>
				<Text style={styles.gildSub}>{gilded ? "Gold wash is on" : "Natural pink skin"}</Text>
			</View>
			<View style={[styles.toggleTrack, gilded && styles.toggleTrackOn]}>
				<View style={[styles.toggleKnob, gilded && styles.toggleKnobOn]} />
			</View>
		</Pressable>
	);
}

function StateReadout({ paletteKey, gilded, lastReaction, reactionCount }: LabProps) {
	const palette = PALETTES.find((item) => item.key === paletteKey)?.name ?? "Natural";
	return (
		<View style={styles.stateReadout}>
			<Text style={styles.stateTitle}>LIVE PROTOTYPE STATE</Text>
			<Text style={styles.stateText}>hat dye: {palette}</Text>
			<Text style={styles.stateText}>Rosie: {gilded ? "gilded" : "natural"}</Text>
			<Text style={styles.stateText}>last reaction: {lastReaction || "none"}</Text>
			<Text style={styles.stateText}>reactions played: {reactionCount}</Text>
		</View>
	);
}

function VariantA(props: LabProps) {
	return (
		<ScrollView contentContainerStyle={styles.scrollContent}>
			<Text style={styles.kicker}>VARIANT A · PERK PASSPORT</Text>
			<Text style={styles.title}>Three reasons to belong</Text>
			<Text style={styles.lede}>Each perk gets a simple member card. Clear, legible, storefront-friendly.</Text>
			<View style={styles.centered}><RosiePreview {...props} bursts={props.bursts} /></View>
			<View style={styles.card}>
				<Text style={styles.cardEyebrow}>01 · THE DYE VAT</Text>
				<Text style={styles.cardTitle}>Make the club cap yours</Text>
				<PaletteControls {...props} />
			</View>
			<View style={styles.card}>
				<Text style={styles.cardEyebrow}>02 · SIGNATURE SKIN</Text>
				<GildToggle {...props} />
			</View>
			<View style={styles.card}>
				<Text style={styles.cardEyebrow}>03 · CLUB REACTIONS</Text>
				<Text style={styles.cardTitle}>Make a little scene</Text>
				<ReactionControls {...props} />
			</View>
			<StateReadout {...props} />
		</ScrollView>
	);
}

function VariantB(props: LabProps) {
	return (
		<View style={styles.dressingRoom}>
			<View style={styles.dressingHeader}>
				<Text style={styles.kicker}>VARIANT B · DRESSING ROOM</Text>
				<Text style={styles.title}>Rosie is the interface</Text>
			</View>
			<View style={styles.heroStage}>
				<View style={styles.crest}><Glyph name="premium" size={22} /></View>
				<RosiePreview {...props} bursts={props.bursts} size={290} />
				<Text style={styles.heroCaption}>Changes happen directly on Rosie.</Text>
			</View>
			<ScrollView style={styles.bottomTray} contentContainerStyle={styles.bottomTrayContent}>
				<Text style={styles.trayLabel}>DYE THE LAUREL CAP</Text>
				<PaletteControls {...props} />
				<GildToggle {...props} />
				<Text style={styles.trayLabel}>REACT</Text>
				<ReactionControls {...props} />
				<StateReadout {...props} />
			</ScrollView>
		</View>
	);
}

function VariantC(props: LabProps) {
	const [focus, setFocus] = useState<"dye" | "skin" | "react">("dye");
	return (
		<ScrollView contentContainerStyle={[styles.scrollContent, { backgroundColor: WHIMSY.cream2 }]}>
			<Text style={styles.kicker}>VARIANT C · CLUB WORKBENCH</Text>
			<Text style={styles.title}>A playful member laboratory</Text>
			<View style={styles.workbenchTabs}>
				{(["dye", "skin", "react"] as const).map((tab) => (
					<Pressable
						key={tab}
						onPress={() => setFocus(tab)}
						style={[styles.workbenchTab, focus === tab && styles.workbenchTabOn]}
					>
						<Text style={styles.workbenchTabText}>{tab}</Text>
					</Pressable>
				))}
			</View>
			<View style={styles.workbenchStage}>
				<RosiePreview {...props} bursts={props.bursts} size={230} />
				<View style={styles.workbenchNote}>
					<Text style={styles.workbenchNoteTitle}>TODAY'S EXPERIMENT</Text>
					<Text style={styles.workbenchNoteText}>
						{focus === "dye" && "Does recoloring an owned item create enough new identity?"}
						{focus === "skin" && "Does gold Rosie feel prestigious or merely tinted?"}
						{focus === "react" && "Are reactions more fun as toys than as a toolbar?"}
					</Text>
				</View>
			</View>
			<View style={styles.focusPanel}>
				{focus === "dye" && <><Text style={styles.focusTitle}>Mix a color</Text><PaletteControls {...props} /></>}
				{focus === "skin" && <><Text style={styles.focusTitle}>Polish Rosie</Text><GildToggle {...props} /></>}
				{focus === "react" && <><Text style={styles.focusTitle}>Push every button</Text><ReactionControls {...props} /></>}
			</View>
			<StateReadout {...props} />
		</ScrollView>
	);
}

const VARIANTS: { key: VariantKey; name: string }[] = [
	{ key: "A", name: "Perk Passport" },
	{ key: "B", name: "Dressing Room" },
	{ key: "C", name: "Club Workbench" },
];

function PrototypeSwitcher({ current }: { current: VariantKey }) {
	const index = VARIANTS.findIndex((item) => item.key === current);
	const move = (delta: number) => {
		const next = VARIANTS[(index + delta + VARIANTS.length) % VARIANTS.length];
		router.setParams({ variant: next.key });
	};
	return (
		<View style={styles.switcher}>
			<Pressable onPress={() => move(-1)} style={styles.switcherArrow}><Text style={styles.switcherArrowText}>‹</Text></Pressable>
			<Text style={styles.switcherLabel}>{current} · {VARIANTS[index].name}</Text>
			<Pressable onPress={() => move(1)} style={styles.switcherArrow}><Text style={styles.switcherArrowText}>›</Text></Pressable>
		</View>
	);
}

export default function MemberPerksPrototype() {
	const params = useLocalSearchParams<{ variant?: string }>();
	const variant: VariantKey = params.variant === "B" || params.variant === "C" ? params.variant : "A";
	const [paletteKey, setPaletteKey] = useState("natural");
	const [gilded, setGilded] = useState(false);
	const [lastReaction, setLastReaction] = useState("");
	const [reactionCount, setReactionCount] = useState(0);
	const [bursts, setBursts] = useState<Burst[]>([]);
	const nextBurst = useRef(0);

	const playReaction = (reaction: { glyph: GlyphName; label: string }) => {
		const id = nextBurst.current++;
		const anim = new Animated.Value(0);
		setLastReaction(reaction.label);
		setReactionCount((count) => count + 1);
		setBursts((current) => [...current, { id, glyph: reaction.glyph, anim }]);
		Animated.timing(anim, { toValue: 1, duration: 1250, useNativeDriver: true }).start(() => {
			setBursts((current) => current.filter((burst) => burst.id !== id));
		});
	};

	const labProps = useMemo<LabProps>(() => ({
		paletteKey,
		setPaletteKey,
		gilded,
		setGilded,
		lastReaction,
		reactionCount,
		playReaction,
		bursts,
	}), [paletteKey, gilded, lastReaction, reactionCount, bursts]);

	if (!__DEV__) return null;
	return (
		<SafeAreaView style={styles.root}>
			<Stack.Screen options={{ headerShown: false }} />
			<Pressable onPress={() => router.back()} style={styles.close} accessibilityLabel="Close perk lab">
				<Icon name="x" size={18} color={WHIMSY.ink} strokeWidth={2.5} />
			</Pressable>
			{variant === "A" && <VariantA {...labProps} />}
			{variant === "B" && <VariantB {...labProps} />}
			{variant === "C" && <VariantC {...labProps} />}
			<PrototypeSwitcher current={variant} />
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: WHIMSY.paper },
	scrollContent: { padding: PAGE_PAD, paddingTop: 56, paddingBottom: 120, gap: SPACE.md },
	kicker: { ...TYPE.kickerPill, color: WHIMSY.accent },
	title: { ...TYPE.pageTitle, color: WHIMSY.ink },
	lede: { ...TYPE.body, color: WHIMSY.mute, maxWidth: 340 },
	centered: { alignItems: "center" },
	preview: { alignItems: "center", justifyContent: "center", position: "relative" },
	stageScale: { width: 300, height: 300, position: "absolute" },
	burstLayer: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 50 },
	burst: { position: "absolute", top: "47%" },
	card: { backgroundColor: WHIMSY.paper, borderWidth: 2, borderColor: WHIMSY.ink, borderRadius: RADII.xl, padding: SPACE.lg, gap: SPACE.sm, ...SHADOW_SM },
	cardEyebrow: { ...TYPE.kickerPill, color: WHIMSY.accent },
	cardTitle: { ...TYPE.cardTitle, color: WHIMSY.ink },
	paletteRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm, paddingVertical: SPACE.xs },
	swatch: { width: 43, height: 43, borderRadius: 22, borderWidth: 2, borderColor: WHIMSY.ink, alignItems: "center", justifyContent: "center" },
	swatchNatural: { backgroundColor: WHIMSY.cream, borderStyle: "solid" },
	swatchSelected: { borderWidth: 4, transform: [{ scale: 1.08 }] },
	reactionRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
	reactionButton: { minWidth: 67, alignItems: "center", gap: 2, backgroundColor: WHIMSY.cream, borderWidth: 2, borderColor: WHIMSY.ink, borderRadius: RADII.lg, paddingVertical: SPACE.sm, paddingHorizontal: SPACE.sm },
	reactionLabel: { fontFamily: FONTS.bodyExtra, fontSize: 11, color: WHIMSY.ink },
	pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
	gildToggle: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, padding: SPACE.md, borderRadius: RADII.lg, backgroundColor: WHIMSY.cream, borderWidth: 2, borderColor: WHIMSY.ink },
	gildToggleOn: { backgroundColor: WHIMSY.slopBand },
	gildTitle: { ...TYPE.body, color: WHIMSY.ink },
	gildSub: { ...TYPE.bodySm, color: WHIMSY.mute },
	toggleTrack: { width: 46, height: 26, borderRadius: 13, padding: 3, backgroundColor: WHIMSY.muteSoft },
	toggleTrackOn: { backgroundColor: WHIMSY.slopGold },
	toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: WHIMSY.paper, borderWidth: 1, borderColor: WHIMSY.ink },
	toggleKnobOn: { transform: [{ translateX: 20 }] },
	stateReadout: { backgroundColor: WHIMSY.bark, borderRadius: RADII.lg, padding: SPACE.md, gap: 3 },
	stateTitle: { ...TYPE.kickerPill, color: WHIMSY.sun, marginBottom: SPACE.xs },
	stateText: { fontFamily: "SpaceMono-Regular", fontSize: 11, color: WHIMSY.barkText },
	dressingRoom: { flex: 1, backgroundColor: WHIMSY.slopBand, paddingTop: 56 },
	dressingHeader: { paddingHorizontal: PAGE_PAD, gap: SPACE.xs },
	heroStage: { flex: 1, minHeight: 310, alignItems: "center", justifyContent: "center" },
	crest: { position: "absolute", top: 8, right: 24, width: 46, height: 46, borderRadius: 23, backgroundColor: WHIMSY.slopGold, borderWidth: 2, borderColor: WHIMSY.ink, alignItems: "center", justifyContent: "center", transform: [{ rotate: "7deg" }] },
	heroCaption: { ...TYPE.hand, color: WHIMSY.mute, marginTop: -22 },
	bottomTray: { flexGrow: 0, maxHeight: "48%", backgroundColor: WHIMSY.paper, borderTopWidth: 3, borderColor: WHIMSY.ink, borderTopLeftRadius: RADII.xxl, borderTopRightRadius: RADII.xxl },
	bottomTrayContent: { padding: PAGE_PAD, paddingBottom: 120, gap: SPACE.md },
	trayLabel: { ...TYPE.kickerPill, color: WHIMSY.accent },
	workbenchTabs: { flexDirection: "row", gap: SPACE.sm },
	workbenchTab: { flex: 1, paddingVertical: SPACE.sm, borderRadius: RADII.pill, backgroundColor: WHIMSY.paper, borderWidth: 2, borderColor: WHIMSY.ink, alignItems: "center" },
	workbenchTabOn: { backgroundColor: WHIMSY.slopGold },
	workbenchTabText: { fontFamily: FONTS.bodyExtra, color: WHIMSY.ink, textTransform: "uppercase", fontSize: 11 },
	workbenchStage: { alignItems: "center", backgroundColor: WHIMSY.sage, borderWidth: 2, borderColor: WHIMSY.ink, borderRadius: RADII.xxl, padding: SPACE.md, overflow: "hidden" },
	workbenchNote: { width: "100%", backgroundColor: WHIMSY.paper, borderRadius: RADII.md, padding: SPACE.sm, transform: [{ rotate: "-1deg" }] },
	workbenchNoteTitle: { ...TYPE.kickerPill, color: WHIMSY.accent },
	workbenchNoteText: { ...TYPE.hand, color: WHIMSY.ink },
	focusPanel: { backgroundColor: WHIMSY.paper, borderWidth: 2, borderColor: WHIMSY.ink, borderRadius: RADII.xl, padding: SPACE.lg, gap: SPACE.md, ...SHADOW_SM },
	focusTitle: { ...TYPE.cardTitle, color: WHIMSY.ink },
	switcher: { position: "absolute", bottom: 24, alignSelf: "center", flexDirection: "row", alignItems: "center", backgroundColor: WHIMSY.bark, borderRadius: RADII.pill, borderWidth: 2, borderColor: WHIMSY.ink, padding: 4, ...SHADOW_SM },
	switcherArrow: { width: 40, height: 36, alignItems: "center", justifyContent: "center" },
	switcherArrowText: { fontFamily: FONTS.display, fontSize: 26, color: WHIMSY.sun, lineHeight: 28 },
	switcherLabel: { minWidth: 156, textAlign: "center", fontFamily: FONTS.bodyExtra, fontSize: 12, color: WHIMSY.paper },
	close: { position: "absolute", top: 54, right: 18, zIndex: 100, width: 40, height: 40, borderRadius: 20, backgroundColor: WHIMSY.paper, borderWidth: 2, borderColor: WHIMSY.ink, alignItems: "center", justifyContent: "center", ...SHADOW_SM },
});

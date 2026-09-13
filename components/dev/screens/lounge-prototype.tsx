// THROWAWAY PROTOTYPE — Multiplayer Lounge social ritual.
//
// Question: should Pig-close tickling emerge quietly from proximity, use an
// explicit friend tray, or grow into a room-wide ritual? Three structurally
// different answers share one in-memory state and are switchable with
// `?variant=A|B|C`. No Supabase, persistence, currency, or production route.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ImageBackground,
	Pressable,
	SafeAreaView,
	StyleSheet,
	Text,
	View,
	useWindowDimensions,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";

import { PrototypeSwitcher } from "@/components/prototypes/PrototypeSwitcher";
import { Glyph } from "@/components/ui/Glyph";
import { IconButton } from "@/components/ui/IconButton";
import { SpritePig } from "@/components/ui/SpritePig";
import {
	PAGE_PAD,
	RADII,
	SHADOW_SM,
	SPACE,
	STICKER_SHADOW,
	TYPE,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import type { PigAnimation } from "@/components/ui/pigRendererContract";
import type { PigId } from "@/utils/pigs";

type VariantKey = "A" | "B" | "C";
type RitualStage = "noticing" | "offered" | "connected" | "afterglow" | "pig-pile";

type RoomPig = {
	id: PigId;
	name: string;
	x: number;
	y: number;
	isMe?: boolean;
};

type ModeProps = {
	selectedId: PigId;
	selectedPig: RoomPig;
	ritual: RitualStage;
	reduceMotion: boolean;
	compactViewport: boolean;
	selectPig: (pigId: PigId) => void;
	offerTickle: () => void;
	inviteCircle: () => void;
	resetRitual: () => void;
};

const VARIANTS = [
	{ key: "A", name: "Quiet noticing" },
	{ key: "B", name: "Friend tray" },
	{ key: "C", name: "Barn warmth" },
] as const;

const ROOM_PIGS: RoomPig[] = [
	{ id: "rosie", name: "You", x: 44, y: 62, isMe: true },
	{ id: "pickles", name: "Pickles", x: 65, y: 54 },
	{ id: "copper", name: "Copper", x: 27, y: 45 },
	{ id: "pepper", name: "Pepper", x: 71, y: 31 },
	{ id: "biscuit", name: "Biscuit", x: 36, y: 27 },
];

const BACKGROUND = require("../../../assets/images/backgrounds/lounge_farm.png");

function ritualRank(stage: RitualStage) {
	return ["noticing", "offered", "connected", "afterglow", "pig-pile"].indexOf(stage);
}

function animationForPig(pig: RoomPig, selectedId: PigId, ritual: RitualStage): PigAnimation {
	if (ritual === "pig-pile") return "bounce";
	const isPair = pig.isMe || pig.id === selectedId;
	if (!isPair) return "idle";
	if (ritual === "offered") return pig.isMe ? "wave" : "surprise";
	if (ritual === "connected" || ritual === "afterglow") return "happy";
	return "idle";
}

function RoomPigActor({
	pig,
	selectedId,
	ritual,
	reduceMotion,
	onSelect,
	showAllNames,
}: {
	pig: RoomPig;
	selectedId: PigId;
	ritual: RitualStage;
	reduceMotion: boolean;
	onSelect: (pigId: PigId) => void;
	showAllNames: boolean;
}) {
	const selected = pig.id === selectedId;
	const paired = (pig.isMe || selected) && ritualRank(ritual) >= ritualRank("connected");
	const inPile = ritual === "pig-pile";

	return (
		<Pressable
			onPress={() => !pig.isMe && onSelect(pig.id)}
			disabled={pig.isMe}
			accessibilityRole={pig.isMe ? undefined : "button"}
			accessibilityLabel={pig.isMe ? "Your pig, Rosie" : `Notice ${pig.name}`}
			accessibilityState={{ selected: !pig.isMe && selected }}
			style={({ pressed }) => [
				styles.actor,
				{ left: `${pig.x}%`, top: `${pig.y}%` },
				pressed && styles.actorPressed,
			]}
		>
			{(paired || inPile) && (
				<View style={[styles.actorGlow, inPile && styles.actorGlowPile]} pointerEvents="none" />
			)}
			{selected && ritual === "noticing" && (
				<View style={styles.noticeGlyph} pointerEvents="none">
					<Glyph name="eyes" size={25} />
				</View>
			)}
			{(paired || inPile) && (
				<View style={styles.heartGlyph} pointerEvents="none">
					<Glyph name={inPile ? "sparkles" : "heart"} size={25} />
				</View>
			)}
			<SpritePig
				pigId={pig.id}
				animation={animationForPig(pig, selectedId, ritual)}
				size={96}
				frameIdx={reduceMotion ? 0 : undefined}
			/>
			{(showAllNames || selected || pig.isMe) && (
				<View style={[styles.nameTag, selected && !pig.isMe && styles.nameTagSelected]}>
					<Text style={styles.nameText}>{pig.name}</Text>
				</View>
			)}
		</Pressable>
	);
}

function WarmthMarks({ ritual }: { ritual: RitualStage }) {
	if (ritualRank(ritual) < ritualRank("afterglow")) return null;
	return (
		<View style={StyleSheet.absoluteFill} pointerEvents="none">
			<View style={[styles.warmthMark, styles.warmthOne]}><Glyph name="sparkle" size={24} /></View>
			<View style={[styles.warmthMark, styles.warmthTwo]}><Glyph name="heart" size={22} /></View>
			<View style={[styles.warmthMark, styles.warmthThree]}><Glyph name="sparkles" size={28} /></View>
			{ritual === "pig-pile" && (
				<>
					<View style={[styles.warmthMark, styles.warmthFour]}><Glyph name="party" size={31} /></View>
					<View style={[styles.warmthMark, styles.warmthFive]}><Glyph name="sun" size={29} /></View>
				</>
			)}
		</View>
	);
}

function WorldStage({
	selectedId,
	ritual,
	reduceMotion,
	selectPig,
	showAllNames = false,
	children,
}: Pick<ModeProps, "selectedId" | "ritual" | "reduceMotion" | "selectPig"> & {
	showAllNames?: boolean;
	children?: React.ReactNode;
}) {
	return (
		<ImageBackground source={BACKGROUND} resizeMode="cover" style={styles.world} imageStyle={styles.worldImage}>
			<View style={styles.worldWash} pointerEvents="none" />
			<WarmthMarks ritual={ritual} />
			{ROOM_PIGS.map((pig) => (
				<RoomPigActor
					key={pig.id}
					pig={pig}
					selectedId={selectedId}
					ritual={ritual}
					reduceMotion={reduceMotion}
					onSelect={selectPig}
					showAllNames={showAllNames}
				/>
			))}
			{children}
		</ImageBackground>
	);
}

function PrototypeState({
	ritual,
	selectedPig,
	lowered = false,
}: Pick<ModeProps, "ritual" | "selectedPig"> & { lowered?: boolean }) {
	return (
		<View style={[styles.prototypeState, lowered && styles.prototypeStateLowered]} pointerEvents="none">
			<Text style={styles.prototypeStateText}>state · {ritual}</Text>
			<Text style={styles.prototypeStateText}>pair · {selectedPig.name}</Text>
		</View>
	);
}

function RitualButton({
	ritual,
	selectedPig,
	offerTickle,
	inviteCircle,
	resetRitual,
	compact = false,
 	wide = false,
}: Pick<ModeProps, "ritual" | "selectedPig" | "offerTickle" | "inviteCircle" | "resetRitual"> & {
	compact?: boolean;
	wide?: boolean;
}) {
	if (ritual === "offered") {
		return (
			<View style={[styles.ritualButton, styles.ritualButtonWaiting, compact && styles.ritualButtonCompact, wide && styles.ritualButtonWide]}>
				<Glyph name="eyes" size={21} />
				<Text style={styles.ritualButtonText}>{selectedPig.name} is leaning in…</Text>
			</View>
		);
	}
	if (ritual === "connected" || ritual === "afterglow") {
		return (
			<Pressable
				onPress={inviteCircle}
				style={({ pressed }) => [
					styles.ritualButton,
					styles.ritualButtonWarm,
					compact && styles.ritualButtonCompact,
					wide && styles.ritualButtonWide,
					pressed && styles.buttonPressed,
				]}
				accessibilityRole="button"
				accessibilityLabel="Invite nearby pigs into a Pig Pile"
			>
				<Glyph name="friends" size={22} />
				<Text style={styles.ritualButtonText}>Invite the circle</Text>
			</Pressable>
		);
	}
	if (ritual === "pig-pile") {
		return (
			<Pressable
				onPress={resetRitual}
				style={({ pressed }) => [
					styles.ritualButton,
					styles.ritualButtonPile,
					compact && styles.ritualButtonCompact,
					wide && styles.ritualButtonWide,
					pressed && styles.buttonPressed,
				]}
				accessibilityRole="button"
				accessibilityLabel="Let the pigs settle"
			>
				<Glyph name="party" size={22} />
				<Text style={styles.ritualButtonText}>Let the pigs settle</Text>
			</Pressable>
		);
	}
	return (
		<Pressable
			onPress={offerTickle}
			style={({ pressed }) => [
				styles.ritualButton,
				compact && styles.ritualButtonCompact,
				wide && styles.ritualButtonWide,
				pressed && styles.buttonPressed,
			]}
			accessibilityRole="button"
			accessibilityLabel={`Offer ${selectedPig.name} a tickle hello`}
		>
			<Glyph name="handshake" size={22} />
			<Text style={styles.ritualButtonText}>Tickle hello</Text>
		</Pressable>
	);
}

function VariantA(props: ModeProps) {
	const connected = ritualRank(props.ritual) >= ritualRank("connected");
	return (
		<View style={styles.variantFill}>
			<WorldStage {...props}>
				<View style={styles.quietHeader}>
					<Glyph name="friends" size={20} />
					<Text style={styles.quietHeaderText}>Five pigs are nearby</Text>
				</View>
				<PrototypeState {...props} />
				<View style={[styles.quietPrompt, props.compactViewport && styles.quietPromptNarrow]}>
					<View style={styles.quietCopy}>
						<Text style={styles.quietTitle}>
							{props.ritual === "pig-pile"
								? "The whole farm answered."
								: connected
									? `${props.selectedPig.name} noticed you.`
									: `${props.selectedPig.name} turned your way.`}
						</Text>
						<Text style={styles.quietSub}>
							{props.ritual === "pig-pile"
								? "A small moment became everybody’s moment."
								: connected
									? "The flowers remember for a little while."
									: "No request box. Just a little opening."}
						</Text>
					</View>
					<RitualButton {...props} compact wide={props.compactViewport} />
				</View>
			</WorldStage>
		</View>
	);
}

function FriendChip({
	pig,
	selected,
	onPress,
}: {
	pig: RoomPig;
	selected: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			style={({ pressed }) => [
				styles.friendChip,
				selected && styles.friendChipSelected,
				pressed && styles.buttonPressed,
			]}
			accessibilityRole="button"
			accessibilityLabel={`Choose ${pig.name}`}
			accessibilityState={{ selected }}
		>
			<SpritePig pigId={pig.id} animation="idle" size={48} frameIdx={0} />
			<Text style={styles.friendChipText}>{pig.name}</Text>
		</Pressable>
	);
}

function VariantB(props: ModeProps) {
	const selectable = ROOM_PIGS.filter((pig) => !pig.isMe);
	return (
		<View style={styles.variantFill}>
			<View style={styles.trayHeader}>
				<Text style={styles.trayKicker}>The Close Tickle</Text>
				<Text style={styles.trayTitle}>Who caught your eye?</Text>
				<Text style={styles.trayIntro}>Pick a pig. The hello only happens when they answer.</Text>
			</View>
			<View style={styles.trayWorldWrap}>
				<WorldStage {...props} showAllNames>
					<PrototypeState {...props} />
				</WorldStage>
			</View>
			<View style={styles.friendTray}>
				<View style={styles.friendList}>
					{selectable.map((pig) => (
						<FriendChip
							key={pig.id}
							pig={pig}
							selected={pig.id === props.selectedId}
							onPress={() => props.selectPig(pig.id)}
						/>
					))}
				</View>
				<View style={[styles.friendTrayAction, props.compactViewport && styles.friendTrayActionNarrow]}>
					<View style={styles.friendTrayCopy}>
						<Text style={styles.friendTrayName}>{props.selectedPig.name}</Text>
						<Text style={styles.friendTrayStatus}>
							{props.ritual === "noticing"
								? "close enough to notice"
								: props.ritual === "offered"
									? "deciding in their own time"
									: props.ritual === "pig-pile"
										? "laughing with the whole room"
										: "sharing a warm little hello"}
						</Text>
					</View>
					<RitualButton {...props} compact wide={props.compactViewport} />
				</View>
			</View>
		</View>
	);
}

function VariantC(props: ModeProps) {
	const warmed = ritualRank(props.ritual) >= ritualRank("afterglow");
	return (
		<View style={styles.variantFill}>
			<WorldStage {...props} showAllNames>
				<View style={styles.warmBanner}>
					<View style={styles.warmBannerIcon}>
						<Glyph name={warmed ? "sun" : "sparkle"} size={28} />
					</View>
					<View style={styles.warmBannerCopy}>
						<Text style={styles.warmBannerTitle}>{warmed ? "The barn is waking up" : "The barn is listening"}</Text>
						<Text style={styles.warmBannerText}>
							{warmed ? "Friendliness leaves little signs behind." : "One warm hello can change the room."}
						</Text>
					</View>
				</View>
				<PrototypeState {...props} lowered />
				<View style={[styles.circleDock, props.compactViewport && styles.circleDockNarrow]}>
					<View style={styles.circleLead}>
						<View style={styles.circlePortraits} pointerEvents="none">
							{ROOM_PIGS.slice(0, 4).map((pig, index) => (
								<View key={pig.id} style={[styles.circlePortrait, { marginLeft: index === 0 ? 0 : -13 }]}>
									<SpritePig pigId={pig.id} animation="happy" size={43} frameIdx={0} />
								</View>
							))}
						</View>
						<View style={styles.circleCopy}>
							<Text style={styles.circleTitle}>{props.ritual === "pig-pile" ? "Pig Pile!" : "Start with one pig"}</Text>
							<Text style={styles.circleText}>
								{props.ritual === "pig-pile" ? "No score. No prize. Just everybody here." : "Then leave the door open for everybody."}
							</Text>
						</View>
					</View>
					<RitualButton {...props} compact wide={props.compactViewport} />
				</View>
			</WorldStage>
		</View>
	);
}

export default function LoungeMultiplayerPrototype() {
	const params = useLocalSearchParams<{ variant?: string; motion?: string }>();
	const { width, height } = useWindowDimensions();
	const variant: VariantKey = params.variant === "B" || params.variant === "C" ? params.variant : "A";
	const reduceMotion = params.motion === "reduced";
	const [selectedId, setSelectedId] = useState<PigId>("pickles");
	const [ritual, setRitual] = useState<RitualStage>("noticing");
	const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

	const selectedPig = useMemo(
		() => ROOM_PIGS.find((pig) => pig.id === selectedId) ?? ROOM_PIGS[1],
		[selectedId],
	);

	const clearTimers = useCallback(() => {
		timers.current.forEach(clearTimeout);
		timers.current = [];
	}, []);

	useEffect(() => clearTimers, [clearTimers]);

	const selectPig = useCallback((pigId: PigId) => {
		clearTimers();
		setSelectedId(pigId);
		setRitual("noticing");
	}, [clearTimers]);

	const offerTickle = useCallback(() => {
		clearTimers();
		setRitual("offered");
		timers.current.push(setTimeout(() => setRitual("connected"), reduceMotion ? 250 : 700));
		timers.current.push(setTimeout(() => setRitual("afterglow"), reduceMotion ? 600 : 1700));
	}, [clearTimers, reduceMotion]);

	const inviteCircle = useCallback(() => {
		clearTimers();
		setRitual("pig-pile");
	}, [clearTimers]);

	const resetRitual = useCallback(() => {
		clearTimers();
		setRitual("noticing");
	}, [clearTimers]);

	const changeVariant = useCallback((next: string) => {
		router.setParams({ variant: next });
	}, []);

	const props: ModeProps = {
		selectedId,
		selectedPig,
		ritual,
		reduceMotion,
		compactViewport: width < 430,
		selectPig,
		offerTickle,
		inviteCircle,
		resetRitual,
	};

	return (
		<SafeAreaView style={styles.screen}>
			<Stack.Screen options={{ headerShown: false }} />
			<View style={[styles.deviceFrame, { width: Math.min(width, 520), height }]}> 
				{variant === "A" && <VariantA {...props} />}
				{variant === "B" && <VariantB {...props} />}
				{variant === "C" && <VariantC {...props} />}
				<IconButton
					name="x"
					label="Leave the Lounge prototype"
					onPress={() => router.back()}
					style={styles.closeButton}
				/>
				<PrototypeSwitcher current={variant} variants={[...VARIANTS]} onChange={changeVariant} />
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		alignItems: "center",
		backgroundColor: WHIMSY.cream2,
	},
	deviceFrame: {
		maxWidth: 520,
		backgroundColor: UI_COLORS.canvas,
		overflow: "hidden",
	},
	variantFill: { flex: 1 },
	world: { flex: 1, overflow: "hidden" },
	worldImage: { opacity: 1 },
	worldWash: {
		...StyleSheet.absoluteFill,
		backgroundColor: WHIMSY.paper,
		opacity: 0.08,
	},
	actor: {
		position: "absolute",
		width: 108,
		height: 126,
		marginLeft: -54,
		marginTop: -63,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 3,
	},
	actorPressed: { transform: [{ scale: 0.96 }] },
	actorGlow: {
		position: "absolute",
		width: 83,
		height: 51,
		bottom: 13,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.rose,
		opacity: 0.82,
	},
	actorGlowPile: { backgroundColor: WHIMSY.sun },
	noticeGlyph: { position: "absolute", top: 4, right: 8, zIndex: 4 },
	heartGlyph: { position: "absolute", top: 4, alignSelf: "center", zIndex: 4 },
	nameTag: {
		position: "absolute",
		bottom: 0,
		minHeight: 26,
		justifyContent: "center",
		paddingHorizontal: SPACE.sm,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		...SHADOW_SM,
	},
	nameTagSelected: { backgroundColor: WHIMSY.sun },
	nameText: { ...TYPE.label, color: WHIMSY.ink },
	warmthMark: { position: "absolute", zIndex: 2 },
	warmthOne: { left: "18%", top: "41%" },
	warmthTwo: { right: "13%", top: "47%" },
	warmthThree: { left: "49%", top: "28%" },
	warmthFour: { right: "24%", top: "66%" },
	warmthFive: { left: "16%", top: "72%" },
	prototypeState: {
		position: "absolute",
		top: 69,
		left: PAGE_PAD,
		paddingVertical: SPACE.xs,
		paddingHorizontal: SPACE.sm,
		borderRadius: RADII.sm,
		backgroundColor: WHIMSY.bark,
		opacity: 0.92,
		zIndex: 8,
	},
	prototypeStateLowered: { top: 98 },
	prototypeStateText: { ...TYPE.kickerPillSm, color: WHIMSY.barkText },
	quietHeader: {
		position: "absolute",
		top: SPACE.md,
		left: PAGE_PAD,
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		minHeight: 44,
		paddingHorizontal: SPACE.md,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		...SHADOW_SM,
		zIndex: 7,
	},
	quietHeaderText: { ...TYPE.bodySm, color: WHIMSY.ink },
	quietPrompt: {
		position: "absolute",
		left: PAGE_PAD,
		right: PAGE_PAD,
		bottom: 86,
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		padding: SPACE.md,
		borderRadius: RADII.lg,
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		...STICKER_SHADOW,
		zIndex: 9,
	},
	quietPromptNarrow: { flexDirection: "column", alignItems: "stretch" },
	quietCopy: { flex: 1, minWidth: 0 },
	quietTitle: { ...TYPE.cardTitleSm, color: WHIMSY.ink },
	quietSub: { ...TYPE.bodySm, color: WHIMSY.mute, marginTop: 2 },
	ritualButton: {
		minHeight: 48,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.sm,
		paddingHorizontal: SPACE.lg,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.roseDeep,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		...SHADOW_SM,
	},
	ritualButtonCompact: { minWidth: 136, paddingHorizontal: SPACE.md },
	ritualButtonWide: { width: "100%" },
	ritualButtonWaiting: { backgroundColor: WHIMSY.cream2 },
	ritualButtonWarm: { backgroundColor: WHIMSY.sun },
	ritualButtonPile: { backgroundColor: WHIMSY.sage },
	ritualButtonText: { ...TYPE.bodySm, color: WHIMSY.ink, textAlign: "center" },
	buttonPressed: { transform: [{ translateX: 1 }, { translateY: 1 }], opacity: 0.9 },
	trayHeader: {
		paddingTop: SPACE.lg,
		paddingHorizontal: PAGE_PAD,
		paddingBottom: SPACE.md,
		backgroundColor: WHIMSY.paper,
		borderBottomWidth: 2,
		borderBottomColor: WHIMSY.ink,
		zIndex: 7,
	},
	trayKicker: { ...TYPE.kicker, color: WHIMSY.accent },
	trayTitle: { ...TYPE.pageTitle, color: WHIMSY.ink, marginTop: 2 },
	trayIntro: { ...TYPE.bodySm, color: WHIMSY.mute, marginTop: SPACE.xs, maxWidth: 360 },
	trayWorldWrap: { flex: 1, minHeight: 260 },
	friendTray: {
		paddingTop: SPACE.md,
		paddingHorizontal: PAGE_PAD,
		paddingBottom: 82,
		backgroundColor: WHIMSY.cream,
		borderTopWidth: 2,
		borderTopColor: WHIMSY.ink,
	},
	friendList: { flexDirection: "row", gap: SPACE.sm },
	friendChip: {
		flex: 1,
		minWidth: 0,
		minHeight: 76,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: RADII.md,
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
	},
	friendChipSelected: { backgroundColor: WHIMSY.sun, ...SHADOW_SM },
	friendChipText: { ...TYPE.kickerPillSm, color: WHIMSY.ink, maxWidth: "100%" },
	friendTrayAction: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		marginTop: SPACE.md,
	},
	friendTrayActionNarrow: { flexDirection: "column", alignItems: "stretch" },
	friendTrayCopy: { flex: 1 },
	friendTrayName: { ...TYPE.cardTitle, color: WHIMSY.ink },
	friendTrayStatus: { ...TYPE.bodySm, color: WHIMSY.mute },
	warmBanner: {
		position: "absolute",
		top: SPACE.md,
		left: PAGE_PAD,
		right: 70,
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		padding: SPACE.md,
		borderRadius: RADII.lg,
		backgroundColor: WHIMSY.bark,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		...STICKER_SHADOW,
		zIndex: 7,
	},
	warmBannerIcon: {
		width: 44,
		height: 44,
		borderRadius: RADII.pill,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: WHIMSY.sun,
	},
	warmBannerCopy: { flex: 1 },
	warmBannerTitle: { ...TYPE.cardTitleSm, color: WHIMSY.barkText },
	warmBannerText: { ...TYPE.bodySm, color: WHIMSY.barkMute, marginTop: 2 },
	circleDock: {
		position: "absolute",
		left: PAGE_PAD,
		right: PAGE_PAD,
		bottom: 84,
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		padding: SPACE.md,
		borderRadius: RADII.lg,
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		...STICKER_SHADOW,
		zIndex: 9,
	},
	circleDockNarrow: { flexDirection: "column", alignItems: "stretch" },
	circleLead: { flex: 1, flexDirection: "row", alignItems: "center", gap: SPACE.md },
	circlePortraits: { flexDirection: "row", alignItems: "center" },
	circlePortrait: {
		width: 42,
		height: 42,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
	},
	circleCopy: { flex: 1, minWidth: 0 },
	circleTitle: { ...TYPE.cardTitleSm, color: WHIMSY.ink },
	circleText: { ...TYPE.bodySm, color: WHIMSY.ink, marginTop: 2 },
	closeButton: { position: "absolute", top: SPACE.md, right: SPACE.md, zIndex: 20 },
});

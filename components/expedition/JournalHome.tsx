import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import {
	PAGE_PAD,
	RADII,
	SPACE,
	SHADOW_SM,
	STICKER_SHADOW,
	TAB_SAFE,
	TYPE,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Sticker } from "@/components/ui/Sticker";
import {
	CARDS,
	ENEMIES,
	ZOOMIES_MAX,
	nextObstacle,
	predictFight,
	type ExpeditionState,
	type Verdict,
} from "@/utils/expedition";
import { RosieCharged } from "./RosiePose";
import { RoadMap } from "./RoadMap";
import { GearRack } from "./GearRack";
import { CardHand } from "./CardHand";
import { ZoomiesMeter } from "./ZoomiesMeter";
import { CeremonyCard } from "./Ceremony";

const VERDICT_COLOR: Record<Verdict, string> = {
	wins: WHIMSY.sage,
	close: WHIMSY.sun,
	stuck: WHIMSY.rose,
};

// The journal — the home surface. Road map, the satchel summary, the send-off
// decision (gear + a tucked Trick + a send-off tickle), and the ±20% prediction
// docked right beside the choice so the loadout and its grade share one glance.
export function JournalHome({
	state,
	dateKey,
	onEquip,
	onTuck,
	onTickle,
	onOpenFight,
	onOpenTraining,
	onOpenBestiary,
}: {
	state: ExpeditionState;
	dateKey: string;
	onEquip: (gearId: string) => void;
	onTuck: (cardId: string) => void;
	onTickle: (opts?: { quiet?: boolean }) => void;
	onOpenFight: () => void;
	onOpenTraining: () => void;
	onOpenBestiary: () => void;
}) {
	const prediction = predictFight(state);
	const obstacle = nextObstacle(state);
	const atWall = !!state.wallEnemyId;
	const wallEnemy = state.wallEnemyId ? ENEMIES[state.wallEnemyId] : null;
	const tucked = state.tuckedCardId ? CARDS[state.tuckedCardId] : null;

	// CTA honesty (Fix 1): a tickle the kernel would refuse renders as a resting
	// (locked) button with a warm sub-line — never a silent no-op. The jar refills
	// with real time (Fix 3), so the empty state points at the refill honestly.
	const jarEmpty = state.mockTickles <= 0;
	// Open-road: already brimming with Zoomies, no wall to burst against.
	const fullOpenRoad = state.zoomies >= ZOOMIES_MAX;
	// At a wall: a quiet journal tickle caps at ZOOMIES_MAX - 1 so the burst only
	// ever happens in the fight view where it can be seen (Fix 1c).
	const quietMaxed = state.zoomies >= ZOOMIES_MAX - 1;
	const sendoffLocked = jarEmpty || fullOpenRoad;
	const quietLocked = jarEmpty || quietMaxed;

	const obstacleAsk =
		obstacle?.kind === "wall"
			? `${obstacle.enemy.name} · ${obstacle.hp} hp · ${obstacle.enemy.behaviorLine}`
			: obstacle?.kind === "cushion"
				? `The Bramble · Cushion ${obstacle.ask} to pass`
				: "The road runs clear ahead.";

	return (
		<ScrollView
			style={styles.root}
			contentContainerStyle={styles.content}
			showsVerticalScrollIndicator={false}
		>
			<PageHeader
				kicker="chapter one · the insolent goose"
				title="Rosie's Ramble"
				below={
					<Text style={styles.tickleBank}>
						{state.mockTickles} tickles in the jar
					</Text>
				}
			/>

			{state.chapterCleared && (
				<CeremonyCard color="sun" style={styles.clearCard}>
					<Text style={styles.clearTitle}>Chapter one, cleared!</Text>
					<Text style={styles.clearBody}>
						The Tollbooth Goose stepped aside. The road rests here until the next
						chapter's art is ready.
					</Text>
				</CeremonyCard>
			)}

			<Sticker color="sky" rotate={-0.5} radius={RADII.xl} style={styles.hero}>
				<RosieCharged zoomies={state.zoomies} max={ZOOMIES_MAX} size={150} />
			</Sticker>

			<RoadMap state={state} />

			{/* Satchel summary — persistent, so the tucked Trick is legible even on a
			    day its card isn't in the hand. (Task 5b.) */}
			<View style={styles.satchel}>
				<Text style={styles.satchelKicker}>★ in the satchel</Text>
				<Text style={styles.satchelText}>
					{tucked
						? `${tucked.name} — ${tucked.ability.flavorLine}`
						: "Draw three, tuck one for the road — its charm rides along, then comes home."}
				</Text>
			</View>

			<GearRack state={state} onEquip={onEquip} />

			<CardHand state={state} dateKey={dateKey} onTuck={onTuck} />

			{/* The legibility law — the prediction docked to the loadout, on a real
			    Sticker with a hand-drawn tilt: the most important sentence in the loop
			    wears the house style. (Tasks 4b + 4c + Fix 6b.) */}
			<Sticker
				color={VERDICT_COLOR[prediction.verdict]}
				rotate={-0.8}
				radius={RADII.md}
				style={styles.predict}
			>
				<Text style={styles.predictKicker}>★ the road ahead</Text>
				<Text style={styles.predictWhy}>{prediction.why}</Text>
				<Text style={styles.predictAsk}>{obstacleAsk}</Text>
			</Sticker>

			{/* Send-off — ONE primary at a time: at a wall the fight is the single
			    gold CTA and the tickle demotes to a quiet inline action; on the open
			    road the send-off tickle is itself the primary. A tickle the kernel
			    would refuse renders as a resting (locked) button, never a silent
			    no-op. (Task 5a + Fix 1b/1c.) */}
			<Sticker color="paper" rotate={-0.4} radius={RADII.xl} style={styles.sendoff}>
				<SectionHeader kicker="send-off" title="Give Rosie a tickle" />
				<ZoomiesMeter value={state.zoomies} />
				{atWall && wallEnemy ? (
					<>
						<Button variant="gold" full onPress={onOpenFight}>
							Help Rosie through the {wallEnemy.name}
						</Button>
						<Button
							variant={quietLocked ? "locked" : "ghost"}
							full
							disabled={quietLocked}
							onPress={() => onTickle({ quiet: true })}
						>
							{jarEmpty
								? "The jar's empty for now"
								: quietMaxed
									? "She's bursting to go — join the scuffle"
									: "Give her a quiet tickle first"}
						</Button>
					</>
				) : (
					<Button
						variant={sendoffLocked ? "locked" : "gold"}
						full
						disabled={sendoffLocked}
						onPress={() => onTickle()}
					>
						{jarEmpty
							? "The tickle jar is empty"
							: fullOpenRoad
								? "She's already bursting with Zoomies"
								: "Send-off tickle"}
					</Button>
				)}
				<Text style={styles.sendoffHint}>
					{jarEmpty
						? "The jar refills a little with time — one tickle every few minutes."
						: fullOpenRoad
							? "Zoomies at the brim — she'll carry them to the next wall."
							: "Affection helps; absence never hurts."}
				</Text>
			</Sticker>

			<View style={styles.shelfRow}>
				<Button variant="ghost" onPress={onOpenBestiary} style={styles.shelfBtn}>
					Bestiary
				</Button>
				<Button variant="ghost" onPress={onOpenTraining} style={styles.shelfBtn}>
					Training
				</Button>
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1 },
	content: { paddingHorizontal: PAGE_PAD, paddingBottom: TAB_SAFE, gap: SPACE.md },
	tickleBank: { ...TYPE.hand, color: UI_COLORS.action },
	clearCard: { padding: SPACE.md },
	clearTitle: { ...TYPE.sectionTitle, color: UI_COLORS.textPrimary },
	clearBody: { ...TYPE.hand, color: UI_COLORS.textPrimary, marginTop: SPACE.xs },
	hero: {
		alignItems: "center",
		paddingVertical: SPACE.md,
		...STICKER_SHADOW,
	},
	satchel: {
		borderWidth: 2,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.md,
		backgroundColor: WHIMSY.cream,
		padding: SPACE.md,
		gap: SPACE.xs,
		...SHADOW_SM,
	},
	satchelKicker: { ...TYPE.kickerPillSm, color: UI_COLORS.action },
	satchelText: { ...TYPE.hand, color: UI_COLORS.textPrimary },
	// Border + shadow now come from the Sticker primitive (Fix 6b); only the inner
	// padding/gap live here.
	predict: {
		padding: SPACE.md,
		gap: SPACE.xs,
	},
	predictKicker: { ...TYPE.kickerPillSm, color: UI_COLORS.textPrimary },
	predictWhy: {
		...TYPE.handLg,
		color: UI_COLORS.textPrimary,
	},
	predictAsk: {
		...TYPE.bodySm,
		color: UI_COLORS.textPrimary,
	},
	sendoff: { padding: SPACE.lg, gap: SPACE.md, ...STICKER_SHADOW },
	sendoffHint: { ...TYPE.bodySm, color: UI_COLORS.textSecondary },
	shelfRow: { flexDirection: "row", gap: SPACE.sm },
	shelfBtn: { flex: 1 },
});

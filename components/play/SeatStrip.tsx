// The seat strip: who is at the table, above the board.
//
// "pigs" (the default): every seat's pig on one ground line, YOU first and
// the rest in turn order after you, so the table reads left to right from
// your chair. A pair faces each other (the visit's turn, PigStage `facing`);
// a table of three or four turns in toward its middle. Under each pig its
// name tag (sun for the pig whose move it is, which also steps up) and one
// line: the game's own status (GameUI.seatStatus), or presence. A pig whose
// socket dropped at a live table naps ("away", the tired sprite: a feeling
// shown, never stated); a pig who left for good has trotted off and leaves
// an empty spot. An open chair at a play-by-post table is a dashed spot
// waiting for its pig. A game's bubble (GameUI.seatBubble) floats over the
// pig it belongs to, and an emote pops over the pig that sent it.
//
// "compact": portrait chips only, for boards that stage the pigs themselves
// (Mud Volley's pasture, Out Looking's map), with the same name, status,
// presence and turn highlight. Two chips sit side by side as rows; three or
// four stand as little cards so a name never squeezes to nothing.

import { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { Glyph, Hand, PigAvatar, Sticker, Tag, type PigStageProps } from "@/components/ui";
import { ART_SIZE, BORDER, CHROME_TYPE_CAP, MOTION_SPRING, OPACITY, RADII, SPACE, TINT, UI_COLORS, WHIMSY } from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import type { EmoteMark } from "@/hooks/useMultiplayer";
import type { RoomSnapshot, SeatInfo } from "@/multiplayer/protocol";
import type { Seat } from "@/multiplayer/types";
import { pigStagePropsForLook } from "@/utils/multiplayer/looks";
import { EmotePop } from "./EmotePop";
import { TablePig, type TablePigProps } from "./TablePig";
import type { GameUI } from "./types";
import type { SeatReactions } from "./useTableCues";
import { BUBBLE_FOOT, BUBBLE_SKY, CHIP_PORTRAIT, EMOTE_POP, STEP_UP, STRIP_PIG_MAX, STRIP_PIG_MIN } from "./layout";
import { MATCH_COPY } from "./playCopy";

type Facing = PigStageProps["facing"];

// Drawing geometry: the breathing room each column keeps beside its pig, how
// far the ground band tucks up under the hooves, and the open chair's disc.
const COLUMN_GUTTER = 8;
const GROUND_TUCK = 8;
const OPEN_DISC_FRAC = 0.6;

export interface SeatStripProps {
	room: RoomSnapshot;
	/** The game's UI (seatStatus, seatBubble). */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	ui: GameUI<any>;
	mode: "pigs" | "compact";
	/** Width the strip may use, page padding already removed. */
	width: number;
	pigs: SeatReactions;
	emotes: Readonly<Record<number, EmoteMark>>;
	/** The table's clock, for the emote dwell. */
	now: () => number;
	/** False for the first beat of the countdown: the pigs face the camera,
	 *  then turn to face each other. */
	turned: boolean;
	practice: boolean;
}

/** The seats in strip order: yours first, then the rest in turn order. Open
 *  chairs (a play-by-post table still waiting for its pig) included. */
export function stripOrder(room: Pick<RoomSnapshot, "seatCount" | "you">): Seat[] {
	const count = Math.max(1, room.seatCount);
	const start = room.you !== null && room.you < count ? room.you : 0;
	return Array.from({ length: count }, (_, i) => (start + i) % count);
}

/** Which way the pig in column `i` of `n` turns: in toward the middle. */
export function facingFor(i: number, n: number): Facing {
	if (n < 2) return undefined;
	const mid = (n - 1) / 2;
	if (i < mid) return "right";
	if (i > mid) return "left";
	return undefined;
}

export function SeatStrip(props: SeatStripProps) {
	return props.mode === "compact" ? <CompactStrip {...props} /> : <PigStrip {...props} />;
}

interface SeatLook {
	seat: Seat;
	info: SeatInfo | null;
	you: boolean;
	active: boolean;
	label: string;
	status: string | null;
	away: boolean;
	gone: boolean;
	bot: boolean;
}

function seatLooks({ room, ui, practice }: SeatStripProps): SeatLook[] {
	const view = room.view;
	const playing = room.phase === "playing";
	return stripOrder(room).map((seat) => {
		const info = room.seats.find((s) => s.seat === seat) ?? null;
		const you = room.you === seat;
		const gone = !!info?.gone;
		// Presence only means something at a live table (a play-by-post pig
		// is "not connected" nearly all the time), and only for the others:
		// your own dropped socket is the connection banner's to say.
		const away = !!info && !gone && !you && room.pace === "live" && !info.connected;
		let status: string | null = null;
		if (info && !gone && view !== null && ui.seatStatus) {
			try {
				status = ui.seatStatus(view, seat, room);
			} catch {
				status = null;
			}
		}
		const bot = practice && !!info && !you;
		return {
			seat,
			info,
			you,
			active: playing && !gone && !!info && room.activeSeats.includes(seat),
			label: info ? (you ? MATCH_COPY.you : info.name) : MATCH_COPY.openChair,
			status: gone ? MATCH_COPY.trottedOff : away ? MATCH_COPY.away : (status ?? (bot ? MATCH_COPY.practicePig : null)),
			away,
			gone,
			bot,
		};
	});
}

function spokenSeat(look: SeatLook): string {
	const parts = [look.bot ? `${look.label}, ${MATCH_COPY.practicePig}` : look.label];
	if (look.active) parts.push(look.you ? MATCH_COPY.yourMove : MATCH_COPY.theirMoveSpoken);
	if (look.status && look.status !== MATCH_COPY.practicePig) parts.push(look.status);
	return parts.join(", ");
}

function tagTone(look: SeatLook): "sun" | "muted" | "lilac" | "paper" {
	if (look.active) return "sun";
	if (look.gone || !look.info) return "muted";
	return look.bot ? "lilac" : "paper";
}

// ── "pigs" ───────────────────────────────────────────────────────────────────

function PigStrip(props: SeatStripProps) {
	const { room, ui, width, pigs, emotes, now, turned } = props;
	const looks = seatLooks(props);
	const n = looks.length;
	const column = Math.floor(width / Math.max(1, n));
	const box = Math.max(STRIP_PIG_MIN, Math.min(STRIP_PIG_MAX, column - COLUMN_GUTTER));
	const Bubble = ui.seatBubble;
	const sky = Bubble ? BUBBLE_SKY : 0;
	return (
		<View style={styles.pigStrip} testID="seat-strip">
			<View pointerEvents="none" style={[styles.ground, { top: sky + box - GROUND_TUCK }]} />
			{looks.map((look, i) => {
				const seated = !!look.info && !look.gone;
				return (
					<View key={look.seat} style={[styles.pigColumn, { width: column, paddingTop: sky }]} testID={`seat-${look.seat}`}>
						<View style={{ width: box, height: box }}>
							{seated && look.info ? (
								<SteppingPig
									active={look.active}
									look={look.info.look}
									size={box}
									facing={turned ? facingFor(i, n) : undefined}
									mood={pigs.moodOf(look.seat) ?? (look.away ? "tired" : "content")}
									reaction={pigs.reactionOf(look.seat)}
									onReactionDone={() => pigs.done(look.seat)}
									testID={`seat-pig-${look.seat}`}
								/>
							) : (
								<EmptySpot size={box} open={!look.info} />
							)}
							{seated ? <EmotePop mark={emotes[look.seat]} now={now} who={look.label} style={styles.popOverPig} testID={`seat-emote-${look.seat}`} /> : null}
						</View>
						{Bubble && room.view !== null && seated ? (
							// Anchored by its foot on the crown of the pig's head; a tall
							// bubble grows up into the sky band.
							<View pointerEvents="box-none" style={[styles.bubbleSlot, { height: sky + box * BUBBLE_FOOT }]}>
								<Bubble view={room.view} seat={look.seat} room={room} />
							</View>
						) : null}
						<Tag
							flat
							label={look.label}
							tone={tagTone(look)}
							accessibilityLabel={spokenSeat(look)}
							maxFontSizeMultiplier={CHROME_TYPE_CAP}
							style={styles.nameTag}
							testID={`seat-tag-${look.seat}`}
						/>
						{look.status ? (
							<Hand
								tone="secondary"
								align="center"
								numberOfLines={2}
								maxFontSizeMultiplier={CHROME_TYPE_CAP}
								accessibilityElementsHidden
								importantForAccessibility="no-hide-descendants"
								style={styles.status}
								testID={`seat-status-${look.seat}`}
							>
								{look.status}
							</Hand>
						) : null}
					</View>
				);
			})}
		</View>
	);
}

/** The pig whose move it is steps up (a spring); under Reduce Motion the sun
 *  tag carries the turn on its own. */
function SteppingPig({ active, ...pig }: { active: boolean } & TablePigProps) {
	const { reduceMotion } = useMotionPolicy();
	const [lift] = useState(() => new Animated.Value(active && !reduceMotion ? 1 : 0));
	useEffect(() => {
		if (reduceMotion) {
			lift.setValue(0);
			return;
		}
		const run = Animated.spring(lift, { toValue: active ? 1 : 0, useNativeDriver: true, ...MOTION_SPRING.tap });
		run.start();
		return () => run.stop();
	}, [active, reduceMotion, lift]);
	return (
		<Animated.View style={{ transform: [{ translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -STEP_UP] }) }] }}>
			<TablePig {...pig} frozen={reduceMotion} />
		</Animated.View>
	);
}

function EmptySpot({ size, open }: { size: number; open: boolean }) {
	const disc = size * OPEN_DISC_FRAC;
	return (
		<View style={[styles.emptySpot, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
			{open ? (
				<Sticker color="cream" radius={RADII.pill} borderStyle="dashed" shadow="none" rotate={0} style={[styles.openDisc, { width: disc, height: disc }]}>
					<Glyph name="pigface" size={ART_SIZE.glyphSm} style={styles.ghost} />
				</Sticker>
			) : null}
			<View style={[styles.spotShadow, { width: size / 2 }]} />
		</View>
	);
}

// ── "compact" ────────────────────────────────────────────────────────────────

function CompactStrip(props: SeatStripProps) {
	const { room, ui, emotes, now } = props;
	const looks = seatLooks(props);
	const stacked = looks.length > 2;
	const Bubble = ui.seatBubble;
	return (
		<View style={styles.chipRow} testID="seat-strip">
			{looks.map((look) => {
				const seated = !!look.info && !look.gone;
				return (
					<Sticker
						key={look.seat}
						color={look.active ? "sun" : look.gone || !look.info ? UI_COLORS.surfaceStrong : look.bot ? "lilac" : "paper"}
						border={look.active ? BORDER.heavy : BORDER.ink}
						borderStyle={look.info ? "solid" : "dashed"}
						radius={RADII.md}
						shadow={look.info ? "sm" : "none"}
						rotate={0}
						accessibilityRole="text"
						accessibilityLabel={spokenSeat(look)}
						style={[styles.chip, stacked ? styles.chipStacked : styles.chipSide]}
						testID={`seat-${look.seat}`}
					>
						<View>
							{seated && look.info ? (
								<PigAvatar
									size={CHIP_PORTRAIT}
									pigId={pigStagePropsForLook(look.info.look).pigId}
									hatId={look.info.look.hat}
									bowId={look.info.look.bow}
									mode="worn"
									style={look.away ? styles.napping : undefined}
								/>
							) : (
								<View style={styles.chipEmpty}>
									<Glyph name="pigface" size={ART_SIZE.glyphSm} style={styles.ghost} />
								</View>
							)}
							{seated ? <EmotePop mark={emotes[look.seat]} now={now} who={look.label} style={styles.popOverChip} testID={`seat-emote-${look.seat}`} /> : null}
						</View>
						<View style={[styles.chipText, stacked ? styles.chipTextStacked : null]}>
							<Tag
								flat
								label={look.label}
								tone={look.active ? "sun" : "paper"}
								maxFontSizeMultiplier={CHROME_TYPE_CAP}
								style={styles.chipTag}
								testID={`seat-tag-${look.seat}`}
							/>
							{look.status ? (
								<Hand
									tone="secondary"
									align={stacked ? "center" : undefined}
									numberOfLines={stacked ? 2 : 1}
									maxFontSizeMultiplier={CHROME_TYPE_CAP}
									testID={`seat-status-${look.seat}`}
								>
									{look.status}
								</Hand>
							) : null}
						</View>
						{Bubble && room.view !== null && seated ? (
							<View pointerEvents="box-none" style={styles.chipBubble}>
								<Bubble view={room.view} seat={look.seat} room={room} />
							</View>
						) : null}
					</Sticker>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	pigStrip: { flexDirection: "row", justifyContent: "center", alignItems: "flex-start" },
	// The ground the pigs stand on: one soft band under every hoof.
	ground: {
		position: "absolute",
		left: 0,
		right: 0,
		height: SPACE.md,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.cream2,
	},
	pigColumn: { alignItems: "center" },
	popOverPig: { top: 0, right: 0 },
	bubbleSlot: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center", justifyContent: "flex-end" },
	nameTag: { marginTop: SPACE.xs, maxWidth: "100%" },
	status: { marginTop: SPACE.xxs },
	emptySpot: { alignItems: "center", justifyContent: "flex-end" },
	openDisc: { alignItems: "center", justifyContent: "center", marginBottom: SPACE.sm },
	ghost: { opacity: OPACITY.ghost },
	spotShadow: { height: SPACE.sm, borderRadius: RADII.pill, backgroundColor: TINT.inkWash },
	chipRow: { flexDirection: "row", gap: SPACE.sm },
	chip: { flex: 1, minWidth: 0, gap: SPACE.xs, paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xs },
	chipSide: { flexDirection: "row", alignItems: "center" },
	chipStacked: { alignItems: "center" },
	chipText: { flex: 1, minWidth: 0, gap: SPACE.xxs, alignItems: "flex-start" },
	chipTextStacked: { alignItems: "center", alignSelf: "stretch" },
	chipTag: { maxWidth: "100%" },
	chipEmpty: {
		width: CHIP_PORTRAIT,
		height: CHIP_PORTRAIT,
		borderRadius: RADII.pill,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: WHIMSY.cream,
	},
	napping: { opacity: OPACITY.muted },
	popOverChip: { top: -SPACE.md, right: -SPACE.md, width: EMOTE_POP, height: EMOTE_POP },
	chipBubble: { position: "absolute", left: 0, right: 0, bottom: "100%", alignItems: "center" },
});

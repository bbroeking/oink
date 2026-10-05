// Out Looking's board. A pure function of the seat's view: the places around
// the yard, my pig, the others waiting (a check once they have chosen, never
// where), and in the thumb zone the place chips and one gold button that says
// exactly what it will do. Choosing is local; sending is `act`. When a day
// resolves, the reveal plays from the last day in the view's history (the
// `revealed` cue only says "now"), so a dropped event never loses the scene.
//
// It fits the height the match screen gives it (GameUI.fillsHeight; the plan
// is ./layout.ts): the thumb zone is pinned at the foot at one height through
// every state, and the day signpost and the yard take what is left, the yard
// scaling down (and the chips, then the signpost's sticker, giving way) on a
// short phone. Before the match screen has measured, the board draws at its
// natural size.

import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, ScrollView, StyleSheet, View } from "react-native";
import { Button, Chip, Hand, HandLg, Sticker, T } from "@/components/ui";
import { BORDER, LIST_BLEED, RADII, SPACE, TILT } from "@/constants/theme";
import type { OlView } from "@/multiplayer/games/out_looking/rules";
import { pigStagePropsForLook } from "@/utils/multiplayer/looks";
import { pigDefinition } from "@/utils/pigs";
import { useTextScale } from "../fit";
import type { BoardProps } from "../../types";
import { CONTROLS_GAP, FOOT, TOP_AIR, controlsCopy, lookingFit } from "./layout";
import {
	BEAT_AT,
	CONTROLS_COPY,
	FIELD_PAD,
	PLACE_NAME,
	cameHomeLine,
	dayLabel,
	firstUnwatched,
	flightsFor,
	geometry,
	heapsAt,
	heartsFor,
	muddyAt,
	outcomeLines,
	sendLabel,
	stagePigs,
	type Beat,
} from "./model";
import { Scene } from "./Scene";

/** The thumb zone keeps one height through every state, so the yard above it
 *  never jumps when a pig is sent or a day is revealed. (Fitted to a height,
 *  the plan sets it from the table's own words instead.) */
const CONTROLS_H = 132;
const TYPE_CAP = 1.3;

export function OutLookingBoard({ view, room, you, yourTurn, act, pending, events, reduceMotion, width, height }: BoardProps<OlView>) {
	const seatInfo = useMemo(() => new Map(room.seats.map((s) => [s.seat, s])), [room.seats]);
	const seated = useMemo(() => room.seats.map((s) => s.seat).filter((s) => s < view.seats), [room.seats, view.seats]);
	const looks = useMemo(
		() => Object.fromEntries(seated.map((s) => [s, pigStagePropsForLook(seatInfo.get(s)?.look)])),
		[seated, seatInfo],
	);
	const gone = useMemo(() => Array.from({ length: view.seats }, (_, s) => !!seatInfo.get(s)?.gone), [view.seats, seatInfo]);
	const pigName = pigDefinition(looks[you]?.pigId).name;
	const nameOf = (seat: number) => seatInfo.get(seat)?.name ?? "a pig";
	const placeIds = view.places.map((p) => p.id);

	// The board's plan: the table's words set the thumb zone, the rest is the
	// yard's. Null until the match screen has measured the board.
	const scale = useTextScale();
	const fit =
		height === undefined
			? null
			: lookingFit({
					width,
					height,
					scale,
					copy: controlsCopy({
						pigName,
						places: placeIds,
						others: seated.filter((s) => s !== you).map(nameOf),
						rounds: view.rounds,
						seats: view.seats,
					}),
				});

	// The choice remembers its day, so a new day starts with nothing chosen.
	const [choice, setChoice] = useState<{ round: number; place: number } | null>(null);
	const selected = choice && choice.round === view.round && view.myPick === null ? choice.place : null;
	// A sent pick, held from the tap until the view shows it (the ack can land
	// before the new view does), the day moves on, or the server refuses it.
	const [outbound, setOutbound] = useState<{ round: number; place: number; refused: boolean } | null>(null);
	const today = outbound !== null && outbound.round === view.round ? outbound : null;
	const flying = today && !today.refused ? today.place : null;

	// The reveal: the latest resolved day plays unless this pig has watched it.
	const latest = view.history.length > 0 ? view.history[view.history.length - 1] : null;
	const [watched, setWatched] = useState<number | null>(() => {
		const unwatched = firstUnwatched(view, events.some((e) => e.type === "revealed"), room.pace);
		return unwatched === null ? (latest?.round ?? null) : unwatched - 1;
	});
	const revealRound = latest && latest.round !== watched ? latest.round : null;
	const [beatOf, setBeatOf] = useState<{ round: number; beat: Beat }>({ round: 0, beat: "out" });
	const reveal = latest && revealRound !== null ? { day: latest, beat: beatOf.round === revealRound ? beatOf.beat : ("out" as Beat) } : null;
	const lines = latest ? outcomeLines(latest, you, pigName, placeIds, nameOf) : null;

	// The scene's clock, keyed by its day: a new revision mid-scene never restarts it.
	useEffect(() => {
		if (revealRound === null) return;
		const timers = [
			setTimeout(() => setBeatOf({ round: revealRound, beat: "outcome" }), BEAT_AT.outcome),
			setTimeout(() => setBeatOf({ round: revealRound, beat: "grew" }), BEAT_AT.grew),
			setTimeout(() => setWatched(revealRound), BEAT_AT.done),
		];
		return () => timers.forEach(clearTimeout);
	}, [revealRound]);

	const picking = view.phase === "picking";
	// My pig is out the moment I send her, and walks home again only if the
	// server refuses the pick.
	const sent = picking ? (view.myPick ?? flying) : null;
	const canPick = yourTurn && !pending && picking && view.myPick === null && flying === null && revealRound === null;

	// Fitted, the yard is drawn at the plan's card height; natural, at full size.
	const fieldWidth = width - 2 * FIELD_PAD - 2 * BORDER.ink;
	const geo = fit
		? geometry(fieldWidth, view.places.length, { cardH: fit.cardH, rowGap: fit.rowGap, scale })
		: geometry(fieldWidth, view.places.length);
	const spots = stagePigs({ geo, view, you, seated, gone, sent, reveal });
	const heaps = heapsAt(geo, view, reveal);
	const flights = reveal ? flightsFor(geo, reveal.day, spots, view.seats) : [];
	const hearts = reveal ? heartsFor(geo, reveal.day, spots) : [];
	const muddy = reveal ? muddyAt(reveal.day, view.places.length) : [];

	const choose = (place: number) => setChoice({ round: view.round, place });
	const send = () => {
		if (selected === null) return;
		const round = view.round;
		const place = selected;
		setOutbound({ round, place, refused: false });
		void act({ type: "go", place }).then((res) => {
			if (!res.ok) setOutbound((o) => (o && o.round === round ? { ...o, refused: true } : o));
		});
	};

	const waiting = seated.filter((s) => s !== you && !gone[s] && !view.picked[s]).length;
	const myWeight = view.weights[you] ?? 0;
	const myHearts = view.hearts[you] ?? 0;
	// Fitted, the thumb zone is exactly the plan's height (pinned at the foot);
	// at natural size it keeps its floor.
	const zone = [styles.controls, fit ? { height: fit.controlsH } : styles.controlsNatural];
	const showChips = fit === null || fit.chips;

	let controls;
	if (reveal && lines) {
		controls = (
			<View style={zone} accessibilityLiveRegion="polite" testID="ol-outcome">
				<HandLg align="center" maxFontSizeMultiplier={TYPE_CAP}>
					{lines.title}
				</HandLg>
				<Hand tone="secondary" align="center" maxFontSizeMultiplier={TYPE_CAP}>
					{lines.sub}
				</Hand>
				{reveal.beat === "out" ? null : <Announce text={`${lines.title} ${lines.sub}`} />}
				<Button
					variant="handLink"
					size="sm"
					onPress={() => setWatched(reveal.day.round)}
					accessibilityHint="Skips the rest of the scene"
					maxFontSizeMultiplier={TYPE_CAP}
					testID="ol-skip"
				>
					{picking ? CONTROLS_COPY.onToDay(view.round) : CONTROLS_COPY.seePouches}
				</Button>
			</View>
		);
	} else if (!picking) {
		controls = (
			<View style={zone} testID="ol-ended">
				<HandLg align="center" maxFontSizeMultiplier={TYPE_CAP}>
					{CONTROLS_COPY.lastDay}
				</HandLg>
				<Hand tone="secondary" align="center" maxFontSizeMultiplier={TYPE_CAP}>
					{cameHomeLine(pigName, myWeight, myHearts)}
				</Hand>
			</View>
		);
	} else if (sent !== null) {
		controls = (
			<View style={zone} testID="ol-sent">
				<HandLg align="center" maxFontSizeMultiplier={TYPE_CAP}>
					{CONTROLS_COPY.sentTitle(pigName, placeIds[sent])}
				</HandLg>
				<Hand tone="secondary" align="center" maxFontSizeMultiplier={TYPE_CAP}>
					{pending || view.myPick === null
						? CONTROLS_COPY.sending(pigName)
						: room.pace === "async"
							? CONTROLS_COPY.pingYou
							: waiting === 0
								? CONTROLS_COPY.everyoneOut
								: CONTROLS_COPY.waitingOn(waiting)}
				</Hand>
			</View>
		);
	} else {
		controls = (
			<View style={zone} testID="ol-picker">
				<HandLg align="center" maxFontSizeMultiplier={TYPE_CAP}>
					{today?.refused ? CONTROLS_COPY.pickAgain : CONTROLS_COPY.pickTitle(pigName)}
				</HandLg>
				{showChips ? (
					<View style={styles.chips} accessibilityRole="radiogroup" testID="ol-chips">
						{view.places.map((place, j) => (
							<Chip
								key={place.id}
								label={PLACE_NAME[place.id]}
								role="radio"
								selected={selected === j}
								disabled={!canPick}
								onPress={() => choose(j)}
								accessibilityLabel={`The ${PLACE_NAME[place.id]}, weight ${place.pileWeight}`}
								maxFontSizeMultiplier={TYPE_CAP}
								testID={`ol-chip-${place.id}`}
							/>
						))}
					</View>
				) : null}
				<Button
					variant="gold"
					full
					disabled={!canPick || selected === null}
					loading={pending}
					loadingLabel={CONTROLS_COPY.sending(pigName)}
					onPress={send}
					accessibilityHint="Sends your pig out looking. A pick is final for the day."
					maxFontSizeMultiplier={TYPE_CAP}
					testID="ol-send"
				>
					{selected !== null ? sendLabel(pigName, placeIds[selected]) : CONTROLS_COPY.pickLabel(pigName)}
				</Button>
			</View>
		);
	}

	const day = dayLabel(reveal ? reveal.day.round : view.round, view.rounds);
	const top = (
		<>
			<View style={styles.dayRow}>
				{fit?.day === "kicker" ? (
					// A short board's signpost: the same words as a kicker line.
					<T role="kicker" tone="secondary" align="center" maxFontSizeMultiplier={TYPE_CAP} testID="ol-day">
						{day}
					</T>
				) : (
					<Sticker color="cream" rotate={TILT.card} radius={RADII.sm} shadow="sm" style={styles.day}>
						<T role="cardTitleSm" align="center" maxFontSizeMultiplier={TYPE_CAP} testID="ol-day">
							{day}
						</T>
					</Sticker>
				)}
			</View>
			<Scene
				geo={geo}
				view={view}
				heaps={heaps}
				spots={spots}
				looks={looks}
				highlighted={sent ?? selected}
				canPick={canPick}
				onPick={choose}
				reveal={reveal}
				flights={flights}
				hearts={hearts}
				muddy={muddy}
				reduce={reduceMotion}
			/>
		</>
	);

	if (!fit) {
		return (
			<View style={styles.board} testID="ol-board">
				<View style={styles.board}>{top}</View>
				{controls}
			</View>
		);
	}
	return (
		<View style={[styles.fitted, { height, gap: fit.gap }]} testID="ol-board">
			{/* Everything above the thumb zone: clipped at its edges (bled out
			    to the sides so the stickers' shadows survive), centred in the
			    room the plan left it, and scrolled only when even the yard's
			    floor does not fit. One scroller either way, so crossing that
			    line mid-game never remounts the yard (and never replays a
			    reveal's entrances). */}
			<View style={styles.top} testID="ol-top">
				<ScrollView
					scrollEnabled={fit.scroll}
					bounces={fit.scroll}
					contentContainerStyle={[styles.topContent, { gap: fit.gap }, fit.scroll ? null : styles.topCentred]}
					showsVerticalScrollIndicator={false}
					testID="ol-top-scroll"
				>
					{top}
				</ScrollView>
			</View>
			{controls}
		</View>
	);
}

/** Reads the day's outcome to VoiceOver once, when the scene reaches it. */
function Announce({ text }: { text: string }) {
	useEffect(() => {
		AccessibilityInfo.announceForAccessibility(text);
	}, [text]);
	return null;
}

const styles = StyleSheet.create({
	board: { gap: SPACE.md },
	fitted: { paddingBottom: FOOT },
	top: { flex: 1, minHeight: 0, overflow: "hidden", marginHorizontal: -LIST_BLEED },
	topContent: { paddingHorizontal: LIST_BLEED, paddingTop: TOP_AIR },
	topCentred: { flexGrow: 1, justifyContent: "center" },
	dayRow: { alignItems: "center" },
	day: { paddingHorizontal: SPACE.md, paddingVertical: SPACE.xxs },
	controls: { gap: CONTROLS_GAP, justifyContent: "center" },
	controlsNatural: { minHeight: CONTROLS_H },
	chips: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		columnGap: SPACE.sm,
		rowGap: SPACE.lg,
		paddingVertical: SPACE.xs,
	},
});

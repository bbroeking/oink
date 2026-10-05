// The table: one match, real or Practice, from useRoom(roomId).
//
// Everything every table has lives here; a game owns only its board
// (components/play/types.ts). Top to bottom:
//
//   the crown       the game's title; a kicker that says live, by post, or
//                   practice (bot pigs, plainly labelled); the way out
//   the seat strip  the pigs on their ground line (or compact chips), with
//                   whose move it is, presence, bubbles and emotes
//   the clock       a draining track at a live table, a hand line by post
//   the board       gameUi(game).Board, fed BoardProps; the lobby card in
//                   its place while an invite table fills; the countdown over
//                   it while the table starts
//   the tray        six emote stickers
//
// Phases: lobby (LobbyCard) → starting (CountdownOverlay, the pigs turn to
// face each other) → playing → ended (the board's last beat, then the
// ResultSheet; "Skip to result" over the board while the beat plays).
//
// Leaving says what it costs before it happens (leaveDialog): a live table
// is a forfeit or an early end, so the Leave control, the back swipe and the
// hardware back all ask first; a play-by-post table just steps away (it
// waits) and offers Resign behind "more"; a practice table, a finished one
// or a guest's lobby chair simply goes.
//
// A way out that starts in a dialog or a sheet (the leave confirm, the result
// sheet's Head home and Find another pig) closes it FIRST and changes the
// route only once its native Modal has finished leaving (MODAL_EXIT_MS). A
// screen popped while its Modal is still presented, or still fading, strands
// the Modal's controller over the app: the hub is drawn, the accessibility
// tree is empty and every tap is dead (the 2026-10-04 freeze, defect #1 in
// artifacts/play-2026-10-04; the wedge SnoutDeepDig's leave also sidesteps).
// Once the player has chosen to go, the table takes no more taps and opens no
// result sheet.
//
// The board's box: a game whose board fills its height (GameUI.fillsHeight)
// is drawn in a box exactly the height measured between the clock and the
// emote tray, with no outer scroll, so a turn's answer is always on screen
// and a tap on it can never land on the tray; a board without the flag keeps
// the scroller. The box clips, so nothing a board draws can reach the tray.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import { useNavigation } from "expo-router";
import {
	ActionSheet,
	Button,
	ConfirmDialog,
	EmptyState,
	Hand,
	IconButton,
	LoadingBeat,
	PageHeader,
	POPUP_HANDOFF_GAP_MS,
	StackPage,
	Sticker,
	showToast,
} from "@/components/ui";
import { CHROME_TYPE_CAP, PAGE_PAD, RADII, SPACE } from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { usePlay, usePlayConnection, usePlayEnabled, useRoom, type ActResult } from "@/hooks/useMultiplayer";
import { getGame } from "@/multiplayer/games";
import type { RoomSnapshot } from "@/multiplayer/protocol";
import type { AnyGame } from "@/multiplayer/types";
import { CONNECTION_COPY } from "@/utils/multiplayer/copy";
import { toProtocolError } from "@/utils/multiplayer/roomSource";
import { isMyTurn } from "@/utils/multiplayer/store";
import { ConnectionBanner } from "./ConnectionBanner";
import { CountdownOverlay } from "./CountdownOverlay";
import { EmoteTray } from "./EmoteTray";
import { gameUi } from "./gameUi";
import { LobbyCard } from "./LobbyCard";
import { holdTableOnStack, leaveScreen, openHub } from "./nav";
import { HUB_COPY, MATCH_COPY, leaveDialog } from "./playCopy";
import { showRefusal } from "./refusal";
import { ResultSheet } from "./ResultSheet";
import { handOffSearch } from "./searchHandoff";
import { SeatStrip } from "./SeatStrip";
import { TurnClock } from "./TurnClock";
import type { GameUI } from "./types";
import { useFreshEvents, useSeatReactions } from "./useTableCues";
import { TURN_BEAT_MS } from "./layout";

// The board's width before its first layout: the window less the page's two
// gutters (the board area pads by PAGE_PAD on each side).
const GUTTERS = PAGE_PAD * 2;
// The paper under a board that fills its box, between its last row and the
// emote tray: a turn's button never sits flush on an emote sticker.
const BOARD_FOOT = SPACE.sm;
// How long a dialog or sheet closed on the way out gets to finish leaving
// before the route changes: the app's one wait between a closing modal and a
// route (a fade or a slide dismissal, plus headroom for a busy main thread).
const MODAL_EXIT_MS = POPUP_HANDOFF_GAP_MS;

const NOTICE_COPY = Object.freeze({
	server_restarting: "The table is taking a quick breather",
	signed_in_elsewhere: CONNECTION_COPY.stopped.signed_in_elsewhere,
});

/** How long the board's last beat holds the result sheet back. A number, or
 *  a function of the final view (Mud Volley's envelope reel is longer than
 *  its live toss). Only a table played to its end has a last beat. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resultDelay(ui: GameUI<any> | null, room: RoomSnapshot): number {
	if (!ui || room.result?.reason !== "complete") return 0;
	const delay = ui.resultDelayMs;
	let ms = 0;
	if (typeof delay === "function") {
		if (room.view === null) return 0;
		try {
			ms = delay(room.view, room);
		} catch {
			ms = 0;
		}
	} else if (typeof delay === "number") {
		ms = delay;
	}
	return Number.isFinite(ms) ? Math.max(0, ms) : 0;
}

interface EndState {
	key: string;
	delay: number;
	ready: boolean;
	dismissed: boolean;
}

/** The board's box: the width less the gutters, and the height between the
 *  clock and the tray less the foot (undefined before the first layout). */
interface BoardBox {
	width: number;
	height?: number;
}

export function MatchScreen({ roomId }: { roomId: string | null }) {
	const enabled = usePlayEnabled();
	const table = useRoom(roomId);
	const play = usePlay();
	const connection = usePlayConnection(!table.practice);
	const { reduceMotion } = useMotionPolicy();
	const navigation = useNavigation();
	const { width: windowWidth } = useWindowDimensions();
	const [boardBox, setBoardBox] = useState<BoardBox>(() => ({ width: Math.max(0, windowWidth - GUTTERS) }));
	const onBoardLayout = useCallback((e: LayoutChangeEvent) => {
		const { width, height } = e.nativeEvent.layout;
		const next = { width: Math.max(0, width - GUTTERS), height: Math.max(0, height - BOARD_FOOT) };
		setBoardBox((cur) => (cur.width === next.width && cur.height === next.height ? cur : next));
	}, []);

	const room = table.snapshot;
	const source = table.source;
	const practice = table.practice;
	const ui = room ? gameUi(room.game) : null;
	const game: AnyGame | null = room ? getGame(room.game) : null;
	const { events, fresh } = useFreshEvents(room);
	const pigs = useSeatReactions(room, ui, fresh, reduceMotion);

	// This table is on the stack while the screen is mounted, under the id it
	// was opened with and the one it follows to after a rematch, so no other
	// way in pushes it a second time (nav.ts).
	const followedId = table.roomId;
	useEffect(() => (roomId ? holdTableOnStack(roomId) : undefined), [roomId]);
	useEffect(() => (followedId && followedId !== roomId ? holdTableOnStack(followedId) : undefined), [followedId, roomId]);

	// ── The countdown's turn: the pigs face the camera for a beat, then each
	// other. Set from a timer, never from the effect body.
	const startingKey = room?.phase === "starting" ? `${room.roomId}:${room.startsAt ?? 0}` : null;
	const [turnedKey, setTurnedKey] = useState<string | null>(null);
	useEffect(() => {
		if (!startingKey) return;
		const timer = setTimeout(() => setTurnedKey(startingKey), reduceMotion ? 0 : TURN_BEAT_MS);
		return () => clearTimeout(timer);
	}, [startingKey, reduceMotion]);
	const turned = room?.phase !== "starting" || reduceMotion || turnedKey === startingKey;

	const [leaveOpen, setLeaveOpen] = useState(false);

	// ── The end: the board's last beat, then the result sheet.
	const phaseKey = room ? `${room.roomId}:${room.phase}` : null;
	const [seenPhase, setSeenPhase] = useState<string | null>(phaseKey);
	const [end, setEnd] = useState<EndState | null>(() =>
		room?.phase === "ended" ? { key: `${room.roomId}:${room.rev}`, delay: 0, ready: true, dismissed: false } : null,
	);
	if (phaseKey !== seenPhase) {
		setSeenPhase(phaseKey);
		// A question about leaving belongs to the phase it was asked in: a
		// table that ends (or a rematch that opens) while it is up closes it.
		setLeaveOpen(false);
		if (room?.phase === "ended") {
			// Watched to its end (this screen saw the table in another phase):
			// let the board's last beat land first. Opened on a finished table:
			// the result straight away.
			const watched = seenPhase !== null && seenPhase.startsWith(`${room.roomId}:`);
			const delay = watched && !reduceMotion ? resultDelay(ui, room) : 0;
			setEnd({ key: `${room.roomId}:${room.rev}`, delay, ready: delay === 0, dismissed: false });
		} else {
			setEnd(null);
		}
	}
	const endKey = end?.key ?? null;
	const endReady = end?.ready ?? true;
	const endDelay = end?.delay ?? 0;
	useEffect(() => {
		if (!endKey || endReady) return;
		const timer = setTimeout(() => setEnd((e) => (e && e.key === endKey ? { ...e, ready: true } : e)), endDelay);
		return () => clearTimeout(timer);
	}, [endKey, endReady, endDelay]);

	// ── Acting: pending while a request is out; a refusal is a toast, except a
	// "not your turn" the table has already moved past (the next view says it).
	const [pendingCount, setPendingCount] = useState(0);
	const act = useCallback(
		async (action: unknown): Promise<ActResult> => {
			if (!source) return { ok: false, error: "not_found" };
			setPendingCount((n) => n + 1);
			try {
				const res = await source.act(action);
				if (!res.ok) {
					const latest = source.snapshot;
					const stillMine = !!latest && latest.you !== null && latest.activeSeats.includes(latest.you);
					if (!(res.error === "not_your_turn" && !stillMine)) showRefusal("act", res.error);
				}
				return res;
			} finally {
				setPendingCount((n) => Math.max(0, n - 1));
			}
		},
		[source],
	);

	// ── Server notices (a restart, another device): said once, in our words.
	const notices = play.notices;
	const dismissNotice = play.dismissNotice;
	useEffect(() => {
		const latest = notices[notices.length - 1];
		if (!latest) return;
		showToast({ tone: "info", title: NOTICE_COPY[latest.kind] ?? NOTICE_COPY.server_restarting });
		dismissNotice(latest.at);
	}, [notices, dismissNotice]);

	// ── Leaving.
	const leaveCopy = room ? leaveDialog(room, game, practice) : null;
	const [moreOpen, setMoreOpen] = useState(false);
	const [leaving, setLeaving] = useState(false);
	// Set the moment the player chooses to go: the table they are leaving is
	// not redrawn as "packed up" in the frames before the screen closes, takes
	// no more taps, and opens no result sheet over the way out.
	const [exiting, setExiting] = useState(false);
	// The same choice as a ref, so a second tap or a back gesture in the same
	// beat sees it at once: one way out per screen.
	const departing = useRef(false);
	const allowRemove = useRef(false);
	const pendingNav = useRef<Parameters<typeof navigation.dispatch>[0] | null>(null);
	const latest = useRef({ room, source, practice, game });
	useEffect(() => {
		latest.current = { room, source, practice, game };
	});

	const goAway = useCallback(() => {
		allowRemove.current = true;
		const action = pendingNav.current;
		pendingNav.current = null;
		if (action) navigation.dispatch(action);
		else leaveScreen();
	}, [navigation]);

	// The wait for a closed dialog or sheet to finish leaving. Resolves true
	// when the route may change; false when the screen went first (a back
	// gesture during the wait, or unmounting), so nothing navigates twice.
	const exitWait = useRef<{ timer: ReturnType<typeof setTimeout>; resolve: (go: boolean) => void } | null>(null);
	const alive = useRef(true);
	const cancelExit = useCallback(() => {
		const wait = exitWait.current;
		if (!wait) return;
		exitWait.current = null;
		clearTimeout(wait.timer);
		wait.resolve(false);
	}, []);
	useEffect(() => {
		alive.current = true;
		return () => {
			alive.current = false;
			cancelExit();
		};
	}, [cancelExit]);
	const modalExit = useCallback(
		() =>
			new Promise<boolean>((resolve) => {
				cancelExit();
				if (!alive.current) {
					resolve(false);
					return;
				}
				const timer = setTimeout(() => {
					exitWait.current = null;
					resolve(true);
				}, MODAL_EXIT_MS);
				exitWait.current = { timer, resolve };
			}),
		[cancelExit],
	);

	// A back swipe or the hardware back at a live table asks first, exactly
	// as the Leave control does; a practice table is put away on the way out.
	useEffect(() => {
		return navigation.addListener("beforeRemove", (e) => {
			if (allowRemove.current) return;
			if (departing.current) {
				// Already on the way out: this removal is the way out, and the
				// one waiting on a closing Modal stands down.
				allowRemove.current = true;
				cancelExit();
				return;
			}
			const now = latest.current;
			const r = now.room;
			if (!r || !now.source) return;
			if (now.practice || r.phase === "ended") {
				void now.source.leave();
				return;
			}
			if (r.pace === "async" && r.phase === "playing") return; // the table waits
			const copy = leaveDialog(r, now.game, now.practice);
			if (!copy) {
				void now.source.leave();
				return;
			}
			e.preventDefault();
			pendingNav.current = e.data.action;
			setLeaveOpen(true);
		});
	}, [navigation, cancelExit]);

	// Leave through the confirm: the table hears it while the dialog says so
	// (busy), then the dialog closes, then the route changes once it has
	// faded out. Never the other way round (the freeze).
	const confirmLeave = async () => {
		if (departing.current) return;
		departing.current = true;
		const r = latest.current.room;
		const s = latest.current.source;
		setLeaving(true);
		setExiting(true);
		if (r?.phase === "lobby" && r.host !== null && r.host === r.you && r.invite) {
			const res = await play.cancelInvite(r.invite.code);
			if (!res.ok && res.error !== "not_found" && res.error !== "expired") showRefusal("cancel", res.error);
		}
		await s?.leave();
		setLeaveOpen(false);
		setLeaving(false);
		if (await modalExit()) goAway();
	};

	// Nothing is open over the table here (the Leave control sits under any
	// sheet's scrim), so a leave that costs nothing goes at once.
	const requestLeave = () => {
		if (departing.current) return;
		if (leaveCopy) {
			setLeaveOpen(true);
			return;
		}
		departing.current = true;
		setExiting(true);
		void source?.leave();
		goAway();
	};

	const stepAway = useCallback(() => {
		if (departing.current) return;
		allowRemove.current = true;
		leaveScreen();
	}, []);

	// ── The lobby and the result's next steps.
	const [starting, setStarting] = useState(false);
	const startNow = useCallback(async () => {
		if (!source) return;
		setStarting(true);
		try {
			await source.start();
		} catch (error) {
			showRefusal("start", toProtocolError(error));
		} finally {
			setStarting(false);
		}
	}, [source]);

	const [rematchBusy, setRematchBusy] = useState(false);
	const rematch = useCallback(async () => {
		if (!source) return;
		setRematchBusy(true);
		try {
			await source.rematch();
		} catch (error) {
			showRefusal("rematch", toProtocolError(error));
		} finally {
			setRematchBusy(false);
		}
	}, [source]);

	// The result sheet's ways out: the sheet goes first, and the route changes
	// once it has left and the table has heard the goodbye.
	const findAnother = async () => {
		const r = latest.current.room;
		if (!r || departing.current) return;
		departing.current = true;
		handOffSearch([r.game], practice ? "live" : r.pace);
		setExiting(true);
		setEnd((e) => (e ? { ...e, dismissed: true } : e));
		const [, go] = await Promise.all([latest.current.source?.leave(), modalExit()]);
		if (!go) return;
		allowRemove.current = true;
		openHub();
	};

	const headHome = async () => {
		if (departing.current) return;
		departing.current = true;
		setExiting(true);
		setEnd((e) => (e ? { ...e, dismissed: true } : e));
		const [, go] = await Promise.all([latest.current.source?.leave(), modalExit()]);
		if (go) goAway();
	};

	// ── What to draw.
	const crownKicker = practice ? MATCH_COPY.kickerPractice : room?.pace === "async" ? MATCH_COPY.kickerAsync : MATCH_COPY.kickerLive;
	const title = game?.title ?? HUB_COPY.title;

	if (!enabled) {
		return (
			<Frame title={HUB_COPY.title} onBack={stepAway}>
				<EmptyState glyph="zzz" title={HUB_COPY.offTitle} sub={HUB_COPY.offSub} />
			</Frame>
		);
	}
	if ((practice && !source) || (table.gone && !exiting)) {
		return (
			<Frame title={title} onBack={stepAway}>
				<EmptyState glyph="zzz" title={MATCH_COPY.packedUp} sub={MATCH_COPY.packedUpSub} action={<HubButton />} />
			</Frame>
		);
	}
	if (!room || !source || !ui) {
		return (
			<Frame title={title} onBack={stepAway}>
				<ConnectionBanner connection={connection} style={styles.bannerInFlow} />
				<LoadingBeat label={MATCH_COPY.pulling} />
			</Frame>
		);
	}
	if (room.you === null) {
		return (
			<Frame title={title} onBack={stepAway}>
				<EmptyState glyph="pigface" title={MATCH_COPY.notSeated} sub={MATCH_COPY.notSeatedSub} action={<HubButton />} />
			</Frame>
		);
	}

	const you = room.you;
	const Board = ui.Board;
	const postTable = room.pace === "async" && !practice && room.phase === "playing";
	// Never over the way out: a sheet presented while the route changes is the
	// same stranded Modal as a dialog left up.
	const showResult = room.phase === "ended" && !!end && end.ready && !end.dismissed && !exiting;
	const holding = room.phase === "ended" && !!end && !end.ready;
	const minSeats = game?.seats.min ?? 2;
	// The lobby card scrolls (it can outgrow a phone at large text); a board
	// that fills its box is drawn in it, any other board in the scroller.
	const scrolls = room.phase === "lobby" || ui.fillsHeight !== true;
	const body =
		room.phase === "lobby" ? (
			<LobbyCard
				room={room}
				source={source}
				gameTitle={title}
				minSeats={minSeats}
				starting={starting}
				onStart={() => void startNow()}
				onCancel={() => setLeaveOpen(true)}
			/>
		) : room.view !== null ? (
			<Board
				key={room.roomId}
				view={room.view}
				room={room}
				you={you}
				yourTurn={isMyTurn(room)}
				act={act}
				pending={pendingCount > 0}
				events={events}
				reduceMotion={reduceMotion}
				width={boardBox.width}
				height={boardBox.height}
				serverNow={source.now}
				practice={practice}
			/>
		) : room.phase === "starting" ? null : (
			<LoadingBeat label={MATCH_COPY.settingUp} />
		);

	return (
		<>
			<StackPage testID="match-screen">
				{/* Inert once the player has chosen to go: one way out. */}
				<View style={[styles.screen, exiting ? styles.inert : null]} testID="match-screen-body">
					<PageHeader
						kicker={crownKicker}
						title={title}
						onBack={postTable ? stepAway : undefined}
						backLabel="back"
						maxFontSizeMultiplier={CHROME_TYPE_CAP}
						right={
							postTable ? (
								<IconButton
									name="more"
									label={MATCH_COPY.more}
									onPress={() => {
										if (!departing.current) setMoreOpen(true);
									}}
									testID="match-more"
								/>
							) : (
								<Button
									variant="ghost"
									size="xs"
									onPress={requestLeave}
									accessibilityHint={leaveCopy ? MATCH_COPY.leaveHint : MATCH_COPY.leaveNowHint}
									maxFontSizeMultiplier={CHROME_TYPE_CAP}
									testID="match-leave"
								>
									{MATCH_COPY.leave}
								</Button>
							)
						}
					/>
					<View style={styles.table}>
						{room.phase !== "lobby" ? (
							<View style={styles.strip}>
								<SeatStrip
									room={room}
									ui={ui}
									mode={ui.seatStrip ?? "pigs"}
									width={boardBox.width}
									pigs={pigs}
									emotes={table.emotes}
									now={source.now}
									turned={turned}
									practice={practice}
								/>
								<TurnClock room={room} ui={ui} source={source} decisionMs={game ? (game.decisionMs[room.pace] ?? game.decisionMs.live) : null} />
							</View>
						) : null}

						<View style={styles.boardArea} onLayout={onBoardLayout} testID="match-board-area">
							{scrolls ? (
								<ScrollView contentContainerStyle={styles.boardScroll} showsVerticalScrollIndicator={false} testID="match-board-scroll">
									{body}
								</ScrollView>
							) : (
								<View style={styles.boardFill} testID="match-board-fill">
									{body}
								</View>
							)}
							{room.phase === "starting" ? <CountdownOverlay room={room} source={source} practice={practice} /> : null}
							{holding ? (
								<Pressable
									onPress={() => setEnd((e) => (e ? { ...e, ready: true } : e))}
									accessibilityRole="button"
									accessibilityLabel={MATCH_COPY.skip}
									accessibilityHint={MATCH_COPY.skipHint}
									style={styles.skipLayer}
									testID="match-skip"
								>
									<Sticker color="paper" radius={RADII.pill} shadow="sm" rotate={0} style={styles.skipPill}>
										<Hand maxFontSizeMultiplier={CHROME_TYPE_CAP}>{`${MATCH_COPY.skip} ›`}</Hand>
									</Sticker>
								</Pressable>
							) : null}
						</View>

						{room.phase === "ended" && end?.ready && end.dismissed && !exiting ? (
							<Button
								variant="lilac"
								size="sm"
								onPress={() => setEnd((e) => (e ? { ...e, dismissed: false } : e))}
								accessibilityHint={MATCH_COPY.seeResultHint}
								style={styles.seeResult}
								testID="match-see-result"
							>
								{MATCH_COPY.seeResult}
							</Button>
						) : null}

						{room.phase !== "lobby" ? (
							<View style={styles.tray}>
								<EmoteTray onEmote={(emote) => source.emote(emote)} cooldownMs={play.timing.emoteCooldownMs} />
							</View>
						) : null}

						{!practice ? <ConnectionBanner connection={connection} style={styles.banner} /> : null}
					</View>
				</View>
			</StackPage>

			<ResultSheet
				open={showResult}
				onClose={() => setEnd((e) => (e ? { ...e, dismissed: true } : e))}
				room={room}
				ui={ui}
				gameTitle={title}
				kind={game?.kind ?? "competitive"}
				practice={practice}
				source={source}
				rematchBusy={rematchBusy}
				onRematch={() => void rematch()}
				onFindAnother={() => void findAnother()}
				onHeadHome={() => void headHome()}
			/>

			<ActionSheet
				open={moreOpen}
				onClose={() => setMoreOpen(false)}
				title={MATCH_COPY.resignTitle}
				items={[{ label: leaveCopy?.confirmLabel ?? MATCH_COPY.resign, onPress: () => setLeaveOpen(true) }]}
			/>

			<ConfirmDialog
				open={leaveOpen && !!leaveCopy}
				title={leaveCopy?.title ?? ""}
				body={leaveCopy?.body}
				confirmLabel={leaveCopy?.confirmLabel ?? MATCH_COPY.leave}
				cancelLabel={leaveCopy?.cancelLabel}
				tone={leaveCopy?.tone ?? "warm"}
				busy={leaving}
				onConfirm={() => void confirmLeave()}
				onCancel={() => {
					// The escape gesture or hardware back while the leave is on
					// its way: it is already decided.
					if (departing.current) return;
					pendingNav.current = null;
					setLeaveOpen(false);
				}}
				confirmHint={leaveCopy?.confirmHint}
				cancelHint={leaveCopy?.cancelHint}
			/>
		</>
	);
}

/** The crown and paper for the screens that are not a table yet (or any more). */
function Frame({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
	return (
		<StackPage testID="match-screen">
			<PageHeader kicker={MATCH_COPY.kickerTable} title={title} onBack={onBack} maxFontSizeMultiplier={CHROME_TYPE_CAP} />
			<View style={styles.frameBody}>{children}</View>
		</StackPage>
	);
}

function HubButton() {
	return (
		<Button variant="ghost" size="sm" onPress={openHub} accessibilityHint={MATCH_COPY.backToHubHint} testID="match-back-to-hub">
			{MATCH_COPY.backToHub}
		</Button>
	);
}

const styles = StyleSheet.create({
	screen: { flex: 1 },
	inert: { pointerEvents: "none" },
	table: { flex: 1 },
	strip: { paddingHorizontal: PAGE_PAD, gap: SPACE.xs },
	boardArea: { flex: 1, marginTop: SPACE.sm },
	boardScroll: { paddingHorizontal: PAGE_PAD, paddingBottom: SPACE.lg, flexGrow: 1 },
	// Exactly the measured box: no scroll, and a clip, so a board that
	// overflows can never draw over the tray (or hand it the board's taps).
	boardFill: { flex: 1, paddingHorizontal: PAGE_PAD, paddingBottom: BOARD_FOOT, overflow: "hidden" },
	skipLayer: { ...StyleSheet.absoluteFill, justifyContent: "flex-end", alignItems: "center", paddingBottom: SPACE.lg },
	skipPill: { paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs },
	seeResult: { alignSelf: "center", marginBottom: SPACE.xs },
	tray: { paddingHorizontal: PAGE_PAD, paddingTop: SPACE.xs, paddingBottom: SPACE.sm },
	banner: { position: "absolute", top: 0, left: PAGE_PAD, right: PAGE_PAD },
	bannerInFlow: { marginHorizontal: PAGE_PAD, marginBottom: SPACE.sm },
	frameBody: { flex: 1, paddingHorizontal: PAGE_PAD },
});

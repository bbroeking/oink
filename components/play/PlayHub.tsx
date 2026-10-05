// Play together: the hub of matchmade play (docs/multiplayer/README.md §1),
// behind the one door on the Friends tab. Top to bottom:
//
//   the connection banner  only when the socket has something to say
//   the searching card     your pig out sniffing while the queue runs, and
//                          after the practice offer time, the two honest
//                          alternatives (an open seat by post, a bot pig)
//   Invites                invites waiting for you: Accept / Not now
//   Your tables            tables in progress, your move first
//   the five               "Find a pig for any game" (the fastest way to a
//                          table at a small population) and the invite link
//                          straight under the crown, with no second heading
//                          over them; then "The five", a small heading, and
//                          each game's card; a card opens its sheet (how it
//                          goes, then Find a pig · Play by post · Invite ·
//                          Practice, timed or with no clock)
//   Wins this month        the door to the wins board
//
// The crown is pinned above the scroller, so it states its type ceiling
// (CHROME_TYPE_CAP); the scroller runs to the screen's foot and ends on the
// stack scroll pad, rather than clipping above the home indicator.
//
// The hub owns searching: it watches for the table a search finds and opens
// it (useTableFound), and a live search still running when the player backs
// out of the hub is stopped, so a stranger is never matched with a pig who
// is not there to sit down. With the play flag off the whole hub is one warm
// line, and nothing else.

import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, Share, StyleSheet, View } from "react-native";
import { useNavigation } from "expo-router";
import { useFocusEffect } from "expo-router/react-navigation";
import {
	Button,
	CardTitle,
	EmptyState,
	Hand,
	Icon,
	NavRow,
	PageHeader,
	SectionHeader,
	STACK_SCROLL_EDGES,
	StackPage,
	Sticker,
	showToast,
	useStackScrollPad,
} from "@/components/ui";
import { ART_SIZE, CHROME_TYPE_CAP, MOTION, PAGE_PAD, SPACE, UI_COLORS } from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import {
	useInvites,
	usePlay,
	usePlayCatalog,
	usePlayConnection,
	usePlayEnabled,
	useQueue,
	useServerClock,
} from "@/hooks/useMultiplayer";
import { GAMES, GAME_IDS } from "@/multiplayer/games";
import type { CatalogEntry, InviteKind, InviteSummary } from "@/multiplayer/protocol";
import type { GameId, Pace } from "@/multiplayer/types";
import { INVITE_COPY } from "@/utils/multiplayer/copy";
import { ensurePushPermission } from "@/utils/pushNotifications";
import { ConnectionBanner } from "./ConnectionBanner";
import { GameCard } from "./GameCard";
import { GameFan } from "./GameFan";
import { GameSheet } from "./GameSheet";
import { IncomingInviteCard } from "./IncomingInviteCard";
import { InviteSheet } from "./InviteSheet";
import { leaveToHome, openTable, openWins } from "./nav";
import { HUB_COPY, LOBBY_COPY, fill, gamesLine } from "./playCopy";
import { showRefusal } from "./refusal";
import { SearchingCard } from "./SearchingCard";
import { takeHandedOffSearch } from "./searchHandoff";
import { claimTable } from "./tableClaims";
import { TableRow } from "./TableRow";
import { useTableFound } from "./useTableFound";

// Invite and table times only need to move by the quarter minute.
const HUB_TICK_MS = 15_000;

// Invites need pushes, so the hub asks once per app session (the first time
// it opens with play on). ensurePushPermission is itself idempotent.
let askedForPushes = false;
function askForPushesOnce(): void {
	if (askedForPushes) return;
	askedForPushes = true;
	void ensurePushPermission();
}

/** Test seam: ask again on the next hub. */
export function resetPushAskForTests(): void {
	askedForPushes = false;
}

type Busy = "find" | "stop" | "seat" | "practice" | `accept:${string}` | `decline:${string}` | null;

export function PlayHub() {
	const enabled = usePlayEnabled();
	const connection = usePlayConnection();
	const play = usePlay();
	const queue = useQueue();
	const invites = useInvites();
	const catalog = usePlayCatalog();
	const now = useServerClock(HUB_TICK_MS);
	const navigation = useNavigation();
	const { reduceMotion } = useMotionPolicy();
	const scroll = useRef<ScrollView>(null);
	const scrollPad = useStackScrollPad();

	const [sheetGame, setSheetGame] = useState<GameId | null>(null);
	const [inviteOpen, setInviteOpen] = useState(false);
	const [inviteGame, setInviteGame] = useState<GameId | null>(null);
	const [busy, setBusy] = useState<Busy>(null);
	const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());

	useEffect(() => {
		if (enabled) askForPushesOnce();
	}, [enabled]);

	const { arm, disarm } = useTableFound(play.games, queue.searching, openTable);
	const { joinQueue, leaveQueue, acceptInvite, declineInvite, startPractice, createInvite } = play;

	const find = useCallback(
		async (games: GameId[], pace: Pace) => {
			if (games.length === 0) return;
			arm();
			const res = await joinQueue(games, pace);
			if (!res.ok) {
				disarm();
				showRefusal("queue", res.error);
			}
		},
		[arm, disarm, joinQueue],
	);

	// A search handed over from a table's result sheet ("Find another pig").
	useFocusEffect(
		useCallback(() => {
			const handed = takeHandedOffSearch();
			if (handed) void find(handed.games, handed.pace);
		}, [find]),
	);

	// A search started from a card deep in the list shows its card at the
	// top of the page: scroll up to it, so the tap visibly did something.
	const searchingNow = queue.searching;
	useEffect(() => {
		if (searchingNow) scroll.current?.scrollTo({ y: 0, animated: !reduceMotion });
	}, [searchingNow, reduceMotion]);

	// Backing out of the hub stops a live search: nobody would be here to
	// open the table it found.
	const latestQueue = useRef(queue);
	useEffect(() => {
		latestQueue.current = queue;
	});
	useEffect(() => {
		return navigation.addListener("beforeRemove", () => {
			const q = latestQueue.current;
			if (q.searching && q.queue.pace === "live") void q.leave();
		});
	}, [navigation]);

	// ── The games, as the server lists them (or the app's own list before the
	// first welcome: every game awake until the server says otherwise).
	const entries: CatalogEntry[] = GAME_IDS.map((id) => catalog.byId(id)).filter((e): e is CatalogEntry => e !== null);
	const serverKnows = catalog.catalog.length > 0;
	const isAsleep = (entry: CatalogEntry) => serverKnows && !entry.enabled;
	const awake = entries.filter((e) => !isAsleep(e));
	const liveIds = awake.filter((e) => e.paces.includes("live")).map((e) => e.id);
	const sheetEntry = sheetGame ? (entries.find((e) => e.id === sheetGame) ?? null) : null;

	// ── The search's own doors.
	const queued = queue.queue.games;
	const queuedTitles = queued.map((id) => GAMES[id]?.title ?? id);
	const seatGames = queued.filter((id) => catalog.asyncAllowed && (catalog.byId(id)?.paces.includes("async") ?? false));
	const practiceGame = queued.find((id) => catalog.practiceGames.some((g) => g.id === id)) ?? null;

	const stopLooking = useCallback(async () => {
		setBusy("stop");
		disarm();
		const res = await leaveQueue();
		setBusy(null);
		if (!res.ok && res.error !== "offline") showRefusal("queue", res.error);
	}, [disarm, leaveQueue]);

	const openSeat = useCallback(async () => {
		setBusy("seat");
		await find(seatGames, "async");
		setBusy(null);
	}, [find, seatGames]);

	const practiceInstead = useCallback(async () => {
		if (!practiceGame) return;
		setBusy("practice");
		disarm();
		await leaveQueue();
		const res = await startPractice({ gameId: practiceGame });
		setBusy(null);
		if (res.ok) openTable(res.roomId);
		else showRefusal("practice", res.error);
	}, [disarm, leaveQueue, practiceGame, startPractice]);

	// ── Invites for you.
	const incoming = invites.incoming.filter((invite) => !dismissed.has(invite.code));
	const accept = useCallback(
		async (invite: InviteSummary) => {
			setBusy(`accept:${invite.code}`);
			// The seat opens its own table: the table's first snapshot lands
			// before the ack, and a search's watch must not open it as well.
			disarm();
			claimTable(invite.roomId);
			const res = await acceptInvite(invite.code);
			setBusy(null);
			if (!res.ok) {
				showRefusal("accept", res.error);
				return;
			}
			const roomId = res.roomId ?? invite.roomId;
			if (roomId) openTable(roomId);
		},
		[disarm, acceptInvite],
	);
	const notNow = useCallback(
		async (invite: InviteSummary) => {
			setDismissed((cur) => new Set(cur).add(invite.code));
			// A direct invite tells the inviter "not this time"; a link or a
			// Sounder invite just leaves your list.
			if (invite.kind !== "direct") return;
			setBusy(`decline:${invite.code}`);
			await declineInvite(invite.code);
			setBusy(null);
		},
		[declineInvite],
	);

	// ── A game's sheet and the invite sheet. A native sheet finishes closing
	// before anything opens over it or the route changes (the modal handoff).
	const closeSheetThen = useCallback((next: () => void) => {
		setSheetGame(null);
		setTimeout(next, MOTION.modalHandoff);
	}, []);

	const practiceFromSheet = useCallback(
		async (gameId: GameId, seats: number, untimed: boolean) => {
			setBusy("practice");
			// Timed by default, like a live table; "No clock" drops it.
			const res = await startPractice(untimed ? { gameId, seats, untimed } : { gameId, seats });
			setBusy(null);
			if (!res.ok) {
				showRefusal("practice", res.error);
				return;
			}
			closeSheetThen(() => openTable(res.roomId));
		},
		[startPractice, closeSheetThen],
	);

	const onInviteCreated = useCallback((invite: InviteSummary | null, kind: InviteKind) => {
		setInviteOpen(false);
		setTimeout(() => {
			const roomId = invite?.roomId ?? null;
			const go = () => {
				if (roomId) openTable(roomId);
				else showToast({ tone: "info", title: INVITE_COPY.sent });
			};
			if (kind === "link" && invite?.url) {
				const title = GAMES[invite.game]?.title ?? "";
				Share.share({ message: `${fill(LOBBY_COPY.shareMessage, { game: title })}\n${invite.url}` })
					.catch(() => null)
					.finally(go);
			} else {
				go();
			}
		}, MOTION.modalHandoff);
	}, []);

	if (!enabled) {
		return (
			<StackPage testID="play-hub">
				<PageHeader kicker={HUB_COPY.kicker} title={HUB_COPY.title} onBack={leaveToHome} maxFontSizeMultiplier={CHROME_TYPE_CAP} />
				<View style={styles.offBody}>
					<EmptyState glyph="zzz" title={HUB_COPY.offTitle} sub={HUB_COPY.offSub} />
				</View>
			</StackPage>
		);
	}

	const tables = play.games.filter((t) => t.phase !== "ended");

	return (
		<>
			<StackPage testID="play-hub" edges={STACK_SCROLL_EDGES}>
				<PageHeader kicker={HUB_COPY.kicker} title={HUB_COPY.title} onBack={leaveToHome} maxFontSizeMultiplier={CHROME_TYPE_CAP} />
				<ScrollView
					ref={scroll}
					style={styles.scroll}
					contentContainerStyle={[styles.content, { paddingBottom: scrollPad }]}
					showsVerticalScrollIndicator={false}
					testID="play-hub-scroll"
				>
					<ConnectionBanner connection={connection} quietWhileConnecting />

					{queue.searching ? (
						<SearchingCard
							queue={queue.queue}
							practiceOfferMs={queue.practiceOfferMs}
							gamesLine={gamesLine(queuedTitles, GAME_IDS.length)}
							canOpenSeat={seatGames.length > 0}
							canPractice={catalog.practiceAllowed && practiceGame !== null}
							busy={busy === "stop" || busy === "seat" || busy === "practice" ? busy : null}
							onStop={() => void stopLooking()}
							onOpenSeat={() => void openSeat()}
							onPractice={() => void practiceInstead()}
						/>
					) : null}

					{incoming.length > 0 ? (
						<View style={styles.section} testID="hub-invites">
							<SectionHeader kicker={HUB_COPY.invitesKicker} title={HUB_COPY.invitesTitle} />
							<View style={styles.stack}>
								{incoming.map((invite) => (
									<IncomingInviteCard
										key={invite.code}
										invite={invite}
										now={now}
										busy={busy === `accept:${invite.code}` ? "accept" : busy === `decline:${invite.code}` ? "decline" : null}
										onAccept={() => void accept(invite)}
										onNotNow={() => void notNow(invite)}
									/>
								))}
							</View>
						</View>
					) : null}

					{tables.length > 0 ? (
						<View style={styles.section} testID="hub-tables">
							<SectionHeader kicker={HUB_COPY.tablesKicker} title={HUB_COPY.tablesTitle} />
							<View style={styles.stack}>
								{tables.map((table, i) => (
									<TableRow key={table.roomId} table={table} index={i} now={now} onPress={() => openTable(table.roomId)} />
								))}
							</View>
						</View>
					) : null}

					<View style={styles.section} testID="hub-games">
						{/* No section crown over the shortcut: the page's crown is
						    its heading, so one heading comes before the first
						    thing to tap, not two. */}
						<View style={styles.stack}>
							{!queue.searching && liveIds.length > 0 ? (
								<Sticker
									color="sun"
									pad
									onPress={() => {
										setBusy("find");
										void find(liveIds, "live").finally(() => setBusy(null));
									}}
									disabled={busy === "find"}
									accessibilityLabel={HUB_COPY.anyTitle}
									accessibilityHint={HUB_COPY.anyHint}
									style={styles.any}
									testID="hub-any-game"
								>
									<GameFan games={liveIds} />
									<View style={styles.anyWords}>
										<CardTitle>{HUB_COPY.anyTitle}</CardTitle>
										<Hand tone="secondary">{HUB_COPY.anySub}</Hand>
									</View>
									<Icon name="chevronRight" size={ART_SIZE.mark} color={UI_COLORS.textSecondary} />
								</Sticker>
							) : null}
							<Button
								variant="handLink"
								size="sm"
								onPress={() => {
									setInviteGame(null);
									setInviteOpen(true);
								}}
								accessibilityHint={HUB_COPY.inviteAnyHint}
								style={styles.inviteAny}
								testID="hub-invite-any"
							>
								{HUB_COPY.inviteAny}
							</Button>
						</View>
						<SectionHeader size="sm" title={HUB_COPY.gamesTitle} style={styles.fiveHeader} />
						<View style={styles.stack}>
							{entries.map((entry, i) => (
								<GameCard
									key={entry.id}
									entry={entry}
									index={i}
									asleep={isAsleep(entry)}
									asyncAllowed={catalog.asyncAllowed}
									onPress={() => setSheetGame(entry.id)}
								/>
							))}
						</View>
					</View>

					<NavRow glyph="trophy" label={HUB_COPY.winsLabel} sub={HUB_COPY.winsSub} onPress={openWins} accessibilityHint={HUB_COPY.winsHint} testID="hub-wins" />
				</ScrollView>
			</StackPage>

			<GameSheet
				entry={sheetEntry}
				open={sheetGame !== null}
				onClose={() => setSheetGame(null)}
				asleep={sheetEntry ? isAsleep(sheetEntry) : false}
				asyncAllowed={catalog.asyncAllowed}
				practiceAllowed={catalog.practiceAllowed && !!sheetEntry && catalog.practiceGames.some((g) => g.id === sheetEntry.id)}
				practiceBusy={busy === "practice"}
				onFind={() => {
					const id = sheetGame;
					setSheetGame(null);
					if (id) void find([id], "live");
				}}
				onByPost={() => {
					const id = sheetGame;
					setSheetGame(null);
					if (id) void find([id], "async");
				}}
				onInvite={() => {
					const id = sheetGame;
					closeSheetThen(() => {
						setInviteGame(id);
						setInviteOpen(true);
					});
				}}
				onPractice={(seats, untimed) => {
					if (sheetGame) void practiceFromSheet(sheetGame, seats, untimed);
				}}
			/>

			<InviteSheet
				open={inviteOpen}
				onClose={() => setInviteOpen(false)}
				game={inviteGame}
				asyncAllowed={catalog.asyncAllowed}
				onCreate={(request) => {
					// The invite opens its own lobby: a search's watch must not
					// open it a second time.
					disarm();
					return createInvite(request);
				}}
				onCreated={onInviteCreated}
			/>
		</>
	);
}

const styles = StyleSheet.create({
	scroll: { flex: 1 },
	content: { paddingHorizontal: PAGE_PAD, gap: SPACE.lg },
	section: { gap: 0 },
	stack: { gap: SPACE.md },
	fiveHeader: { marginTop: SPACE.lg },
	any: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
	anyWords: { flex: 1, minWidth: 0, gap: SPACE.xxs },
	inviteAny: { alignSelf: "center" },
	offBody: { flex: 1, paddingHorizontal: PAGE_PAD },
});

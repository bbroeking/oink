// Matchmade play for screens. Mount <MultiplayerProvider> once (app/_layout,
// inside FeatureFlagsProvider); every Play surface talks to the play server
// only through the hooks below. Nothing here renders UI.
//
// ── API ──────────────────────────────────────────────────────────────────────
//
// usePlayEnabled(): boolean
//   True once the `multiplayer` server flag has loaded and is on. Gate every
//   Play door and route on it (false while loading).
//
// usePlayConnection(active = true): PlayConnection
//   Holds the socket open while the calling screen is mounted (ref-counted;
//   the last release lingers 60 s before the socket closes). Call it in every
//   Play screen. Returns { status, reason, connection, banner, retry }:
//   `banner` is the copy line for a connecting / reconnecting / stopped state
//   (null when nothing needs saying); `retry()` redials after a stop.
//   The socket also stays up, with no screen mounted, while the player is
//   searching or seated at a live table that has not ended.
//
// usePlay(): UsePlay
//   Everything at once, for the Play hub: { enabled, connection, me, timing,
//   catalog, queue, games (Your games: my turn first), incomingInvites,
//   sentInvites, yourTurnCount, notices, lastError } plus actions:
//     joinQueue(games, pace)            → PlayResult
//     leaveQueue()                      → PlayResult
//     createInvite({ game, kind, to?, pace }) → PlayResult<{ invite }>
//     previewInvite(code)               → PlayResult<{ invite, room }>
//     acceptInvite(code)                → PlayResult<{ roomId }>  (open /match/<roomId>)
//     declineInvite(code), cancelInvite(code) → PlayResult
//     joinRoom(roomId)                  → PlayResult
//     act(roomId, action)               → ActResult
//     leaveRoom(roomId)                 → void (never rejects)
//     emote(roomId, emote)              → void
//     rematch(roomId), startRoom(roomId) → PlayResult
//     startPractice({ gameId, seats?, untimed? }) → PlayResult<{ roomId }>
//                                         (then open /match/<roomId>)
//     retry(), clearError(), dismissNotice(at)
//   PlayResult = { ok: true, ... } | { ok: false, error: PlayErrorCode };
//   errorCopy(error) in utils/multiplayer/copy.ts has the line to show.
//   Actions never throw. One made while the socket is still coming up waits
//   for it (8 s) rather than failing "offline".
//
// useRoom(roomId): UseRoom
//   One table for the match screen, real or Practice (ids from
//   startPractice start with "practice-"). Returns { roomId, snapshot,
//   source, practice, gone, emotes }. Holds the connection and (re)joins the
//   table on every reconnect. Follows a rematch: when the server opens the
//   rematch table, `roomId`/`snapshot` move to it. Draw from `source`
//   (utils/multiplayer/roomSource.ts): source.act / emote / leave / rematch /
//   start, and source.now() for the table's clock. Play `snapshot.events`
//   once per `${snapshot.roomId}:${snapshot.rev}`. `gone` is set when the
//   server closed the table ("not_found" | "left" | "expired").
//
// useQueue(): UseQueue
//   { queue, searching, since, practiceOfferMs, join(games, pace), leave() }.
//   With useServerClock, offer Practice once (now - since) >= practiceOfferMs
//   (or use shouldOfferPractice from utils/multiplayer/store).
//
// useInvites(): UseInvites
//   { incoming, sent, byCode, preview, accept, decline, cancel, create }.
//   `incoming` = open invites naming me, plus crew/link invites I previewed.
//
// usePlayCatalog(): UsePlayCatalog
//   { catalog (the server's welcome list, empty until connected), playable
//   (enabled entries), practiceGames (from the app's own registry, so
//   Practice works before or without the server; empty when the server
//   config turns Practice off), asyncAllowed, practiceAllowed, byId(id) }.
//
// useServerClock(intervalMs = 250, source?): number
//   A ticking clock for countdowns. With a RoomSource it ticks on that
//   table's clock (a Practice table runs on the device clock); without one,
//   on the server clock. Pair with msLeft(snapshot, now) from
//   utils/multiplayer/store.
//
// Also exported for screens: msLeft, rematchMsLeft, isMyTurn, mySeat,
// eventsSince, shouldOfferPractice (store); resultCopy, errorCopy,
// connectionCopy, inviteLine (copy); pigStagePropsForLook (looks).
//
// Push + links: a tap on an invite push opens /play/<CODE>, a your-turn push
// /match/<roomId> (utils/notificationRouting.ts). Expo Router maps
// https://ticklethepig.com/play/<CODE> and ticklethepig://play/<CODE> to
// app/play/[code].tsx. The provider registers the invite push's "Play" /
// "Not now" buttons (utils/multiplayer/notifications.ts).

import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useState,
	useSyncExternalStore,
	type ReactNode,
} from "react";
import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import { useFeatureFlagState } from "@/hooks/useFeatureFlags";
import { GAMES } from "@/multiplayer/games";
import type { CatalogEntry, Emote, InviteSummary, PlayerCard, QueueState, RoomSnapshot, RoomSummary, Timing } from "@/multiplayer/protocol";
import type { GameId, Pace } from "@/multiplayer/types";
import { log } from "@/utils/log";
import { supabase } from "@/utils/supabase";
import { PlayClient, type PlayConnectionState, type PlayStopReason } from "@/utils/multiplayer/client";
import {
	hydrateMultiplayerConfig,
	multiplayerConfig,
	playServerUrl,
	refreshMultiplayerConfig,
} from "@/utils/multiplayer/config";
import { connectionCopy } from "@/utils/multiplayer/copy";
import { isPracticeRoomId } from "@/utils/multiplayer/localRoom";
import { fetchMyPlayerCard } from "@/utils/multiplayer/looks";
import { registerPlayNotificationCategory } from "@/utils/multiplayer/notifications";
import type { ActResult, RoomSource } from "@/utils/multiplayer/roomSource";
import {
	PlayRuntime,
	type CreateInviteRequest,
	type PlayResult,
	type PracticeRequest,
} from "@/utils/multiplayer/runtime";
import {
	followRematch,
	incomingInvites as selectIncoming,
	roomEmotes,
	roomSummaryList,
	sentInvites as selectSent,
	yourTurnCount as selectYourTurnCount,
	type EmoteMark,
	type PlayErrorMark,
	type PlayNotice,
	type PlayState,
	type RoomGoneReason,
} from "@/utils/multiplayer/store";

export type { ActResult, PlayResult, RoomSource };
export {
	eventsSince,
	isMyTurn,
	msLeft,
	mySeat,
	rematchMsLeft,
	shouldOfferPractice,
} from "@/utils/multiplayer/store";
export { connectionCopy, errorCopy, inviteLine, resultCopy, resultHeadline } from "@/utils/multiplayer/copy";
export { pigStagePropsForLook } from "@/utils/multiplayer/looks";
export { isPracticeRoomId };

// ── Runtime wiring ───────────────────────────────────────────────────────────

function clientInfo(): { version?: string; build?: string; platform?: string } {
	const config = Constants.expoConfig;
	return {
		version: config?.version ?? undefined,
		build: config?.ios?.buildNumber ?? undefined,
		platform: Platform.OS,
	};
}

async function accessToken({ refresh }: { refresh: boolean }): Promise<string | null> {
	if (refresh) {
		const { data, error } = await supabase.auth.refreshSession();
		if (error) throw error;
		return data.session?.access_token ?? null;
	}
	const { data } = await supabase.auth.getSession();
	return data.session?.access_token ?? null;
}

function createRuntime(): PlayRuntime {
	const warn = (message: string, detail?: unknown) => log.warn(message, detail ?? "");
	const runtime: PlayRuntime = new PlayRuntime({
		createClient: ({ url }) =>
			new PlayClient({
				url,
				getToken: accessToken,
				client: clientInfo(),
				log: warn,
			}),
		serverUrl: playServerUrl,
		practiceAllowed: () => multiplayerConfig().practice,
		loadMyCard: () => fetchMyPlayerCard(runtime.store.getState().me?.name),
		log: warn,
	});
	return runtime;
}

interface MultiplayerContextValue {
	runtime: PlayRuntime;
	enabled: boolean;
}

// Hooks used outside the provider (an isolated test render, a gallery) get
// an inert runtime: never enabled, never connects.
let inert: MultiplayerContextValue | null = null;
function inertContext(): MultiplayerContextValue {
	if (!inert) inert = { runtime: createRuntime(), enabled: false };
	return inert;
}

const MultiplayerContext = createContext<MultiplayerContextValue | null>(null);

function useMultiplayerContext(): MultiplayerContextValue {
	return useContext(MultiplayerContext) ?? inertContext();
}

// Development only: EXPO_PUBLIC_PLAY_FORCE_ON=1 opens play before the
// `multiplayer` flag exists on the server (its migration is unpushed), for the
// simulator pass and local testing against `npm run dev` in server/. A
// production bundle compiles `__DEV__` to false and ignores it.
const DEV_FORCE_ON = __DEV__ && process.env.EXPO_PUBLIC_PLAY_FORCE_ON === "1";

export function MultiplayerProvider({ children }: { children: ReactNode }) {
	const { visible, loaded } = useFeatureFlagState("multiplayer");
	const enabled = DEV_FORCE_ON || (loaded && visible);
	const [runtime] = useState(createRuntime);

	// The server flag gates everything; config and the push buttons load
	// only once play is on for this account. The cleanup switches play off
	// (closing any socket) rather than disposing the runtime, so a remount,
	// or StrictMode's double-run of effects, simply switches it back on.
	useEffect(() => {
		runtime.setEnabled(enabled);
		if (enabled) {
			void registerPlayNotificationCategory();
			void hydrateMultiplayerConfig()
				.then(() => refreshMultiplayerConfig())
				.then((changed) => {
					if (changed) runtime.configChanged();
				});
		}
		return () => runtime.setEnabled(false);
	}, [runtime, enabled]);

	// The session: a token source while signed in, a reset on sign-out or an
	// account switch.
	useEffect(() => {
		let cancelled = false;
		void supabase.auth.getSession().then(({ data }) => {
			if (!cancelled) runtime.setSession(data.session?.user.id ?? null);
		});
		const { data } = supabase.auth.onAuthStateChange((_event, session) => {
			runtime.setSession(session?.user.id ?? null);
		});
		return () => {
			cancelled = true;
			data.subscription.unsubscribe();
		};
	}, [runtime]);

	// iOS suspends sockets in the background: close on background, redial on
	// active. `inactive` (Notification Center, a call) is deliberately ignored.
	useEffect(() => {
		const subscription = AppState.addEventListener("change", (state) => {
			if (state === "active") {
				runtime.setAppActive(true);
				void refreshMultiplayerConfig().then((changed) => {
					if (changed) runtime.configChanged();
				});
			} else if (state === "background") {
				runtime.setAppActive(false);
			}
		});
		return () => subscription.remove();
	}, [runtime]);

	const value = useMemo(() => ({ runtime, enabled }), [runtime, enabled]);
	return <MultiplayerContext.Provider value={value}>{children}</MultiplayerContext.Provider>;
}

function usePlaySelector<T>(select: (state: PlayState) => T): T {
	const { runtime } = useMultiplayerContext();
	return useSyncExternalStore(
		runtime.store.subscribe,
		() => select(runtime.store.getState()),
		() => select(runtime.store.getState()),
	);
}

const selectState = (state: PlayState) => state;
const selectConnection = (state: PlayState) => state.connection;
const selectQueue = (state: PlayState) => state.queue;
const selectTiming = (state: PlayState) => state.timing;
const selectCatalog = (state: PlayState) => state.catalog;

// ── Hooks ────────────────────────────────────────────────────────────────────

export function usePlayEnabled(): boolean {
	return useMultiplayerContext().enabled;
}

export interface PlayConnection {
	status: PlayConnectionState["status"];
	reason: PlayStopReason | null;
	connection: PlayConnectionState;
	/** The copy line for this state, or null when nothing needs saying. */
	banner: string | null;
	retry: () => void;
}

export function usePlayConnection(active = true): PlayConnection {
	const { runtime } = useMultiplayerContext();
	useEffect(() => {
		if (!active) return;
		return runtime.retain();
	}, [runtime, active]);
	const connection = usePlaySelector(selectConnection);
	return useMemo(
		() => ({
			status: connection.status,
			reason: connection.reason,
			connection,
			banner: connectionCopy(connection),
			retry: () => runtime.retry(),
		}),
		[connection, runtime],
	);
}

export interface PlayActions {
	joinQueue: (games: GameId[], pace: Pace) => Promise<PlayResult>;
	leaveQueue: () => Promise<PlayResult>;
	createInvite: (request: CreateInviteRequest) => Promise<PlayResult<{ invite: InviteSummary | null }>>;
	previewInvite: (code: string) => Promise<PlayResult<{ invite: InviteSummary | null; room: RoomSnapshot | null }>>;
	acceptInvite: (code: string) => Promise<PlayResult<{ roomId: string | null }>>;
	declineInvite: (code: string) => Promise<PlayResult>;
	cancelInvite: (code: string) => Promise<PlayResult>;
	joinRoom: (roomId: string) => Promise<PlayResult>;
	act: (roomId: string, action: unknown) => Promise<ActResult>;
	leaveRoom: (roomId: string) => Promise<void>;
	emote: (roomId: string, emote: Emote) => void;
	rematch: (roomId: string) => Promise<PlayResult>;
	startRoom: (roomId: string) => Promise<PlayResult>;
	startPractice: (request: PracticeRequest) => Promise<PlayResult<{ roomId: string }>>;
	retry: () => void;
	clearError: () => void;
	dismissNotice: (at: number) => void;
}

export interface UsePlay extends PlayActions {
	enabled: boolean;
	connection: PlayConnectionState;
	me: { userId: string; name: string } | null;
	timing: Timing;
	catalog: CatalogEntry[];
	queue: QueueState;
	/** "Your games": tables waiting on me first, then the freshest. */
	games: RoomSummary[];
	incomingInvites: InviteSummary[];
	sentInvites: InviteSummary[];
	yourTurnCount: number;
	notices: PlayNotice[];
	lastError: PlayErrorMark | null;
}

function useActions(runtime: PlayRuntime): PlayActions {
	return useMemo(
		() => ({
			joinQueue: (games, pace) => runtime.joinQueue(games, pace),
			leaveQueue: () => runtime.leaveQueue(),
			createInvite: (request) => runtime.createInvite(request),
			previewInvite: (code) => runtime.previewInvite(code),
			acceptInvite: (code) => runtime.acceptInvite(code),
			declineInvite: (code) => runtime.declineInvite(code),
			cancelInvite: (code) => runtime.cancelInvite(code),
			joinRoom: (roomId) => runtime.joinRoom(roomId),
			act: (roomId, action) => runtime.act(roomId, action),
			leaveRoom: (roomId) => runtime.leaveRoom(roomId),
			emote: (roomId, emote) => runtime.emote(roomId, emote),
			rematch: (roomId) => runtime.rematch(roomId),
			startRoom: (roomId) => runtime.startRoom(roomId),
			startPractice: (request) => runtime.startPractice(request),
			retry: () => runtime.retry(),
			clearError: () => runtime.clearError(),
			dismissNotice: (at) => runtime.dismissNotice(at),
		}),
		[runtime],
	);
}

export function usePlay(): UsePlay {
	const { runtime, enabled } = useMultiplayerContext();
	const state = usePlaySelector(selectState);
	const actions = useActions(runtime);
	const derived = useMemo(
		() => ({
			games: roomSummaryList(state),
			incomingInvites: selectIncoming(state, runtime.serverNow()),
			sentInvites: selectSent(state, runtime.serverNow()),
			yourTurnCount: selectYourTurnCount(state),
		}),
		[state, runtime],
	);
	return {
		...actions,
		...derived,
		enabled,
		connection: state.connection,
		me: state.me,
		timing: state.timing,
		catalog: state.catalog,
		queue: state.queue,
		notices: state.notices,
		lastError: state.lastError,
	};
}

export interface UseRoom {
	/** The table being shown (moves to the rematch table when one opens). */
	roomId: string | null;
	snapshot: RoomSnapshot | null;
	source: RoomSource | null;
	practice: boolean;
	/** Set when the server closed the table. */
	gone: RoomGoneReason | null;
	emotes: Readonly<Record<number, EmoteMark>>;
}

const NO_EMOTES: Readonly<Record<number, EmoteMark>> = Object.freeze({});
const noopSubscribe = () => () => {};

export function useRoom(roomId: string | null | undefined): UseRoom {
	const { runtime } = useMultiplayerContext();
	const practice = isPracticeRoomId(roomId);
	const remote = !!roomId && !practice;

	// A real table follows its rematch chain; a Practice table rematches in
	// place.
	const followed = usePlaySelector((state) => (remote && roomId ? followRematch(state, roomId) : null));
	const effectiveId = remote ? followed : (roomId ?? null);

	usePlayConnection(remote);
	useEffect(() => {
		if (!remote || !effectiveId) return;
		return runtime.watchRoom(effectiveId);
	}, [runtime, remote, effectiveId]);

	// Memoised per id: a Practice table that is left (and forgotten by the
	// runtime) keeps its source for the screen still showing it.
	const source = useMemo(() => (effectiveId ? runtime.roomSource(effectiveId) : null), [runtime, effectiveId]);
	const snapshot = useSyncExternalStore(
		source?.subscribe ?? noopSubscribe,
		() => source?.snapshot ?? null,
		() => source?.snapshot ?? null,
	);
	const emotes = useSyncExternalStore(
		source?.subscribe ?? noopSubscribe,
		() => source?.emotes ?? NO_EMOTES,
		() => source?.emotes ?? NO_EMOTES,
	);
	const gone = usePlaySelector((state) => (remote && effectiveId ? (state.goneRooms[effectiveId] ?? null) : null));
	return { roomId: effectiveId, snapshot, source, practice, gone, emotes };
}

export interface UseQueue {
	queue: QueueState;
	searching: boolean;
	/** Server epoch ms the search began (null when idle). */
	since: number | null;
	/** Offer Practice / by-post after this long in the live queue. */
	practiceOfferMs: number;
	join: (games: GameId[], pace: Pace) => Promise<PlayResult>;
	leave: () => Promise<PlayResult>;
}

export function useQueue(): UseQueue {
	const { runtime } = useMultiplayerContext();
	const queue = usePlaySelector(selectQueue);
	const timing = usePlaySelector(selectTiming);
	return useMemo(
		() => ({
			queue,
			searching: queue.state === "searching",
			since: queue.since,
			practiceOfferMs: timing.practiceOfferMs,
			join: (games: GameId[], pace: Pace) => runtime.joinQueue(games, pace),
			leave: () => runtime.leaveQueue(),
		}),
		[queue, timing, runtime],
	);
}

export interface UseInvites {
	incoming: InviteSummary[];
	sent: InviteSummary[];
	/** Any invite the store knows, open or not. */
	byCode: (code: string) => InviteSummary | null;
	preview: PlayActions["previewInvite"];
	accept: PlayActions["acceptInvite"];
	decline: PlayActions["declineInvite"];
	cancel: PlayActions["cancelInvite"];
	create: PlayActions["createInvite"];
}

export function useInvites(): UseInvites {
	const { runtime } = useMultiplayerContext();
	const state = usePlaySelector(selectState);
	return useMemo(() => {
		const now = runtime.serverNow();
		return {
			incoming: selectIncoming(state, now),
			sent: selectSent(state, now),
			byCode: (code: string) => state.invites[code.toUpperCase()] ?? null,
			preview: (code: string) => runtime.previewInvite(code),
			accept: (code: string) => runtime.acceptInvite(code),
			decline: (code: string) => runtime.declineInvite(code),
			cancel: (code: string) => runtime.cancelInvite(code),
			create: (request: CreateInviteRequest) => runtime.createInvite(request),
		};
	}, [runtime, state]);
}

export interface UsePlayCatalog {
	/** The server's games (empty until the first welcome). */
	catalog: CatalogEntry[];
	/** Server games switched on right now. */
	playable: CatalogEntry[];
	/** Games the app can run as Practice (empty when Practice is off). */
	practiceGames: CatalogEntry[];
	practiceAllowed: boolean;
	asyncAllowed: boolean;
	byId: (id: GameId) => CatalogEntry | null;
}

function localCatalog(): CatalogEntry[] {
	return Object.values(GAMES).map((game) => ({
		id: game.id,
		title: game.title,
		tagline: game.tagline,
		kind: game.kind,
		seats: { ...game.seats },
		paces: [...game.paces],
		rulesVersion: game.rulesVersion,
		enabled: true,
	}));
}

export function usePlayCatalog(): UsePlayCatalog {
	const catalog = usePlaySelector(selectCatalog);
	const { practice: practiceAllowed, async: asyncAllowed } = multiplayerConfig();
	return useMemo(() => {
		const local = localCatalog();
		return {
			catalog,
			playable: catalog.filter((entry) => entry.enabled),
			practiceGames: practiceAllowed ? local : [],
			practiceAllowed,
			asyncAllowed,
			byId: (id: GameId) => catalog.find((entry) => entry.id === id) ?? local.find((entry) => entry.id === id) ?? null,
		};
	}, [catalog, practiceAllowed, asyncAllowed]);
}

export function useServerClock(intervalMs = 250, source?: RoomSource | null): number {
	const { runtime } = useMultiplayerContext();
	const clock = source ? source.now : runtime.serverNow;
	const [now, setNow] = useState(clock);
	useEffect(() => {
		const id = setInterval(() => setNow(clock()), Math.max(16, intervalMs));
		return () => clearInterval(id);
	}, [clock, intervalMs]);
	return now;
}

export type { PlayerCard, EmoteMark, RoomGoneReason, CreateInviteRequest, PracticeRequest };
export { roomEmotes };

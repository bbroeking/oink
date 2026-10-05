// The play store: rev ordering, events-once, invites incoming vs sent, the
// welcome/resume merge, emotes, tombstones, rematch links and selectors.

import {
	INITIAL_PLAY_STATE,
	createPlayStore,
	eventsSince,
	followRematch,
	holdsLiveInterest,
	incomingInvites,
	isMyTurn,
	msLeft,
	playReducer,
	rematchMsLeft,
	roomSummaryList,
	sentInvites,
	serverNow,
	shouldOfferPractice,
	yourTurnCount,
	type PlayAction,
	type PlayState,
} from "../../utils/multiplayer/store";
import {
	DEFAULT_TIMING,
	PROTOCOL_VERSION,
	type InviteSummary,
	type PlayerCard,
	type RoomSnapshot,
	type RoomSummary,
	type ServerMessage,
} from "../../multiplayer/protocol";
import { TEST_LOOK } from "../../multiplayer/testkit";

const NOW = 1_700_000_000_000;
const ME = "user-me";

const card = (userId: string, name: string): PlayerCard => ({ userId, name, look: TEST_LOOK });

function room(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
	return {
		roomId: "0000aaaa-room-1",
		game: "fence_the_pen",
		rulesVersion: 1,
		pace: "live",
		source: "queue",
		phase: "playing",
		seats: [
			{ seat: 0, ...card(ME, "Rosie"), connected: true, gone: false },
			{ seat: 1, ...card("user-2", "Copper"), connected: true, gone: false },
		],
		seatCount: 2,
		you: 0,
		view: { board: [] },
		activeSeats: [0],
		deadline: NOW + 10_000,
		startsAt: null,
		rev: 3,
		events: [{ type: "fence", seat: 1 }],
		result: null,
		invite: null,
		rematch: null,
		host: null,
		...overrides,
	};
}

function invite(overrides: Partial<InviteSummary> = {}): InviteSummary {
	return {
		code: "ABCD2345",
		url: "https://ticklethepig.com/play/ABCD2345",
		game: "mud_volley",
		pace: "live",
		kind: "direct",
		from: card("user-2", "Copper"),
		to: [ME],
		status: "open",
		roomId: null,
		seatsTaken: 1,
		seatsMax: 2,
		expiresAt: NOW + 15 * 60_000,
		...overrides,
	};
}

function summary(overrides: Partial<RoomSummary> = {}): RoomSummary {
	return {
		roomId: "0000bbbb-room-2",
		game: "rootle",
		pace: "async",
		phase: "playing",
		yourTurn: false,
		opponents: [card("user-3", "Pepper")],
		deadline: null,
		updatedAt: NOW - 1_000,
		...overrides,
	};
}

function welcome(overrides: Partial<Extract<ServerMessage, { t: "welcome" }>> = {}): ServerMessage {
	return {
		t: "welcome",
		userId: ME,
		name: "Rosie",
		serverNow: NOW,
		protocol: PROTOCOL_VERSION,
		timing: { ...DEFAULT_TIMING, practiceOfferMs: 12_000 },
		catalog: [
			{ id: "mud_volley", title: "Mud Volley", tagline: "Flick it.", kind: "competitive", seats: { min: 2, max: 2 }, paces: ["live"], rulesVersion: 1, enabled: true },
		],
		resume: { queue: { state: "idle", games: [], pace: "live", since: null }, rooms: [], invites: [] },
		...overrides,
	};
}

const server = (message: ServerMessage, at = NOW): PlayAction => ({ type: "server", message, at });
const reduce = (state: PlayState, ...actions: PlayAction[]) => actions.reduce(playReducer, state);
const signedIn = () => reduce(INITIAL_PLAY_STATE, server(welcome()));

describe("rooms: highest rev wins", () => {
	it("keeps the newest snapshot and drops older or equal ones whole", () => {
		const s1 = reduce(signedIn(), server({ t: "room.state", room: room({ rev: 5 }) }));
		expect(s1.rooms["0000aaaa-room-1"].rev).toBe(5);
		const older = playReducer(s1, server({ t: "room.state", room: room({ rev: 4, events: [{ type: "old" }] }) }));
		expect(older).toBe(s1);
		// A re-sent snapshot of the same rev (after a reconnect) changes nothing,
		// so its events cannot play twice.
		const resent = playReducer(s1, server({ t: "room.state", room: room({ rev: 5, events: [{ type: "fence", seat: 1 }] }) }));
		expect(resent).toBe(s1);
		const newer = playReducer(s1, server({ t: "room.state", room: room({ rev: 7 }) }));
		expect(newer.rooms["0000aaaa-room-1"].rev).toBe(7);
	});

	it("hands the UI each rev's events once", () => {
		const r5 = room({ rev: 5, events: [{ type: "fence", seat: 1 }] });
		expect(eventsSince(r5, null)).toEqual([{ type: "fence", seat: 1 }]);
		expect(eventsSince(r5, 4)).toEqual([{ type: "fence", seat: 1 }]);
		expect(eventsSince(r5, 5)).toEqual([]);
		expect(eventsSince(null, 1)).toEqual([]);
	});

	it("keeps 'Your games' current from snapshots I sit in, but not from previews", () => {
		const s = reduce(signedIn(), server({ t: "room.state", room: room({ rev: 2, activeSeats: [0] }) }, NOW + 5));
		expect(s.roomSummaries["0000aaaa-room-1"]).toMatchObject({ yourTurn: true, phase: "playing", updatedAt: NOW + 5 });
		expect(s.roomSummaries["0000aaaa-room-1"].opponents.map((o) => o.name)).toEqual(["Copper"]);
		const preview = reduce(signedIn(), { type: "room", room: room({ roomId: "0000cccc-lobby", you: null, phase: "lobby" }), at: NOW });
		expect(preview.rooms["0000cccc-lobby"]).toBeDefined();
		expect(preview.roomSummaries["0000cccc-lobby"]).toBeUndefined();
	});

	it("records a lobby's invite from the snapshot", () => {
		const s = reduce(signedIn(), server({ t: "room.state", room: room({ phase: "lobby", invite: invite({ from: card(ME, "Rosie"), to: [] }) }) }));
		expect(s.invites.ABCD2345.from.userId).toBe(ME);
	});

	it("tombstones a gone table and drops it from Your games", () => {
		const s = reduce(
			signedIn(),
			server({ t: "room.state", room: room() }),
			server({ t: "room.gone", roomId: "0000aaaa-room-1", reason: "expired" }),
		);
		expect(s.goneRooms["0000aaaa-room-1"]).toBe("expired");
		expect(s.roomSummaries["0000aaaa-room-1"]).toBeUndefined();
		// The table coming back (a newer rev) clears the tombstone.
		const back = playReducer(s, server({ t: "room.state", room: room({ rev: 9 }) }));
		expect(back.goneRooms["0000aaaa-room-1"]).toBeUndefined();
	});

	it("forgets a table I left without blanking its snapshot", () => {
		const s = reduce(signedIn(), server({ t: "room.state", room: room() }), { type: "forgetRoom", roomId: "0000aaaa-room-1" });
		expect(s.roomSummaries["0000aaaa-room-1"]).toBeUndefined();
		expect(s.rooms["0000aaaa-room-1"]).toBeDefined();
		expect(s.goneRooms["0000aaaa-room-1"]).toBe("left");
	});

	it("keeps a table I left out of Your games when its final snapshot arrives", () => {
		const left = room({ rev: 8, phase: "ended", activeSeats: [], result: { kind: "win", winners: [1], scores: [], summary: "", reason: "forfeit" } });
		left.seats = [{ ...left.seats[0], gone: true, connected: false }, left.seats[1]];
		const s = reduce(
			signedIn(),
			server({ t: "room.state", room: room() }),
			{ type: "forgetRoom", roomId: "0000aaaa-room-1" },
			server({ t: "room.state", room: left }),
		);
		expect(s.rooms["0000aaaa-room-1"].rev).toBe(8);
		expect(s.roomSummaries["0000aaaa-room-1"]).toBeUndefined();
		expect(s.goneRooms["0000aaaa-room-1"]).toBe("left");
	});

	it("links a rematch table to the finished table with the same pigs", () => {
		const ended = room({ phase: "ended", rev: 20, activeSeats: [], result: { kind: "win", winners: [0], scores: [3, 1], summary: "3 to 1", reason: "complete" } });
		const next = room({ roomId: "0000dddd-rematch", source: "rematch", phase: "starting", rev: 1, startsAt: NOW + 3_000 });
		const s = reduce(signedIn(), server({ t: "room.state", room: ended }), server({ t: "room.state", room: next }));
		expect(s.successors["0000aaaa-room-1"]).toBe("0000dddd-rematch");
		expect(followRematch(s, "0000aaaa-room-1")).toBe("0000dddd-rematch");
		expect(followRematch(s, "0000dddd-rematch")).toBe("0000dddd-rematch");
		// An explicit link (from an ack) wins too, and a loop cannot hang.
		const looped = reduce(s, { type: "rematchLink", from: "0000dddd-rematch", to: "0000aaaa-room-1" });
		expect(["0000aaaa-room-1", "0000dddd-rematch"]).toContain(followRematch(looped, "0000aaaa-room-1"));
	});
});

describe("invites: incoming vs sent", () => {
	it("counts a direct invite naming me, never one I sent", () => {
		const s = reduce(
			signedIn(),
			server({ t: "invite.state", invite: invite() }),
			server({ t: "invite.state", invite: invite({ code: "MINE2345", from: card(ME, "Rosie"), to: ["user-2"] }) }),
			server({ t: "invite.state", invite: invite({ code: "OTHR2345", to: ["user-9"] }) }),
		);
		expect(incomingInvites(s).map((i) => i.code)).toEqual(["ABCD2345"]);
		expect(sentInvites(s).map((i) => i.code)).toEqual(["MINE2345"]);
	});

	it("counts a link or crew invite as incoming only once I previewed it", () => {
		const link = invite({ code: "LINK2345", kind: "link", to: [] });
		const crew = invite({ code: "CREW2345", kind: "crew", to: [] });
		let s = reduce(signedIn(), server({ t: "invite.state", invite: link }), server({ t: "invite.state", invite: crew }));
		expect(incomingInvites(s)).toEqual([]);
		s = reduce(s, { type: "invite", invite: link, previewed: true });
		expect(incomingInvites(s).map((i) => i.code)).toEqual(["LINK2345"]);
		s = reduce(s, { type: "invite", invite: crew, previewed: true });
		expect(incomingInvites(s).map((i) => i.code).sort()).toEqual(["CREW2345", "LINK2345"]);
	});

	it("drops invites that are no longer open, or lapsed by the server clock", () => {
		const s = reduce(
			signedIn(),
			server({ t: "invite.state", invite: invite({ code: "OPEN2345", expiresAt: NOW + 60_000 }) }),
			server({ t: "invite.state", invite: invite({ code: "TAKN2345", status: "accepted" }) }),
			server({ t: "invite.state", invite: invite({ code: "SOON2345", expiresAt: NOW + 1_000 }) }),
		);
		expect(incomingInvites(s).map((i) => i.code)).toEqual(["OPEN2345", "SOON2345"]);
		expect(incomingInvites(s, NOW + 5_000).map((i) => i.code)).toEqual(["OPEN2345"]);
	});

	it("has no incoming invites before the welcome says who I am", () => {
		const s = reduce(INITIAL_PLAY_STATE, server({ t: "invite.state", invite: invite() }));
		expect(incomingInvites(s)).toEqual([]);
	});
});

describe("welcome", () => {
	it("takes me, timing, catalog, queue, Your games and invites from the resume", () => {
		const s = reduce(
			INITIAL_PLAY_STATE,
			server(
				welcome({
					resume: {
						queue: { state: "searching", games: ["mud_volley"], pace: "live", since: NOW - 3_000 },
						rooms: [summary()],
						invites: [invite()],
					},
				}),
			),
		);
		expect(s.me).toEqual({ userId: ME, name: "Rosie" });
		expect(s.timing.practiceOfferMs).toBe(12_000);
		expect(s.catalog.map((c) => c.id)).toEqual(["mud_volley"]);
		expect(s.queue.state).toBe("searching");
		expect(Object.keys(s.roomSummaries)).toEqual(["0000bbbb-room-2"]);
		expect(incomingInvites(s).map((i) => i.code)).toEqual(["ABCD2345"]);
	});

	it("keeps invites I only previewed across a reconnect, and replaces the rest", () => {
		const link = invite({ code: "LINK2345", kind: "link", to: [] });
		let s = reduce(signedIn(), { type: "invite", invite: link, previewed: true }, server({ t: "invite.state", invite: invite({ code: "GONE2345" }) }));
		s = reduce(s, server(welcome()));
		expect(Object.keys(s.invites)).toEqual(["LINK2345"]);
	});

	it("starts from nothing when a different account is welcomed", () => {
		let s = reduce(signedIn(), server({ t: "room.state", room: room() }));
		s = reduce(s, server(welcome({ userId: "someone-else", name: "Pickles" })));
		expect(s.me?.userId).toBe("someone-else");
		expect(s.rooms).toEqual({});
	});
});

describe("emotes, notices, errors, reset", () => {
	it("keeps the latest emote per room and seat", () => {
		let s = reduce(signedIn(), server({ t: "room.emote", roomId: "r1", seat: 1, emote: "oink", at: NOW + 10 }));
		s = reduce(s, server({ t: "room.emote", roomId: "r1", seat: 1, emote: "wow", at: NOW + 5 })); // older: ignored
		s = reduce(s, { type: "emote", roomId: "r1", seat: 0, emote: "gg", at: NOW + 20 });
		expect(s.emotes.r1).toEqual({ 0: { emote: "gg", at: NOW + 20 }, 1: { emote: "oink", at: NOW + 10 } });
	});

	it("collects notices, records unsolicited errors, and resets everything but the connection", () => {
		let s = reduce(
			signedIn(),
			{ type: "connection", connection: { status: "open", reason: null, attempt: 0, retryAt: null } },
			server({ t: "notice", kind: "server_restarting", message: "brb" }, NOW + 1),
			server({ t: "error", error: "rate_limited" }, NOW + 2),
		);
		expect(s.notices).toEqual([{ kind: "server_restarting", message: "brb", at: NOW + 1 }]);
		expect(s.lastError).toEqual({ error: "rate_limited", message: null, at: NOW + 2 });
		s = reduce(s, { type: "dismissNotice", at: NOW + 1 }, { type: "clearError" });
		expect(s.notices).toEqual([]);
		expect(s.lastError).toBeNull();
		s = reduce(s, { type: "reset" });
		expect(s.me).toBeNull();
		expect(s.connection.status).toBe("open");
	});

	it("ignores acks and pongs, and returns the same state for no-op actions", () => {
		const s = signedIn();
		expect(playReducer(s, server({ t: "ack", rid: 1, ok: true }))).toBe(s);
		expect(playReducer(s, server({ t: "pong", ct: 1, st: 2 }))).toBe(s);
		expect(playReducer(s, { type: "clearError" })).toBe(s);
		expect(playReducer(s, { type: "clock", offsetMs: 0, rttMs: null })).toBe(s);
	});
});

describe("selectors", () => {
	it("serverNow adds the measured offset", () => {
		const s = reduce(signedIn(), { type: "clock", offsetMs: 2_500, rttMs: 80 });
		expect(serverNow(s, NOW)).toBe(NOW + 2_500);
	});

	it("msLeft reads the deadline in play, the countdown while starting, nothing otherwise", () => {
		expect(msLeft(room({ deadline: NOW + 4_000 }), NOW)).toBe(4_000);
		expect(msLeft(room({ deadline: NOW - 50 }), NOW)).toBe(0);
		expect(msLeft(room({ deadline: null }), NOW)).toBeNull();
		expect(msLeft(room({ phase: "starting", deadline: null, startsAt: NOW + 3_000 }), NOW)).toBe(3_000);
		expect(msLeft(room({ phase: "ended", deadline: null }), NOW)).toBeNull();
		expect(msLeft(null, NOW)).toBeNull();
		expect(rematchMsLeft(room({ phase: "ended", rematch: { votes: [0], until: NOW + 30_000 } }), NOW + 10_000)).toBe(20_000);
		expect(rematchMsLeft(room(), NOW)).toBeNull();
	});

	it("isMyTurn needs play, my seat among the active, and me still at the table", () => {
		expect(isMyTurn(room({ activeSeats: [0] }))).toBe(true);
		expect(isMyTurn(room({ activeSeats: [1] }))).toBe(false);
		expect(isMyTurn(room({ activeSeats: [0], phase: "ended" }))).toBe(false);
		expect(isMyTurn(room({ activeSeats: [0], you: null }))).toBe(false);
		const gone = room({ activeSeats: [0] });
		gone.seats = [{ ...gone.seats[0], gone: true }, gone.seats[1]];
		expect(isMyTurn(gone)).toBe(false);
	});

	it("yourTurnCount counts summaries, with a held snapshot overriding its summary", () => {
		let s = reduce(
			signedIn(),
			server({
				t: "rooms",
				rooms: [
					summary({ roomId: "0000aaaa-room-1", yourTurn: false, pace: "live" }),
					summary({ roomId: "0000bbbb-room-2", yourTurn: true }),
					summary({ roomId: "0000eeee-room-3", yourTurn: true, phase: "ended" }),
				],
			}),
		);
		expect(yourTurnCount(s)).toBe(1);
		s = reduce(s, server({ t: "room.state", room: room({ activeSeats: [0] }) }));
		expect(yourTurnCount(s)).toBe(2);
		expect(roomSummaryList(s).map((r) => r.roomId).slice(0, 2).sort()).toEqual(["0000aaaa-room-1", "0000bbbb-room-2"]);
		expect(roomSummaryList(s).every((r, i, list) => i === 0 || Number(list[i - 1].yourTurn) >= Number(r.yourTurn))).toBe(true);
	});

	it("holds live interest while searching or seated at an unfinished live table", () => {
		const idle = signedIn();
		expect(holdsLiveInterest(idle)).toBe(false);
		const searching = reduce(idle, server({ t: "queue.state", queue: { state: "searching", games: ["mud_volley"], pace: "live", since: NOW } }));
		expect(holdsLiveInterest(searching)).toBe(true);
		const seated = reduce(idle, server({ t: "room.state", room: room() }));
		expect(holdsLiveInterest(seated)).toBe(true);
		const ended = reduce(idle, server({ t: "room.state", room: room({ phase: "ended", activeSeats: [], deadline: null }) }));
		expect(holdsLiveInterest(ended)).toBe(false);
		const byPost = reduce(idle, server({ t: "room.state", room: room({ pace: "async" }) }));
		expect(holdsLiveInterest(byPost)).toBe(false);
	});

	it("offers Practice after practiceOfferMs in the live queue", () => {
		const s = reduce(signedIn(), server({ t: "queue.state", queue: { state: "searching", games: ["mud_volley"], pace: "live", since: NOW } }));
		expect(shouldOfferPractice(s, NOW + 11_999)).toBe(false);
		expect(shouldOfferPractice(s, NOW + 12_000)).toBe(true);
		const byPost = reduce(s, server({ t: "queue.state", queue: { state: "searching", games: ["rootle"], pace: "async", since: NOW } }));
		expect(shouldOfferPractice(byPost, NOW + 60_000)).toBe(false);
	});
});

describe("createPlayStore", () => {
	it("notifies subscribers only when the state actually changes", () => {
		const store = createPlayStore();
		const seen: PlayState[] = [];
		const off = store.subscribe(() => seen.push(store.getState()));
		store.dispatch(server(welcome()));
		store.dispatch({ type: "clearError" }); // no-op
		store.dispatch(server({ t: "room.state", room: room() }));
		store.dispatch(server({ t: "room.state", room: room() })); // same rev: no-op
		expect(seen).toHaveLength(2);
		off();
		store.dispatch({ type: "reset" });
		expect(seen).toHaveLength(2);
	});
});

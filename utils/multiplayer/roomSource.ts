// RoomSource: the one interface a match screen draws from. A real table
// (RemoteRoomSource, over PlayClient + the play store) and a Practice table
// (LocalRoomSource in ./localRoom.ts, the shared engine plus bot pigs) look
// the same from the screen; only `practice` tells them apart.
//
// Reading: `snapshot` and `emotes` are stable references that change only
// when the table does, so a screen can hand `subscribe` and a getter straight
// to useSyncExternalStore. Clock: `now()` is the table's clock (server time
// for a real table, the device clock for Practice); compare it with the
// snapshot's deadline / startsAt / rematch.until, never with Date.now().
// Animations: play `snapshot.events` once per `${snapshot.roomId}:${rev}`.

import type { Emote, ProtocolErrorCode, RoomSnapshot } from "@/multiplayer/protocol";
import { isPlayRequestError, type PlayRequest } from "./client";
import { roomEmotes, type EmoteMark, type PlayStore } from "./store";

/** What `act` resolves with. Matches components/play/types.ts ActResult. */
export type ActResult = { ok: true } | { ok: false; error: ProtocolErrorCode };

export interface RoomSource<V = unknown> {
	/** The table this source was opened on. */
	readonly roomId: string;
	/** True for a Practice table (a bot pig plays the other seats). */
	readonly practice: boolean;
	/** The latest snapshot, or null before the first one arrives. */
	readonly snapshot: RoomSnapshot<V> | null;
	/** The latest emote per seat. */
	readonly emotes: Readonly<Record<number, EmoteMark>>;
	/** Called after any change to `snapshot` or `emotes`. Returns unsubscribe. */
	subscribe(listener: () => void): () => void;
	/** The table's clock, epoch ms. */
	now(): number;
	/** Send an action for my seat. Resolves when the table answers; the new
	 *  view arrives separately (through `subscribe`). Never rejects. */
	act(action: unknown): Promise<ActResult>;
	/** A sticker reaction. Fire-and-forget; repeats inside the cooldown are
	 *  dropped quietly. */
	emote(emote: Emote): void;
	/** Leave the table (a forfeit mid-game, a goodbye at the end). Never
	 *  rejects; leaving always succeeds from the player's side. */
	leave(): Promise<void>;
	/** Vote for a rematch. Rejects with a PlayRequestError (`code`) when the
	 *  table has moved on. */
	rematch(): Promise<void>;
	/** Host: start a lobby early. Rejects with a PlayRequestError on refusal. */
	start(): Promise<void>;
}

/**
 * A request failure as a ProtocolErrorCode. The client-side failures
 * (offline, timeout, a dropped socket) have no protocol code of their own;
 * they surface as "internal", whose copy reads as "that did not go
 * through, try again", and the screen's connection banner tells the rest.
 */
export function toProtocolError(error: unknown): ProtocolErrorCode {
	if (!isPlayRequestError(error)) return "internal";
	switch (error.code) {
		case "offline":
		case "timeout":
		case "disconnected":
			return "internal";
		default:
			return error.code;
	}
}

export interface RemoteRoomDeps {
	store: PlayStore;
	request: (message: PlayRequest) => Promise<unknown>;
	send: (message: PlayRequest) => boolean;
	/** Server clock, epoch ms. */
	serverNow: () => number;
	/** Local clock for the emote cooldown. Defaults to Date.now. */
	now?: () => number;
}

/** A rematch ack may carry the new table's id; take it when it does. */
function roomIdFromAck(data: unknown): string | null {
	if (typeof data !== "object" || data === null) return null;
	const d = data as Record<string, unknown>;
	if (typeof d.roomId === "string" && d.roomId.length > 0) return d.roomId;
	const room = d.room as Record<string, unknown> | undefined;
	return room && typeof room.roomId === "string" ? room.roomId : null;
}

export class RemoteRoomSource implements RoomSource {
	readonly roomId: string;
	readonly practice = false;
	private readonly deps: RemoteRoomDeps;
	private lastEmoteAt = Number.NEGATIVE_INFINITY;

	constructor(roomId: string, deps: RemoteRoomDeps) {
		this.roomId = roomId;
		this.deps = deps;
	}

	get snapshot(): RoomSnapshot | null {
		return this.deps.store.getState().rooms[this.roomId] ?? null;
	}

	get emotes(): Readonly<Record<number, EmoteMark>> {
		return roomEmotes(this.deps.store.getState(), this.roomId);
	}

	subscribe = (listener: () => void): (() => void) => {
		let room = this.snapshot;
		let emotes = this.emotes;
		return this.deps.store.subscribe(() => {
			const nextRoom = this.snapshot;
			const nextEmotes = this.emotes;
			if (nextRoom === room && nextEmotes === emotes) return;
			room = nextRoom;
			emotes = nextEmotes;
			listener();
		});
	};

	now = (): number => this.deps.serverNow();

	act = async (action: unknown): Promise<ActResult> => {
		const snapshot = this.snapshot;
		if (!snapshot) return { ok: false, error: "not_found" };
		try {
			await this.deps.request({ t: "room.action", roomId: this.roomId, rev: snapshot.rev, action });
			return { ok: true };
		} catch (error) {
			return { ok: false, error: toProtocolError(error) };
		}
	};

	emote = (emote: Emote): void => {
		const snapshot = this.snapshot;
		if (!snapshot || snapshot.you === null) return;
		const localNow = (this.deps.now ?? Date.now)();
		const cooldown = this.deps.store.getState().timing.emoteCooldownMs;
		if (localNow - this.lastEmoteAt < cooldown) return;
		if (!this.deps.send({ t: "room.emote", roomId: this.roomId, emote })) return;
		this.lastEmoteAt = localNow;
		// Echo it on my pig now; the server's broadcast (if it comes back to
		// me) lands on the same seat a beat later.
		this.deps.store.dispatch({ type: "emote", roomId: this.roomId, seat: snapshot.you, emote, at: this.deps.serverNow() });
	};

	leave = async (): Promise<void> => {
		try {
			await this.deps.request({ t: "room.leave", roomId: this.roomId });
		} catch {
			// Leaving is best-effort: an offline leave lapses into the server's
			// reconnect grace and resolves the same way.
		}
		this.deps.store.dispatch({ type: "forgetRoom", roomId: this.roomId });
	};

	rematch = async (): Promise<void> => {
		const data = await this.deps.request({ t: "room.rematch", roomId: this.roomId });
		const next = roomIdFromAck(data);
		if (next) this.deps.store.dispatch({ type: "rematchLink", from: this.roomId, to: next });
	};

	start = async (): Promise<void> => {
		await this.deps.request({ t: "room.start", roomId: this.roomId });
	};
}

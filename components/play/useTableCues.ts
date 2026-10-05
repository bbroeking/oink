// The table's per-revision cues, played once each (RoomSource contract: play
// `snapshot.events` once per `${roomId}:${rev}`).
//
//   useFreshEvents  the events the board should play: this revision's cues,
//                   or nothing for the first snapshot the screen sees of a
//                   table (a mid-game mount, a table reopened from the hub),
//                   whose cues are old news.
//   useSeatReactions  GameUI.reactions turned into each seat pig's one-shot
//                   reaction (dropped under Reduce Motion) and resting mood
//                   (held for a beat, then the pig settles).
//
// Both adjust state during render (the React-sanctioned way to derive state
// from a changing prop) so nothing here sets state from an effect body.

import { useCallback, useEffect, useState } from "react";
import type { PigReaction } from "@/components/ui";
import type { RoomSnapshot } from "@/multiplayer/protocol";
import type { GameEvent, Seat } from "@/multiplayer/types";
import type { GameUI, SeatReaction } from "./types";
import { MOOD_HOLD_MS } from "./layout";

const NO_EVENTS: GameEvent[] = [];

/** True when `room` is a revision this screen saw arrive (not the first
 *  snapshot it was handed of this table). */
export function useFreshEvents(room: RoomSnapshot | null): { events: GameEvent[]; fresh: boolean } {
	const [baseline, setBaseline] = useState<{ roomId: string; rev: number } | null>(room ? { roomId: room.roomId, rev: room.rev } : null);
	const stale = !!room && (!baseline || baseline.roomId !== room.roomId);
	if (stale && room) setBaseline({ roomId: room.roomId, rev: room.rev });
	const fresh = !!room && !stale && !!baseline && room.rev > baseline.rev;
	return { events: fresh && room ? room.events : NO_EVENTS, fresh };
}

type Mood = NonNullable<SeatReaction["mood"]>;

interface PigCues {
	n: number;
	reactions: Partial<Record<Seat, PigReaction>>;
	moods: Partial<Record<Seat, Mood>>;
}

const NO_CUES: PigCues = { n: 0, reactions: {}, moods: {} };

export interface SeatReactions {
	reactionOf: (seat: Seat) => PigReaction | null;
	moodOf: (seat: Seat) => Mood | null;
	done: (seat: Seat) => void;
}

export function useSeatReactions(
	room: RoomSnapshot | null,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	ui: GameUI<any> | null,
	fresh: boolean,
	reduceMotion: boolean,
): SeatReactions {
	const key = room ? `${room.roomId}:${room.rev}` : null;
	const [seen, setSeen] = useState<string | null>(key);
	const [cues, setCues] = useState<PigCues>(NO_CUES);
	if (key !== seen) {
		setSeen(key);
		if (fresh && room && ui?.reactions && room.events.length > 0) {
			let out: Partial<Record<Seat, SeatReaction>> = {};
			try {
				out = ui.reactions(room.events, room) ?? {};
			} catch {
				out = {};
			}
			let n = cues.n;
			const reactions = { ...cues.reactions };
			const moods = { ...cues.moods };
			for (const [seatKey, reaction] of Object.entries(out)) {
				const seat = Number(seatKey);
				if (!reaction || !Number.isInteger(seat)) continue;
				if (reaction.kind && !reduceMotion) {
					n += 1;
					reactions[seat] = { id: n, kind: reaction.kind };
				}
				if (reaction.mood) moods[seat] = reaction.mood;
			}
			setCues({ n, reactions, moods });
		}
	}

	// A mood is a beat, not a state: the pigs settle once it has been read.
	const moods = cues.moods;
	useEffect(() => {
		if (Object.keys(moods).length === 0) return;
		const timer = setTimeout(() => setCues((c) => (c.moods === moods ? { ...c, moods: {} } : c)), MOOD_HOLD_MS);
		return () => clearTimeout(timer);
	}, [moods]);

	const done = useCallback((seat: Seat) => {
		setCues((c) => {
			if (!c.reactions[seat]) return c;
			const reactions = { ...c.reactions };
			delete reactions[seat];
			return { ...c, reactions };
		});
	}, []);

	return {
		reactionOf: (seat) => cues.reactions[seat] ?? null,
		moodOf: (seat) => cues.moods[seat] ?? null,
		done,
	};
}

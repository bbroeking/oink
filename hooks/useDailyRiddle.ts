// The Sheep's Riddle on this device: today's deal, the day's play and the
// solved tally, kept in AsyncStorage (one record, replaced each move) so
// reopening the riddle, or the app, keeps the result. No server in v1.
//
// The book lives in one module-level copy shared by every mounted reader
// (the riddle page and the Barn button's fan row), so a guess on the page is
// on the fan the moment the page closes. Moves are computed from that copy
// synchronously, so two fast taps can never both land as "the first guess".
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PictureId } from "@/multiplayer/games/snout_says/deck";
import {
	dealRiddle,
	guessInBook,
	openBook,
	revealInBook,
	riddleOutcome,
	serializeBook,
	utcDayKey,
	type DailyRiddle,
	type RiddleBook,
	type RiddleOutcome,
} from "@/utils/dailyRiddle";

export const RIDDLE_STORAGE_KEY = "daily_riddle_v1";

let current: RiddleBook | null = null;
const listeners = new Set<(book: RiddleBook) => void>();

function publish(book: RiddleBook): void {
	current = book;
	for (const listener of listeners) listener(book);
}

async function loadBook(riddle: DailyRiddle): Promise<RiddleBook> {
	if (current && current.play.day === riddle.day) return current;
	let raw: string | null = null;
	try {
		raw = await AsyncStorage.getItem(RIDDLE_STORAGE_KEY);
	} catch {
		raw = null;
	}
	// Another reader may have moved while this one read.
	if (current && current.play.day === riddle.day) return current;
	return openBook(raw, riddle);
}

function commit(book: RiddleBook): void {
	publish(book);
	AsyncStorage.setItem(RIDDLE_STORAGE_KEY, serializeBook(book)).catch(() => {});
}

/** Test seam: forget the shared copy (AsyncStorage is reset by the test). */
export function resetDailyRiddleCache(): void {
	current = null;
}

export interface DailyRiddleState {
	riddle: DailyRiddle;
	/** Null until the stored record has been read. */
	book: RiddleBook | null;
	outcome: RiddleOutcome;
	reveal: () => void;
	/** Guess a picture. Returns the riddle's outcome after it, or null when
	 *  the guess did not land (already over, a repeat, not one of the nine). */
	guess: (picture: PictureId) => RiddleOutcome | null;
}

export function useDailyRiddle(): DailyRiddleState {
	// The UTC day, re-read whenever the app comes back to the front, so a
	// riddle left open over midnight turns over on return.
	const [day, setDay] = useState(() => utcDayKey());
	useEffect(() => {
		const sub = AppState.addEventListener("change", (state) => {
			if (state === "active") setDay(utcDayKey());
		});
		return () => sub.remove();
	}, []);
	const riddle = useMemo(() => dealRiddle(day), [day]);

	const [book, setBook] = useState<RiddleBook | null>(() =>
		current && current.play.day === day ? current : null,
	);
	useEffect(() => {
		let live = true;
		const onChange = (next: RiddleBook) => {
			if (live && next.play.day === riddle.day) setBook(next);
		};
		listeners.add(onChange);
		void loadBook(riddle).then((loaded) => {
			if (!live) return;
			if (!current || current.play.day !== riddle.day) current = loaded;
			setBook(current);
		});
		return () => {
			live = false;
			listeners.delete(onChange);
		};
	}, [riddle]);

	const reveal = useCallback(() => {
		if (!current || current.play.day !== riddle.day) return;
		const next = revealInBook(riddle, current);
		if (next !== current) commit(next);
	}, [riddle]);

	const guess = useCallback(
		(picture: PictureId): RiddleOutcome | null => {
			if (!current || current.play.day !== riddle.day) return null;
			const next = guessInBook(riddle, current, picture);
			if (next === current) return null;
			commit(next);
			return riddleOutcome(riddle, next.play);
		},
		[riddle],
	);

	const shown = book && book.play.day === riddle.day ? book : null;
	return {
		riddle,
		book: shown,
		outcome: shown ? riddleOutcome(riddle, shown.play) : "playing",
		reveal,
		guess,
	};
}

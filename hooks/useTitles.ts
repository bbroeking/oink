// Titles, for the picker (the shop-IA pass, 2026-09-17).
//
// The Closet used to carry a `TitlesSection` footer at the bottom of the whole
// catalog, and the pig's nameplate chip jumped ~3,000pt to reach it. The
// nameplate opens a sheet now, so the query that fed that footer lives here
// instead: what you have EARNED (`user_titles`), and the whole board of titles
// (`titles`) so the picker's "Not yet" tab can show the ones still out there.
// Titles are earned, never sold (20260677) — there is no price anywhere in it.
//
// The two list rules are pure, so the worn-first order and the search are
// testable without mounting a sheet.
import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router/react-navigation";
import { supabase } from "@/utils/supabase";
import type { TitleRow } from "@/constants/title_types";

interface OwnedRow {
	title_id: string;
	titles: TitleRow;
}

export interface UseTitles {
	/** The titles this player has earned. */
	owned: TitleRow[];
	/** Every title there is — the "Not yet" tab subtracts `owned` from it. */
	catalog: TitleRow[];
	loading: boolean;
	refresh: () => Promise<void>;
}

/** Worn first, then A–Z. The one you are wearing is the one you look for. */
export function sortTitles(
	rows: readonly TitleRow[],
	activeId: string | null,
): TitleRow[] {
	return [...rows].sort((a, b) => {
		if (a.id === activeId) return -1;
		if (b.id === activeId) return 1;
		return a.name.localeCompare(b.name);
	});
}

/** Search by name only — a title's how-earned line is prose, not an index. */
export function filterTitles(
	rows: readonly TitleRow[],
	query: string,
): TitleRow[] {
	const needle = query.trim().toLowerCase();
	if (!needle) return [...rows];
	return rows.filter((row) => row.name.toLowerCase().includes(needle));
}

/** The titles still out there: the board minus what you already wear. */
export function unearnedTitles(
	catalog: readonly TitleRow[],
	owned: readonly TitleRow[],
): TitleRow[] {
	const mine = new Set(owned.map((row) => row.id));
	return catalog.filter((row) => !mine.has(row.id));
}

export function useTitles(userId: string | null): UseTitles {
	const [owned, setOwned] = useState<TitleRow[]>([]);
	const [catalog, setCatalog] = useState<TitleRow[]>([]);
	const [loading, setLoading] = useState(false);

	const refresh = useCallback(async () => {
		if (!userId) {
			setOwned([]);
			setCatalog([]);
			return;
		}
		setLoading(true);
		// `user_titles` arrived with the 20260511 migration. On a client running
		// against a database that has not taken it yet the query 404s — the
		// picker then simply has nothing earned, rather than an error.
		const [mine, board] = await Promise.all([
			supabase
				.from("user_titles")
				.select("title_id, titles(id, name, placement, description)")
				// A nested-join select makes PostgREST infer a parser-error row
				// shape; declare the known row type through the builder instead.
				.eq("user_id", userId)
				.returns<OwnedRow[]>(),
			supabase
				.from("titles")
				.select("id, name, placement, description")
				.returns<TitleRow[]>(),
		]);
		setOwned(
			mine.error
				? []
				: (mine.data ?? [])
						.map((row) => row.titles)
						.filter((row): row is TitleRow => !!row),
		);
		setCatalog(board.error ? [] : (board.data ?? []));
		setLoading(false);
	}, [userId]);

	// On focus, like the roster: a title earned while the player was away shows
	// up when they come back, without a manual reload.
	useFocusEffect(
		useCallback(() => {
			void refresh();
		}, [refresh]),
	);

	return useMemo(
		() => ({ owned, catalog, loading, refresh }),
		[owned, catalog, loading, refresh],
	);
}

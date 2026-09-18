// The errand picker's targets: every friend's pig's live wish (the Satchel's
// friend_wishes, no new social RPC), the friend's name and pig for the row,
// and my own pig's wish. Read once per open; fail-soft to empty lists (a
// server without the bag draws an "anything" row and nothing else).
import { useCallback, useState } from "react";
import { fetchFriendWishes, fetchMySatchel, type FriendWish, type PigWish, type SatchelItem } from "@/utils/satchel";
import { getFriendIds } from "@/utils/friendships";
import { supabase } from "@/utils/supabase";
import { isPigId, type PigId } from "@/utils/pigs";

export interface FriendWishTarget {
	friendId: string;
	name: string;
	pigId: PigId;
	wish: FriendWish;
}

export interface WishTargets {
	friends: FriendWishTarget[];
	/** Every friend's name and pig, wish or no wish — for the pins and the
	 *  out lines that name who an errand is for. */
	names: Map<string, { name: string; pigId: PigId }>;
	/** My pig's own wish, when the server named one. */
	mine: PigWish | null;
	/** My bag, so a row can say "you have it". */
	bag: SatchelItem[];
}

const EMPTY: WishTargets = { friends: [], names: new Map(), mine: null, bag: [] };

interface ProfileRow {
	id: string;
	username: string | null;
	active_pig_id: string | null;
	is_vip: boolean | null;
}

export function useFriendWishTargets(): {
	targets: WishTargets;
	loading: boolean;
	loaded: boolean;
	load: () => Promise<WishTargets>;
} {
	const [targets, setTargets] = useState<WishTargets>(EMPTY);
	const [loading, setLoading] = useState(false);
	const [loaded, setLoaded] = useState(false);

	const load = useCallback(async (): Promise<WishTargets> => {
		setLoading(true);
		const ids = (await getFriendIds()) ?? [];
		const [wishes, mine, profiles] = await Promise.all([
			fetchFriendWishes(ids),
			fetchMySatchel(),
			ids.length
				? supabase
						.from("profiles")
						.select("id, username, active_pig_id, is_vip")
						.in("id", ids)
						.returns<ProfileRow[]>()
				: Promise.resolve({ data: [] as ProfileRow[], error: null }),
		]);
		const byId = new Map<string, ProfileRow>((profiles.data ?? []).map((p) => [p.id, p]));
		const friends: FriendWishTarget[] = [];
		for (const w of wishes.ok ? wishes.wishes : []) {
			// A wish this visitor has already filled rerolls on its own; a pig
			// sent for it would come home to a moved wish.
			if (w.fulfilled_by_me) continue;
			const p = byId.get(w.target_id);
			friends.push({
				friendId: w.target_id,
				name: p?.username ?? "a friend",
				pigId: p?.is_vip && isPigId(p.active_pig_id) ? p.active_pig_id : "rosie",
				wish: w,
			});
		}
		friends.sort((a, b) => a.name.localeCompare(b.name));
		const names = new Map<string, { name: string; pigId: PigId }>();
		for (const p of profiles.data ?? []) {
			names.set(p.id, {
				name: p.username ?? "a friend",
				pigId: p.is_vip && isPigId(p.active_pig_id) ? p.active_pig_id : "rosie",
			});
		}
		const next: WishTargets = {
			friends,
			names,
			mine: mine.ok ? mine.state.wish : null,
			bag: mine.ok ? mine.state.items : [],
		};
		setTargets(next);
		setLoading(false);
		setLoaded(true);
		return next;
	}, []);

	return { targets, loading, loaded, load };
}

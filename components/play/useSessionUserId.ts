// The signed-in player's id, read once from the Supabase session: undefined
// while it is being read, null when nobody is signed in. For the Play screens
// that must know who is looking without opening the play socket (the wins
// board finds your row; the invite landing asks a signed-out pig to sign in).

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase";

export function useSessionUserId(): string | null | undefined {
	const [userId, setUserId] = useState<string | null | undefined>(undefined);
	useEffect(() => {
		let live = true;
		supabase.auth
			.getSession()
			.then(({ data }) => {
				if (live) setUserId(data.session?.user.id ?? null);
			})
			.catch(() => {
				if (live) setUserId(null);
			});
		return () => {
			live = false;
		};
	}, []);
	return userId;
}

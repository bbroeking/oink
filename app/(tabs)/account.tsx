import React, { useEffect, useState } from "react";
import { Account } from "../../components/Account";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../../utils/supabase";
import { View } from "react-native";
import { WHIMSY } from "../../constants/theme";

export default function AccountScreen() {
	const [session, setSession] = useState<Session | null>(null);

	useEffect(() => {
		supabase.auth.getSession().then(({ data: { session } }) => {
			setSession(session);
		});

		// The listener is dropped with the screen; it used to outlive it, one
		// more subscription per mount. (polish 2026-10-04)
		const { data } = supabase.auth.onAuthStateChange((_event, session) => {
			setSession(session);
		});
		return () => data.subscription.unsubscribe();
	}, []);

	return (
		<View style={{ flex: 1, backgroundColor: WHIMSY.cream }}>
			{session && <Account session={session} />}
		</View>
	);
}

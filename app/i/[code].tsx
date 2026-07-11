// Invite deep-link landing route. When a Universal Link
// `https://ticklethepig.com/i/<CODE>` resolves through expo-router
// (rather than the raw-URL Linking listener in app/_layout.tsx), this
// route catches it. It's deliberately dumb: pull the code param, stash
// it under PENDING_REFERRAL_CODE_KEY (the same slot the onboarding
// code-entry step + the _layout deep-link handler read), and
// replace-navigate home so the invite param never lingers in history.
//
// Redemption itself is never done here — the onboarding
// ReferralCodeEntry step (new signups) or the _layout Alert prompt
// (existing sessions) owns that. This route only hands off the code.

import { useEffect } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
	PENDING_REFERRAL_CODE_KEY,
	REFERRAL_CODE_PATTERN,
} from "@/utils/referrals";

export default function InviteRoute() {
	const { code } = useLocalSearchParams<{ code?: string }>();

	useEffect(() => {
		const raw = Array.isArray(code) ? code[0] : code;
		const candidate = (raw ?? "").toUpperCase().trim();
		const stash = REFERRAL_CODE_PATTERN.test(candidate)
			? AsyncStorage.setItem(PENDING_REFERRAL_CODE_KEY, candidate)
			: Promise.resolve();
		// Hand off, then bounce home regardless of validity. A malformed
		// code just lands the user on the normal home screen with nothing
		// stashed — no error surface needed on a link they didn't type.
		stash
			.catch(() => {})
			.finally(() => {
				router.replace("/");
			});
	}, [code]);

	// Nothing to render — this is a pass-through. Blank view avoids a
	// flash of unstyled content before the replace-nav completes.
	return <View style={{ flex: 1, backgroundColor: "#fffaf0" }} />;
}

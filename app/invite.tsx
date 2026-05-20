// Deep-link landing route: `myapp://invite?u=Brian&d=4075`.
// Paired with docs/invite.html — the public landing page that fires
// this scheme when a friend taps a shared link.
//
// Flow:
//   1. Parse u (username) + d (discriminator, optional) from query.
//   2. If the user isn't signed in yet, show a "sign in to add" CTA
//      and route to / on tap.
//   3. Otherwise fire send_friend_request and show the result, then
//      bounce to the Account → Friends section after a beat.
import React, { useEffect, useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	ActivityIndicator,
	Pressable,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { supabase } from "../utils/supabase";
import { Sticker } from "../components/ui/Sticker";
import { FONTS, KICKER_TEXT, STICKER_SHADOW, WHIMSY } from "@/constants/theme";

export default function InviteScreen() {
	const params = useLocalSearchParams<{ u?: string; d?: string; ref?: string }>();
	const username = (params.u ?? "").trim();
	const discriminator = (params.d ?? "").trim() || null;
	// `ref` carries `<username>-<discriminator>` of the referrer. Parsed
	// here so both attribute_referral + send_friend_request can fire.
	const refRaw = (params.ref ?? "").trim();
	const [refUsername, refDiscriminator] = refRaw
		? refRaw.split("-")
		: [null, null];

	const [status, setStatus] =
		useState<"idle" | "sending" | "ok" | "err">("idle");
	const [reason, setReason] = useState<string>("");

	useEffect(() => {
		(async () => {
			if (!username) {
				setStatus("err");
				setReason("Missing friend code.");
				return;
			}
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) {
				// Caller isn't signed in. Bounce home — the auth flow will
				// catch them; on next open of this URL they'll be signed in.
				setStatus("err");
				setReason("Sign in first, then tap the link again.");
				return;
			}
			setStatus("sending");
			// Fire-and-no-throw attribute_referral first — it's idempotent
			// and silently no-ops if the user already has a referrer.
			// Use the dedicated `ref` if present, otherwise fall back to
			// the friend-add target (so legacy share links still attribute).
			const refU = refUsername ?? username;
			const refD = refDiscriminator ?? discriminator;
			if (refU) {
				try {
					await supabase.rpc("attribute_referral", {
						referrer_username: refU,
						referrer_discriminator: refD,
					});
				} catch {}
			}
			const { data, error } = await supabase.rpc("send_friend_request", {
				target_username: username,
				target_discriminator: discriminator,
			});
			const r = data as { ok?: boolean; reason?: string } | null;
			if (error || !r?.ok) {
				setStatus("err");
				setReason(reasonMessage(r?.reason ?? "error"));
				return;
			}
			setStatus("ok");
			// Bounce to home after a beat so they land in the app, not
			// stranded on the invite screen.
			setTimeout(() => router.replace("/"), 1500);
		})();
	}, [username, discriminator, refUsername, refDiscriminator]);

	const displayHandle = discriminator
		? `${username}#${discriminator}`
		: username || "—";

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />
			<View style={styles.bg}>
				<Sticker color="paper" rotate={-1.2} radius={20} style={styles.card}>
					<Text style={styles.kicker}>★ friend invite</Text>
					<Text style={styles.emoji}>🐷</Text>
					<Text style={styles.handle}>{displayHandle}</Text>

					{status === "sending" && (
						<>
							<ActivityIndicator color={WHIMSY.lilac} />
							<Text style={styles.body}>Sending request…</Text>
						</>
					)}
					{status === "ok" && (
						<Text style={styles.body}>
							Request sent! Bouncing home…
						</Text>
					)}
					{status === "err" && (
						<>
							<Text style={styles.body}>{reason}</Text>
							<Pressable
								onPress={() => router.replace("/")}
								style={styles.btn}
							>
								<Text style={styles.btnText}>Home</Text>
							</Pressable>
						</>
					)}
				</Sticker>
			</View>
		</>
	);
}

function reasonMessage(reason: string): string {
	switch (reason) {
		case "not_found":
			return "Couldn't find that friend code.";
		case "self":
			return "That's you. You can't invite yourself.";
		case "discriminator_required":
			return "Multiple users with that name — open via a fresh invite link.";
		case "unauthenticated":
			return "Sign in first, then tap the link again.";
		default:
			return "Couldn't send the request. Try again.";
	}
}

const styles = StyleSheet.create({
	bg: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: 24,
		backgroundColor: WHIMSY.cream,
	},
	card: {
		width: "100%",
		maxWidth: 360,
		paddingHorizontal: 22,
		paddingVertical: 24,
		alignItems: "center",
		...STICKER_SHADOW,
	},
	kicker: { ...KICKER_TEXT, marginBottom: 6 },
	emoji: { fontSize: 48, marginBottom: 6 },
	handle: {
		fontFamily: FONTS.whimsy,
		fontSize: 26,
		color: WHIMSY.ink,
		marginBottom: 14,
	},
	body: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: 10,
	},
	btn: {
		marginTop: 14,
		paddingHorizontal: 22,
		paddingVertical: 10,
		borderRadius: 12,
		backgroundColor: WHIMSY.lilac,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	btnText: {
		fontFamily: FONTS.whimsy,
		fontSize: 15,
		color: WHIMSY.ink,
	},
});

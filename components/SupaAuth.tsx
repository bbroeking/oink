// Sign-in screen. Rosie front-and-center as the storybook hero so
// the first thing a player sees on the loading flow is the same
// pig they're about to meet on the Barn screen — no disconnect
// between the splash art and the gameplay character.
//
// Layout: cream backdrop, Rosie hero portrait scaled to ~72% width
// upper-center, then a paper-sticker card with the title + a platform
// sign-in button + an "Use email instead" link that expands a
// hidden email/password form. The platform split: iOS gets Apple
// Sign-In, Android gets "Continue with Google" — never both, so the
// off-platform provider's empty frame can't render. The email path is
// primarily for the App Store reviewer demo account but is available
// to anyone who taps the link.
import React, { useState } from "react";
import {
	StyleSheet,
	View,
	Image,
	Text,
	SafeAreaView,
	TextInput,
	Pressable,
	KeyboardAvoidingView,
	Platform,
} from "react-native";
import { AppleAuth } from "./AppleAuth";
import { GoogleAuth } from "./GoogleAuth";
import { Sticker } from "./ui/Sticker";
import { supabase } from "../utils/supabase";
import { FONTS, KICKER_TEXT, WHIMSY, STICKER_SHADOW, PAGE_PAD, RADII } from "@/constants/theme";

export default function SupaAuth() {
	const [showEmail, setShowEmail] = useState(false);
	const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleEmailSubmit = async () => {
		if (busy) return;
		const trimmedEmail = email.trim();
		if (!trimmedEmail || !password) {
			setError("Email and password required.");
			return;
		}
		if (mode === "signUp" && password.length < 6) {
			setError("Password must be at least 6 characters.");
			return;
		}
		setBusy(true);
		setError(null);
		const fn = mode === "signUp"
			? supabase.auth.signUp({ email: trimmedEmail, password })
			: supabase.auth.signInWithPassword({ email: trimmedEmail, password });
		const { error: err } = await fn;
		setBusy(false);
		if (err) {
			const m = (err.message || "").toLowerCase();
			if (m.includes("already") || m.includes("registered")) {
				setError("That email is already registered — sign in instead.");
			} else if (m.includes("invalid login") || m.includes("invalid_grant")) {
				setError("Wrong email or password.");
			} else {
				setError(err.message || "Couldn't sign in. Try again.");
			}
			return;
		}
		// On success the auth listener picks up the new session and
		// the parent layout routes to UsernameSetup (new signup) or
		// directly into the Barn (existing account).
	};

	return (
		<View style={styles.bg}>
			<KeyboardAvoidingView
				style={styles.flex}
				behavior={Platform.OS === "ios" ? "padding" : undefined}
			>
				<SafeAreaView style={styles.safe}>
					<View style={styles.hero}>
						<Image
							source={require("../assets/images/sprites/rosie/idle_1.png")}
							style={styles.rosie}
							resizeMode="contain"
						/>
						<Text style={styles.kicker}>★ tickle the pig ★</Text>
						<Text style={styles.title}>Meet Rosie</Text>
						<Text style={styles.subtitle}>
							She'd like a tickle. Sign in to start.
						</Text>
					</View>

					<View style={styles.cardWrap}>
						<Sticker
							color="paper"
							rotate={-0.8}
							radius={RADII.xxl}
							style={[styles.card, STICKER_SHADOW]}
						>
							{Platform.OS === "ios" ? (
								<AppleAuth />
							) : (
								<GoogleAuth onError={setError} />
							)}

							{/* Email auth path — collapsed by default. Mainly here
							    so the App Store reviewer demo account works
							    (Apple Sign-In / Google each create a fresh empty
							    account per reviewer, which doesn't show off the
							    social loop). Anyone can use this who'd rather not
							    use the platform provider. */}
							{!showEmail && (
								<Pressable
									onPress={() => setShowEmail(true)}
									style={styles.emailToggle}
									hitSlop={8}
								>
									<Text style={styles.emailToggleText}>or use email</Text>
								</Pressable>
							)}

							{/* Provider-level note (e.g. a Google failure) needs to
							    show even while the email form is collapsed. */}
							{error && !showEmail && (
								<Text style={styles.noteText}>{error}</Text>
							)}

							{showEmail && (
								<View style={styles.emailForm}>
									<TextInput
										style={styles.input}
										placeholder="email"
										placeholderTextColor={WHIMSY.mute}
										value={email}
										onChangeText={(t) => {
											setEmail(t);
											if (error) setError(null);
										}}
										autoCapitalize="none"
										autoCorrect={false}
										keyboardType="email-address"
										textContentType="emailAddress"
										editable={!busy}
									/>
									<TextInput
										style={styles.input}
										placeholder={
											mode === "signUp" ? "password (6+ chars)" : "password"
										}
										placeholderTextColor={WHIMSY.mute}
										value={password}
										onChangeText={(t) => {
											setPassword(t);
											if (error) setError(null);
										}}
										autoCapitalize="none"
										autoCorrect={false}
										secureTextEntry
										textContentType={
											mode === "signUp" ? "newPassword" : "password"
										}
										editable={!busy}
									/>
									{error && <Text style={styles.errorText}>{error}</Text>}
									<Pressable
										onPress={handleEmailSubmit}
										disabled={busy}
										style={({ pressed }) => [
											styles.signInBtn,
											(pressed || busy) && { opacity: 0.7 },
										]}
									>
										<Text style={styles.signInBtnText}>
											{busy
												? mode === "signUp"
													? "Creating…"
													: "Signing in…"
												: mode === "signUp"
													? "Create account"
													: "Sign in"}
										</Text>
									</Pressable>
									<Pressable
										onPress={() => {
											setMode((m) => (m === "signUp" ? "signIn" : "signUp"));
											setError(null);
										}}
										style={styles.modeToggle}
										hitSlop={6}
									>
										<Text style={styles.modeToggleText}>
											{mode === "signUp"
												? "Already have an account? Sign in"
												: "No account yet? Create one"}
										</Text>
									</Pressable>
								</View>
							)}
						</Sticker>
					</View>
				</SafeAreaView>
			</KeyboardAvoidingView>
		</View>
	);
}

const styles = StyleSheet.create({
	bg: { flex: 1, backgroundColor: WHIMSY.cream },
	// NOTE: horizontal padding lives on the children, not here — RN's
	// built-in SafeAreaView replaces author padding with its own inset
	// padding, so paddingHorizontal set on it silently drops on device.
	safe: { flex: 1, justifyContent: "space-between" },
	hero: {
		alignItems: "center",
		paddingTop: 24,
		paddingHorizontal: PAGE_PAD,
		flex: 1,
		justifyContent: "center",
	},
	rosie: {
		width: "72%",
		aspectRatio: 370 / 383, // matches idle_1.png native ratio (near-square)
		marginBottom: 18,
	},
	kicker: {
		...KICKER_TEXT,
		marginBottom: 6,
	},
	title: {
		fontFamily: FONTS.whimsy,
		fontSize: 36,
		color: WHIMSY.ink,
		marginBottom: 6,
		textAlign: "center",
	},
	subtitle: {
		fontFamily: FONTS.hand,
		fontSize: 16,
		color: WHIMSY.mute,
		textAlign: "center",
		paddingHorizontal: 20,
	},
	cardWrap: {
		paddingBottom: 24,
		paddingHorizontal: PAGE_PAD,
	},
	card: {
		padding: 20,
	},
	flex: { flex: 1 },
	emailToggle: {
		alignItems: "center",
		marginTop: 14,
		paddingVertical: 4,
	},
	emailToggleText: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.mute,
		textDecorationLine: "underline",
	},
	emailForm: {
		marginTop: 12,
	},
	input: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 15,
		color: WHIMSY.ink,
		backgroundColor: WHIMSY.cream,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 11,
		marginBottom: 8,
	},
	errorText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 12,
		color: WHIMSY.accent,
		marginBottom: 6,
	},
	noteText: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.accent,
		textAlign: "center",
		marginTop: 8,
	},
	signInBtn: {
		backgroundColor: WHIMSY.lilac,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 12,
		paddingVertical: 11,
		alignItems: "center",
		marginTop: 4,
	},
	signInBtnText: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.ink,
	},
	modeToggle: {
		alignItems: "center",
		marginTop: 10,
		paddingVertical: 4,
	},
	modeToggleText: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		textDecorationLine: "underline",
	},
});

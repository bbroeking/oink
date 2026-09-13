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
//
// Rebuilt on the design system 2026-09-11 (wave 3 · area E): both wells are
// `TextField` (the refusal is the field's own written line, and the well wears
// the error chrome rather than leaving a loose red string to carry it), the
// three text links and the submit are `Button`, and both provider buttons now
// share one chrome and one mark system. [E16, E23]
import React, { useState } from "react";
import {
	StyleSheet,
	View,
	Image,
	SafeAreaView,
	KeyboardAvoidingView,
	Platform,
} from "react-native";
import { AppleAuth } from "./AppleAuth";
import { GoogleAuth } from "./GoogleAuth";
import { Button, Hand, HandLg, Kicker, Sticker, T, TextField } from "./ui";
import { supabase } from "../utils/supabase";
import { PAGE_PAD, RADII, SPACE, STICKER_SHADOW, UI_COLORS } from "@/constants/theme";

const PASSWORD_MIN = 6;

export default function SupaAuth() {
	const [showEmail, setShowEmail] = useState(false);
	const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const clearError = () => {
		if (error) setError(null);
	};

	const handleEmailSubmit = async () => {
		if (busy) return;
		const trimmedEmail = email.trim();
		if (!trimmedEmail || !password) {
			setError("Email and password required.");
			return;
		}
		if (mode === "signUp" && password.length < PASSWORD_MIN) {
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

	// One refusal, spoken once: the wells wear the error chrome and the written
	// line rides the password field (the last thing touched before submit), so a
	// screen reader hears the reason instead of a border carrying it alone.
	const fieldState = error && showEmail ? "error" : "default";

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
						<Kicker star={false}>★ tickle the pig ★</Kicker>
						<T role="displayLg" align="center" style={styles.title}>
							Meet Rosie
						</T>
						<HandLg tone="secondary" align="center" style={styles.subtitle}>
							She'd like a tickle. Sign in to start.
						</HandLg>
					</View>

					<View style={styles.cardWrap}>
						<Sticker
							color="paper"
							rotate={-0.8}
							radius={RADII.xxl}
							pad
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
								<Button
									variant="handLink"
									onPress={() => setShowEmail(true)}
									accessibilityLabel="Use email instead"
									accessibilityHint="Opens an email and password form"
								>
									or use email
								</Button>
							)}

							{/* Provider-level note (e.g. a Google failure) needs to
							    show even while the email form is collapsed. */}
							{error && !showEmail && (
								<Hand tone="danger" align="center" accessibilityRole="alert">
									{error}
								</Hand>
							)}

							{showEmail && (
								<View style={styles.emailForm}>
									<TextField
										label="Email"
										labelHidden
										value={email}
										onChangeText={(t) => {
											setEmail(t);
											clearError();
										}}
										placeholder="email"
										state={fieldState}
										autoCapitalize="none"
										autoCorrect={false}
										keyboardType="email-address"
										textContentType="emailAddress"
										editable={!busy}
									/>
									<TextField
										label="Password"
										labelHidden
										value={password}
										onChangeText={(t) => {
											setPassword(t);
											clearError();
										}}
										placeholder={
											mode === "signUp"
												? "password (6+ chars)"
												: "password"
										}
										state={fieldState}
										errorText={error ?? undefined}
										secure
										autoCapitalize="none"
										autoCorrect={false}
										textContentType={
											mode === "signUp" ? "newPassword" : "password"
										}
										editable={!busy}
									/>
									<Button
										full
										variant="lilac"
										onPress={handleEmailSubmit}
										loading={busy}
										loadingLabel={
											mode === "signUp" ? "Creating…" : "Signing in…"
										}
										accessibilityLabel={
											mode === "signUp"
												? "Create account with email"
												: "Sign in with email"
										}
										accessibilityHint="Brings you into the barn"
									>
										{mode === "signUp" ? "Create account" : "Sign in"}
									</Button>
									<Button
										variant="handLink"
										onPress={() => {
											setMode((m) => (m === "signUp" ? "signIn" : "signUp"));
											setError(null);
										}}
										accessibilityLabel={
											mode === "signUp"
												? "Switch to signing in"
												: "Switch to creating an account"
										}
										accessibilityHint="Swaps the form between sign-in and sign-up"
									>
										{mode === "signUp"
											? "Already have an account? Sign in"
											: "No account yet? Create one"}
									</Button>
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
	bg: { flex: 1, backgroundColor: UI_COLORS.surfaceMuted },
	// NOTE: horizontal padding lives on the children, not here — RN's
	// built-in SafeAreaView replaces author padding with its own inset
	// padding, so paddingHorizontal set on it silently drops on device.
	safe: { flex: 1, justifyContent: "space-between" },
	hero: {
		alignItems: "center",
		paddingTop: SPACE.xl,
		paddingHorizontal: PAGE_PAD,
		flex: 1,
		justifyContent: "center",
	},
	rosie: {
		width: "72%",
		aspectRatio: 370 / 383, // matches idle_1.png native ratio (near-square)
		marginBottom: SPACE.lg,
	},
	title: {
		marginTop: SPACE.sm,
	},
	subtitle: {
		marginTop: SPACE.sm,
		paddingHorizontal: SPACE.xl,
	},
	cardWrap: {
		paddingBottom: SPACE.xl,
		paddingHorizontal: PAGE_PAD,
	},
	card: {
		gap: SPACE.md,
	},
	flex: { flex: 1 },
	emailForm: {
		gap: SPACE.md,
	},
});

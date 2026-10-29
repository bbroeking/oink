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
//
// Recomposed for small phones 2026-10-04 (polish pass, iPhone SE captures 110 /
// 111). Rosie was meant to be 72% of the width but drew at her asset's own
// 370×383pt on every phone: React Native's `Image` writes the source's size
// into its style first, and that `height: 383` beat the percentage width
// through `aspectRatio`. On a 667pt-tall phone the hero overflowed its flex box
// and spilled both ways — her ears under the status bar, "Meet Rosie" and the
// tagline under the card — and the email form hid the heading even on a 17 Pro.
// Now she takes whatever height the scene can spare, capped at her own 383pt
// and floored at the portrait size, so the 17 Pro lands on exactly the same
// points as before while an SE shrinks her until heading, tagline, card and
// the Terms · Privacy line all fit; the scene is a scroller (it scrolls only
// when even the floor can't fit — the email form on an SE, or large text), and
// the keyboard insets it natively and lifts the focused field into view.
//
// Measured, not flexed (2026-10-04, after/110–111). The first cut gave her a
// slot that flex-grew into the hero's spare height, but inside a scroller that
// slot is never offered a definite height to shrink against: she still drew at
// her 383pt ceiling on the SE (a Yoga run of this tree reproduces it), the
// legal line sat below the fold and the email form cut her ears off under the
// status bar. Her height is now arithmetic, `fitRosieHeight`: the scene's
// height (the window less its safe areas) less everything that is not her,
// with the words and the card measured as they lay out, so a Dynamic Type
// change or the email form re-fits her.
import React, { useState } from "react";
import {
	StyleSheet,
	View,
	Image,
	Linking,
	Platform,
	ScrollView,
	useWindowDimensions,
	type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppleAuth } from "./AppleAuth";
import { GoogleAuth } from "./GoogleAuth";
import { Button, Hand, HandLg, Kicker, Sticker, T, TextField } from "./ui";
import {
	fitRosieHeight,
	HERO_PAD_BOTTOM,
	HERO_PAD_TOP,
	ROSIE_ART,
	ROSIE_GAP,
} from "./rosieHero";
import { supabase } from "../utils/supabase";
import {
	BORDER,
	BUTTON_SIZE,
	PAGE_PAD,
	RADII,
	SPACE,
	STICKER_SHADOW,
	TAP_MIN,
	TILT,
	TYPE,
	UI_COLORS,
} from "@/constants/theme";

const PASSWORD_MIN = 6;

// What the words and the card take before they have been measured, summed
// from the tokens they lay out with at the default text size (the geometry
// the styles imply, the way `constants/layoutBreakpoints.ts` writes it down),
// so the first frame is already the fitted one on an SE; onLayout corrects it
// for Dynamic Type and for the email form.
const sum = (parts: readonly number[]) => parts.reduce((a, b) => a + b, 0);
// The kicker, the title and the tagline, with the SPACE.sm step above each.
const WORDS_H_GUESS = sum([
	TYPE.kicker.lineHeight,
	SPACE.sm,
	TYPE.displayLg.lineHeight,
	SPACE.sm,
	TYPE.handLg.lineHeight,
]);
// The card (outline, pad, the provider button, the gap, the "or use email"
// link, pad, outline), then the legal line and the card's bottom breath.
const CARD_H_GUESS = sum([
	BORDER.ink,
	SPACE.card,
	BUTTON_SIZE.md.minH,
	SPACE.md,
	TAP_MIN,
	SPACE.card,
	BORDER.ink,
	SPACE.sm,
	TAP_MIN,
	SPACE.xl,
]);

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
				setError("That email is already registered. Sign in instead.");
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
	const insets = useSafeAreaInsets();

	// Rosie fills what the scene can spare (see `fitRosieHeight`).
	const { height: windowH } = useWindowDimensions();
	const [wordsH, setWordsH] = useState(WORDS_H_GUESS);
	const [cardH, setCardH] = useState(CARD_H_GUESS);
	const rosieH = fitRosieHeight({
		sceneH: windowH - insets.top - insets.bottom,
		wordsH,
		cardH,
	});
	const onWordsLayout = (e: LayoutChangeEvent) => setWordsH(e.nativeEvent.layout.height);
	const onCardLayout = (e: LayoutChangeEvent) => setCardH(e.nativeEvent.layout.height);

	return (
		<View style={[styles.bg, { paddingTop: insets.top }]}>
			<ScrollView
				style={styles.flex}
				contentContainerStyle={[styles.scene, { paddingBottom: insets.bottom }]}
				// The keyboard insets the scroller and lifts the focused well
				// above itself (Fabric does both natively); a tap on Sign in
				// with the keyboard up lands the first time.
				automaticallyAdjustKeyboardInsets
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode="interactive"
				// A scene that fits stays put; it only gives when it can scroll.
				alwaysBounceVertical={false}
				showsVerticalScrollIndicator={false}
				testID="sign-in-scene"
			>
				<View style={styles.hero}>
					<View style={[styles.rosieSlot, { height: rosieH }]} testID="sign-in-rosie">
						<Image
							source={require("../assets/images/sprites/rosie/idle_1.png")}
							// Both axes, so the asset's own 370×383 can't win.
							style={styles.rosie}
							resizeMode="contain"
						/>
					</View>
					<View style={styles.words} onLayout={onWordsLayout} testID="sign-in-words">
						<Kicker star={false}>★ tickle the pig ★</Kicker>
						<T role="displayLg" align="center" style={styles.title}>
							Meet Rosie
						</T>
						<HandLg tone="secondary" align="center" style={styles.subtitle}>
							She'd like a tickle. Sign in to start.
						</HandLg>
					</View>
				</View>

				<View style={styles.cardWrap} onLayout={onCardLayout} testID="sign-in-card">
					<Sticker
						color="paper"
						rotate={TILT.dialog}
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
					{/* The two legal doors, one line, before anyone signs in. They
					    also live under Me · Settings; here they are for the pig who
					    hasn't got a Me yet. (2026-09-22) */}
					<View style={styles.legalRow}>
						<Button
							variant="handLink"
							size="xs"
							onPress={() => Linking.openURL("https://ticklethepig.com/terms")}
							accessibilityLabel="Terms of service"
							accessibilityHint="Opens ticklethepig.com/terms in your browser"
						>
							Terms
						</Button>
						{/* A separator, not a word: out of the tree. */}
						<Hand
							tone="secondary"
							accessibilityElementsHidden
							importantForAccessibility="no-hide-descendants"
						>
							·
						</Hand>
						<Button
							variant="handLink"
							size="xs"
							onPress={() => Linking.openURL("https://ticklethepig.com/privacy")}
							accessibilityLabel="Privacy policy"
							accessibilityHint="Opens ticklethepig.com/privacy in your browser"
						>
							Privacy
						</Button>
					</View>
				</View>
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	bg: { flex: 1, backgroundColor: UI_COLORS.surfaceMuted },
	// The scroller's content: at least the viewport (so a scene that fits lays
	// out exactly as the old full-screen column did), taller only when it must.
	scene: { flexGrow: 1, justifyContent: "space-between" },
	hero: {
		// `flexGrow`, not `flex: 1`: inside a scroller the hero's own content
		// must count toward the scene's height (a zero basis would let it
		// collapse under the card instead of scrolling).
		flexGrow: 1,
		alignItems: "center",
		justifyContent: "center",
		// Top minus bottom is the 24pt (SPACE.xl) the hero always kept above
		// Rosie, so wherever she reaches her full size (the 17 Pro) every element
		// lands on the same point as before; the SPACE.sm underneath is the
		// breath a short phone keeps between the tagline and the card.
		paddingTop: HERO_PAD_TOP,
		paddingBottom: HERO_PAD_BOTTOM,
		paddingHorizontal: PAGE_PAD,
	},
	// Rosie's slot: its height is `fitRosieHeight`'s, set inline; her width
	// follows from the art's ratio.
	rosieSlot: {
		aspectRatio: ROSIE_ART.width / ROSIE_ART.height,
		marginBottom: ROSIE_GAP,
	},
	rosie: { width: "100%", height: "100%" },
	// The kicker, title and tagline, measured as one block; centred across the
	// hero's width as they were when they were its own children.
	words: { alignSelf: "stretch", alignItems: "center" },
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
	legalRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.xs,
		marginTop: SPACE.sm,
	},
	emailForm: {
		gap: SPACE.md,
	},
});

// Onboarding code-entry step. Mounted after UsernameSetup, before
// the storybook Onboarding screens, so a fresh signup with a
// pending code from the Universal Link / clipboard gets one tap to
// apply.
//
// Pre-fill priority:
//   1. AsyncStorage[PENDING_REFERRAL_CODE_KEY] — stashed by the deep-
//      link handler in app/_layout.tsx when an uninstalled-friend tap
//      opens the App Store first.
//   2. Clipboard contents matching REFERRAL_CODE_PATTERN — catches
//      the install-from-landing-page → manual paste path.
//
// On apply, calls redeem_referral_code and either advances or shows
// the mapped error copy. Skip advances unconditionally — the spec
// makes redemption strictly signup-only, so a skipped code is gone
// for that account.
//
// Rebuilt on the design system 2026-09-11 (wave 3 · area E): the code well is
// `TextField` (a well-formed code earns the check, a refusal is the field's own
// `errorText` instead of a loose red line), Apply/Skip/Paste are `Button` —
// Apply's disabled state is now "a button, asleep" rather than the retired
// opacity ghost, and Skip keeps its quiet hand voice as `handLink`. [E16]

import React, { useEffect, useState } from "react";
import {
	View,
	StyleSheet,
	SafeAreaView,
	KeyboardAvoidingView,
	Platform,
	Image,
	Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import {
	Button,
	Hand,
	Kicker,
	SectionTitle,
	Sticker,
	TextField,
} from "./ui";
import { PAGE_PAD, RADII, SPACE, STICKER_SHADOW, UI_COLORS } from "@/constants/theme";
import {
	PENDING_REFERRAL_CODE_KEY,
	REFERRAL_CODE_PATTERN,
	parseReferralCodeFromClipboard,
	redeemReferralCode,
	referralErrorMessage,
} from "@/utils/referrals";

interface Props {
	onDone: () => void;
}

// AsyncStorage flag — flipped on first traversal so the step never
// re-prompts on subsequent launches. Independent of seen_onboarding
// so a future onboarding redesign doesn't accidentally re-show the
// referral prompt.
const SEEN_KEY = "seen_referral_step";

const CODE_MAX = 20;

// Explicit pixel dims for the Rosie hero. A percentage width + aspectRatio
// collapses to zero height in this layout (tall, mostly-empty hero because
// the card below is short), so the image vanished. Concrete px sizing from
// the screen width keeps Yoga from dropping it. 370x383 is the native ratio.
const SCREEN_W = Dimensions.get("window").width;
const ROSIE_W = Math.round(SCREEN_W * 0.55);
const ROSIE_H = Math.round(ROSIE_W * (383 / 370));

type Status =
	| { kind: "idle" }
	| { kind: "applying" }
	| { kind: "error"; message: string }
	| { kind: "applied"; inviterName: string | null };

export function ReferralCodeEntry({ onDone }: Props) {
	const [code, setCode] = useState("");
	const [status, setStatus] = useState<Status>({ kind: "idle" });

	// Pre-fill on mount: AsyncStorage first, then clipboard. Run once;
	// race conditions here are harmless (user can always type over it).
	useEffect(() => {
		let cancelled = false;
		(async () => {
			const stored = await AsyncStorage.getItem(PENDING_REFERRAL_CODE_KEY);
			if (cancelled) return;
			if (stored && REFERRAL_CODE_PATTERN.test(stored)) {
				setCode(stored);
				// Clear immediately so a back-out-and-skip path doesn't
				// re-trigger the prefill on a later step.
				AsyncStorage.removeItem(PENDING_REFERRAL_CODE_KEY).catch(() => {});
				return;
			}
			try {
				const clip = await Clipboard.getStringAsync();
				if (cancelled) return;
				const fromClip = parseReferralCodeFromClipboard(clip);
				if (fromClip) setCode(fromClip);
			} catch {
				// Clipboard permission denied / unavailable — silent.
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const trimmed = code.trim().toUpperCase();
	const validShape = REFERRAL_CODE_PATTERN.test(trimmed);
	const applying = status.kind === "applying";

	// One-tap paste: pull the clipboard on demand and drop a matching
	// code into the field. Complements the mount-time prefill for the
	// case where the user copied their code from the landing page after
	// this screen already mounted (clipboard was empty on mount).
	const pasteFromClipboard = async () => {
		try {
			const clip = await Clipboard.getStringAsync();
			const fromClip = parseReferralCodeFromClipboard(clip);
			if (fromClip) {
				setCode(fromClip);
				if (status.kind === "error") setStatus({ kind: "idle" });
			}
		} catch {
			// Clipboard unavailable / denied — silent; user can type.
		}
	};

	const finish = async () => {
		await AsyncStorage.setItem(SEEN_KEY, "1").catch(() => {});
		onDone();
	};

	const apply = async () => {
		if (!validShape || applying) return;
		setStatus({ kind: "applying" });
		const result = await redeemReferralCode(trimmed);
		if (result?.ok) {
			setStatus({
				kind: "applied",
				inviterName: result.inviter_username ?? null,
			});
			return;
		}
		setStatus({
			kind: "error",
			message: referralErrorMessage(result?.reason),
		});
	};

	if (status.kind === "applied") {
		return (
			<View style={styles.bg}>
				<SafeAreaView style={styles.safe}>
					<View style={styles.hero}>
						<Image
							source={require("../assets/images/sprites/rosie/happy_1.png")}
							style={styles.rosie}
							resizeMode="contain"
						/>
						<Kicker star={false}>★ you're in ★</Kicker>
						<SectionTitle align="center" style={styles.title}>
							{status.inviterName
								? `${status.inviterName} brought you in!`
								: "You're in — welcome!"}
						</SectionTitle>
						<Hand tone="secondary" align="center" style={styles.heroBody}>
							+50 snouts in your barn.
						</Hand>
					</View>
					<View style={styles.cardWrap}>
						<Button
							full
							variant="lilac"
							onPress={finish}
							accessibilityLabel="Continue"
							accessibilityHint="Opens the introduction storybook"
						>
							Continue
						</Button>
					</View>
				</SafeAreaView>
			</View>
		);
	}

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
						<Kicker star={false}>★ got a friend's code? ★</Kicker>
						<SectionTitle align="center" style={styles.title}>
							Pop their code in for a +50 snout welcome.
						</SectionTitle>
						<Hand tone="secondary" align="center" style={styles.heroBody}>
							Skip if not — most pigs don't have one their first time.
						</Hand>
					</View>

					<View style={styles.cardWrap}>
						<Sticker
							color="paper"
							rotate={-0.6}
							radius={RADII.xxl}
							pad
							style={[styles.card, STICKER_SHADOW]}
						>
							<View style={styles.pasteRow}>
								<Button
									variant="handLink"
									size="sm"
									onPress={pasteFromClipboard}
									disabled={applying}
									accessibilityLabel="Paste code from clipboard"
									accessibilityHint="Fills the field with a code you copied"
								>
									Paste code
								</Button>
							</View>
							<TextField
								// The kicker above already asks for the code, so the
								// field's label stays for VoiceOver only.
								label="Your friend's invite code"
								labelHidden
								value={code}
								onChangeText={(t) => {
									setCode(t);
									if (status.kind === "error") setStatus({ kind: "idle" });
								}}
								// The placeholder IS the format instruction here (audit
								// E10), so there is no separate rules line to carry as
								// `helper` — the well speaks in shapes, and a refusal
								// arrives as `errorText`.
								placeholder="ROSIE-K3T9"
								variant="code"
								state={
									status.kind === "error"
										? "error"
										: validShape
											? "valid"
											: "default"
								}
								errorText={
									status.kind === "error" ? status.message : undefined
								}
								autoCapitalize="characters"
								autoCorrect={false}
								maxLength={CODE_MAX}
								editable={!applying}
							/>
							<View style={styles.btnRow}>
								<Button
									variant="handLink"
									onPress={finish}
									accessibilityLabel="Skip the invite code"
									accessibilityHint="Continues without a code — this step won't come back"
								>
									Skip
								</Button>
								<View style={styles.applyWrap}>
									<Button
										full
										variant="lilac"
										onPress={apply}
										disabled={!validShape}
										loading={applying}
										loadingLabel="Applying…"
										accessibilityLabel={
											validShape
												? `Apply invite code ${trimmed}`
												: "Apply invite code"
										}
										accessibilityHint={
											validShape
												? "Adds 50 snouts to your barn"
												: "Enter a code like ROSIE-K3T9 first"
										}
									>
										{validShape ? `Apply ${trimmed}` : "Apply"}
									</Button>
								</View>
							</View>
						</Sticker>
					</View>
				</SafeAreaView>
			</KeyboardAvoidingView>
		</View>
	);
}

// Helper for the (tabs) layout to decide whether to show this step.
// Resolves to false once the user has either applied or skipped.
export async function hasSeenReferralStep(): Promise<boolean> {
	const v = await AsyncStorage.getItem(SEEN_KEY);
	return v === "1";
}

const styles = StyleSheet.create({
	bg: { flex: 1, backgroundColor: UI_COLORS.surfaceMuted },
	flex: { flex: 1 },
	safe: { flex: 1, justifyContent: "space-between", paddingHorizontal: PAGE_PAD },
	hero: {
		alignItems: "center",
		paddingTop: SPACE.xl,
		flex: 1,
		justifyContent: "center",
	},
	rosie: {
		width: ROSIE_W,
		height: ROSIE_H,
		marginBottom: SPACE.card,
	},
	title: {
		paddingHorizontal: SPACE.md,
		marginTop: SPACE.sm,
	},
	heroBody: {
		paddingHorizontal: SPACE.xl,
		marginTop: SPACE.sm,
	},
	cardWrap: { paddingBottom: SPACE.xl },
	card: { gap: SPACE.sm },
	pasteRow: { alignItems: "flex-end" },
	btnRow: {
		flexDirection: "row",
		gap: SPACE.md,
		alignItems: "center",
	},
	applyWrap: { flex: 1 },
});

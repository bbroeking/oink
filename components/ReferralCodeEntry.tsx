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

import React, { useEffect, useState } from "react";
import {
	View,
	Text,
	Pressable,
	StyleSheet,
	TextInput,
	SafeAreaView,
	KeyboardAvoidingView,
	Platform,
	Image,
	Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { Sticker } from "./ui/Sticker";
import { FONTS, KICKER_TEXT, RADII, TYPE, WHIMSY, STICKER_SHADOW } from "@/constants/theme";
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
		if (!validShape || status.kind === "applying") return;
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
						<Text style={styles.kicker}>★ you're in ★</Text>
						<Text style={styles.title}>
							{status.inviterName
								? `${status.inviterName} brought you in!`
								: "You're in — welcome!"}
						</Text>
						<Text style={styles.heroBody}>+50 snouts in your barn.</Text>
					</View>
					<View style={styles.cardWrap}>
						<Pressable
							onPress={finish}
							style={({ pressed }) => [styles.btn, pressed && { opacity: 0.7 }]}
						>
							<Text style={styles.btnText}>Continue</Text>
						</Pressable>
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
						<Text style={styles.kicker}>★ got a friend's code? ★</Text>
						<Text style={styles.title}>
							Pop their code in for a +50 snout welcome.
						</Text>
						<Text style={styles.heroBody}>
							Skip if not — most pigs don't have one their first time.
						</Text>
					</View>

					<View style={styles.cardWrap}>
						<Sticker
							color="paper"
							rotate={-0.6}
							radius={RADII.xxl}
							style={[styles.card, STICKER_SHADOW]}
						>
							<Pressable
								onPress={pasteFromClipboard}
								disabled={status.kind === "applying"}
								style={({ pressed }) => [
									styles.pasteChip,
									pressed && { opacity: 0.7 },
								]}
							>
								<Text style={styles.pasteChipText}>Paste code</Text>
							</Pressable>
							<TextInput
								style={[
									styles.input,
									status.kind === "error" && styles.inputError,
								]}
								placeholder="ROSIE-K3T9"
								placeholderTextColor={WHIMSY.mute}
								value={code}
								onChangeText={(t) => {
									setCode(t);
									if (status.kind === "error") setStatus({ kind: "idle" });
								}}
								autoCapitalize="characters"
								autoCorrect={false}
								maxLength={20}
								editable={status.kind !== "applying"}
							/>
							{status.kind === "error" && (
								<Text style={styles.errorText}>{status.message}</Text>
							)}
							<View style={styles.btnRow}>
								<Pressable
									onPress={finish}
									style={({ pressed }) => [
										styles.skipBtn,
										pressed && { opacity: 0.7 },
									]}
								>
									<Text style={styles.skipText}>Skip</Text>
								</Pressable>
								<Pressable
									onPress={apply}
									disabled={!validShape || status.kind === "applying"}
									style={({ pressed }) => [
										styles.btn,
										(!validShape || status.kind === "applying") &&
											styles.btnDisabled,
										pressed && { opacity: 0.85 },
									]}
								>
									<Text style={styles.btnText}>
										{status.kind === "applying"
											? "Applying…"
											: validShape
												? `Apply ${trimmed}`
												: "Apply"}
									</Text>
								</Pressable>
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
	bg: { flex: 1, backgroundColor: WHIMSY.cream },
	flex: { flex: 1 },
	safe: { flex: 1, justifyContent: "space-between", paddingHorizontal: 22 },
	hero: {
		alignItems: "center",
		paddingTop: 24,
		flex: 1,
		justifyContent: "center",
	},
	rosie: {
		width: ROSIE_W,
		height: ROSIE_H,
		marginBottom: 14,
	},
	kicker: { ...KICKER_TEXT, marginBottom: 6 },
	title: {
		...TYPE.sectionTitle,
		color: WHIMSY.ink,
		textAlign: "center",
		paddingHorizontal: 12,
		marginBottom: 8,
	},
	heroBody: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.mute,
		textAlign: "center",
		paddingHorizontal: 24,
	},
	cardWrap: { paddingBottom: 24 },
	card: { padding: 18 },
	pasteChip: {
		alignSelf: "flex-end",
		paddingVertical: 6,
		paddingHorizontal: 10,
		marginBottom: 8,
	},
	pasteChipText: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		textDecorationLine: "underline",
	},
	input: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 18,
		letterSpacing: 1.2,
		color: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		paddingHorizontal: 14,
		paddingVertical: 12,
		marginBottom: 10,
		textAlign: "center",
	},
	inputError: { borderColor: WHIMSY.accent },
	errorText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 13,
		color: WHIMSY.accent,
		marginBottom: 10,
		textAlign: "center",
	},
	btnRow: {
		flexDirection: "row",
		gap: 10,
		marginTop: 4,
		alignItems: "center",
	},
	skipBtn: {
		paddingVertical: 13,
		paddingHorizontal: 18,
	},
	skipText: {
		fontFamily: FONTS.hand,
		fontSize: 15,
		color: WHIMSY.mute,
		textDecorationLine: "underline",
	},
	btn: {
		flex: 1,
		backgroundColor: WHIMSY.lilac,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		paddingVertical: 13,
		alignItems: "center",
	},
	btnDisabled: { opacity: 0.5 },
	btnText: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.ink,
		letterSpacing: 0.3,
	},
});

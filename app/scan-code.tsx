// Golden Ticket — redeem a giveaway code by scanning its QR or typing it.
// Technical route name (scan-code); all player-facing copy says "Golden Ticket"
// / "code". One legible loop (SKILL.md — Collect, legibility): scan (or type) →
// named reveal → done. No inventory, no multi-grant bundles.
//
// Camera pane fills the top; a manual-entry field is ALWAYS visible at the
// bottom, so the code is typeable on a simulator / denied-camera / no-camera
// device — the camera never blocks the flow. On a successful redeem the scanner
// is replaced in-place by a reveal card (no navigation); a single "Done" pops.
//
// Feature-dark safe: before the migration is pushed, redeem_code → PGRST202 →
// rpcAction returns {ok:false, reason:"network"} → the gentle retry copy. No
// crash, no red box (same contract as hunger_meter/digoff_state).

import { useCallback, useEffect, useRef, useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	SafeAreaView,
	TextInput,
	Image,
	Linking,
	ScrollView,
	KeyboardAvoidingView,
	Platform,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { PageHeader } from "@/components/ui/PageHeader";
import { Sticker } from "@/components/ui/Sticker";
import { Button } from "@/components/ui";
import { EmptyState, LoadingBeat } from "@/components/ui/EmptyState";
import { Glyph } from "@/components/ui/Glyph";
import { SnoutCoin } from "@/components/ui/SnoutCoin";
import { supabase } from "@/utils/supabase";
import { rpcAction } from "@/utils/rpc";
import {
	parseRedemptionPayload,
	formatRedemptionCode,
	redemptionErrorMessage,
	PENDING_REDEMPTION_CODE_KEY,
} from "@/utils/redemption";
import { HAT_IMAGES, RARITY_COLORS, type Rarity } from "@/constants/hats";
import {
	FONTS,
	RADII,
	SHADOW_SM,
	SPACE,
	TYPE,
	WHIMSY,
	PAGE_PAD,
	TAB_SAFE,
} from "@/constants/theme";

// ── expo-camera, resolved defensively ───────────────────────────────────────
// The CURRENT dev client is built without the expo-camera native module, so a
// static `import { CameraView, useCameraPermissions } from "expo-camera"` blows
// up (the JS require pulls in a TurboModule that isn't linked) — a blank void /
// red box before the manual-entry card ever renders. Resolve the module at load
// time inside a try/catch: if it's absent, `Camera` is null and we substitute a
// no-op permission hook that reports "no camera on this device". The manual-code
// card is always usable, so a missing native module degrades gracefully instead
// of crashing. Once the native module ships in a future build, the live scanner
// lights up with no code change.
//
// The substitute hook is chosen ONCE here (module scope), so calling it
// unconditionally in the component stays Rules-of-Hooks-safe.
type CameraModule = {
	CameraView: React.ComponentType<any>;
	useCameraPermissions: () => [
		{ granted: boolean; canAskAgain: boolean } | null,
		() => Promise<unknown>,
	];
};
let Camera: CameraModule | null = null;
try {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const mod = require("expo-camera");
	if (mod?.CameraView && mod?.useCameraPermissions) {
		Camera = mod as CameraModule;
	}
} catch {
	Camera = null;
}
// When the native module is missing, a permission that never grants and can
// never be asked — CameraPane collapses to the "no camera, type instead" card.
const useCameraPermissionsSafe: CameraModule["useCameraPermissions"] =
	Camera?.useCameraPermissions ??
	(() => [{ granted: false, canAskAgain: false }, async () => undefined]);

// The shape redeem_code() returns on ok:true (spec §1b).
type Reveal = {
	kind: string;
	id?: string;
	name?: string;
	rarity?: Rarity;
	granted_amount?: number;
	amount?: number;
	already_owned?: boolean;
};

export default function ScanCodeScreen() {
	const params = useLocalSearchParams<{ code?: string }>();
	const [permission, requestPermission] = useCameraPermissionsSafe();

	const [manual, setManual] = useState("");
	const [busy, setBusy] = useState(false);
	const [reveal, setReveal] = useState<Reveal | null>(null);
	const [error, setError] = useState<string | null>(null);

	// One QR fires once: lock after the first hit so a held-up code doesn't
	// spawn N redeems while the frame stays in view.
	const scanLock = useRef(false);
	// The last payload that was REFUSED. On refusal we unlock the scanner so the
	// player can try a different code — but expo-camera re-fires onBarcodeScanned
	// for the SAME frame at RTT rate, so we suppress an identical payload until it
	// changes (new QR / edit) to avoid re-hammering a failing code (finding #6).
	const lastFailedPayload = useRef<string | null>(null);
	// A prefilled code (deep-link param / pre-auth stash) submits EXACTLY once.
	// `submit`'s identity changes with `busy` (true→false per attempt), which
	// re-runs the prefill effect; without this guard the effect would resubmit on
	// every refusal → infinite auto-resubmit loop (finding #1).
	const prefillFired = useRef<string | null>(null);

	const submit = useCallback(async (rawCode: string) => {
		const p_code = rawCode.trim();
		if (!p_code || busy) return;
		setBusy(true);
		setError(null);
		const r = await rpcAction<Reveal>("redeem_code", { p_code });
		setBusy(false);
		if (r.ok) {
			setReveal(r);
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
				() => {}
			);
		} else {
			// Refusal: remember this payload so the scanner won't re-fire it, and
			// unlock so a DIFFERENT code can be scanned.
			lastFailedPayload.current = p_code;
			scanLock.current = false;
			setError(redemptionErrorMessage(r.reason));
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
				() => {}
			);
		}
	}, [busy]);

	// A scanned QR body → parse to a code → submit (guarded by scanLock).
	const onScanned = useCallback(
		(data: string) => {
			if (scanLock.current || busy || reveal) return;
			const code = parseRedemptionPayload(data);
			if (!code) return;
			// Don't re-submit the exact code we just refused while it's still in
			// frame — wait for the payload to change (or a manual edit clears it).
			if (code === lastFailedPayload.current) return;
			scanLock.current = true;
			setManual(formatRedemptionCode(code));
			submit(code);
		},
		[busy, reveal, submit]
	);

	// Deep-link / pending prefill: a code arrives as a route param (from the
	// _layout deep-link handler) OR was stashed pre-auth. Prefill the field and
	// auto-submit once a session exists — exactly ONCE per code (prefillFired
	// guards against `submit`'s changing identity re-running this effect).
	useEffect(() => {
		let cancelled = false;
		const run = async () => {
			let code = params.code ? parseRedemptionPayload(String(params.code)) : null;
			if (!code) {
				const stashed = await AsyncStorage.getItem(PENDING_REDEMPTION_CODE_KEY);
				code = stashed ? parseRedemptionPayload(stashed) : null;
			}
			if (!code || cancelled) return;
			// Already handled this exact prefill code — never fire it twice.
			if (prefillFired.current === code) return;
			setManual(formatRedemptionCode(code));
			const { data } = await supabase.auth.getSession();
			if (cancelled) return;
			if (data.session) {
				// Latch BEFORE submitting: this code's prefill is spent, so a
				// re-render (busy flip) can't re-enter and resubmit.
				prefillFired.current = code;
				// Clear the stash so a redeemed code can't auto-fire again later.
				await AsyncStorage.removeItem(PENDING_REDEMPTION_CODE_KEY);
				submit(code);
			} else {
				// No session yet — keep it stashed; the post-auth handler redeems it.
				await AsyncStorage.setItem(PENDING_REDEMPTION_CODE_KEY, code);
			}
		};
		run();
		return () => {
			cancelled = true;
		};
		// params.code is stable per navigation; submit is memoized. prefillFired
		// makes a given code submit at most once regardless of re-runs.
	}, [params.code, submit]);

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />
			<View style={styles.bg}>
				<SafeAreaView style={{ flex: 1 }}>
					<PageHeader
						kicker="golden ticket"
						title="Redeem a Code"
						onBack={() => router.back()}
					/>
					<KeyboardAvoidingView
						style={{ flex: 1 }}
						behavior={Platform.OS === "ios" ? "padding" : undefined}
					>
						<ScrollView
							contentContainerStyle={[
								styles.scroll,
								// Center the reveal card in the available height; the
								// scan/type flow flows from the top.
								reveal && styles.scrollCentered,
							]}
							showsVerticalScrollIndicator={false}
							keyboardShouldPersistTaps="handled"
						>
							{reveal ? (
								<RevealCard reveal={reveal} onDone={() => router.back()} />
							) : (
								<>
									<CameraPane
										permission={permission}
										requestPermission={requestPermission}
										onScanned={onScanned}
									/>
									<ManualEntry
										value={manual}
										onChange={(t) => {
											setManual(t);
											if (error) setError(null);
											// Editing clears the failed-payload guard so a manual
											// re-submit isn't suppressed by the scanner cooldown.
											lastFailedPayload.current = null;
										}}
										onSubmit={() => submit(manual)}
										busy={busy}
										error={error}
									/>
								</>
							)}
						</ScrollView>
					</KeyboardAvoidingView>
				</SafeAreaView>
			</View>
		</>
	);
}

// The camera pane — fills the top when granted; collapses to a gentle card when
// undetermined (explainer + "Open the camera") or denied (type-instead + Settings).
// Never blocks the flow: the manual field below is always usable.
function CameraPane({
	permission,
	requestPermission,
	onScanned,
}: {
	permission: ReturnType<CameraModule["useCameraPermissions"]>[0];
	requestPermission: ReturnType<CameraModule["useCameraPermissions"]>[1];
	onScanned: (data: string) => void;
}) {
	// No native camera module in this build → collapse straight to the gentle
	// "type it instead" card. The manual field below carries the whole flow.
	if (!Camera) {
		return (
			<Sticker color="paper" rotate={0.4} radius={RADII.lg} style={styles.permCard}>
				<Glyph name="search" size={36} style={{ opacity: 0.9, marginBottom: 8 }} />
				<Text style={styles.permTitle}>Type your code below</Text>
				<Text style={styles.permSub}>
					The camera scanner isn't available on this device — pop your Golden
					Ticket code into the field below.
				</Text>
			</Sticker>
		);
	}

	// Permission still resolving.
	if (!permission) {
		return (
			<View style={styles.cameraFrame}>
				<LoadingBeat label="waking the camera" />
			</View>
		);
	}

	// Undetermined → in-world explainer + opt-in button.
	if (!permission.granted && permission.canAskAgain) {
		return (
			<Sticker color="paper" rotate={-0.4} radius={RADII.lg} style={styles.permCard}>
				<Glyph name="search" size={36} style={{ opacity: 0.9, marginBottom: 8 }} />
				<Text style={styles.permTitle}>Point at a Golden Ticket</Text>
				<Text style={styles.permSub}>
					Rosie only peeks through the camera to read a giveaway QR — nothing else.
				</Text>
				<Button
					variant="primary"
					size="md"
					style={{ marginTop: SPACE.md }}
					onPress={requestPermission}
				>
					Open the camera
				</Button>
			</Sticker>
		);
	}

	// Denied (can't ask again) → collapse to a gentle card, point at Settings.
	if (!permission.granted) {
		return (
			<Sticker color="paper" rotate={0.4} radius={RADII.lg} style={styles.permCard}>
				<Glyph name="zzz" size={36} style={{ opacity: 0.9, marginBottom: 8 }} />
				<Text style={styles.permTitle}>Camera's napping</Text>
				<Text style={styles.permSub}>
					Type the code below instead — or wake the camera in Settings.
				</Text>
				<Button
					variant="ghost"
					size="md"
					style={{ marginTop: SPACE.md }}
					onPress={() => Linking.openSettings()}
				>
					Open Settings
				</Button>
			</Sticker>
		);
	}

	// Granted → live scanner.
	const CameraView = Camera.CameraView;
	return (
		<View style={styles.cameraFrame}>
			<CameraView
				style={StyleSheet.absoluteFill}
				facing="back"
				barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
				onBarcodeScanned={({ data }: { data: string }) => onScanned(data)}
			/>
			<View pointerEvents="none" style={styles.reticle} />
			<Text style={styles.scanHint}>hold a Golden Ticket in the frame</Text>
		</View>
	);
}

// The always-visible manual-entry row: monospace-ish field + Redeem button.
// This is the whole UI on a simulator / no-camera device.
function ManualEntry({
	value,
	onChange,
	onSubmit,
	busy,
	error,
}: {
	value: string;
	onChange: (t: string) => void;
	onSubmit: () => void;
	busy: boolean;
	error: string | null;
}) {
	return (
		<View style={styles.manualWrap}>
			<Text style={styles.manualLabel}>★ or type your code</Text>
			<TextInput
				value={value}
				onChangeText={onChange}
				placeholder="PIG-XXXX-XXXX"
				placeholderTextColor={WHIMSY.mute}
				autoCapitalize="characters"
				autoCorrect={false}
				autoComplete="off"
				style={styles.input}
				editable={!busy}
				returnKeyType="go"
				onSubmitEditing={onSubmit}
			/>
			{!!error && <Text style={styles.errorText}>{error}</Text>}
			<Button
				variant="primary"
				size="lg"
				full
				style={{ marginTop: SPACE.md }}
				disabled={busy || value.trim().length === 0}
				onPress={onSubmit}
			>
				{busy ? "Checking…" : "Redeem"}
			</Button>
		</View>
	);
}

// The reveal — replaces the scanner in place. Names the grant (hat art + name +
// rarity color; truffles/snouts big count + icon). already_owned reassures.
function RevealCard({ reveal, onDone }: { reveal: Reveal; onDone: () => void }) {
	let body: React.ReactNode;

	if (reveal.kind === "hat") {
		const art = reveal.id ? HAT_IMAGES[reveal.id] : undefined;
		const color = reveal.rarity ? RARITY_COLORS[reveal.rarity] : WHIMSY.ink;
		body = (
			<>
				{art ? (
					<Image source={art} style={styles.hatArt} resizeMode="contain" />
				) : (
					<Glyph name="gift" size={72} style={{ marginBottom: SPACE.sm }} />
				)}
				<Text style={[styles.grantName, { color }]}>
					{reveal.name ?? "A new keepsake"}
				</Text>
				<Text style={styles.grantSub}>
					{reveal.already_owned
						? "Rosie already has this one — it's still yours."
						: "A new one for Rosie's closet."}
				</Text>
			</>
		);
	} else if (reveal.kind === "truffles") {
		const amt = reveal.granted_amount ?? 0;
		const truffleArt = HAT_IMAGES.golden_truffle;
		body = (
			<>
				{truffleArt ? (
					<Image source={truffleArt} style={styles.countIconArt} resizeMode="contain" />
				) : (
					<Glyph name="gem" size={56} style={{ marginBottom: SPACE.xs }} />
				)}
				<Text style={styles.grantCount}>+{amt}</Text>
				<Text style={styles.grantSub}>
					golden {amt === 1 ? "truffle" : "truffles"}
				</Text>
			</>
		);
	} else {
		// snouts
		const amt = reveal.amount ?? 0;
		body = (
			<>
				<View style={{ marginBottom: SPACE.xs }}>
					<SnoutCoin size={56} />
				</View>
				<Text style={styles.grantCount}>+{amt}</Text>
				<Text style={styles.grantSub}>{amt === 1 ? "snout" : "snouts"}</Text>
			</>
		);
	}

	return (
		<View style={styles.revealWrap}>
			<Sticker color="sun" rotate={-0.6} radius={RADII.lg} style={styles.revealCard}>
				<Text style={styles.revealKicker}>★ a gift for you</Text>
				{body}
			</Sticker>
			<Button
				variant="primary"
				size="lg"
				full
				style={{ marginTop: SPACE.xl }}
				onPress={onDone}
			>
				Done
			</Button>
		</View>
	);
}

const styles = StyleSheet.create({
	bg: { flex: 1, backgroundColor: WHIMSY.cream },
	scroll: { paddingHorizontal: PAGE_PAD, paddingBottom: TAB_SAFE },
	// When the reveal card is up it's the only content — grow to fill and
	// center it vertically so the gift sits mid-screen, not pinned to the top.
	scrollCentered: { flexGrow: 1, justifyContent: "center" },
	// Camera pane — a tall rounded ink-framed window.
	cameraFrame: {
		aspectRatio: 1,
		width: "100%",
		borderRadius: RADII.lg,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: "#000",
		overflow: "hidden",
		alignItems: "center",
		justifyContent: "center",
		...SHADOW_SM,
		marginBottom: SPACE.lg,
	},
	reticle: {
		width: "62%",
		aspectRatio: 1,
		borderRadius: RADII.md,
		borderWidth: 3,
		borderColor: WHIMSY.sun,
		opacity: 0.9,
	},
	scanHint: {
		position: "absolute",
		bottom: SPACE.md,
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.cream,
		textShadowColor: "rgba(0,0,0,0.6)",
		textShadowRadius: 4,
	},
	// Permission cards (collapsed camera pane).
	permCard: {
		alignItems: "center",
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.xl,
		marginBottom: SPACE.lg,
		...SHADOW_SM,
	},
	permTitle: { ...TYPE.cardTitle, fontFamily: FONTS.whimsy, color: WHIMSY.ink },
	permSub: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.mute,
		textAlign: "center",
		lineHeight: 19,
		marginTop: 4,
	},
	// Manual entry.
	manualWrap: { paddingTop: SPACE.xs },
	manualLabel: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		marginBottom: SPACE.xs,
	},
	input: {
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		backgroundColor: WHIMSY.paper,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.md,
		// No mono token in FONTS; bodyExtra (Nunito 800) + wide tracking reads
		// as a code field within the existing type system.
		fontFamily: FONTS.bodyExtra,
		fontSize: 20,
		letterSpacing: 3,
		color: WHIMSY.ink,
		textAlign: "center",
	},
	errorText: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.accent,
		textAlign: "center",
		marginTop: SPACE.sm,
	},
	// Reveal.
	revealWrap: { paddingTop: SPACE.md },
	revealCard: {
		alignItems: "center",
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.xl,
		...SHADOW_SM,
	},
	revealKicker: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		marginBottom: SPACE.md,
	},
	hatArt: { width: 148, height: 148, marginBottom: SPACE.sm },
	countIconArt: { width: 72, height: 72, marginBottom: SPACE.xs },
	grantName: {
		fontFamily: FONTS.whimsy,
		fontSize: 26,
		textAlign: "center",
	},
	grantCount: { fontFamily: FONTS.whimsy, fontSize: 44, color: WHIMSY.ink },
	grantSub: {
		fontFamily: FONTS.hand,
		fontSize: 15,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: 2,
	},
});

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
	StyleSheet,
	SafeAreaView,
	Image,
	Linking,
	ScrollView,
	KeyboardAvoidingView,
	Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import {
	Button,
	CardTitle,
	Glyph,
	Hand,
	Kicker,
	LoadingBeat,
	PageHeader,
	SnoutCoin,
	Sticker,
	T,
	Tag,
	TextField,
	TicketButton,
} from "@/components/ui";
import { supabase } from "@/utils/supabase";
import { rpcAction } from "@/utils/rpc";
import {
	parseRedemptionPayload,
	parseTradingCardPayload,
	formatRedemptionCode,
	redemptionErrorMessage,
	PENDING_REDEMPTION_CODE_KEY,
} from "@/utils/redemption";
import { HAT_IMAGES, type Rarity } from "@/constants/hats";
import {
	ART_SIZE,
	BORDER,
	LENS_TEXT_SHADOW,
	RADII,
	RARITY_BADGE,
	SHADOW_SM,
	SPACE,
	UI_COLORS,
	WHIMSY_LENS,
	PAGE_PAD,
	TAB_SAFE,
} from "@/constants/theme";
// `import type` is fully erased at compile time (no verbatimModuleSyntax) and
// stripped by Babel's TS preset, so it never emits the runtime `require` that
// the defensive block below guards against — it only pulls in the prop types.
import type { CameraViewProps } from "expo-camera";

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
	CameraView: React.ComponentType<CameraViewProps>;
	useCameraPermissions: () => [
		{ granted: boolean; canAskAgain: boolean } | null,
		() => Promise<unknown>,
	];
};
let Camera: CameraModule | null = null;
try {
	// A static import cannot be wrapped in this try/catch — the whole point is to
	// survive a build whose native module is absent — so the require stays.
	// eslint-disable-next-line @typescript-eslint/no-require-imports
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
			const payload = parseTradingCardPayload(data);
			if (!payload) return;
			if (payload.kind === "app_store") {
				scanLock.current = true;
				Linking.openURL(payload.url).catch(() => {
					scanLock.current = false;
					setError("Couldn't open the App Store — try the QR with your phone camera.");
				});
				return;
			}
			const code = payload.code;
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

	// The root <Stack> declares `headerShown: false` for every route (E13), so
	// this screen no longer opts out for itself.
	return (
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
				<Glyph name="search" size={ART_SIZE.glyph} style={styles.permGlyph} />
				<CardTitle align="center">Type your code below</CardTitle>
				<PermSub>
					The camera scanner isn't available on this device — pop your Golden
					Ticket code into the field below.
				</PermSub>
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
				<Glyph name="search" size={ART_SIZE.glyph} style={styles.permGlyph} />
				<CardTitle align="center">Point at a Golden Ticket</CardTitle>
				<PermSub>
					Rosie only peeks through the camera to read a giveaway QR — nothing else.
				</PermSub>
				<Button
					variant="primary"
					size="md"
					style={styles.permCta}
					onPress={requestPermission}
					accessibilityHint="Asks iOS for camera access so Rosie can read a Golden Ticket QR."
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
				<Glyph name="zzz" size={ART_SIZE.glyph} style={styles.permGlyph} />
				<CardTitle align="center">Camera's napping</CardTitle>
				<PermSub>
					Type the code below instead — or wake the camera in Settings.
				</PermSub>
				<Button
					variant="ghost"
					size="md"
					style={styles.permCta}
					onPress={() => Linking.openSettings()}
					accessibilityHint="Leaves the app for the iOS Settings screen for Tickle the Pig."
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
			<T role="kicker" tone="onDark" style={styles.scanHint}>
				hold a Golden Ticket in the frame
			</T>
		</View>
	);
}

// The two-line reassurance under a permission card's title. One definition, so
// the three states can't drift apart.
function PermSub({ children }: { children: React.ReactNode }) {
	return (
		<Hand tone="secondary" align="center" style={styles.permSub}>
			{children}
		</Hand>
	);
}

// The always-visible manual-entry row: the shared `TextField` + the ticket
// button. This is the whole UI on a simulator / no-camera device. A refusal is
// the field's own error state now (danger fill, written line, spoken hint)
// rather than a loose accent-coloured string underneath it.
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
			<TextField
				label="or type your code"
				variant="code"
				value={value}
				onChangeText={onChange}
				placeholder="PIG-XXXX-XXXX"
				helper="The code printed on your Golden Ticket."
				state={error ? "error" : "default"}
				errorText={error ?? undefined}
				autoCapitalize="characters"
				autoCorrect={false}
				autoComplete="off"
				editable={!busy}
				returnKeyType="go"
				onSubmitEditing={onSubmit}
			/>
			<TicketButton
				label="Redeem ticket"
				stub="Golden"
				tone="golden"
				loading={busy}
				loadingLabel="Checking…"
				style={styles.redeem}
				disabled={value.trim().length === 0}
				onPress={onSubmit}
				accessibilityLabel={
					value.trim() ? `Redeem Golden Ticket ${value.trim()}` : "Redeem ticket"
				}
				accessibilityHint="Claims this code's gift and shows what it held."
			/>
		</View>
	);
}

// The reveal — replaces the scanner in place. Names the grant (hat art + name +
// rarity color; truffles/snouts big count + icon). already_owned reassures.
function RevealCard({ reveal, onDone }: { reveal: Reveal; onDone: () => void }) {
	let body: React.ReactNode;

	if (reveal.kind === "hat") {
		const art = reveal.id ? HAT_IMAGES[reveal.id] : undefined;
		// The rarity is a badge, not a tint on the name: RARITY_BADGE's fill/ink
		// pairs are each verified ≥4.5:1, where the old saturated legend-dot
		// colours were being read as text. [D-02, E30]
		const badge = reveal.rarity ? RARITY_BADGE[reveal.rarity] : undefined;
		body = (
			<>
				{art ? (
					<Image source={art} style={styles.hatArt} resizeMode="contain" />
				) : (
					<Glyph name="gift" size={ART_SIZE.thumb} style={styles.grantGlyph} />
				)}
				<T role="pageTitle" align="center">
					{reveal.name ?? "A new keepsake"}
				</T>
				{badge && reveal.rarity ? (
					<Tag
						label={reveal.rarity}
						ink={badge.ink}
						style={[styles.rarityTag, { backgroundColor: badge.bg }]}
					/>
				) : null}
				<Hand tone="secondary" align="center" style={styles.grantSub}>
					{reveal.already_owned
						? "Rosie already has this one — it's still yours."
						: "A new one for Rosie's closet."}
				</Hand>
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
					<Glyph name="gem" size={ART_SIZE.badge} style={styles.countGlyph} />
				)}
				<T role="hero">+{amt}</T>
				<Hand tone="secondary" align="center" style={styles.grantSub}>
					golden {amt === 1 ? "truffle" : "truffles"}
				</Hand>
			</>
		);
	} else {
		// snouts
		const amt = reveal.amount ?? 0;
		body = (
			<>
				<View style={styles.countGlyph}>
					<SnoutCoin size={ART_SIZE.badge} />
				</View>
				<T role="hero">+{amt}</T>
				<Hand tone="secondary" align="center" style={styles.grantSub}>
					{amt === 1 ? "snout" : "snouts"}
				</Hand>
			</>
		);
	}

	return (
		<View style={styles.revealWrap}>
			<Sticker color="sun" rotate={-0.6} radius={RADII.lg} style={styles.revealCard}>
				<Kicker style={styles.revealKicker}>a gift for you</Kicker>
				{body}
			</Sticker>
			<Button
				variant="primary"
				size="lg"
				full
				style={styles.done}
				onPress={onDone}
				accessibilityHint="Closes the gift and goes back."
			>
				Done
			</Button>
		</View>
	);
}

const styles = StyleSheet.create({
	bg: { flex: 1, backgroundColor: UI_COLORS.surfaceMuted },
	scroll: { paddingHorizontal: PAGE_PAD, paddingBottom: TAB_SAFE },
	// When the reveal card is up it's the only content — grow to fill and
	// center it vertically so the gift sits mid-screen, not pinned to the top.
	scrollCentered: { flexGrow: 1, justifyContent: "center" },
	// Camera pane — a tall rounded ink-framed window onto the lens.
	cameraFrame: {
		aspectRatio: 1,
		width: "100%",
		borderRadius: RADII.lg,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		backgroundColor: WHIMSY_LENS,
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
		borderWidth: BORDER.heavy,
		borderColor: UI_COLORS.actionSurface,
	},
	scanHint: {
		position: "absolute",
		bottom: SPACE.md,
		...LENS_TEXT_SHADOW,
	},
	// Permission cards (collapsed camera pane).
	permCard: {
		alignItems: "center",
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.xl,
		marginBottom: SPACE.lg,
		...SHADOW_SM,
	},
	permGlyph: { marginBottom: SPACE.sm },
	permSub: { marginTop: SPACE.xs },
	permCta: { marginTop: SPACE.md },
	// Manual entry.
	manualWrap: { paddingTop: SPACE.xs },
	redeem: { marginTop: SPACE.md },
	// Reveal.
	revealWrap: { paddingTop: SPACE.md },
	revealCard: {
		alignItems: "center",
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.xl,
		...SHADOW_SM,
	},
	revealKicker: { marginBottom: SPACE.md },
	hatArt: {
		width: ART_SIZE.portrait,
		height: ART_SIZE.portrait,
		marginBottom: SPACE.sm,
	},
	grantGlyph: { marginBottom: SPACE.sm },
	countIconArt: {
		width: ART_SIZE.thumb,
		height: ART_SIZE.thumb,
		marginBottom: SPACE.xs,
	},
	countGlyph: { marginBottom: SPACE.xs },
	rarityTag: { marginTop: SPACE.sm },
	grantSub: { marginTop: SPACE.xxs },
	done: { marginTop: SPACE.xl },
});

// Shared guarded-phase CTA affordances — the pieces a player sees when the patch
// is closed and there's nothing to dig yet. Extracted from SounderStepCard so the
// onboarding first_dig branch AND the retained-player CrewedHome guarded state
// offer the SAME "oink me for every Feeding" toggle (no forked copy), plus the Burrow
// Book as a real secondary affordance instead of an afterthought link.
//
//   NotifyChip     — the persistent account-level Feeding push toggle. Server
//                    truth is refreshed on mount and foreground so every device
//                    shows the same preference; denied devices get Settings help.
//   BurrowBookLink — the dig's relic shelf, styled as a bordered secondary button
//                    (paper pill + ink outline), not a bare underlined link.

import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, View, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Chip, Glyph, Kicker } from "@/components/ui";
import {
	ensurePushPermission,
	getDevicePushPermission,
	getFeedingPushPreference,
	setFeedingPushPreference,
} from "@/utils/pushNotifications";
import { PRESSED_FLAT, RADII, SPACE, TAP_MIN, UI_COLORS } from "@/constants/theme";

// The little state mark beside the toggle line — an inline glyph, not an icon
// action, so it takes the `mark`-sized art box rather than a tap target.
const TOGGLE_MARK = 14;

type DevicePermission = Awaited<ReturnType<typeof getDevicePushPermission>>;

// "Oink me for every Feeding" — one shared toggle rendered everywhere the
// guarded patch offers reminders. The account preference is never inferred
// from component state or a local scheduled job.
export function NotifyChip() {
	const [enabled, setEnabled] = useState<boolean | null>(null);
	const [permission, setPermission] = useState<DevicePermission>("undetermined");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState(false);

	const refresh = useCallback(async () => {
		try {
			const [serverEnabled, devicePermission] = await Promise.all([
				getFeedingPushPreference(),
				getDevicePushPermission(),
			]);
			setPermission(devicePermission);
			if (serverEnabled == null) {
				setError(true);
				return;
			}
			// A preference enabled on another device still needs this already-
			// permissioned install's token registered. This does not prompt: the
			// permission read above proved it is granted.
			const tokenReady =
				serverEnabled && devicePermission === "granted"
					? Boolean(await ensurePushPermission())
					: true;
			setEnabled(serverEnabled);
			setError(!tokenReady);
		} catch {
			setError(true);
		}
	}, []);

	useEffect(() => {
		// This synchronizes external account/OS state; it is not render-derived.
		// eslint-disable-next-line react-hooks/set-state-in-effect
		void refresh();
		const subscription = AppState.addEventListener("change", (next) => {
			if (next === "active") void refresh();
		});
		return () => subscription.remove();
	}, [refresh]);

	const onPress = useCallback(async () => {
		if (busy || enabled == null) return;
		Haptics.selectionAsync().catch(() => {});
		setBusy(true);
		setError(false);
		try {
			const result = await setFeedingPushPreference(!enabled);
			if (result === "enabled") {
				setEnabled(true);
				setPermission("granted");
			} else if (result === "disabled") {
				setEnabled(false);
			} else if (result === "denied") {
				setPermission("denied");
			} else {
				setError(true);
			}
		} catch {
			setError(true);
		} finally {
			setBusy(false);
		}
	}, [busy, enabled]);

	const enableOnThisDevice = useCallback(async () => {
		if (busy || enabled !== true) return;
		setBusy(true);
		setError(false);
		try {
			const result = await setFeedingPushPreference(true);
			if (result === "enabled") {
				setPermission("granted");
			} else if (result === "denied") {
				setPermission("denied");
			} else {
				setError(true);
			}
		} catch {
			setError(true);
		} finally {
			setBusy(false);
		}
	}, [busy, enabled]);

	const permissionBlocked = permission === "denied";
	const permissionNeedsPrompt =
		enabled === true && permission === "undetermined";
	const permissionUnavailable = permission === "unavailable";
	const label =
		enabled == null
			? "checking Feeding oinks…"
			: enabled
				? "oinks on for every Feeding"
				: "oink me for every Feeding";

	return (
		<View style={styles.notifyWrap}>
			<Pressable
				testID="feeding-push-toggle"
				onPress={onPress}
				hitSlop={6}
				disabled={busy || enabled == null}
				accessibilityRole="switch"
				accessibilityLabel="Oink me for every Feeding"
				accessibilityState={{
					checked: enabled === true,
					disabled: busy || enabled == null,
					busy,
				}}
				accessibilityHint="Sends a push when the Truffle Patch opens"
				style={({ pressed }) => [
					styles.notifyRow,
					enabled && styles.notifyRowEnabled,
					pressed && PRESSED_FLAT,
				]}
			>
				<Glyph name={enabled ? "check" : "gem"} size={TOGGLE_MARK} />
				<Kicker star={false} style={enabled ? styles.notifySet : undefined}>
					{busy ? "saving Feeding oinks…" : label}
				</Kicker>
				{enabled != null && (
					<Kicker star={false} tone="secondary">
						{enabled ? "ON" : "OFF"}
					</Kicker>
				)}
			</Pressable>
			{permissionBlocked && (
				<Pressable
					testID="feeding-push-settings"
					onPress={() => Linking.openSettings()}
					hitSlop={6}
					style={styles.notifyRecoveryTarget}
					accessibilityRole="button"
					accessibilityLabel="Allow notifications for this device in Settings"
					accessibilityHint="Opens this app's iOS Settings page"
				>
					<Kicker star={false} tone="secondary" align="center" style={styles.notifyDenied}>
						allow notifications for this device in Settings ›
					</Kicker>
				</Pressable>
			)}
			{permissionNeedsPrompt && (
				<Pressable
					onPress={enableOnThisDevice}
					hitSlop={6}
					style={styles.notifyRecoveryTarget}
					accessibilityRole="button"
					accessibilityLabel="Allow Feeding oinks on this device"
					accessibilityHint="Asks this device for notification permission"
				>
					<Kicker star={false} tone="secondary" align="center" style={styles.notifyDenied}>
						allow Feeding oinks on this device ›
					</Kicker>
				</Pressable>
			)}
			{permissionUnavailable && (
				<Kicker star={false} tone="secondary" align="center" style={styles.notifyDenied}>
					Feeding oinks need notifications on a supported device
				</Kicker>
			)}
			{error && (
				<Kicker
					star={false}
					tone="secondary"
					align="center"
					style={styles.notifyDenied}
					accessibilityLiveRegion="polite"
				>
					couldn't update Feeding oinks — try again
				</Kicker>
			)}
		</View>
	);
}

// The Burrow Book — the dig's relic shelf. A real bordered secondary affordance
// (paper pill + ink outline + hard shadow), not a bare underlined afterthought.
export function BurrowBookLink() {
	return (
		<Chip
			label="the Burrow Book"
			glyph="gem"
			onPress={() => router.push("/dig-collection")}
			accessibilityLabel="Open the Burrow Book"
			accessibilityHint="Shows the relics you have dug up"
			style={styles.burrowBtn}
		/>
	);
}

const styles = StyleSheet.create({
	// Notify opt-in on the guarded state.
	notifyRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.xs,
		marginTop: SPACE.sm,
		paddingHorizontal: SPACE.sm,
		paddingVertical: SPACE.xs,
		minHeight: TAP_MIN,
		borderRadius: RADII.pill,
	},
	notifyWrap: { alignItems: "center" },
	notifyRowEnabled: { backgroundColor: UI_COLORS.surface },
	// The "it's on" state. Was `WHIMSY.sage` — a pastel FILL used as text, which
	// reads ~1.3:1 on paper; the semantic success ink says the same thing and is
	// legible. [spec §1.1: pastel fills are never assigned to `color:`]
	notifySet: { color: UI_COLORS.successText },
	notifyRecoveryTarget: {
		minHeight: TAP_MIN,
		justifyContent: "center",
	},
	notifyDenied: { marginTop: SPACE.sm },
	// The Burrow Book secondary capsule — the shared Chip drawing, nudged off
	// the control above it and centred under the card.
	burrowBtn: { alignSelf: "center", marginTop: SPACE.sm },
});

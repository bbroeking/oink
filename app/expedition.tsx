// Expedition v0 — Rosie's Ramble, the first playable slice. Client-local and
// DEV-GATED (like app/idle-battler-prototype.tsx): navigable at /expedition, but
// redirects to home in any non-dev build. Zero server / migration surface — the
// pure kernel (utils/expedition.ts) + AsyncStorage hook (hooks/useExpedition.ts)
// run the whole loop. See docs/expedition-v0-playable-spec.md.
import React, { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, SafeAreaView } from "react-native";
import { Redirect, Stack, useFocusEffect } from "expo-router";

import { PageBackground } from "@/components/ui/PageBackground";
import { LoadingBeat } from "@/components/ui/EmptyState";
import { useExpedition } from "@/hooks/useExpedition";
import {
	RADII,
	SPACE,
	TYPE,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import { JournalHome } from "@/components/expedition/JournalHome";
import { ScuffleView } from "@/components/expedition/ScuffleView";
import { PostcardModal } from "@/components/expedition/PostcardModal";
import { TrainingSheet } from "@/components/expedition/TrainingSheet";
import { BestiaryShelf } from "@/components/expedition/BestiaryShelf";

type ScreenView = "journal" | "fight";
type Overlay = "training" | "bestiary" | null;

export default function ExpeditionScreen() {
	if (!__DEV__) return <Redirect href="/" />;
	return <ExpeditionLab />;
}

function ExpeditionLab() {
	const exp = useExpedition();
	const [view, setView] = useState<ScreenView>("journal");
	const [overlay, setOverlay] = useState<Overlay>(null);

	// Re-settle whatever time passed while the screen was away.
	useFocusEffect(
		useCallback(() => {
			exp.refresh();
		}, [exp])
	);

	const dateKey = new Date().toISOString().slice(0, 10);
	const state = exp.state;

	return (
		<PageBackground bgId="homestead_barn">
			<SafeAreaView style={styles.root}>
				<Stack.Screen options={{ headerShown: false }} />

				{!state ? (
					<LoadingBeat label="saddling up" glyph="pigface" />
				) : view === "fight" && state.wallEnemyId ? (
					<ScuffleView
						state={state}
						onTickle={exp.tickle}
						onPlayCard={exp.playCard}
						onBack={() => setView("journal")}
					/>
				) : (
					<JournalHome
						state={state}
						dateKey={dateKey}
						onEquip={exp.equip}
						onTuck={exp.tuck}
						onTickle={exp.tickle}
						onOpenFight={() => setView("fight")}
						onOpenTraining={() => setOverlay("training")}
						onOpenBestiary={() => setOverlay("bestiary")}
					/>
				)}

				{/* Dev drawer — the time-warp, reset, and a bark-panel state readout,
				    styled like the prototype's readout. Collapsed by default. */}
				{state && <DevDrawer exp={exp} state={state} />}

				{/* Overlays (in-screen, NOT the global PopupQueue) */}
				{exp.pendingReport && (
					<PostcardModal
						report={exp.pendingReport}
						onClose={() => {
							exp.dismissReport();
							if (state?.wallEnemyId) setView("journal");
						}}
					/>
				)}
				{state && overlay === "training" && (
					<TrainingSheet
						state={state}
						onTrain={exp.train}
						onClose={() => setOverlay(null)}
					/>
				)}
				{state && overlay === "bestiary" && (
					<BestiaryShelf state={state} onClose={() => setOverlay(null)} />
				)}
			</SafeAreaView>
		</PageBackground>
	);
}

function DevDrawer({
	exp,
	state,
}: {
	exp: ReturnType<typeof useExpedition>;
	state: NonNullable<ReturnType<typeof useExpedition>["state"]>;
}) {
	const [open, setOpen] = useState(false);
	return (
		<View style={styles.drawer}>
			<Pressable onPress={() => setOpen((o) => !o)} style={styles.drawerHandle}>
				<Text style={styles.drawerHandleText}>
					{open ? "▾ dev" : "▸ dev tools"}
				</Text>
			</Pressable>
			{open && (
				<View style={styles.drawerBody}>
					<Text style={styles.drawerHint}>
						Warp the hours forward to let Rosie walk, then read her postcard.
					</Text>
					<View style={styles.drawerRow}>
						<DevBtn label="+1h" onPress={() => exp.warp(1)} />
						<DevBtn label="+8h" onPress={() => exp.warp(8)} />
						<DevBtn label="reset" onPress={exp.reset} />
					</View>
					<Text style={styles.readout}>
						seg {state.segment}/12 · wall {state.wallEnemyId ?? "none"}
						{state.wallHp !== null ? ` (${state.wallHp}hp)` : ""}
					</Text>
					<Text style={styles.readout}>
						tickles {state.mockTickles} · zoomies {state.zoomies}/5 · trip{" "}
						{state.tripIndex} · training {state.training.length}/5
					</Text>
					<Text style={styles.readout}>
						tucked {state.tuckedCardId ?? "none"} · cleared{" "}
						{String(state.chapterCleared)}
					</Text>
				</View>
			)}
		</View>
	);
}

function DevBtn({ label, onPress }: { label: string; onPress: () => void }) {
	return (
		<Pressable
			onPress={onPress}
			style={({ pressed }) => [styles.devBtn, pressed && { opacity: 0.7 }]}
		>
			<Text style={styles.devBtnText}>{label}</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1 },
	drawer: {
		position: "absolute",
		left: SPACE.md,
		right: SPACE.md,
		bottom: SPACE.md,
		backgroundColor: WHIMSY.bark,
		borderRadius: RADII.lg,
		borderWidth: 2,
		borderColor: UI_COLORS.border,
		overflow: "hidden",
		zIndex: 20,
	},
	drawerHandle: { paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm },
	drawerHandleText: { ...TYPE.kickerPill, color: WHIMSY.sun },
	drawerBody: {
		paddingHorizontal: SPACE.md,
		paddingBottom: SPACE.md,
		gap: SPACE.xs,
	},
	drawerHint: { ...TYPE.bodySm, color: WHIMSY.barkMute, marginBottom: SPACE.xs },
	drawerRow: { flexDirection: "row", gap: SPACE.sm, marginBottom: SPACE.xs },
	devBtn: {
		flex: 1,
		alignItems: "center",
		paddingVertical: SPACE.sm,
		borderRadius: RADII.sm,
		borderWidth: 1.5,
		borderColor: WHIMSY.sun,
		backgroundColor: "transparent",
	},
	devBtnText: { ...TYPE.label, color: WHIMSY.barkText },
	readout: { fontFamily: "SpaceMono-Regular", fontSize: 11, color: WHIMSY.barkText },
});

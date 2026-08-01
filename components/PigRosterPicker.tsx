import React, { useEffect, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { PigPortrait } from "./ui/PigPortrait";
import { Glyph, type GlyphName } from "./ui/Glyph";
import { useUnmanagedModalHold } from "./ui/PopupQueue";
import { MODAL_BACKDROP_BG, RADII, SHADOW_SM, SPACE, TYPE, WHIMSY } from "@/constants/theme";
import { pigRosterActionMessage, type PigRoster } from "@/utils/pigRoster";
import { pigDefinition, type PigId } from "@/utils/pigs";
import type { RpcResult } from "@/utils/rpc";

interface Props {
	roster: PigRoster;
	loading: boolean;
	busyPigId: PigId | null;
	openSignal?: string;
	onRecruit: (pigId: PigId) => Promise<RpcResult<{ pig_id: PigId }>>;
	onActivate: (pigId: PigId) => Promise<RpcResult<{ pig_id: PigId }>>;
}

export function PigRosterPicker({
	roster,
	loading,
	busyPigId,
	openSignal,
	onRecruit,
	onActivate,
}: Props) {
	const [open, setOpen] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	useUnmanagedModalHold(open);
	const activePig = roster.pigs.find((pig) => pig.id === roster.activePigId);

	useEffect(() => {
		if (openSignal) setOpen(true);
	}, [openSignal]);

	const act = async (pigId: PigId, owned: boolean) => {
		Haptics.selectionAsync().catch(() => {});
		setMessage(null);
		const result = owned ? await onActivate(pigId) : await onRecruit(pigId);
		setMessage(pigRosterActionMessage(result));
		if (result.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
		}
	};

	const requestAct = (pigId: PigId, owned: boolean) => {
		if (!owned && roster.recruitedPigId) return;
		if (!owned) {
			const pig = pigDefinition(pigId);
			Alert.alert(
				`Choose ${pig.name} as Rosie’s friend?`,
				"This is your one long-term companion choice. You can’t change it right now.",
				[
					{ text: "Keep looking", style: "cancel" },
					{
						text: `Choose ${pig.name}`,
						onPress: () => void act(pigId, false),
					},
				],
			);
			return;
		}
		void act(pigId, owned);
	};

	return (
		<>
			<Pressable
				onPress={() => {
					setMessage(null);
					setOpen(true);
				}}
				style={({ pressed }) => [styles.homeChip, pressed && styles.pressed]}
				accessibilityRole="button"
				accessibilityLabel={`Open pig roster. ${activePig?.name ?? "Rosie"} is on the homepage`}
			>
				<Text style={styles.homeChipName}>{activePig?.name ?? "Rosie"}</Text>
				<Text style={styles.homeChipHint}>{roster.isMember ? "switch pig ▾" : "pig roster ▾"}</Text>
			</Pressable>

			{open && (
				<Modal visible transparent animationType="slide" onRequestClose={() => setOpen(false)}>
					<View style={styles.backdrop}>
						<Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
						<View style={styles.sheet}>
							<View style={styles.grabber} />
							<Text style={styles.kicker}>★ YOUR PIGS</Text>
							<Text style={styles.title}>Who’s hanging out?</Text>
							<Text style={styles.subtitle}>
								Everyone starts with Rosie. Slop Club members choose one long-term friend, then
								choose whether Rosie or that friend greets them at home.
							</Text>

							<ScrollView
								style={styles.scroll}
								contentContainerStyle={styles.grid}
								showsVerticalScrollIndicator={false}
							>
								{roster.pigs.map((pig) => {
									const selected = pig.id === roster.activePigId;
									const lockedByLapsedMembership =
										pig.owned && pig.id !== "rosie" && !roster.isMember;
									const disabled =
										busyPigId != null ||
										selected ||
										(!pig.owned && roster.recruitedPigId != null) ||
										(!pig.owned && !pig.recruitable) ||
										lockedByLapsedMembership;
									const buttonLabel = selected
										? "On homepage"
										: pig.owned
											? lockedByLapsedMembership
												? "Membership paused"
												: "Put on homepage"
											: pig.recruitable
												? "Recruit"
												: roster.recruitedPigId
													? "Choice locked"
													: "Slop Club friend";
									const definition = pigDefinition(pig.id);
									const motif: GlyphName =
										definition.motif === "mask"
											? "mask"
											: definition.motif === "heart"
												? "heart"
												: definition.motif === "spark"
													? "sparkle"
													: definition.motif === "leaf" || definition.motif === "wheat"
														? "sun"
														: "pigface";

									return (
										<View key={pig.id} style={[styles.pigCard, selected && styles.pigCardSelected]}>
											<View style={styles.tape} />
											<View style={[styles.pigArt, { backgroundColor: definition.accent + "33" }]}>
												<View style={styles.motif}>
													<Glyph name={motif} size={18} />
												</View>
												<PigPortrait
													size={112}
													pigId={pig.id}
												/>
											</View>
											<View style={[styles.ribbon, { backgroundColor: definition.accent }]}>
												<View style={styles.ribbonTailLeft} />
												<Text style={styles.pigName}>{pig.name}</Text>
												<View style={styles.ribbonTailRight} />
											</View>
											<Text style={styles.pigCoat}>{pig.coat}</Text>
											<Pressable
												disabled={disabled}
												onPress={() => requestAct(pig.id, pig.owned)}
												style={({ pressed }) => [
													styles.action,
													{ backgroundColor: definition.accent },
													selected && styles.actionSelected,
													disabled && !selected && styles.actionDisabled,
													pressed && styles.pressed,
												]}
											>
												{busyPigId === pig.id ? (
													<ActivityIndicator size="small" color={WHIMSY.ink} />
												) : (
													<Text style={styles.actionText}>{buttonLabel}</Text>
												)}
											</Pressable>
										</View>
									);
								})}
							</ScrollView>

							{message && <Text style={styles.message}>{message}</Text>}
							{loading && busyPigId == null && (
								<ActivityIndicator size="small" color={WHIMSY.ink} />
							)}
							<Pressable onPress={() => setOpen(false)} style={styles.close}>
								<Text style={styles.closeText}>Done</Text>
							</Pressable>
						</View>
					</View>
				</Modal>
			)}
		</>
	);
}

const styles = StyleSheet.create({
	homeChip: {
		alignSelf: "center",
		flexDirection: "row",
		alignItems: "baseline",
		gap: SPACE.sm,
		paddingHorizontal: SPACE.md,
		paddingVertical: 7,
		marginBottom: SPACE.xs,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.paper,
		...SHADOW_SM,
		zIndex: 3,
	},
	homeChipName: { ...TYPE.cardTitle, color: WHIMSY.ink },
	homeChipHint: { ...TYPE.kicker, color: WHIMSY.mute },
	pressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
	backdrop: {
		flex: 1,
		justifyContent: "flex-end",
		backgroundColor: MODAL_BACKDROP_BG,
	},
	sheet: {
		maxHeight: "88%",
		paddingHorizontal: SPACE.lg,
		paddingTop: SPACE.sm,
		paddingBottom: 28,
		borderTopLeftRadius: RADII.xxl,
		borderTopRightRadius: RADII.xxl,
		borderWidth: 2,
		borderBottomWidth: 0,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
	},
	grabber: {
		alignSelf: "center",
		width: 42,
		height: 5,
		marginBottom: SPACE.md,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.ink,
		opacity: 0.22,
	},
	kicker: { ...TYPE.kickerPill, color: WHIMSY.accent, textAlign: "center" },
	title: {
		...TYPE.pageTitle,
		color: WHIMSY.ink,
		textAlign: "center",
		marginTop: 2,
	},
	subtitle: {
		...TYPE.bodySm,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: SPACE.sm,
		marginBottom: SPACE.md,
	},
	scroll: { flexGrow: 0 },
	grid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: SPACE.sm,
		paddingBottom: SPACE.sm,
	},
	pigCard: {
		width: "48.5%",
		alignItems: "center",
		paddingHorizontal: SPACE.sm,
		paddingTop: SPACE.md,
		paddingBottom: SPACE.sm,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		backgroundColor: WHIMSY.cream,
		...SHADOW_SM,
	},
	pigCardSelected: { backgroundColor: WHIMSY.slopBand, borderWidth: 3 },
	tape: {
		position: "absolute",
		top: -7,
		width: 52,
		height: 17,
		borderWidth: 1,
		borderColor: "#C8AD77",
		backgroundColor: "#EAD59E",
		opacity: 0.88,
		transform: [{ rotate: "-2deg" }],
		zIndex: 4,
	},
	pigArt: {
		width: "100%",
		height: 118,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
		borderRadius: RADII.md,
	},
	motif: {
		position: "absolute",
		top: 6,
		right: 6,
		width: 28,
		height: 28,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.paper,
		zIndex: 3,
	},
	ribbon: {
		minWidth: 100,
		alignItems: "center",
		marginTop: -4,
		paddingHorizontal: SPACE.md,
		paddingVertical: 2,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 3,
		zIndex: 3,
	},
	ribbonTailLeft: {
		position: "absolute",
		left: -9,
		top: 7,
		width: 13,
		height: 13,
		backgroundColor: WHIMSY.ink,
		transform: [{ rotate: "45deg" }],
		zIndex: -1,
	},
	ribbonTailRight: {
		position: "absolute",
		right: -9,
		top: 7,
		width: 13,
		height: 13,
		backgroundColor: WHIMSY.ink,
		transform: [{ rotate: "45deg" }],
		zIndex: -1,
	},
	pigName: {
		...TYPE.hand,
		fontSize: 24,
		lineHeight: 28,
		color: WHIMSY.ink,
	},
	pigCoat: {
		...TYPE.kicker,
		color: WHIMSY.mute,
		textAlign: "center",
		minHeight: 34,
		marginTop: SPACE.xs,
	},
	action: {
		width: "100%",
		minHeight: 38,
		alignItems: "center",
		justifyContent: "center",
		marginTop: SPACE.sm,
		paddingHorizontal: SPACE.xs,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.sun,
	},
	actionSelected: { backgroundColor: WHIMSY.sage },
	actionDisabled: { opacity: 0.45, backgroundColor: WHIMSY.cream2 },
	actionText: { ...TYPE.label, color: WHIMSY.ink, textAlign: "center" },
	message: {
		...TYPE.bodySm,
		color: WHIMSY.ink,
		textAlign: "center",
		marginTop: SPACE.sm,
	},
	close: {
		alignSelf: "center",
		minWidth: 120,
		alignItems: "center",
		marginTop: SPACE.md,
		paddingVertical: SPACE.sm,
		paddingHorizontal: SPACE.xl,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.ink,
	},
	closeText: { ...TYPE.label, color: WHIMSY.paper },
});

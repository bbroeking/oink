import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
	View,
	Text,
	ScrollView,
	Pressable,
	StyleSheet,
	Image,
	ImageBackground,
	SafeAreaView,
	TextInput,
	PanResponder,
} from "react-native";
import { Stack } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../utils/supabase";
import {
	HAT_IMAGES,
	HAT_OVERLAYS,
	CATEGORY_OVERLAYS,
	DEFAULT_HAT_OVERLAY,
	HatRow,
	HatOverlay,
} from "@/constants/hats";
import { COLORS, FONTS, SHADOWS } from "@/constants/theme";

const STORAGE_KEY = "align_overrides_v1";
const PIG_SIZE = 300;

const CATEGORY_ORDER = [
	"hat",
	"glasses",
	"bow",
	"scarf",
	"mask",
	"necklace",
	"cape",
	"held",
	"aura",
	"background",
];

export default function AlignScreen() {
	if (!__DEV__) return null;
	const [items, setItems] = useState<HatRow[]>([]);
	const [overrides, setOverrides] = useState<Record<string, HatOverlay>>({});
	const [currentId, setCurrentId] = useState<string | null>(null);
	const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
	const [step, setStep] = useState<1 | 5 | 10>(5);
	const [showExport, setShowExport] = useState(false);
	const [showOutline, setShowOutline] = useState(true);
	const [hydrated, setHydrated] = useState(false);

	useEffect(() => {
		(async () => {
			const [itemsRes, ovRaw] = await Promise.all([
				supabase
					.from("hats")
					.select(
						"id, name, cost, display_order, emoji, image_path, category, rarity, description"
					)
					.order("display_order"),
				AsyncStorage.getItem(STORAGE_KEY),
			]);
			const rows = (itemsRes.data ?? []) as HatRow[];
			setItems(rows);
			if (rows.length > 0) setCurrentId((c) => c ?? rows[0].id);
			if (ovRaw) {
				try {
					setOverrides(JSON.parse(ovRaw));
				} catch {}
			}
			setHydrated(true);
		})();
	}, []);

	useEffect(() => {
		if (!hydrated) return;
		AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(overrides)).catch(() => {});
	}, [overrides, hydrated]);

	const current = useMemo(
		() => items.find((i) => i.id === currentId) ?? null,
		[items, currentId]
	);

	const baseOverlay = useCallback(
		(id: string, category?: string): HatOverlay => {
			return (
				overrides[id] ??
				HAT_OVERLAYS[id] ??
				(category ? CATEGORY_OVERLAYS[category] : undefined) ??
				DEFAULT_HAT_OVERLAY
			);
		},
		[overrides]
	);

	const overlay = current ? baseOverlay(current.id, current.category) : null;
	const imageSrc = current ? HAT_IMAGES[current.id] : null;
	const emoji = current?.emoji ?? null;

	const update = useCallback(
		(delta: Partial<HatOverlay>) => {
			if (!current) return;
			setOverrides((o) => {
				const cur =
					o[current.id] ??
					HAT_OVERLAYS[current.id] ??
					(current.category
						? CATEGORY_OVERLAYS[current.category]
						: undefined) ??
					DEFAULT_HAT_OVERLAY;
				return {
					...o,
					[current.id]: {
						bottom: clamp((cur.bottom ?? 0) + (delta.bottom ?? 0), 0, PIG_SIZE),
						left: clamp((cur.left ?? 0) + (delta.left ?? 0), 0, PIG_SIZE),
						width: clamp((cur.width ?? 0) + (delta.width ?? 0), 10, 400),
						height: clamp((cur.height ?? 0) + (delta.height ?? 0), 10, 400),
					},
				};
			});
		},
		[current]
	);

	const reset = useCallback(() => {
		if (!current) return;
		setOverrides((o) => {
			const { [current.id]: _, ...rest } = o;
			return rest;
		});
	}, [current]);

	const goByOffset = useCallback(
		(delta: number) => {
			if (!currentId || items.length === 0) return;
			const idx = items.findIndex((i) => i.id === currentId);
			const next = items[(idx + delta + items.length) % items.length];
			setCurrentId(next.id);
		},
		[items, currentId]
	);

	// Drag-to-reposition on the overlay box
	const dragStart = useRef<{ left: number; bottom: number } | null>(null);
	const stateRef = useRef({ current, overlay });
	stateRef.current = { current, overlay };

	const pan = useMemo(
		() =>
			PanResponder.create({
				onStartShouldSetPanResponder: () => true,
				onMoveShouldSetPanResponder: () => true,
				onPanResponderGrant: () => {
					const { overlay } = stateRef.current;
					if (!overlay) return;
					dragStart.current = {
						left: overlay.left,
						bottom: overlay.bottom,
					};
				},
				onPanResponderMove: (_, gs) => {
					const { current } = stateRef.current;
					if (!current || !dragStart.current) return;
					const newLeft = clamp(
						Math.round(dragStart.current.left + gs.dx),
						0,
						PIG_SIZE
					);
					const newBottom = clamp(
						Math.round(dragStart.current.bottom - gs.dy),
						0,
						PIG_SIZE
					);
					setOverrides((o) => {
						const base =
							o[current.id] ??
							HAT_OVERLAYS[current.id] ??
							(current.category
								? CATEGORY_OVERLAYS[current.category]
								: undefined) ??
							DEFAULT_HAT_OVERLAY;
						return {
							...o,
							[current.id]: { ...base, left: newLeft, bottom: newBottom },
						};
					});
				},
				onPanResponderRelease: () => {
					dragStart.current = null;
				},
			}),
		[]
	);

	const categories = useMemo(() => {
		const set = new Set<string>();
		items.forEach((i) => i.category && set.add(i.category));
		return Array.from(set).sort((a, b) => {
			const ai = CATEGORY_ORDER.indexOf(a);
			const bi = CATEGORY_ORDER.indexOf(b);
			return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
		});
	}, [items]);

	const filteredItems = useMemo(
		() =>
			categoryFilter
				? items.filter((i) => i.category === categoryFilter)
				: items,
		[items, categoryFilter]
	);

	const exportSnippet = useMemo(() => {
		const entries = Object.entries(overrides);
		if (!entries.length) return "// No overrides yet — nudge an item to start.";
		const lines = entries.map(([id, o]) => {
			const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(id) ? id : `'${id}'`;
			return `\t${safeKey}: { bottom: ${o.bottom}, left: ${o.left}, width: ${o.width}, height: ${o.height} },`;
		});
		return `// Paste into HAT_OVERLAYS in constants/hats.ts:\n${lines.join("\n")}`;
	}, [overrides]);

	return (
		<View style={styles.container}>
			<Stack.Screen options={{ title: "Align Items" }} />
			<SafeAreaView style={{ flex: 1 }}>
				{/* Category chips */}
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={styles.chipsRow}
				>
					<Chip
						label="All"
						active={!categoryFilter}
						onPress={() => setCategoryFilter(null)}
					/>
					{categories.map((c) => (
						<Chip
							key={c}
							label={c}
							active={categoryFilter === c}
							onPress={() => setCategoryFilter(categoryFilter === c ? null : c)}
						/>
					))}
				</ScrollView>

				{/* Item picker */}
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={styles.itemRow}
				>
					{filteredItems.map((it) => {
						const active = it.id === currentId;
						const has = overrides[it.id] != null;
						const src = HAT_IMAGES[it.id];
						return (
							<Pressable
								key={it.id}
								onPress={() => setCurrentId(it.id)}
								style={[styles.item, active && styles.itemActive]}
							>
								{src ? (
									<Image
										source={src}
										style={{ width: 36, height: 36 }}
										resizeMode="contain"
									/>
								) : (
									<Text style={{ fontSize: 24 }}>{it.emoji ?? "?"}</Text>
								)}
								{has && <View style={styles.dot} />}
							</Pressable>
						);
					})}
				</ScrollView>

				<View style={styles.stage}>
					<View style={styles.card}>
						<ImageBackground
							source={require("../assets/images/pig.png")}
							style={styles.cardImage}
							imageStyle={styles.cardImageStyle}
							resizeMode="cover"
						/>
						{/* Center crosshair for reference */}
						<View pointerEvents="none" style={styles.crosshairV} />
						<View pointerEvents="none" style={styles.crosshairH} />
						{overlay && current && (
							<View
								{...pan.panHandlers}
								style={[styles.overlayBox, overlay]}
							>
								{imageSrc ? (
									<Image
										source={imageSrc}
										style={styles.fillImage}
										resizeMode="contain"
									/>
								) : emoji ? (
									<Text
										style={[
											styles.emojiOverlay,
											{
												fontSize:
													Math.min(overlay.width, overlay.height) *
													0.7,
											},
										]}
									>
										{emoji}
									</Text>
								) : null}
								{showOutline && <View pointerEvents="none" style={styles.outline} />}
							</View>
						)}
					</View>
				</View>

				{/* Live values + nav */}
				{current && overlay && (
					<View style={styles.values}>
						<View style={styles.navRow}>
							<Pressable onPress={() => goByOffset(-1)} style={styles.navBtn}>
								<Text style={styles.navText}>‹ prev</Text>
							</Pressable>
							<View style={{ flex: 1, alignItems: "center" }}>
								<Text style={styles.itemName}>{current.name}</Text>
								<Text style={styles.itemMeta}>
									{current.id} · {current.category}
									{imageSrc ? " · PNG" : " · emoji"}
								</Text>
							</View>
							<Pressable onPress={() => goByOffset(1)} style={styles.navBtn}>
								<Text style={styles.navText}>next ›</Text>
							</Pressable>
						</View>
						<Text style={styles.valuesText}>
							b:{overlay.bottom}  l:{overlay.left}  w:{overlay.width}  h:
							{overlay.height}
						</Text>
					</View>
				)}

				<View style={styles.controls}>
					<View style={styles.padRow}>
						<View style={{ flex: 1 }} />
						<NudgeBtn label="↑" onPress={() => update({ bottom: step })} />
						<View style={{ flex: 1 }} />
					</View>
					<View style={styles.padRow}>
						<NudgeBtn label="←" onPress={() => update({ left: -step })} />
						<Pressable onPress={reset} style={styles.resetBtn}>
							<Text style={styles.resetText}>↺</Text>
						</Pressable>
						<NudgeBtn label="→" onPress={() => update({ left: step })} />
					</View>
					<View style={styles.padRow}>
						<View style={{ flex: 1 }} />
						<NudgeBtn label="↓" onPress={() => update({ bottom: -step })} />
						<View style={{ flex: 1 }} />
					</View>

					<View style={styles.sizeRow}>
						<NudgeBtn small label="W−" onPress={() => update({ width: -step })} />
						<NudgeBtn small label="W+" onPress={() => update({ width: step })} />
						<NudgeBtn small label="H−" onPress={() => update({ height: -step })} />
						<NudgeBtn small label="H+" onPress={() => update({ height: step })} />
					</View>

					<View style={styles.bottomRow}>
						<View style={styles.stepGroup}>
							{([1, 5, 10] as const).map((s) => (
								<Pressable
									key={s}
									onPress={() => setStep(s)}
									style={[styles.toggle, step === s && styles.toggleOn]}
								>
									<Text
										style={[
											styles.toggleText,
											step === s && styles.toggleTextOn,
										]}
									>
										{s}px
									</Text>
								</Pressable>
							))}
						</View>
						<Pressable
							onPress={() => setShowOutline((v) => !v)}
							style={[styles.toggle, !showOutline && styles.toggleOn]}
						>
							<Text
								style={[
									styles.toggleText,
									!showOutline && styles.toggleTextOn,
								]}
							>
								{showOutline ? "outline on" : "outline off"}
							</Text>
						</Pressable>
						<Pressable onPress={() => setShowExport(true)} style={styles.exportBtn}>
							<Text style={styles.exportBtnText}>
								Export ({Object.keys(overrides).length})
							</Text>
						</Pressable>
					</View>
				</View>

				{showExport && (
					<View style={styles.exportSheet}>
						<View style={styles.exportHeader}>
							<Text style={styles.exportTitle}>Overrides</Text>
							<Pressable onPress={() => setShowExport(false)}>
								<Text style={styles.exportClose}>×</Text>
							</Pressable>
						</View>
						<TextInput
							style={styles.exportText}
							value={exportSnippet}
							multiline
							editable={false}
							selectTextOnFocus
						/>
						<Text style={styles.exportHint}>
							Long-press to select & copy. Then paste into{" "}
							<Text style={{ fontFamily: FONTS.bodyExtra }}>
								constants/hats.ts → HAT_OVERLAYS
							</Text>
							, or paste back to me in chat.
						</Text>
					</View>
				)}
			</SafeAreaView>
		</View>
	);
}

function clamp(v: number, lo: number, hi: number) {
	return Math.max(lo, Math.min(hi, v));
}

function Chip({
	label,
	active,
	onPress,
}: {
	label: string;
	active: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			style={[styles.chip, active && styles.chipActive]}
		>
			<Text style={[styles.chipText, active && styles.chipTextActive]}>
				{label}
			</Text>
		</Pressable>
	);
}

function NudgeBtn({
	label,
	onPress,
	small,
}: {
	label: string;
	onPress: () => void;
	small?: boolean;
}) {
	return (
		<Pressable
			onPress={onPress}
			style={[styles.nudgeBtn, small && styles.nudgeBtnSmall]}
		>
			<Text style={[styles.nudgeText, small && styles.nudgeTextSmall]}>
				{label}
			</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: COLORS.paper2 },
	chipsRow: {
		paddingHorizontal: 12,
		paddingTop: 8,
		paddingBottom: 6,
		gap: 6,
	},
	chip: {
		paddingHorizontal: 14,
		paddingVertical: 6,
		borderRadius: 12,
		backgroundColor: COLORS.paper,
		borderWidth: 1,
		borderColor: COLORS.border,
	},
	chipActive: { backgroundColor: COLORS.ink, borderColor: COLORS.ink },
	chipText: {
		fontSize: 11,
		fontFamily: FONTS.bodyExtra,
		color: COLORS.ink2,
		letterSpacing: 0.4,
	},
	chipTextActive: { color: "#fff" },
	itemRow: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		gap: 6,
	},
	item: {
		width: 52,
		height: 52,
		borderRadius: 14,
		backgroundColor: COLORS.paper,
		borderWidth: 1.5,
		borderColor: COLORS.border,
		alignItems: "center",
		justifyContent: "center",
		position: "relative",
	},
	itemActive: { borderColor: COLORS.pinkDeep, borderWidth: 2.5 },
	dot: {
		position: "absolute",
		top: 4,
		right: 4,
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: COLORS.success,
	},
	stage: {
		alignItems: "center",
		justifyContent: "center",
		paddingTop: 8,
	},
	card: {
		width: PIG_SIZE,
		height: PIG_SIZE,
		borderRadius: 15,
		backgroundColor: COLORS.pinkBg,
		overflow: "hidden",
		...SHADOWS.card,
	},
	cardImage: { width: "100%", height: "100%" },
	cardImageStyle: { borderRadius: 15 },
	overlayBox: {
		position: "absolute",
		alignItems: "center",
		justifyContent: "center",
	},
	fillImage: { width: "100%", height: "100%" },
	emojiOverlay: { textAlign: "center" },
	outline: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		borderWidth: 1.5,
		borderColor: "rgba(123,95,255,0.85)",
		borderStyle: "dashed",
		borderRadius: 4,
	},
	crosshairV: {
		position: "absolute",
		top: 0,
		bottom: 0,
		left: PIG_SIZE / 2 - 0.5,
		width: 1,
		backgroundColor: "rgba(255,255,255,0.35)",
	},
	crosshairH: {
		position: "absolute",
		left: 0,
		right: 0,
		top: PIG_SIZE / 2 - 0.5,
		height: 1,
		backgroundColor: "rgba(255,255,255,0.35)",
	},
	values: {
		paddingHorizontal: 14,
		paddingTop: 8,
	},
	navRow: {
		flexDirection: "row",
		alignItems: "center",
	},
	navBtn: {
		paddingVertical: 6,
		paddingHorizontal: 10,
		borderRadius: 10,
		backgroundColor: COLORS.paper,
		borderWidth: 1,
		borderColor: COLORS.border,
	},
	navText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 12,
		color: COLORS.ink2,
	},
	itemName: {
		fontFamily: FONTS.display,
		fontSize: 16,
		color: COLORS.ink,
	},
	itemMeta: {
		fontFamily: FONTS.body,
		fontSize: 11,
		color: COLORS.ink3,
	},
	valuesText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 13,
		color: COLORS.ink2,
		textAlign: "center",
		marginTop: 6,
		letterSpacing: 0.5,
	},
	controls: {
		paddingHorizontal: 14,
		paddingTop: 6,
	},
	padRow: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: 8,
		marginVertical: 2,
	},
	nudgeBtn: {
		width: 56,
		height: 44,
		borderRadius: 12,
		backgroundColor: COLORS.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	nudgeBtnSmall: {
		flex: 1,
		height: 38,
		backgroundColor: COLORS.ink2,
	},
	nudgeText: {
		color: "#fff",
		fontSize: 22,
		fontFamily: FONTS.bodyBlack,
	},
	nudgeTextSmall: {
		fontSize: 14,
		fontFamily: FONTS.bodyExtra,
	},
	resetBtn: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: COLORS.paper3,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: COLORS.border,
	},
	resetText: {
		fontSize: 22,
		color: COLORS.ink2,
	},
	sizeRow: {
		flexDirection: "row",
		gap: 6,
		marginTop: 8,
	},
	bottomRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		marginTop: 10,
	},
	stepGroup: {
		flexDirection: "row",
		gap: 4,
	},
	toggle: {
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 10,
		backgroundColor: COLORS.paper,
		borderWidth: 1,
		borderColor: COLORS.border,
	},
	toggleOn: {
		backgroundColor: COLORS.ink,
		borderColor: COLORS.ink,
	},
	toggleText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: COLORS.ink2,
		letterSpacing: 0.4,
	},
	toggleTextOn: { color: "#fff" },
	exportBtn: {
		marginLeft: "auto",
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 12,
		backgroundColor: COLORS.purple,
	},
	exportBtnText: {
		color: "#fff",
		fontFamily: FONTS.bodyExtra,
		fontSize: 12,
		letterSpacing: 0.4,
	},
	exportSheet: {
		position: "absolute",
		left: 12,
		right: 12,
		bottom: 12,
		top: 60,
		backgroundColor: COLORS.paper,
		borderRadius: 18,
		borderWidth: 1,
		borderColor: COLORS.border,
		padding: 14,
		...SHADOWS.card,
	},
	exportHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 8,
	},
	exportTitle: {
		fontFamily: FONTS.display,
		fontSize: 18,
		color: COLORS.ink,
	},
	exportClose: {
		fontSize: 28,
		color: COLORS.ink3,
		paddingHorizontal: 8,
	},
	exportText: {
		flex: 1,
		fontFamily: "SpaceMono",
		fontSize: 12,
		color: COLORS.ink2,
		backgroundColor: COLORS.paper3,
		padding: 10,
		borderRadius: 10,
		textAlignVertical: "top",
	},
	exportHint: {
		fontFamily: FONTS.body,
		fontSize: 12,
		color: COLORS.ink3,
		marginTop: 8,
		lineHeight: 17,
	},
});

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
	resolveAnchor,
	PigAnimationKey,
	AnchorName,
} from "@/constants/hats";
import { COLORS, FONTS, SHADOWS } from "@/constants/theme";
import { SpritePig, PigAnimation } from "@/components/ui/SpritePig";

const STORAGE_KEY = "align_overrides_v1";
const FLAG_KEY = "align_flagged_v1";
const PIG_SIZE = 360;
const ANIMATIONS_TO_TEST: PigAnimation[] = [
	"idle",
	"walk",
	"jump",
	"happy",
	"sad",
	"surprise",
	"wave",
	"arms_up",
];

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
	const [flagged, setFlagged] = useState<Record<string, true>>({});
	const [currentId, setCurrentId] = useState<string | null>(null);
	const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
	const [step, setStep] = useState<1 | 5 | 10>(5);
	const [showExport, setShowExport] = useState(false);
	const [showOutline, setShowOutline] = useState(true);
	const [hydrated, setHydrated] = useState(false);
	// Scan mode: live animated pig + auto-advance through items.
	const [liveMode, setLiveMode] = useState(true);
	const [animation, setAnimation] = useState<PigAnimation>("idle");
	const [autoCycle, setAutoCycle] = useState(false);
	const [cycleSpeed, setCycleSpeed] = useState<1500 | 3000>(1500);
	const [showAnchors, setShowAnchors] = useState(false);
	const [pigFrameIdx, setPigFrameIdx] = useState(0);
	// Manual stepper: when paused, hold the SpritePig at this index instead
	// of auto-advancing. Useful for spotting which specific frame an item
	// drifts on (jump apex, etc).
	const [paused, setPaused] = useState(false);
	const [manualFrame, setManualFrame] = useState(0);

	// Keep anchor dots + delta math in sync with the displayed frame when
	// the user is manually stepping.
	useEffect(() => {
		if (paused) setPigFrameIdx(manualFrame);
	}, [paused, manualFrame]);
	const [saveToast, setSaveToast] = useState<string | null>(null);

	useEffect(() => {
		(async () => {
			const [itemsRes, ovRaw, flagRaw] = await Promise.all([
				supabase
					.from("hats")
					.select(
						"id, name, cost, display_order, emoji, image_path, category, rarity, description"
					)
					.order("display_order"),
				AsyncStorage.getItem(STORAGE_KEY),
				AsyncStorage.getItem(FLAG_KEY),
			]);
			const rows = (itemsRes.data ?? []) as HatRow[];
			setItems(rows);
			if (rows.length > 0) setCurrentId((c) => c ?? rows[0].id);
			if (ovRaw) {
				try {
					setOverrides(JSON.parse(ovRaw));
				} catch {}
			}
			if (flagRaw) {
				try {
					setFlagged(JSON.parse(flagRaw));
				} catch {}
			}
			setHydrated(true);
		})();
	}, []);

	useEffect(() => {
		if (!hydrated) return;
		AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(overrides)).catch(() => {});
	}, [overrides, hydrated]);

	useEffect(() => {
		if (!hydrated) return;
		AsyncStorage.setItem(FLAG_KEY, JSON.stringify(flagged)).catch(() => {});
	}, [flagged, hydrated]);

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

	// Toggling 'behind' writes a per-item HatOverlay.behind override into
	// the local overrides map, which exports + (via the category override
	// path in SwipeElement) ships to runtime.
	const behindOverride = !!(current && overrides[current.id]?.behind);
	const setBehindOverride = (next: boolean | ((prev: boolean) => boolean)) => {
		if (!current) return;
		setOverrides((o) => {
			const cur =
				o[current.id] ??
				HAT_OVERLAYS[current.id] ??
				(current.category
					? CATEGORY_OVERLAYS[current.category]
					: undefined) ??
				DEFAULT_HAT_OVERLAY;
			const value =
				typeof next === "function" ? next(!!cur.behind) : next;
			return {
				...o,
				[current.id]: { ...cur, behind: value },
			};
		});
	};

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
			const list = categoryFilter
				? items.filter((i) => i.category === categoryFilter)
				: items;
			if (list.length === 0) return;
			const idx = list.findIndex((i) => i.id === currentId);
			const next = list[(idx + delta + list.length) % list.length];
			setCurrentId(next.id);
		},
		[items, currentId, categoryFilter]
	);

	// Auto-cycle: advance through items every cycleSpeed ms when toggled on.
	useEffect(() => {
		if (!autoCycle) return;
		const t = setInterval(() => goByOffset(1), cycleSpeed);
		return () => clearInterval(t);
	}, [autoCycle, cycleSpeed, goByOffset]);

	const toggleFlag = useCallback(() => {
		if (!currentId) return;
		setFlagged((f) => {
			if (f[currentId]) {
				const { [currentId]: _, ...rest } = f;
				return rest;
			}
			return { ...f, [currentId]: true };
		});
	}, [currentId]);

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
			const fields = [
				`bottom: ${o.bottom}`,
				`left: ${o.left}`,
				`width: ${o.width}`,
				`height: ${o.height}`,
			];
			if (o.behind) fields.push("behind: true");
			if (o.anchor) fields.push(`anchor: "${o.anchor}"`);
			return `\t${safeKey}: { ${fields.join(", ")} },`;
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
						{/* When behindOverride is on, item renders here (under the pig) */}
						{behindOverride && overlay && current && (
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
						{liveMode ? (
							<View style={styles.cardImage}>
								<SpritePig
									animation={animation}
									size={PIG_SIZE}
									onFrame={setPigFrameIdx}
									frameIdx={paused ? manualFrame : undefined}
								/>
							</View>
						) : (
							<ImageBackground
								source={require("../assets/images/pig.png")}
								style={styles.cardImage}
								imageStyle={styles.cardImageStyle}
								resizeMode="cover"
							/>
						)}
						{/* Center crosshair for reference */}
						<View pointerEvents="none" style={styles.crosshairV} />
						<View pointerEvents="none" style={styles.crosshairH} />
						{!behindOverride && overlay && current && (
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
						{/* Anchor dots — colored is the CURRENT frame's anchor;
						   ghost (light, no label) is the REST position from
						   idle frame 0. Drift = distance between the two. */}
						{showAnchors && (() => {
							const palette = [
								["head", "#FF3B30"],
								["eyes", "#FF9500"],
								["snout", "#FFCC00"],
								["mouth", "#34C759"],
								["neck", "#5AC8FA"],
								["body", "#007AFF"],
								["hand_l", "#AF52DE"],
								["hand_r", "#FF2D92"],
								["feet", "#8E8E93"],
							] as const;
							return (
								<>
									{palette.map(([name, color]) => {
										const rest = resolveAnchor("idle" as PigAnimationKey, 0, name as AnchorName);
										return (
											<View
												key={`ghost-${name}`}
												pointerEvents="none"
												style={[
													styles.anchorDot,
													styles.anchorDotGhost,
													{
														left: rest.x - 6,
														top: rest.y - 6,
														backgroundColor: color,
													},
												]}
											/>
										);
									})}
									{palette.map(([name, color]) => {
										const a = resolveAnchor(
											animation as PigAnimationKey,
											pigFrameIdx,
											name as AnchorName,
										);
										return (
											<View
												key={name}
												pointerEvents="none"
												style={[
													styles.anchorDot,
													{
														left: a.x - 6,
														top: a.y - 6,
														backgroundColor: color,
													},
												]}
											>
												<Text style={styles.anchorLabel}>{name}</Text>
											</View>
										);
									})}
								</>
							);
						})()}
					</View>
				</View>

				{/* Scan-mode controls: animation switcher + auto-cycle + flag */}
				<View style={styles.scanRow}>
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={styles.scanChips}
					>
						{ANIMATIONS_TO_TEST.map((a) => (
							<Pressable
								key={a}
								onPress={() => setAnimation(a)}
								style={[styles.toggle, animation === a && styles.toggleOn]}
							>
								<Text
									style={[
										styles.toggleText,
										animation === a && styles.toggleTextOn,
									]}
								>
									{a}
								</Text>
							</Pressable>
						))}
					</ScrollView>
					<Pressable
						onPress={() => setCurrentId(null)}
						style={[styles.toggle, !currentId && styles.toggleOn]}
					>
						<Text
							style={[styles.toggleText, !currentId && styles.toggleTextOn]}
						>
							clear
						</Text>
					</Pressable>
					<Pressable
						onPress={() => setPaused((p) => !p)}
						style={[styles.toggle, paused && styles.toggleOn]}
					>
						<Text
							style={[styles.toggleText, paused && styles.toggleTextOn]}
						>
							{paused ? `f${manualFrame + 1}` : "pause"}
						</Text>
					</Pressable>
					{paused && (
						<>
							<Pressable
								onPress={() => setManualFrame((f) => Math.max(0, f - 1))}
								style={styles.toggle}
							>
								<Text style={styles.toggleText}>◀</Text>
							</Pressable>
							<Pressable
								onPress={() => setManualFrame((f) => (f + 1) % 4)}
								style={styles.toggle}
							>
								<Text style={styles.toggleText}>▶</Text>
							</Pressable>
						</>
					)}
					<Pressable
						onPress={() => setAutoCycle((v) => !v)}
						style={[styles.toggle, autoCycle && styles.toggleOn]}
					>
						<Text
							style={[styles.toggleText, autoCycle && styles.toggleTextOn]}
						>
							{autoCycle ? `▶ cycle ${cycleSpeed / 1000}s` : "auto-cycle"}
						</Text>
					</Pressable>
					<Pressable
						onPress={toggleFlag}
						style={[
							styles.toggle,
							currentId && flagged[currentId] && styles.toggleFlagged,
						]}
					>
						<Text
							style={[
								styles.toggleText,
								currentId && flagged[currentId] && styles.toggleTextOn,
							]}
						>
							⚑ {Object.keys(flagged).length}
						</Text>
					</Pressable>
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
							<Pressable
								onPress={() => {
									if (!current || !overlay) return;
									const safeKey =
										/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(current.id)
											? current.id
											: `'${current.id}'`;
									const fields = [
										`bottom: ${overlay.bottom}`,
										`left: ${overlay.left}`,
										`width: ${overlay.width}`,
										`height: ${overlay.height}`,
									];
									if (overlay.behind) fields.push("behind: true");
									if (overlay.anchor)
										fields.push(`anchor: "${overlay.anchor}"`);
									const snippet = `${safeKey}: { ${fields.join(", ")} },`;
									// eslint-disable-next-line no-console
									console.log("\n[align] paste into HAT_OVERLAYS:");
									// eslint-disable-next-line no-console
									console.log("\t" + snippet + "\n");
									setSaveToast(current.id);
									setTimeout(() => setSaveToast(null), 1500);
								}}
								style={styles.saveBtn}
							>
								<Text style={styles.saveBtnText}>
									{saveToast === current.id ? "✓ saved" : "save"}
								</Text>
							</Pressable>
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
						<Pressable
							onPress={() => setLiveMode((v) => !v)}
							style={[styles.toggle, liveMode && styles.toggleOn]}
						>
							<Text
								style={[
									styles.toggleText,
									liveMode && styles.toggleTextOn,
								]}
							>
								{liveMode ? "live" : "static"}
							</Text>
						</Pressable>
						<Pressable
							onPress={() => setShowAnchors((v) => !v)}
							style={[styles.toggle, showAnchors && styles.toggleOn]}
						>
							<Text
								style={[
									styles.toggleText,
									showAnchors && styles.toggleTextOn,
								]}
							>
								anchors
							</Text>
						</Pressable>
						<Pressable
							onPress={() => setBehindOverride((v) => !v)}
							style={[styles.toggle, behindOverride && styles.toggleOn]}
						>
							<Text
								style={[
									styles.toggleText,
									behindOverride && styles.toggleTextOn,
								]}
							>
								behind
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
	toggleFlagged: {
		backgroundColor: "#E55454",
		borderColor: "#E55454",
	},
	scanRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingHorizontal: 12,
		paddingTop: 10,
	},
	scanChips: {
		gap: 4,
		paddingRight: 6,
	},
	saveBtn: {
		paddingVertical: 6,
		paddingHorizontal: 12,
		borderRadius: 10,
		backgroundColor: COLORS.purple,
		marginHorizontal: 4,
	},
	saveBtnText: {
		color: "#fff",
		fontFamily: FONTS.bodyExtra,
		fontSize: 12,
		letterSpacing: 0.4,
	},
	anchorDot: {
		position: "absolute",
		width: 12,
		height: 12,
		borderRadius: 6,
		borderWidth: 1.5,
		borderColor: "#fff",
		alignItems: "center",
		justifyContent: "center",
		zIndex: 100,
	},
	anchorDotGhost: {
		opacity: 0.35,
		borderColor: "rgba(255,255,255,0.5)",
		borderStyle: "dashed",
		zIndex: 99,
	},
	anchorLabel: {
		position: "absolute",
		left: 14,
		top: -4,
		fontSize: 9,
		fontWeight: "700",
		color: "#fff",
		backgroundColor: "rgba(0,0,0,0.7)",
		paddingHorizontal: 3,
		paddingVertical: 1,
		borderRadius: 3,
		overflow: "hidden",
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

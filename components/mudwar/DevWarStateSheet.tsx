// __DEV__-only bottom sheet: live-tweak every WarState field the Mud Scuffle
// page renders. Reached from a small "dev war" chip on the war page. Feeds the
// REAL components through useWarStateOverride (see devWarState.ts) — never
// ships (gated on __DEV__ at both the chip and this import).

import { Modal, View, Text, TextInput, Pressable, ScrollView, StyleSheet } from "react-native";
import {
	FONTS,
	MODAL_BACKDROP_BG,
	RADII,
	SPACE,
	TYPE,
	WHIMSY,
} from "@/constants/theme";
import type { WarStatus, WarPhase } from "@/utils/mudWars";
import type { UseWarStateOverride } from "./devWarState";

export function DevWarStateSheet({
	open,
	onClose,
	ctrl,
}: {
	open: boolean;
	onClose: () => void;
	ctrl: UseWarStateOverride;
}) {
	if (!__DEV__) return null;
	const { override, mockOn, setField, setMockOn, reset } = ctrl;

	return (
		<Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
			<View style={styles.backdrop}>
				<View style={styles.sheet}>
					<View style={styles.headRow}>
						<Text style={styles.title}>Dev · War State</Text>
						<Pressable onPress={reset} hitSlop={8}>
							<Text style={styles.reset}>reset</Text>
						</Pressable>
					</View>
					<Text style={styles.sub}>
						Overrides merge over the real war (or a mock). Blank = untouched.
					</Text>

					<ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: SPACE.lg }}>
						<ToggleRow
							label="Use mock war"
							value={mockOn}
							onChange={(v) => setMockOn(v)}
						/>

						<TextRow
							label="Opponent name"
							value={override.opponentName ?? ""}
							placeholder="Trough Loyalists"
							onChange={(t) => setField("opponentName", t || undefined)}
						/>

						<NumberRow
							label="My mud / pig"
							value={override.myPerCapita}
							step={1}
							min={0}
							onChange={(n) => setField("myPerCapita", n)}
						/>
						<NumberRow
							label="Their mud / pig"
							value={override.themPerCapita}
							step={1}
							min={0}
							onChange={(n) => setField("themPerCapita", n)}
						/>
						<NumberRow
							label="Rope (−10..10 → norm)"
							value={
								override.ropeNorm != null
									? Math.round(override.ropeNorm * 10)
									: undefined
							}
							step={1}
							min={-10}
							max={10}
							onChange={(n) =>
								setField("ropeNorm", n == null ? undefined : n / 10)
							}
						/>
						<NumberRow
							label="Day of term"
							value={override.day}
							step={1}
							min={1}
							max={7}
							onChange={(n) => setField("day", n)}
						/>
						<NumberRow
							label="Slings left today"
							value={override.throwsRemaining}
							step={1}
							min={0}
							onChange={(n) => setField("throwsRemaining", n)}
						/>
						<NumberRow
							label="Hold runs left"
							value={override.runsRemaining}
							step={1}
							min={0}
							onChange={(n) => setField("runsRemaining", n)}
						/>

						<ToggleRow
							label="Dug this feeding"
							value={override.dugThisWindow ?? false}
							onChange={(v) => setField("dugThisWindow", v || undefined)}
						/>
						<ToggleRow
							label="Bot war (The Mudlarks)"
							value={override.isBotWar ?? false}
							onChange={(v) => setField("isBotWar", v || undefined)}
						/>
						<ToggleRow
							label="Rhythm war (Hold phase)"
							value={override.rhythmEnabled ?? false}
							onChange={(v) => {
								setField("rhythmEnabled", v || undefined);
								setField("phase", v ? ("war" as WarPhase) : undefined);
							}}
						/>

						<SegRow
							label="Status"
							options={["active", "pending", "resolved"] as WarStatus[]}
							value={override.status}
							onChange={(s) => setField("status", s)}
						/>
						{override.status === "resolved" && (
							<SegRow
								label="Resolved outcome"
								options={["win", "loss"] as const}
								value={
									override.won == null ? undefined : override.won ? "win" : "loss"
								}
								onChange={(o) => setField("won", o === "win")}
							/>
						)}
					</ScrollView>

					<Pressable onPress={onClose} style={styles.doneBtn}>
						<Text style={styles.doneText}>Done</Text>
					</Pressable>
				</View>
			</View>
		</Modal>
	);
}

// ── Rows ─────────────────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<View style={styles.row}>
			<Text style={styles.rowLabel}>{label}</Text>
			<View style={styles.rowCtrl}>{children}</View>
		</View>
	);
}

function NumberRow({
	label,
	value,
	step,
	min,
	max,
	onChange,
}: {
	label: string;
	value: number | undefined;
	step: number;
	min?: number;
	max?: number;
	onChange: (n: number | undefined) => void;
}) {
	const clamp = (n: number) =>
		Math.max(min ?? -Infinity, Math.min(max ?? Infinity, n));
	const base = value ?? 0;
	return (
		<Row label={label}>
			<Pressable
				onPress={() => onChange(clamp(base - step))}
				style={styles.stepBtn}
				hitSlop={6}
			>
				<Text style={styles.stepText}>−</Text>
			</Pressable>
			<Text style={styles.numVal}>{value == null ? "—" : value}</Text>
			<Pressable
				onPress={() => onChange(clamp(base + step))}
				style={styles.stepBtn}
				hitSlop={6}
			>
				<Text style={styles.stepText}>+</Text>
			</Pressable>
			{value != null && (
				<Pressable onPress={() => onChange(undefined)} hitSlop={6}>
					<Text style={styles.clearX}>×</Text>
				</Pressable>
			)}
		</Row>
	);
}

function ToggleRow({
	label,
	value,
	onChange,
}: {
	label: string;
	value: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<Row label={label}>
			<Pressable
				onPress={() => onChange(!value)}
				style={[styles.toggle, value && styles.toggleOn]}
			>
				<Text style={[styles.toggleText, value && styles.toggleTextOn]}>
					{value ? "on" : "off"}
				</Text>
			</Pressable>
		</Row>
	);
}

function TextRow({
	label,
	value,
	placeholder,
	onChange,
}: {
	label: string;
	value: string;
	placeholder?: string;
	onChange: (t: string) => void;
}) {
	return (
		<Row label={label}>
			<TextInput
				value={value}
				onChangeText={onChange}
				placeholder={placeholder}
				placeholderTextColor={WHIMSY.muteSoft}
				style={styles.input}
			/>
		</Row>
	);
}

function SegRow<T extends string>({
	label,
	options,
	value,
	onChange,
}: {
	label: string;
	options: readonly T[];
	value: T | undefined;
	onChange: (v: T) => void;
}) {
	return (
		<Row label={label}>
			{options.map((o) => (
				<Pressable
					key={o}
					onPress={() => onChange(o)}
					style={[styles.seg, value === o && styles.segOn]}
				>
					<Text style={[styles.segText, value === o && styles.segTextOn]}>{o}</Text>
				</Pressable>
			))}
		</Row>
	);
}

const styles = StyleSheet.create({
	backdrop: { flex: 1, backgroundColor: MODAL_BACKDROP_BG, justifyContent: "flex-end" },
	sheet: {
		backgroundColor: WHIMSY.paper,
		borderTopWidth: 2,
		borderColor: WHIMSY.ink,
		borderTopLeftRadius: RADII.xxl,
		borderTopRightRadius: RADII.xxl,
		paddingHorizontal: SPACE.lg,
		paddingTop: SPACE.lg,
		paddingBottom: SPACE.md,
		maxHeight: "82%",
	},
	headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
	title: { ...TYPE.cardTitle, color: WHIMSY.ink },
	reset: { ...TYPE.kicker, fontFamily: FONTS.hand, color: WHIMSY.accent, textDecorationLine: "underline" },
	sub: { ...TYPE.hand, fontFamily: FONTS.hand, color: WHIMSY.mute, marginTop: 2, marginBottom: SPACE.sm },
	body: { flexGrow: 0 },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		paddingVertical: 6,
		borderBottomWidth: 1.5,
		borderBottomColor: WHIMSY.cream2,
	},
	rowLabel: { ...TYPE.bodySm, fontFamily: FONTS.body, color: WHIMSY.ink, flex: 1 },
	rowCtrl: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	stepBtn: {
		width: 30,
		height: 30,
		borderRadius: RADII.sm,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream,
		alignItems: "center",
		justifyContent: "center",
	},
	stepText: { fontFamily: FONTS.whimsy, fontSize: 18, color: WHIMSY.ink },
	numVal: { ...TYPE.numeral, color: WHIMSY.ink, minWidth: 28, textAlign: "center" },
	clearX: { fontFamily: FONTS.body, fontSize: 16, color: WHIMSY.mute },
	toggle: {
		paddingHorizontal: 14,
		paddingVertical: 5,
		borderRadius: 999,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream,
	},
	toggleOn: { backgroundColor: WHIMSY.sun },
	toggleText: { fontFamily: FONTS.bodyExtra, fontSize: 12, color: WHIMSY.mute },
	toggleTextOn: { color: WHIMSY.ink },
	input: {
		minWidth: 150,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.sm,
		backgroundColor: WHIMSY.cream,
		paddingHorizontal: SPACE.sm,
		paddingVertical: 5,
		fontFamily: FONTS.body,
		fontSize: 13,
		color: WHIMSY.ink,
	},
	seg: {
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 999,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream,
	},
	segOn: { backgroundColor: WHIMSY.sun },
	segText: { fontFamily: FONTS.bodyExtra, fontSize: 11, color: WHIMSY.mute },
	segTextOn: { color: WHIMSY.ink },
	doneBtn: {
		marginTop: SPACE.sm,
		backgroundColor: WHIMSY.ink,
		borderRadius: 999,
		paddingVertical: 12,
		alignItems: "center",
	},
	doneText: { color: WHIMSY.paper, fontFamily: FONTS.bodyExtra, fontSize: 14, letterSpacing: 0.4 },
});

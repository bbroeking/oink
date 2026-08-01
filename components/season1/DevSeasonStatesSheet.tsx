import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Sticker } from "../ui/Sticker";
import { Glyph } from "../ui/Glyph";
import {
	MODAL_BACKDROP_BG,
	RADII,
	SPACE,
	TYPE,
	WHIMSY,
} from "@/constants/theme";
import {
	patchDevSeasonOverrides,
	resetDevSeasonOverrides,
	type DevSeasonOverrides,
} from "@/utils/devSeasonOverrides";

const PHASES = [undefined, "open", "guarded"] as const;
const CEREMONIES = [undefined, "podium", "mid", "subquorum"] as const;
const STEPS = [undefined, "taste", "join", "first_dig"] as const;
const HUNGER_STAGES = [undefined, 0, 1, 2, 3, 4, 5] as const;

function nextValue<T>(values: readonly T[], current: T): T {
	const index = values.findIndex((value) => value === current);
	return values[(index + 1 + values.length) % values.length];
}

function label(value: string | number | undefined): string {
	return value === undefined ? "live" : String(value);
}

function Cycler({
	name,
	value,
	onPress,
}: {
	name: string;
	value: string | number | undefined;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={`${name}: ${label(value)}. Tap for next state.`}
			style={({ pressed }) => [styles.row, pressed && styles.pressed]}
		>
			<Text style={styles.rowName}>{name}</Text>
			<Text style={styles.rowValue}>{label(value)} ›</Text>
		</Pressable>
	);
}

export function DevSeasonStatesSheet({
	visible,
	overrides,
	onClose,
}: {
	visible: boolean;
	overrides: DevSeasonOverrides;
	onClose: () => void;
}) {
	if (!__DEV__) return null;
	return (
		<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
			<Pressable style={styles.backdrop} onPress={onClose}>
				<Pressable onPress={(event) => event.stopPropagation()}>
					<Sticker color="paper" rotate={-0.4} radius={RADII.lg} style={styles.sheet}>
						<View style={styles.header}>
							<Glyph name="scene" size={24} />
							<View style={styles.headerCopy}>
								<Text style={styles.kicker}>dev · season states</Text>
								<Text style={styles.title}>Presentation overrides</Text>
							</View>
						</View>
						<Cycler
							name="feeding phase"
							value={overrides.phase}
							onPress={() =>
								patchDevSeasonOverrides({
									phase: nextValue(PHASES, overrides.phase),
								})
							}
						/>
						<Cycler
							name="ceremony"
							value={overrides.ceremony}
							onPress={() =>
								patchDevSeasonOverrides({
									ceremony: nextValue(CEREMONIES, overrides.ceremony),
								})
							}
						/>
						<Cycler
							name="funnel step"
							value={overrides.step}
							onPress={() =>
								patchDevSeasonOverrides({
									step: nextValue(STEPS, overrides.step),
								})
							}
						/>
						<Cycler
							name="hunger stage"
							value={overrides.hungerStage}
							onPress={() =>
								patchDevSeasonOverrides({
									hungerStage: nextValue(
										HUNGER_STAGES,
										overrides.hungerStage,
									),
								})
							}
						/>
						<View style={styles.actions}>
							<Pressable
								onPress={resetDevSeasonOverrides}
								style={({ pressed }) => [styles.action, pressed && styles.pressed]}
							>
								<Text style={styles.actionText}>reset all</Text>
							</Pressable>
							<Pressable
								onPress={onClose}
								style={({ pressed }) => [
									styles.action,
									styles.done,
									pressed && styles.pressed,
								]}
							>
								<Text style={styles.actionText}>done</Text>
							</Pressable>
						</View>
					</Sticker>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		backgroundColor: MODAL_BACKDROP_BG,
		justifyContent: "center",
		paddingHorizontal: SPACE.xl,
	},
	sheet: { padding: SPACE.lg, gap: SPACE.sm },
	header: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		marginBottom: SPACE.xs,
	},
	headerCopy: { flex: 1 },
	kicker: { ...TYPE.kicker, color: WHIMSY.accent },
	title: { ...TYPE.cardTitle, color: WHIMSY.ink },
	row: {
		minHeight: 44,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: SPACE.sm,
		paddingHorizontal: SPACE.md,
		backgroundColor: WHIMSY.cream,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
	},
	rowName: { ...TYPE.bodySm, color: WHIMSY.ink },
	rowValue: { ...TYPE.label, color: WHIMSY.accent },
	actions: {
		flexDirection: "row",
		justifyContent: "flex-end",
		gap: SPACE.sm,
		marginTop: SPACE.xs,
	},
	action: {
		minHeight: 44,
		justifyContent: "center",
		paddingHorizontal: SPACE.lg,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.cream,
	},
	done: { backgroundColor: WHIMSY.sun },
	actionText: { ...TYPE.bodySm, color: WHIMSY.ink },
	pressed: { opacity: 0.65 },
});

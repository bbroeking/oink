// Dev-only presentation overrides for the Season tab — force a feeding phase, a
// ceremony, a funnel step or a hunger stage without waiting for the server.
//
// It is a `Sheet` like every other bottom panel in the app: the primitive owns
// the Modal, the scrim, the grabber, the title row and the close affordance, so
// the dev tool can't drift from the chrome it is used to inspect [C-09].

import { StyleSheet, View } from "react-native";
import { Button, Glyph, Label, ListRow, Sheet } from "@/components/ui";
import { ART_SIZE, SPACE } from "@/constants/theme";
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
		<ListRow
			title={name}
			trailing={<Label tone="accent">{`${label(value)} ›`}</Label>}
			fill="cream"
			tilt={false}
			onPress={onPress}
			accessibilityLabel={`${name}: ${label(value)}`}
			accessibilityHint="Cycles to the next state"
		/>
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
		<Sheet
			open={visible}
			onClose={onClose}
			kicker="dev · season states"
			title="Presentation overrides"
			closeLabel="Done"
			footer={
				<View style={styles.actions}>
					<Button
						size="sm"
						variant="ghost"
						onPress={resetDevSeasonOverrides}
						accessibilityLabel="Reset every season override"
						accessibilityHint="Puts every override back to live server state"
					>
						reset all
					</Button>
					<Button
						size="sm"
						variant="primary"
						onPress={onClose}
						accessibilityLabel="Done"
					>
						done
					</Button>
				</View>
			}
		>
			<View style={styles.header}>
				<Glyph name="scene" size={ART_SIZE.glyphSm} />
			</View>
			<View style={styles.rows}>
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
			</View>
		</Sheet>
	);
}

const styles = StyleSheet.create({
	header: { alignItems: "center", marginBottom: SPACE.sm },
	rows: { gap: SPACE.sm },
	actions: {
		flexDirection: "row",
		justifyContent: "flex-end",
		gap: SPACE.sm,
	},
});

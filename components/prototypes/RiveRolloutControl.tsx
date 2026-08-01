import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { SPACE, TYPE, UI_COLORS } from "@/constants/theme";
import {
	setRivePigRolloutEnabled,
	useRivePigRolloutEnabled,
} from "@/utils/rivePigRollout";

/**
 * Development control for the persistent renderer gate. Enabling the gate
 * never bypasses compatibility checks: missing assets, unsupported equipment,
 * Reduce Motion, and renderer failures still resolve to the raster pig.
 */
export function RiveRolloutControl() {
	const enabled = useRivePigRolloutEnabled();
	const [saving, setSaving] = useState(false);

	const toggle = async () => {
		setSaving(true);
		await setRivePigRolloutEnabled(!enabled);
		setSaving(false);
	};

	return (
		<View style={styles.group}>
			<Text style={styles.title}>Pig renderer rollout</Text>
			<Text style={styles.body}>
				{enabled
					? "Rive is requested when the asset, motion policy, animation, and equipment all support it."
					: "Raster is locked as the renderer on this installation."}
			</Text>
			<Button full variant={enabled ? "ghost" : "dark"} onPress={toggle}>
				{saving
					? "Saving renderer preference"
					: enabled
						? "Use raster"
						: "Use Rive when supported"}
			</Button>
		</View>
	);
}

const styles = StyleSheet.create({
	group: {
		gap: SPACE.md,
	},
	title: {
		...TYPE.sectionTitle,
		color: UI_COLORS.textPrimary,
	},
	body: {
		...TYPE.body,
		color: UI_COLORS.textSecondary,
	},
});

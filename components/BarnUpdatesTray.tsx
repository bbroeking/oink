// A single compact home for the Barn's live status surfaces.
//
// Clearing the tray is presentation-only: it collapses the current cards into
// the dropdown without cleansing an effect or changing the Truffle Patch.
// Players can expose the same cards again by reopening the dropdown.

import { useMemo, useState } from "react";
import {
	LayoutAnimation,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useActiveEffectsContext } from "@/hooks/ActiveEffectsProvider";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import {
	PAGE_PAD,
	RADII,
	SHADOW_SM,
	SPACE,
	TYPE,
	WHIMSY,
} from "@/constants/theme";
import { BarnActiveEffectsStrip } from "./BarnActiveEffectsStrip";
import { BarnSounderChip } from "./BarnSounderChip";
import { Icon } from "./ui/Icon";

export function BarnUpdatesTray() {
	const { effects } = useActiveEffectsContext();
	const patchVisible = useFeatureFlag("world_boss") || __DEV__;
	const { reduceMotion } = useMotionPolicy();
	const [expanded, setExpanded] = useState(false);

	const summary = useMemo(() => {
		const parts: string[] = [];
		if (effects.length > 0) {
			parts.push(`${effects.length} active`);
		}
		if (patchVisible) parts.push("Truffle Patch");
		return parts.join(" · ");
	}, [effects, patchVisible]);

	if (!summary) return null;

	const toggle = () => {
		Haptics.selectionAsync().catch(() => {});
		if (!reduceMotion) {
			LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		}
		setExpanded((value) => !value);
	};

	return (
		<View style={styles.tray}>
			<Pressable
				onPress={toggle}
				style={({ pressed }) => [
					styles.toggle,
					expanded && styles.toggleExpanded,
					pressed && styles.togglePressed,
				]}
				accessibilityRole="button"
				accessibilityLabel="Barn updates"
				accessibilityHint={expanded ? "Collapses live Barn updates" : summary}
				accessibilityState={{ expanded }}
			>
				<View style={styles.iconWell}>
					<Icon name="bell" size={16} color={WHIMSY.ink} strokeWidth={2.2} />
				</View>
				<View style={styles.copy}>
					<Text style={styles.title}>Updates</Text>
					<Text style={styles.summary}>
						· {summary}
					</Text>
				</View>
				<Icon
					name="chevronDown"
					size={20}
					color={WHIMSY.ink}
					style={expanded ? styles.chevronExpanded : undefined}
				/>
			</Pressable>

			{expanded && (
				<View style={styles.contents}>
					<BarnActiveEffectsStrip />
					<BarnSounderChip />
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	tray: {
		marginBottom: SPACE.sm,
		zIndex: 2,
	},
	toggle: {
		minHeight: 44,
		marginHorizontal: PAGE_PAD,
		paddingHorizontal: SPACE.sm,
		paddingVertical: SPACE.xs,
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.pill,
		transform: [{ rotate: "-0.4deg" }],
		...SHADOW_SM,
	},
	toggleExpanded: {
		backgroundColor: WHIMSY.sun,
	},
	togglePressed: {
		transform: [{ translateX: 2 }, { translateY: 2 }, { rotate: "-0.4deg" }],
		shadowOpacity: 0,
		elevation: 0,
	},
	iconWell: {
		width: 28,
		height: 28,
		borderRadius: RADII.pill,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: WHIMSY.rose,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
	},
	copy: {
		flex: 1,
		minWidth: 0,
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xs,
	},
	title: {
		...TYPE.label,
		color: WHIMSY.ink,
	},
	summary: {
		...TYPE.bodySm,
		color: WHIMSY.ink,
		flexShrink: 1,
	},
	chevronExpanded: {
		transform: [{ rotate: "180deg" }],
	},
	contents: {
		paddingTop: SPACE.sm,
	},
});

import React, { useCallback, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { FONTS, RADII, SHADOW_SM, WHIMSY } from "@/constants/theme";

type Variant = {
	key: string;
	name: string;
};

type Props = {
	current: string;
	variants: Variant[];
	onChange: (key: string) => void;
};

// THROWAWAY PROTOTYPE TOOLING — never rendered in production.
export function PrototypeSwitcher({ current, variants, onChange }: Props) {
	const index = Math.max(0, variants.findIndex((variant) => variant.key === current));
	const move = useCallback((delta: number) => {
		const next = variants[(index + delta + variants.length) % variants.length];
		onChange(next.key);
	}, [index, onChange, variants]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const onKeyDown = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			const tag = target?.tagName?.toLowerCase();
			if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
			if (event.key === "ArrowLeft") move(-1);
			if (event.key === "ArrowRight") move(1);
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [move]);

	if (!__DEV__) return null;
	return (
		<View style={styles.switcher}>
			<Pressable
				onPress={() => move(-1)}
				style={styles.arrow}
				accessibilityRole="button"
				accessibilityLabel="Previous prototype variant"
			>
				<Text style={styles.arrowText}>‹</Text>
			</Pressable>
			<Text style={styles.label}>
				{variants[index].key} · {variants[index].name}
			</Text>
			<Pressable
				onPress={() => move(1)}
				style={styles.arrow}
				accessibilityRole="button"
				accessibilityLabel="Next prototype variant"
			>
				<Text style={styles.arrowText}>›</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	switcher: {
		position: "absolute",
		bottom: 22,
		alignSelf: "center",
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: WHIMSY.bark,
		borderRadius: RADII.pill,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		padding: 4,
		zIndex: 500,
		...SHADOW_SM,
	},
	arrow: {
		width: 40,
		height: 36,
		alignItems: "center",
		justifyContent: "center",
	},
	arrowText: {
		fontFamily: FONTS.display,
		fontSize: 27,
		lineHeight: 29,
		color: WHIMSY.sun,
	},
	label: {
		minWidth: 184,
		textAlign: "center",
		fontFamily: FONTS.bodyExtra,
		fontSize: 12,
		color: WHIMSY.paper,
	},
});

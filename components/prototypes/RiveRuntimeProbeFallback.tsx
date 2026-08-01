import { StyleSheet, Text, View } from "react-native";
import { SPACE, TYPE, UI_COLORS } from "@/constants/theme";

/**
 * Web-safe audit state. The native probe deliberately tests native linkage,
 * so the browser explains the boundary without importing the native runtime.
 */
export function RiveRuntimeProbe({ autoStart: _autoStart = false }: { autoStart?: boolean }) {
	return (
		<View style={styles.group}>
			<Text style={styles.title}>Rive native-runtime probe</Text>
			<Text style={styles.body}>
				The native Rive probe runs only in an iOS development build. Web
				uses the raster pig until its dedicated Rive adapter is ready.
			</Text>
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

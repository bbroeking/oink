import React from "react";
import {
	KeyboardAvoidingView,
	Modal,
	Platform,
	ScrollView,
	StyleSheet,
	View,
	useWindowDimensions,
	type ModalProps,
	type ScrollViewProps,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	MODAL_BACKDROP_BG,
	RADII,
	SHADOW_SM,
	SPACE,
	UI_COLORS,
} from "@/constants/theme";
import { DialogCloseRow } from "./DialogCloseRow";

interface Props {
	visible: boolean;
	onRequestClose: () => void;
	children: React.ReactNode;
	maxWidth?: number;
	animationType?: ModalProps["animationType"];
	keyboardAware?: boolean;
	showCloseButton?: boolean;
	closeLabel?: string;
	bare?: boolean;
	frameStyle?: StyleProp<ViewStyle>;
	contentContainerStyle?: StyleProp<ViewStyle>;
	scrollViewProps?: Omit<
		ScrollViewProps,
		"contentContainerStyle" | "children"
	>;
	testID?: string;
}

/**
 * Phone-first modal shell that remains usable on compact-height windows and
 * with accessibility text sizes. The frame is sized from the current window
 * (not a module snapshot), respects safe areas, and always gives dense content
 * a scroll path.
 */
export function AdaptiveModalScaffold({
	visible,
	onRequestClose,
	children,
	maxWidth = 430,
	animationType = "fade",
	keyboardAware = false,
	showCloseButton = false,
	closeLabel = "Close",
	bare = false,
	frameStyle,
	contentContainerStyle,
	scrollViewProps,
	testID,
}: Props) {
	const { width, height } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const gutter = width < 360 ? SPACE.sm : SPACE.md;
	const availableWidth = Math.max(280, width - gutter * 2);
	const availableHeight = Math.max(
		240,
		height - insets.top - insets.bottom - gutter * 2,
	);

	const body = (
		<View
			testID={testID}
			accessibilityViewIsModal
			onAccessibilityEscape={onRequestClose}
			style={[
				styles.frame,
				bare ? styles.bareFrame : styles.paperFrame,
				{
					width: Math.min(maxWidth, availableWidth),
					maxHeight: availableHeight,
				},
				frameStyle,
			]}
		>
			{showCloseButton && (
				<DialogCloseRow onPress={onRequestClose} label={closeLabel} />
			)}
			<ScrollView
				bounces={false}
				showsVerticalScrollIndicator={false}
				keyboardShouldPersistTaps="handled"
				contentInsetAdjustmentBehavior="automatic"
				{...scrollViewProps}
				contentContainerStyle={[
					styles.content,
					contentContainerStyle,
				]}
			>
				{children}
			</ScrollView>
		</View>
	);

	return (
		<Modal
			visible={visible}
			transparent
			animationType={animationType}
			onRequestClose={onRequestClose}
			statusBarTranslucent
		>
			<KeyboardAvoidingView
				enabled={keyboardAware}
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				style={[
					styles.backdrop,
					{
						paddingTop: insets.top + gutter,
						paddingBottom: insets.bottom + gutter,
						paddingHorizontal: gutter,
					},
				]}
			>
				{body}
			</KeyboardAvoidingView>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: MODAL_BACKDROP_BG,
	},
	frame: {
		overflow: "hidden",
	},
	paperFrame: {
		borderWidth: 2,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.xxl,
		backgroundColor: UI_COLORS.surface,
		...SHADOW_SM,
	},
	bareFrame: {
		overflow: "visible",
	},
	content: {
		flexGrow: 1,
	},
});

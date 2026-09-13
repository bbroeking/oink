// TextField — the one labelled input (design-system spec §2, row 08).
//
// UsernameSetup, ReferralCodeEntry and scan-code each grew their
// own well, their own focus treatment and their own way of saying "that's
// wrong". The shape they were all reaching for:
//
//   KICKER_PILL label
//   ┌──────────────────────────────┐  ← paper well: RADII.md, BORDER.ink,
//   │ value                     ✓  │    SHADOW_SM; focus swaps to BORDER.heavy
//   └──────────────────────────────┘    in UI_COLORS.focus
//   helper / error line in the hand voice
//
// States are never carried by color alone: `valid` adds the check mark, `error`
// adds a written line, and both are reported through accessibilityState so the
// screen reader hears what the border is saying.

import { useState } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import {
	BORDER,
	RADII,
	SHADOW_SM,
	SPACE,
	TAP_MIN,
	TYPE,
	UI_COLORS,
} from "@/constants/theme";
import { Icon, type IconName } from "./Icon";
import { Hand, KickerPill } from "./Text";

export type TextFieldState = "default" | "valid" | "error";

const CHECK_SIZE = SPACE.lg;

interface Props
	extends Omit<
		TextInputProps,
		| "style"
		| "value"
		| "onChangeText"
		| "placeholder"
		| "placeholderTextColor"
		| "secureTextEntry"
		| "accessibilityLabel"
	> {
	label: string;
	value: string;
	onChangeText: (next: string) => void;
	placeholder?: string;
	/** Quiet hand-voice guidance under the well ("letters, numbers and _ only"). */
	helper?: string;
	state?: TextFieldState;
	/** The written half of the error state. Shown instead of `helper`. */
	errorText?: string;
	secure?: boolean;
	/** A leading mark inside the well (the search magnifier). (2026-09-11) */
	icon?: IconName;
	/**
	 * Keep the label for screen readers but don't print the kicker — a search
	 * well whose placeholder already says "search pigs". (2026-09-11)
	 */
	labelHidden?: boolean;
	/**
	 * "code" centres and tracks the text in the numeral face — a Golden Ticket
	 * or friend code you read back digit by digit. (2026-09-11)
	 */
	variant?: "text" | "code";
	/** A note well: grows to `rows` lines, top-aligned. (2026-09-11) */
	multiline?: boolean;
	rows?: number;
	testID?: string;
}

export function TextField({
	label,
	value,
	onChangeText,
	placeholder,
	helper,
	state = "default",
	errorText,
	secure,
	icon,
	labelHidden,
	variant = "text",
	multiline,
	rows = 3,
	autoCapitalize,
	keyboardType,
	maxLength,
	testID,
	...inputProps
}: Props) {
	const [focused, setFocused] = useState(false);
	const invalid = state === "error";
	const message = invalid ? (errorText ?? helper) : helper;

	return (
		<View style={styles.field}>
			{labelHidden ? null : <KickerPill star={false}>{label}</KickerPill>}
			<View
				style={[
					styles.well,
					invalid && styles.wellError,
					focused && styles.wellFocus,
				]}
			>
				{icon ? (
					<Icon
						name={icon}
						size={TYPE.body.fontSize}
						color={UI_COLORS.uiMuted}
						style={styles.leadingMark}
					/>
				) : null}
				<TextInput
					{...inputProps}
					value={value}
					onChangeText={onChangeText}
					placeholder={placeholder}
					placeholderTextColor={UI_COLORS.textPlaceholder}
					secureTextEntry={secure}
					autoCapitalize={autoCapitalize}
					keyboardType={keyboardType}
					maxLength={maxLength}
					testID={testID}
					onFocus={(e) => {
						setFocused(true);
						inputProps.onFocus?.(e);
					}}
					onBlur={(e) => {
						setFocused(false);
						inputProps.onBlur?.(e);
					}}
					accessibilityLabel={label}
					// RN exposes no `invalid` accessibility flag on TextInput, so the
					// error is SPOKEN: the hint leads with it rather than leaving the
					// danger border to carry the state on its own.
					accessibilityState={{ disabled: inputProps.editable === false }}
					accessibilityHint={
						invalid && message ? `Needs fixing. ${message}` : message
					}
					multiline={multiline}
					numberOfLines={multiline ? rows : undefined}
					textAlignVertical={multiline ? "top" : undefined}
					style={[
						styles.input,
						variant === "code" && styles.inputCode,
						multiline && { minHeight: TYPE.body.lineHeight * rows },
					]}
				/>
				{state === "valid" && (
					<Icon
						name="check"
						size={CHECK_SIZE}
						color={UI_COLORS.successText}
						strokeWidth={2.6}
					/>
				)}
			</View>
			{!!message && (
				<Hand tone={invalid ? "danger" : "secondary"}>{message}</Hand>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	field: {
		gap: SPACE.xs,
	},
	well: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		minHeight: TAP_MIN + SPACE.xs,
		paddingHorizontal: SPACE.md,
		borderRadius: RADII.md,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		backgroundColor: UI_COLORS.surface,
		...SHADOW_SM,
	},
	leadingMark: {
		marginRight: SPACE.sm,
	},
	wellFocus: {
		borderWidth: BORDER.heavy,
		borderColor: UI_COLORS.focus,
	},
	wellError: {
		backgroundColor: UI_COLORS.dangerSurface,
		borderColor: UI_COLORS.dangerText,
	},
	input: {
		flex: 1,
		minWidth: 0,
		paddingVertical: SPACE.sm,
		...TYPE.body,
		color: UI_COLORS.textPrimary,
	},
	inputCode: {
		...TYPE.numeralLg,
		textAlign: "center",
		letterSpacing: SPACE.xxs,
	},
});

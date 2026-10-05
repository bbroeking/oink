// The app's canonical name-rendering block: an earned title above or below a
// username, with an optional #discriminator and a trailing suffix. Every social
// surface (friend row, crew row, leaderboard, UserSheet header) renders a player
// through this, so a bare `fontSize` here landed off-scale type on all of them
// at once. [B-05] (2026-09-11)
//
// Text speaks in TYPE roles only. `profile` folds onto `pageTitle` — spec §5
// declined a `TYPE.profileName` at 24/27 and named `pageTitle` (26/28) its home.
//
// **Portrait + username is a `UserSheet` door, or it must not look like one**
// [B-16]: this block draws the NAME, never the tap. A surface that composes it
// beside a `PigAvatar`/`PrestigeAvatar` either wires the row to `UserSheet` or
// drops the sticker treatment that promises a door.
//
// Four rules from the 2026-10-04 polish (Friends ask A-3, Me ask M-08):
//   · the name and its `#code` are two words: a space between them
//     ("DemoHelper1 #1035", never "DemoHelper1#1035");
//   · in a ROW the title always sits on the line under the name, whatever its
//     placement — a ranking mixed "title above" and "title below" row to row,
//     so the names never lined up. The placement still decides above/below in
//     the hero and profile variants, where one name stands alone;
//   · a title keeps its own casing everywhere (it is a name: "Silvester Sow"),
//     so the same title no longer reads two ways on two tabs;
//   · a name or a title wraps to a second line rather than ending in "…".
import React from "react";
import {
	StyleSheet,
	View,
	type StyleProp,
	type TextStyle,
	type ViewStyle,
} from "react-native";
import type { TitlePlacement } from "@/constants/title_types";
import { CHROME_TYPE_CAP } from "@/constants/theme";
import { T, type TextRole } from "./Text";

export interface ProfileIdentityTitle {
	name: string;
	placement: TitlePlacement;
}

type Variant = "row" | "hero" | "profile";

// A name or title may take a second line; past that (only at the accessibility
// sizes) it clamps. Never one line: one line is how a long name lost its tail.
const NAME_LINES = 2;

// The three sizes the name speaks in.
const NAME_ROLE: Record<Variant, TextRole> = {
	row: "cardTitle",
	hero: "sectionTitle",
	profile: "pageTitle",
};

// The profile name stands in a column beside the portrait (the passport, a
// friend's sheet), ~240pt wide on an SE, and a username is one word: at
// accessibility-large the 26pt name broke mid-word ("DemoPi / g", after round
// 2026-10-04). It states the passport's ceiling, as the stats under it do.
// Rows and the hero line keep the full 200%.
const NAME_CAP: Partial<Record<Variant, number>> = { profile: CHROME_TYPE_CAP };

// The earned title: the hand voice, one step under the name. `row` keeps the
// muted kicker the dense lists were tuned for; the two larger variants wear the
// accent hand line.
const TITLE_ROLE: Record<Variant, TextRole> = {
	row: "kicker",
	hero: "hand",
	profile: "hand",
};

export function ProfileIdentity({
	username,
	title,
	discriminator,
	suffix,
	variant = "row",
	align = "left",
	style,
	nameStyle,
	titleStyle,
}: {
	username: string | null;
	title?: ProfileIdentityTitle | null;
	discriminator?: string | null;
	suffix?: string | null;
	variant?: Variant;
	align?: "left" | "center";
	style?: StyleProp<ViewStyle>;
	nameStyle?: StyleProp<TextStyle>;
	titleStyle?: StyleProp<TextStyle>;
}) {
	// A row reads every title under the name; the larger variants honour the
	// title's placement.
	const row = variant === "row";
	const pre = !row && title?.placement === "pre" ? title.name : null;
	const post = title && (row || title.placement === "post") ? title.name : null;
	const centered = align === "center";
	const titleRole = TITLE_ROLE[variant];
	const titleTone = variant === "row" ? "secondary" : "accent";
	const titleLine = (text: string) => (
		<T
			role={titleRole}
			tone={titleTone}
			align={centered ? "center" : undefined}
			numberOfLines={NAME_LINES}
			style={titleStyle}
		>
			{text}
		</T>
	);

	return (
		<View style={[styles.root, centered && styles.center, style]}>
			{pre && titleLine(pre)}
			<T
				role={NAME_ROLE[variant]}
				align={centered ? "center" : undefined}
				numberOfLines={NAME_LINES}
				maxFontSizeMultiplier={NAME_CAP[variant]}
				style={nameStyle}
			>
				{username ?? "Anonymous"}
				{discriminator ? (
					<T role="kicker" tone="secondary">
						{" "}#{discriminator}
					</T>
				) : null}
				{suffix ? (
					<T role="kicker" tone="accent">
						{" "}
						{suffix}
					</T>
				) : null}
			</T>
			{post && titleLine(post)}
		</View>
	);
}

/**
 * What a ProfileIdentity says, as one line for an accessibility label: the
 * name with its #code and suffix, then the title ("DemoPig (you), Silvester
 * Sow"). For a row that draws the identity inside a larger element, whose
 * label must carry the words the drawing shows (the Sounder's roster rows
 * said only "rides with you"). (2026-10-04)
 */
export function profileIdentityText({
	username,
	title,
	discriminator,
	suffix,
}: {
	username: string | null;
	title?: ProfileIdentityTitle | null;
	discriminator?: string | null;
	suffix?: string | null;
}): string {
	const name = [username ?? "Anonymous", discriminator ? `#${discriminator}` : null, suffix]
		.filter(Boolean)
		.join(" ");
	return title ? `${name}, ${title.name}` : name;
}

const styles = StyleSheet.create({
	root: { minWidth: 0 },
	center: { alignItems: "center" },
});

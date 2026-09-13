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
import React from "react";
import {
	StyleSheet,
	View,
	type StyleProp,
	type TextStyle,
	type ViewStyle,
} from "react-native";
import type { TitlePlacement } from "@/constants/title_types";
import { T, type TextRole } from "./Text";

export interface ProfileIdentityTitle {
	name: string;
	placement: TitlePlacement;
}

type Variant = "row" | "hero" | "profile";

// The three sizes the name speaks in.
const NAME_ROLE: Record<Variant, TextRole> = {
	row: "cardTitle",
	hero: "sectionTitle",
	profile: "pageTitle",
};

// The earned title: the hand voice, one step under the name. `row` keeps the
// lowercase muted kicker the dense lists were tuned for; the two larger
// variants wear the accent hand line.
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
	const pre = title?.placement === "pre" ? title.name : null;
	const post = title?.placement === "post" ? title.name : null;
	const centered = align === "center";
	const titleRole = TITLE_ROLE[variant];
	const titleTone = variant === "row" ? "secondary" : "accent";
	const titleLine = (text: string) => (
		<T
			role={titleRole}
			tone={titleTone}
			align={centered ? "center" : undefined}
			numberOfLines={1}
			style={[variant === "row" && styles.rowTitle, titleStyle]}
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
				numberOfLines={1}
				style={nameStyle}
			>
				{username ?? "Anonymous"}
				{discriminator ? (
					<T role="kicker" tone="secondary">
						#{discriminator}
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

const styles = StyleSheet.create({
	root: { minWidth: 0 },
	center: { alignItems: "center" },
	// The dense-row title is written the way it is spoken: lowercase.
	rowTitle: { textTransform: "lowercase" },
});

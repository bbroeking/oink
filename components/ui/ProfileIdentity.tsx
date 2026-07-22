import React from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import type { TitlePlacement } from "@/constants/title_types";
import { FONTS, TYPE, WHIMSY } from "@/constants/theme";

export interface ProfileIdentityTitle {
	name: string;
	placement: TitlePlacement;
}

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
	variant?: "row" | "hero" | "profile";
	align?: "left" | "center";
	style?: StyleProp<ViewStyle>;
	nameStyle?: StyleProp<TextStyle>;
	titleStyle?: StyleProp<TextStyle>;
}) {
	const pre = title?.placement === "pre" ? title.name : null;
	const post = title?.placement === "post" ? title.name : null;
	const alignStyle = align === "center" ? styles.center : null;
	return (
		<View style={[styles.root, alignStyle, style]}>
			{pre && (
				<Text style={[styles.title, styles[`${variant}Title`], alignStyle, titleStyle]} numberOfLines={1}>
					{pre}
				</Text>
			)}
			<Text
				style={[styles.name, styles[`${variant}Name`], alignStyle, nameStyle]}
				numberOfLines={1}
				adjustsFontSizeToFit
				minimumFontScale={0.6}
			>
				{username ?? "Anonymous"}
				{discriminator ? <Text style={styles.meta}>#{discriminator}</Text> : null}
				{suffix ? <Text style={styles.suffix}> {suffix}</Text> : null}
			</Text>
			{post && (
				<Text style={[styles.title, styles[`${variant}Title`], alignStyle, titleStyle]} numberOfLines={1}>
					{post}
				</Text>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { minWidth: 0 },
	center: { alignItems: "center", textAlign: "center" },
	name: { color: WHIMSY.ink },
	rowName: { fontFamily: FONTS.whimsy, fontSize: 15, lineHeight: 18 },
	heroName: { ...TYPE.sectionTitle },
	profileName: { fontFamily: FONTS.whimsy, fontSize: 24, lineHeight: 27 },
	title: { fontFamily: FONTS.hand, color: WHIMSY.accent },
	rowTitle: { fontSize: 12, lineHeight: 15 },
	heroTitle: { fontSize: 14, lineHeight: 17 },
	profileTitle: { fontSize: 15, lineHeight: 18 },
	meta: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.mute },
	suffix: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.accent },
});

import React from "react";
import { View, Image, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { HAT_IMAGES } from "@/constants/hats";

interface Props {
	size?: number;
	hatId?: string | null;
	border?: string;
	style?: ViewStyle;
}

export function PigAvatar({ size = 40, hatId, border, style }: Props) {
	const hatSrc = hatId ? HAT_IMAGES[hatId] : null;
	return (
		<View
			style={[
				{
					width: size,
					height: size,
					borderRadius: size / 2,
					overflow: "hidden",
					borderWidth: border ? 2.5 : 0,
					borderColor: border,
				},
				style,
			]}
		>
			<LinearGradient
				colors={["#FFD0DC", "#E8A7B9"]}
				style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}
			>
				<Image
					source={require("../../assets/images/pig.png")}
					style={{
						width: size * 0.95,
						height: size * 0.95,
						marginBottom: -size * 0.05,
					}}
					resizeMode="contain"
				/>
				{hatSrc && (
					<Image
						source={hatSrc}
						style={{
							position: "absolute",
							top: -size * 0.05,
							width: size * 0.7,
							height: size * 0.45,
						}}
						resizeMode="contain"
					/>
				)}
			</LinearGradient>
		</View>
	);
}

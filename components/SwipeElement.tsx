import React, { useRef } from "react";
import {
	StyleSheet,
	Animated,
	PanResponder,
	View,
	Dimensions,
	ImageBackground,
} from "react-native";
import { ThemedText } from "./ThemedText";

const SWIPE_THRESHOLD = 120;
const SCREEN_WIDTH = Dimensions.get("window").width;

interface SwipeElementProps {
	onLuckySwipe: () => void;
}

export default function SwipeElement({ onLuckySwipe }: SwipeElementProps) {
	const position = useRef(new Animated.ValueXY()).current;
	const swipeCount = useRef(0);

	const panResponder = useRef(
		PanResponder.create({
			onStartShouldSetPanResponder: () => true,
			onPanResponderMove: (_, gesture) => {
				position.setValue({ x: gesture.dx, y: 0 });
			},
			onPanResponderRelease: (_, gesture) => {
				if (Math.abs(gesture.dx) > SWIPE_THRESHOLD) {
					swipeCount.current += 1;
					onLuckySwipe();
				}

				// Reset position with animation
				Animated.spring(position, {
					toValue: { x: 0, y: 0 },
					useNativeDriver: false,
					friction: 5,
				}).start();
			},
		})
	).current;

	const getCardStyle = () => {
		const rotate = position.x.interpolate({
			inputRange: [-SCREEN_WIDTH * 1.5, 0, SCREEN_WIDTH * 1.5],
			outputRange: ["-30deg", "0deg", "30deg"],
		});

		return {
			...position.getLayout(),
			transform: [{ rotate }],
		};
	};

	return (
		<View style={styles.container}>
			<Animated.View
				style={[styles.card, getCardStyle()]}
				{...panResponder.panHandlers}
			>
				<ImageBackground
					source={require("../assets/images/pig.png")}
					style={styles.cardImage}
					imageStyle={styles.cardImageStyle}
					resizeMode="cover"
				></ImageBackground>
			</Animated.View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		width: "100%",
		alignItems: "center",
		justifyContent: "center",
		marginVertical: 20,
	},
	card: {
		width: 300,
		height: 300,
		borderRadius: 15,
		backgroundColor: "transparent",
	},
	cardImage: {
		width: "100%",
		height: "100%",
		borderRadius: 15,
		overflow: "hidden",
	},
	cardImageStyle: {
		borderRadius: 15,
	},
	textContainer: {
		position: "absolute",
		bottom: 0,
		left: 0,
		right: 0,
		padding: 20,
		paddingBottom: 25,
	},
	text: {
		fontSize: 28,
		fontWeight: "700",
		color: "white",
		marginBottom: 5,
		textAlign: "center",
		textShadowColor: "rgba(0, 0, 0, 0.75)",
		textShadowOffset: { width: 1, height: 1 },
		textShadowRadius: 3,
	},
	subtext: {
		fontSize: 18,
		color: "white",
		textAlign: "center",
		textShadowColor: "rgba(0, 0, 0, 0.75)",
		textShadowOffset: { width: 1, height: 1 },
		textShadowRadius: 3,
	},
});

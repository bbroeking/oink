// "A new version is ready": the soft-update card on Home. Server-driven by
// app_settings.min_build (hooks/useMinBuild.ts) and inert until that row is
// raised above this binary's build number. Never blocking: one line from the
// server, one Button to the App Store listing, one dismiss that lasts the
// session.
//
// It sits IN FLOW under Home's two corners (the empty sky the ad-refill card
// also uses), never as an absolute layer: a full-width absolute view over the
// yard swallows every tap meant for Rosie on Fabric (the build-99 footgun). The
// wrapper is still `box-none` so only the card's own controls take touches.

import { Linking, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
// The four primitives by file, not the ui barrel: the barrel drags the pig
// renderer (and Sentry) into anything that imports this card.
import { Button } from "./ui/Button";
import { IconButton } from "./ui/IconButton";
import { Sticker } from "./ui/Sticker";
import { Hand } from "./ui/Text";
import { SPACE, TILT } from "@/constants/theme";
import { useMinBuild } from "@/hooks/useMinBuild";
import { TICKLE_THE_PIG_APP_STORE_URL } from "@/utils/redemption";

export function UpdateNudge({ style }: { style?: StyleProp<ViewStyle> }) {
	const { show, title, body, dismiss } = useMinBuild();
	if (!show) return null;

	const openStore = () => {
		// Fail-soft: if the App Store will not open, the card simply stays.
		Linking.openURL(TICKLE_THE_PIG_APP_STORE_URL).catch(() => {});
	};

	return (
		<View pointerEvents="box-none" style={style} testID="update-nudge">
			<Sticker
				color="sky"
				rotate={TILT.card}
				shadow="sm"
				pad
				title={title}
				right={
					<IconButton
						name="x"
						variant="none"
						iconSize={SPACE.card}
						label="Dismiss the update note"
						accessibilityHint="Hides this until the next time you open the app"
						onPress={dismiss}
						testID="update-nudge-dismiss"
					/>
				}
			>
				<Hand tone="secondary">{body}</Hand>
				<Button
					variant="primary"
					size="sm"
					full
					onPress={openStore}
					accessibilityLabel="Update Tickle the Pig"
					accessibilityHint="Opens Tickle the Pig in the App Store"
					testID="update-nudge-update"
					style={styles.cta}
				>
					Update
				</Button>
			</Sticker>
		</View>
	);
}

const styles = StyleSheet.create({
	cta: {
		marginTop: SPACE.sm,
	},
});

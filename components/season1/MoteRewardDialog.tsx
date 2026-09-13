import { Image, StyleSheet } from "react-native";
import { router } from "expo-router";
import {
	AdaptiveModalScaffold,
	Body,
	Button,
	SectionTitle,
	Sticker,
	POPUP_TEARDOWN_MS,
} from "@/components/ui";
import { MOTE_IMAGE } from "@/constants/motes";
import { MOTE_MACHINE_VISIBLE } from "@/constants/featureFlags";
import { RADII, SPACE } from "@/constants/theme";

// The reward portrait — the one Mote, drawn big enough to be the card's subject
// without pushing the two CTAs off a short screen. Drawing geometry, not spacing.
const MOTE_ART = 88;

export function MoteRewardDialog({ amount, onClose }: { amount: number; onClose: () => void }) {
	return (
		<AdaptiveModalScaffold visible onRequestClose={onClose} maxWidth={340} bare>
			<Sticker color="paper" radius={RADII.xxl} style={styles.card}>
				<Image source={MOTE_IMAGE} style={styles.image} accessible={false} />
				<SectionTitle align="center" accessibilityRole="header">
					{amount} {amount === 1 ? "Mote" : "Motes"} claimed
				</SectionTitle>
				{/* Never name the Mote Machine while it's dark — the flag hides the
				    surface, so the copy has to hide it too. */}
				<Body align="center">
					{MOTE_MACHINE_VISIBLE
						? "Each Mote powers one reveal in the Mote Machine."
						: "Tucked safe in your pouch until there's something to spend it on."}
				</Body>
				{MOTE_MACHINE_VISIBLE && (
					<Button full variant="gold" onPress={() => {
						onClose();
						// Finish dismissing the native modal before changing screens.
						setTimeout(() => router.push("/mote-machine"), POPUP_TEARDOWN_MS);
					}}>
						Use Motes
					</Button>
				)}
				<Button full variant="ghost" onPress={onClose}>Keep for later</Button>
			</Sticker>
		</AdaptiveModalScaffold>
	);
}

const styles = StyleSheet.create({
	card: { width: "100%", maxWidth: 340, padding: SPACE.lg, gap: SPACE.md, alignItems: "center" },
	image: { width: MOTE_ART, height: MOTE_ART, resizeMode: "contain" },
});

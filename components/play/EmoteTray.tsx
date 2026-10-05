// The emote tray: six sticker buttons at the foot of the table, the whole of
// what a pig can say at a table (no free text: strangers share it). A tap
// pops the sticker over your pig (and everyone else's screen); the tray then
// rests for the server's emote gap (welcome.timing.emoteCooldownMs) wearing
// the asleep chrome, so a pig can't flood a table.

import { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Sticker } from "@/components/ui";
import { RADII, SPACE } from "@/constants/theme";
import type { Emote } from "@/multiplayer/protocol";
import { EMOTES, EMOTE_ART, EMOTE_LABEL } from "./emoteArt";
import { EMOTE_ART as ART_BOX, EMOTE_BUTTON } from "./layout";

export function EmoteTray({ onEmote, cooldownMs, testID = "emote-tray" }: { onEmote: (emote: Emote) => void; cooldownMs: number; testID?: string }) {
	const [cooling, setCooling] = useState(false);
	useEffect(() => {
		if (!cooling) return;
		const timer = setTimeout(() => setCooling(false), Math.max(0, cooldownMs));
		return () => clearTimeout(timer);
	}, [cooling, cooldownMs]);

	const send = (emote: Emote) => {
		if (cooling) return;
		Haptics.selectionAsync().catch(() => {});
		onEmote(emote);
		setCooling(true);
	};

	return (
		<View style={styles.tray} testID={testID}>
			{EMOTES.map((emote) => (
				<Sticker
					key={emote}
					color="paper"
					radius={RADII.pill}
					shadow="sm"
					rotate={0}
					disabled={cooling}
					onPress={() => send(emote)}
					accessibilityLabel={`Send ${EMOTE_LABEL[emote]}`}
					accessibilityHint="Pops this sticker over your pig for the table"
					style={styles.button}
					testID={`emote-${emote}`}
				>
					<Image source={EMOTE_ART[emote]} resizeMode="contain" style={styles.art} />
				</Sticker>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	tray: { flexDirection: "row", justifyContent: "center", gap: SPACE.sm },
	button: { width: EMOTE_BUTTON, height: EMOTE_BUTTON, alignItems: "center", justifyContent: "center" },
	art: { width: ART_BOX, height: ART_BOX },
});

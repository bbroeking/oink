// The Great Hunger — Season 1 intro. The tale cinematic (generated panels +
// ElevenLabs narration, captions burned into the frames) embedded in a paper
// sticker modal — the same card chrome as the season's other sheets
// (SeasonGuideModal / SeasonInfoModal), with the video where a storybook once
// was. Routed through the launch PopupQueue and gated on the `world_boss`
// server flag + a first-view marker.
//
// The bundled asset is a mobile re-encode of assets/concepts/great-hungerer/
// video/great_hunger_generated_panels_animated_v2_no_app_section.mp4: trimmed
// at 29.1s to drop the dated marketing CTA card (players watching this are
// already inside Season 1), 720×1280 CRF-27 → 4.0 MB. The 40 MB master stays
// out of the bundle (nothing require()s it).

import { useCallback, useEffect, useState } from "react";
import {
	Modal,
	View,
	Text,
	Pressable,
	StyleSheet,
	useWindowDimensions,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useVideoPlayer, VideoView } from "expo-video";
import { Sticker } from "./ui/Sticker";
import { Button } from "./ui";
import { Icon } from "./ui/Icon";
import {
	FONTS,
	KICKER_TEXT,
	MODAL_BACKDROP_BG,
	RADII,
	SPACE,
	STICKER_SHADOW,
	WHIMSY,
} from "@/constants/theme";

const TALE_VIDEO = require("../assets/video/great_hunger_tale.mp4");

export function GreatHungerIntroModal({
	visible,
	onDone,
}: {
	visible: boolean;
	// Fired on the CTA ("Rally your Sounder") — the parent dismisses and can
	// route on to the season. "skip" = dismissed via the hardware back.
	onDone: (action: "rally" | "skip") => void;
}) {
	return (
		<Modal
			visible={visible}
			animationType="fade"
			transparent
			onRequestClose={() => onDone("skip")}
		>
			{/* Gate on `visible` so the player mounts fresh per open (autoplay
			    from 0:00 every retelling) and releases on close — useVideoPlayer
			    ties the native player's lifetime to the mount. */}
			{visible && <TaleCard onDone={onDone} />}
		</Modal>
	);
}

function TaleCard({ onDone }: { onDone: (action: "rally" | "skip") => void }) {
	const { height: screenH } = useWindowDimensions();
	// The narration's end flips the CTA from a quiet leave to the rally beat.
	const [ended, setEnded] = useState(false);
	// Starts muted — the tale can auto-play without ambushing the room; the
	// speaker chip on the frame unmutes the narration on demand.
	const [muted, setMuted] = useState(true);
	const player = useVideoPlayer(TALE_VIDEO, (p) => {
		p.loop = false;
		p.muted = true;
		p.play();
	});
	const toggleMute = useCallback(() => {
		setMuted((m) => {
			player.muted = !m;
			return !m;
		});
	}, [player]);
	useEffect(() => {
		const sub = player.addListener("playToEnd", () => setEnded(true));
		return () => sub.remove();
	}, [player]);

	const rally = useCallback(() => {
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
			() => {}
		);
		onDone("rally");
	}, [onDone]);

	return (
		<View style={styles.backdrop}>
			<Sticker
				color="paper"
				rotate={-0.8}
				radius={20}
				border={3}
				style={[styles.card, STICKER_SHADOW]}
			>
				<Text style={styles.kicker}>★ season 1 — the tale ★</Text>
				<Text style={styles.headline}>The Great Hunger</Text>

				{/* The tale itself — 9:16 frame, ink-bordered like the rest of the
				    card family. Captions ride inside the video; controls stay
				    native-free so it reads as a story moment, not a media player.
				    Height caps to the screen so the CTA never gets pushed off. */}
				<View
					style={[styles.videoFrame, { maxHeight: Math.round(screenH * 0.58) }]}
				>
					<VideoView
						player={player}
						style={StyleSheet.absoluteFill}
						contentFit="cover"
						nativeControls={false}
					/>
					<Pressable
						onPress={toggleMute}
						hitSlop={8}
						accessibilityRole="button"
						accessibilityLabel={muted ? "Unmute the tale" : "Mute the tale"}
						style={({ pressed }) => [
							styles.muteChip,
							pressed && { opacity: 0.8 },
						]}
					>
						<Icon name={muted ? "speakerOff" : "speaker"} size={16} color={WHIMSY.ink} />
					</Pressable>
				</View>

				<Button size="lg" variant="primary" full onPress={rally}>
					{ended ? "Rally your Sounder" : "To the season"}
				</Button>
			</Sticker>
		</View>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: MODAL_BACKDROP_BG,
		padding: 24,
	},
	card: {
		width: "100%",
		maxWidth: 400,
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.lg,
	},
	kicker: { ...KICKER_TEXT, textAlign: "center", marginBottom: 4 },
	headline: {
		fontFamily: FONTS.whimsy,
		fontSize: 24,
		color: WHIMSY.ink,
		textAlign: "center",
		marginBottom: SPACE.md,
	},
	videoFrame: {
		width: "100%",
		aspectRatio: 9 / 16,
		alignSelf: "center",
		borderWidth: 2.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.lg,
		overflow: "hidden",
		backgroundColor: WHIMSY.ink,
		marginBottom: SPACE.md,
	},
	// Sound toggle riding the video's bottom-right corner — paper chip,
	// ink ring, same sticker language as the card it sits in.
	muteChip: {
		position: "absolute",
		bottom: SPACE.sm,
		right: SPACE.sm,
		width: 34,
		height: 34,
		borderRadius: 17,
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
});

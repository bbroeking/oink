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
	View,
	Pressable,
	StyleSheet,
	useWindowDimensions,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useVideoPlayer, VideoView } from "expo-video";
import {
	AdaptiveModalScaffold,
	Button,
	DialogCloseRow,
	Icon,
	Kicker,
	PageTitle,
	Sticker,
} from "./ui";
import {
	BORDER,
	PRESSED_FLAT,
	RADII,
	SPACE,
	TILT,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";

// The sound toggle riding the tale's bottom-right corner — a paper chip sized
// to the 34pt art well the video frame can spare, not a spacing step.
const MUTE_CHIP = 34;
const MUTE_ICON = 16;

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
		<AdaptiveModalScaffold
			visible={visible}
			onRequestClose={() => onDone("skip")}
			maxWidth={400}
			bare
		>
			{/* Gate on `visible` so the player mounts fresh per open (autoplay
			    from 0:00 every retelling) and releases on close — useVideoPlayer
			    ties the native player's lifetime to the mount. */}
			{visible && <TaleCard onDone={onDone} />}
		</AdaptiveModalScaffold>
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
		<Sticker
			color="paper"
			rotate={TILT.dialog}
			radius={RADII.xxl}
			border={3}
			style={styles.card}
		>
			<DialogCloseRow onPress={() => onDone("skip")} label="Skip the tale" />
			<Kicker align="center" style={styles.kicker}>
				season 1 — the tale ★
			</Kicker>
			<PageTitle align="center" style={styles.headline}>
				The Great Hunger
			</PageTitle>

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
					accessibilityHint="Turns the narration on or off"
					style={({ pressed }) => [
						styles.muteChip,
						pressed && PRESSED_FLAT,
					]}
				>
					<Icon
						name={muted ? "speakerOff" : "speaker"}
						size={MUTE_ICON}
						color={UI_COLORS.textPrimary}
					/>
				</Pressable>
			</View>

			<Button size="lg" variant="primary" full onPress={rally}>
				{ended ? "Rally your Sounder" : "To the season"}
			</Button>
		</Sticker>
	);
}

const styles = StyleSheet.create({
	card: {
		width: "100%",
		paddingHorizontal: SPACE.lg,
		paddingBottom: SPACE.lg,
	},
	kicker: { marginBottom: SPACE.xs },
	headline: { marginBottom: SPACE.md },
	videoFrame: {
		width: "100%",
		aspectRatio: 9 / 16,
		alignSelf: "center",
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.lg,
		overflow: "hidden",
		// The letterbox ground behind the tale — the sanctioned ceremony dark,
		// not a second hand-mixed near-black. [C-23]
		backgroundColor: WHIMSY.stage,
		marginBottom: SPACE.md,
	},
	// Sound toggle riding the video's bottom-right corner — paper chip,
	// ink ring, same sticker language as the card it sits in.
	muteChip: {
		position: "absolute",
		bottom: SPACE.sm,
		right: SPACE.sm,
		width: MUTE_CHIP,
		height: MUTE_CHIP,
		borderRadius: RADII.pill,
		backgroundColor: UI_COLORS.surface,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		alignItems: "center",
		justifyContent: "center",
	},
});

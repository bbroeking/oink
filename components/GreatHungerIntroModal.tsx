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
//
// Polish pass 2026-10-04: the sound chip rides the frame's top-right corner,
// over sky — at the bottom it sat on the burned-in captions; the × is the
// pinned "Close" of `AdaptiveModalScaffold card`, whose frame IS the card, so
// at large text or on a short phone the tale scrolls under a × that stays
// put; and the one button keeps one label for the whole tale. It used to
// flip to "Rally your Sounder" when the narration ended, but it only ever
// closed the card, and the Sounder is no longer the season's ask (2026-09-21).
// A caller names where the button lands (`ctaLabel`); the Season tab's replay
// says "Back to the season".

import { useCallback, useState } from "react";
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
	Icon,
	Kicker,
	PageTitle,
} from "./ui";
import {
	BORDER,
	PRESSED_FLAT,
	RADII,
	SPACE,
	TAP_MIN,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";

// The sound toggle riding the tale's top-right corner — a paper chip sized
// to the 34pt art well the video frame can spare, not a spacing step.
const MUTE_CHIP = 34;
const MUTE_ICON = 16;
// The chip's frame grows to the 44pt floor through hitSlop, not by drawing a
// bigger chip over the art.
const MUTE_HIT = (TAP_MIN - MUTE_CHIP) / 2;

const TALE_VIDEO = require("../assets/video/great_hunger_tale.mp4");

// What the button says when the caller doesn't name its landing.
const DEFAULT_CTA = "To the season";

export function GreatHungerIntroModal({
	visible,
	onDone,
	ctaLabel = DEFAULT_CTA,
}: {
	visible: boolean;
	// Fired on the CTA ("rally") or the × / hardware back ("skip"); every caller
	// closes the card either way.
	onDone: (action: "rally" | "skip") => void;
	/** The CTA's words — where the player lands when the card closes. */
	ctaLabel?: string;
}) {
	return (
		<AdaptiveModalScaffold
			visible={visible}
			onRequestClose={() => onDone("skip")}
			maxWidth={400}
			// The card is painted (and its × pinned) only while the tale is up:
			// the content unmounts the moment `visible` drops (below), and a
			// painted frame would fade out as an empty card with a lone ×. Off,
			// the frame falls back to `bare`: nothing drawn.
			bare
			card={visible}
		>
			{/* Gate on `visible` so the player mounts fresh per open (autoplay
			    from 0:00 every retelling) and releases on close — useVideoPlayer
			    ties the native player's lifetime to the mount. */}
			{visible && <TaleCard onDone={onDone} ctaLabel={ctaLabel} />}
		</AdaptiveModalScaffold>
	);
}

function TaleCard({
	onDone,
	ctaLabel,
}: {
	onDone: (action: "rally" | "skip") => void;
	ctaLabel: string;
}) {
	const { height: screenH } = useWindowDimensions();
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

	const rally = useCallback(() => {
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
			() => {}
		);
		onDone("rally");
	}, [onDone]);

	return (
		<>
			<Kicker align="center" style={styles.kicker}>
				season 1 · the tale ★
			</Kicker>
			<PageTitle align="center" accessibilityRole="header" style={styles.headline}>
				The Great Hunger
			</PageTitle>

			{/* The tale itself — 9:16 frame, ink-bordered like the rest of the
			    card family. Captions ride inside the video, along its bottom;
			    controls stay native-free so it reads as a story moment, not a
			    media player. Height caps to the screen so the CTA never gets
			    pushed off. */}
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
					hitSlop={MUTE_HIT}
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

			<Button
				size="lg"
				variant="primary"
				full
				onPress={rally}
				accessibilityLabel={ctaLabel}
				accessibilityHint="Closes the tale"
			>
				{ctaLabel}
			</Button>
		</>
	);
}

const styles = StyleSheet.create({
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
	// Sound toggle riding the video's top-right corner, over the sky: the
	// burned-in captions run along the bottom of every frame, and a chip there
	// covered their last words. Paper chip, ink ring, the card's sticker
	// language.
	muteChip: {
		position: "absolute",
		top: SPACE.sm,
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

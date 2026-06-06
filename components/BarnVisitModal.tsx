// MOCK — Barn visiting (social feature, idea 2). Visit another player's Barn:
// see their pig (their background + equipped hat + country flag) and tickle
// their pig FOR them — the social, hands-on version of trading tickles.
//
// This is a working visual mock: the pig/background/flag are REAL (read from
// the target's profile), but the tickle GRANT is stubbed locally (haptic +
// confirmation, no backend yet). The real implementation will call a
// `tickle_at_barn(target)` RPC that grants the target tickles with a cooldown
// + a "someone visited" notification. Branch: social-barn-visiting.
import { useEffect, useState } from "react";
import {
	Modal,
	View,
	Text,
	Pressable,
	Image,
	ActivityIndicator,
	StyleSheet,
} from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "@/utils/supabase";
import { PigStage } from "./ui/PigStage";
import { PageBackground } from "./ui/PageBackground";
import { Button } from "./ui";
import { HAT_IMAGES } from "@/constants/hats";
import { FONTS, MODAL_BACKDROP_BG, WHIMSY } from "@/constants/theme";

interface Props {
	targetUserId: string;
	targetName: string;
	onClose: () => void;
}

interface Barn {
	username: string | null;
	tickles_earned: number | null;
	active_background_id: string | null;
	active_hat_id: string | null;
	active_flag_id: string | null;
	hat_category: string | null;
	hat_emoji: string | null;
}

// MOCK: how many tickles a visit sends. Real impl will live server-side with a
// cooldown so it can't be farmed.
const VISIT_TICKLES = 3;

export function BarnVisitModal({ targetUserId, targetName, onClose }: Props) {
	const [barn, setBarn] = useState<Barn | null>(null);
	const [loading, setLoading] = useState(true);
	const [tickled, setTickled] = useState(false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			const { data } = await supabase
				.from("profiles")
				.select(
					"username, tickles_earned, active_background_id, active_hat_id, active_flag_id, active_hat:hats!profiles_active_hat_id_fkey(category, emoji)"
				)
				.eq("id", targetUserId)
				.maybeSingle();
			if (cancelled || !data) {
				setLoading(false);
				return;
			}
			const d = data as Record<string, unknown>;
			const hat = (d.active_hat ?? null) as { category?: string; emoji?: string } | null;
			setBarn({
				username: (d.username as string) ?? null,
				tickles_earned: (d.tickles_earned as number) ?? 0,
				active_background_id: (d.active_background_id as string) ?? null,
				active_hat_id: (d.active_hat_id as string) ?? null,
				active_flag_id: (d.active_flag_id as string) ?? null,
				hat_category: hat?.category ?? null,
				hat_emoji: hat?.emoji ?? null,
			});
			setLoading(false);
		})();
		return () => {
			cancelled = true;
		};
	}, [targetUserId]);

	const hatSlot = barn?.active_hat_id
		? { id: barn.active_hat_id, category: barn.hat_category, emoji: barn.hat_emoji }
		: null;
	const flagSlot = barn?.active_flag_id
		? { id: barn.active_flag_id, category: "flag", emoji: null }
		: null;

	const tickle = () => {
		if (tickled) return;
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
			() => {}
		);
		setTickled(true);
		// MOCK: real impl → await rpc("tickle_at_barn", { target: targetUserId }).
	};

	return (
		<Modal visible animationType="slide" transparent onRequestClose={onClose}>
			<View style={styles.root}>
				<PageBackground bgId={barn?.active_background_id ?? null}>
					<View style={styles.overlay}>
						<Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
							<Text style={styles.closeText}>✕</Text>
						</Pressable>

						<Text style={styles.kicker}>visiting</Text>
						<Text style={styles.title}>{targetName}'s Barn</Text>

						{loading ? (
							<ActivityIndicator color={WHIMSY.ink} style={{ marginTop: 40 }} />
						) : (
							<>
								<View style={styles.stage}>
									<PigStage equipped={hatSlot} equippedFlag={flagSlot} />
								</View>

								<Text style={styles.stat}>
									♥ {(barn?.tickles_earned ?? 0).toLocaleString()} tickles earned
								</Text>

								{tickled ? (
									<View style={styles.doneWrap}>
										<Text style={styles.doneEmoji}>🤚✨</Text>
										<Text style={styles.doneText}>
											You tickled {targetName}'s pig! +{VISIT_TICKLES} tickles
											sent their way.
										</Text>
										<Button size="md" variant="ghost" full onPress={onClose}>
											Done
										</Button>
									</View>
								) : (
									<View style={styles.actionWrap}>
										<Button size="lg" variant="primary" full onPress={tickle}>
											Tickle {targetName}'s pig 🤚
										</Button>
										<Text style={styles.hint}>
											Send them {VISIT_TICKLES} tickles — the friendly way to
											share the love.
										</Text>
									</View>
								)}
							</>
						)}
					</View>
				</PageBackground>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: MODAL_BACKDROP_BG },
	overlay: { flex: 1, paddingHorizontal: 20, paddingTop: 64, alignItems: "center" },
	closeBtn: {
		position: "absolute",
		top: 50,
		right: 18,
		width: 40,
		height: 40,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 30,
	},
	closeText: { fontSize: 26, color: WHIMSY.ink },
	kicker: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 12,
		letterSpacing: 1.6,
		color: WHIMSY.accent,
		textTransform: "uppercase",
	},
	title: {
		fontFamily: FONTS.whimsy,
		fontSize: 30,
		color: WHIMSY.ink,
		marginTop: 2,
		textAlign: "center",
	},
	stage: { width: 300, height: 300, marginTop: 8 },
	stat: {
		fontFamily: FONTS.hand,
		fontSize: 16,
		color: WHIMSY.ink,
		marginTop: 4,
		marginBottom: 18,
	},
	actionWrap: { width: "100%", gap: 8, alignItems: "center" },
	hint: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		textAlign: "center",
	},
	doneWrap: { width: "100%", gap: 12, alignItems: "center", paddingHorizontal: 8 },
	doneEmoji: { fontSize: 44 },
	doneText: {
		fontFamily: FONTS.hand,
		fontSize: 16,
		color: WHIMSY.ink,
		textAlign: "center",
		lineHeight: 22,
	},
});

// Barn visiting (social feature, idea 2). Visit another player's Barn: see
// their pig (their background + equipped hat + country flag) and tickle their
// pig FOR them — the social, hands-on version of trading tickles.
//
// Fully wired: the pig/background/flag are read from the target's profile, and
// the tickle calls tickle_at_barn(p_target) which grants the target +3 tickles
// (over-cap), rate-limited to once per target per hour, and fires a "someone
// visited your Barn" in-app notification. Branch: social-barn-visiting.
import { useEffect, useRef, useState } from "react";
import {
	View,
	Text,
	Pressable,
	Image,
	ActivityIndicator,
	StyleSheet,
	Animated,
} from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "@/utils/supabase";
import { rpc } from "@/utils/rpc";
import { PigStage } from "./ui/PigStage";
import { PageBackground } from "./ui/PageBackground";
import { Button } from "./ui";
import { HAT_IMAGES } from "@/constants/hats";
import { FONTS, WHIMSY } from "@/constants/theme";

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

// Tickles a visit sends (matches the server rewards in tickle_at_barn). Display
// only — the real grant + budget + generosity all happen server-side.
const VISIT_TICKLES = 3; // to the host
const VISITOR_TICKLES = 1; // a little tickle back to you

export function BarnVisitModal({ targetUserId, targetName, onClose }: Props) {
	const [barn, setBarn] = useState<Barn | null>(null);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [outOfVisits, setOutOfVisits] = useState(false);
	// Tap-session: tap their pig until both pigs tire out (a random 3–7), then
	// the visit ends back home.
	const [tapCount, setTapCount] = useState(0);
	const [tiredOut, setTiredOut] = useState(false);
	const [tapCap] = useState(() => 3 + Math.floor(Math.random() * 5)); // 3–7
	const [truffleAvail, setTruffleAvail] = useState(false);
	const [dug, setDug] = useState<number | null>(null);
	const [digging, setDigging] = useState(false);
	// The visitor's own pig — so both pigs share the page (you, visiting them).
	const [mine, setMine] = useState<{
		hat: { id: string; category: string | null; emoji: string | null } | null;
		flag: { id: string; category: string; emoji: null } | null;
	}>({ hat: null, flag: null });
	// Tickle juice: hearts that fly from your pig to theirs + a happy bounce.
	const [hearts, setHearts] = useState<{ id: number; anim: Animated.Value }[]>([]);
	const nextHeart = useRef(0);
	const bounce = useRef(new Animated.Value(0)).current;

	const playJuice = () => {
		Animated.sequence([
			Animated.timing(bounce, { toValue: 1, duration: 110, useNativeDriver: true }),
			Animated.spring(bounce, { toValue: 0, friction: 4, useNativeDriver: true }),
		]).start();
		for (let i = 0; i < 6; i++) {
			setTimeout(() => {
				const id = nextHeart.current++;
				const anim = new Animated.Value(0);
				setHearts((h) => [...h, { id, anim }]);
				Animated.timing(anim, {
					toValue: 1,
					duration: 850 + i * 40,
					useNativeDriver: true,
				}).start(() => setHearts((h) => h.filter((x) => x.id !== id)));
			}, i * 70);
		}
	};

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
			// Is there an un-dug truffle buried here to dig up?
			const { data: tr } = await supabase
				.from("truffles")
				.select("id")
				.eq("host_id", targetUserId)
				.is("dug_at", null)
				.maybeSingle();
			if (!cancelled) setTruffleAvail(!!tr);

			// The visitor's own pig (hat + flag) so both pigs show together.
			const { data: ures } = await supabase.auth.getUser();
			if (ures.user) {
				const { data: me } = await supabase
					.from("profiles")
					.select(
						"active_hat_id, active_flag_id, active_hat:hats!profiles_active_hat_id_fkey(category, emoji)"
					)
					.eq("id", ures.user.id)
					.maybeSingle();
				if (!cancelled && me) {
					const m = me as Record<string, unknown>;
					const mh = (m.active_hat ?? null) as { category?: string; emoji?: string } | null;
					setMine({
						hat: m.active_hat_id
							? { id: m.active_hat_id as string, category: mh?.category ?? null, emoji: mh?.emoji ?? null }
							: null,
						flag: m.active_flag_id
							? { id: m.active_flag_id as string, category: "flag", emoji: null }
							: null,
					});
				}
			}
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

	// One tap of the visit tap-session. Both pigs get tickles + happiness; after
	// a random 3–7 taps (or the server's tired ceiling), both pigs tire out and
	// the visit closes back to the homepage.
	const tireOut = () => {
		setTiredOut(true);
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
			() => {}
		);
		setTimeout(onClose, 2600);
	};

	const tickle = async () => {
		if (tiredOut || busy) return;
		setBusy(true);
		const r = await rpc<{ ok?: boolean; error?: string }>("tickle_at_barn", {
			p_target: targetUserId,
		});
		setBusy(false);
		if (r?.ok) {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
			playJuice();
			const next = tapCount + 1;
			setTapCount(next);
			if (next >= tapCap) tireOut();
		} else if (r?.error === "tired") {
			tireOut();
		} else if (r?.error === "budget") {
			Haptics.notificationAsync(
				Haptics.NotificationFeedbackType.Warning
			).catch(() => {});
			setOutOfVisits(true);
		}
	};

	const dig = async () => {
		if (digging || dug != null) return;
		setDigging(true);
		const r = await rpc<{ ok?: boolean; reward?: number; error?: string }>(
			"dig_truffle",
			{ p_host: targetUserId }
		);
		setDigging(false);
		setTruffleAvail(false);
		if (r?.ok) {
			Haptics.notificationAsync(
				Haptics.NotificationFeedbackType.Success
			).catch(() => {});
			setDug(r.reward ?? 0);
		}
		// error 'none' (someone beat you to it) just clears the button.
	};

	return (
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
								{/* Both pigs together — you, paying them a visit. */}
								<View style={styles.pigsRow}>
									<View style={styles.pigCol}>
										<View style={styles.pigScaleWrap}>
											<View style={styles.pigScale}>
												<PigStage
													equipped={mine.hat}
													equippedFlag={mine.flag}
													pigAnimation={tiredOut ? "tired" : "idle"}
												/>
											</View>
										</View>
										<Text style={styles.pigLabel}>you</Text>
									</View>
									<Text style={styles.between}>🤚</Text>
									<View style={styles.pigCol}>
										<View style={styles.pigScaleWrap}>
											<Animated.View
												style={[
													styles.pigScale,
													{
														transform: [
															{ scale: 0.5 },
															{
																scale: bounce.interpolate({
																	inputRange: [0, 1],
																	outputRange: [1, 1.18],
																}),
															},
														],
													},
												]}
											>
												<PigStage
													equipped={hatSlot}
													equippedFlag={flagSlot}
													pigAnimation={tiredOut ? "tired" : "idle"}
												/>
											</Animated.View>
										</View>
										<Text style={styles.pigLabel} numberOfLines={1}>
											{targetName}
										</Text>
									</View>

									{/* Hearts fly from you → them on a tickle. */}
									<View pointerEvents="none" style={styles.heartsLayer}>
										{hearts.map((h) => (
											<Animated.Text
												key={h.id}
												style={[
													styles.heart,
													{
														opacity: h.anim.interpolate({
															inputRange: [0, 0.15, 0.8, 1],
															outputRange: [0, 1, 1, 0],
														}),
														transform: [
															{
																translateX: h.anim.interpolate({
																	inputRange: [0, 1],
																	outputRange: [-40, 60],
																}),
															},
															{
																translateY: h.anim.interpolate({
																	inputRange: [0, 0.5, 1],
																	outputRange: [8, -26, -10],
																}),
															},
															{
																scale: h.anim.interpolate({
																	inputRange: [0, 0.2, 1],
																	outputRange: [0.4, 1.1, 0.85],
																}),
															},
														],
													},
												]}
											>
												♥
											</Animated.Text>
										))}
									</View>
								</View>

								<Text style={styles.stat}>
									♥ {(barn?.tickles_earned ?? 0).toLocaleString()} tickles earned
								</Text>

								{dug != null ? (
									<Text style={styles.truffleFound}>
										🐽✨ You dug up a truffle — +{dug} snouts!
									</Text>
								) : truffleAvail ? (
									<Pressable
										onPress={dig}
										disabled={digging}
										style={({ pressed }) => [
											styles.truffleBtn,
											pressed && { opacity: 0.85 },
										]}
									>
										<Text style={styles.truffleText}>
											{digging ? "digging…" : "🐽 Dig for a truffle!"}
										</Text>
									</Pressable>
								) : null}

								{tiredOut ? (
									<View style={styles.doneWrap}>
										<Text style={styles.doneEmoji}>😴💤</Text>
										<Text style={styles.doneText}>
											The pigs are all tuckered out — come play another time!
										</Text>
									</View>
								) : outOfVisits ? (
									<View style={styles.actionWrap}>
										<Button size="lg" variant="locked" full disabled>
											Out of visits today
										</Button>
										<Text style={styles.hint}>
											You've spread the love to 5 barns today — your visits
											refill tomorrow.
										</Text>
									</View>
								) : (
									<View style={styles.actionWrap}>
										<Button
											size="lg"
											variant="primary"
											full
											disabled={busy}
											onPress={tickle}
										>
											{busy
												? "…"
												: tapCount === 0
													? `Tickle ${targetName}'s pig 🤚`
													: "Again! 🤚"}
										</Button>
										<Text style={styles.hint}>
											{tapCount === 0
												? "Tap their pig — you both get happier and a little tickle."
												: "Keep going — until the pigs get sleepy."}
										</Text>
									</View>
								)}
							</>
						)}
					</View>
				</PageBackground>
		</View>
	);
}

const styles = StyleSheet.create({
	// Full-screen overlay (NOT a nested Modal — iOS won't reliably stack a
	// Modal over the UserSheet Modal). Sits on top within the sheet's layer.
	root: { ...StyleSheet.absoluteFillObject, zIndex: 100, backgroundColor: WHIMSY.cream },
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
	pigsRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		marginTop: 8,
		position: "relative",
	},
	heartsLayer: {
		...StyleSheet.absoluteFillObject,
		alignItems: "center",
		justifyContent: "center",
	},
	heart: { position: "absolute", fontSize: 24, color: WHIMSY.roseDeep },
	pigCol: { alignItems: "center" },
	// 300px PigStage scaled to 0.5 → a 150px box (overflow clipped).
	pigScaleWrap: {
		width: 150,
		height: 150,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
	},
	pigScale: { transform: [{ scale: 0.5 }] },
	pigLabel: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.ink,
		maxWidth: 150,
		textAlign: "center",
	},
	between: { fontSize: 26, marginHorizontal: 2 },
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
	truffleBtn: {
		backgroundColor: WHIMSY.peach,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 14,
		paddingVertical: 10,
		paddingHorizontal: 18,
		marginBottom: 14,
	},
	truffleText: { fontFamily: FONTS.whimsy, fontSize: 16, color: WHIMSY.ink },
	truffleFound: {
		fontFamily: FONTS.whimsy,
		fontSize: 17,
		color: WHIMSY.ink,
		textAlign: "center",
		marginBottom: 14,
	},
	generous: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.angel,
		textAlign: "center",
	},
	doneText: {
		fontFamily: FONTS.hand,
		fontSize: 16,
		color: WHIMSY.ink,
		textAlign: "center",
		lineHeight: 22,
	},
});

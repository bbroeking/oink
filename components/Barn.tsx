import React, { useState, useCallback, useEffect, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import {
	View,
	StyleSheet,
	ImageBackground,
	Dimensions,
	Platform,
	SafeAreaView,
	Pressable,
	Alert,
	Text,
	Animated,
	DevSettings,
} from "react-native";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../utils/supabase";
import { log } from "../utils/log";
import SwipeElement from "./SwipeElement";
import { Icon } from "./ui/Icon";
import { Sticker, Tape } from "./ui/Sticker";
import { WHIMSY, FONTS } from "@/constants/theme";

const tickleSound = require("../assets/sounds/tickle.m4a");

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface Stats {
	counter: number;
	ticklesEarned: number;
	itemCount: number;
	cap: number;
	nextRegenSeconds: number | null;
	activeHatId: string | null;
	activeCategory: string | null;
	activeEmoji: string | null;
	currentTier: number;
	totalTiers: number;
}

function formatCountdown(totalSeconds: number): string {
	const m = Math.floor(totalSeconds / 60);
	const s = totalSeconds % 60;
	if (m === 0) return `${s}s`;
	return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function PaperTicket({
	label,
	value,
	tapeColor,
	rotate,
	chipColor = "roseDeep",
	chipSymbol = "♥",
	subValue,
	onPress,
}: {
	label: string;
	value: string;
	tapeColor: "sun" | "rose" | "sky" | "sage" | "lilac" | "peach";
	rotate: number;
	chipColor?: "roseDeep" | "lilacDeep" | "peach";
	chipSymbol?: string;
	subValue?: string;
	onPress?: () => void;
}) {
	const Wrap: React.ElementType = onPress ? Pressable : View;
	return (
		<Wrap onPress={onPress} style={styles.ticketWrap}>
			<Tape
				color={tapeColor}
				rotate={-6 + rotate}
				width={56}
				height={16}
				style={styles.tape}
			/>
			<Sticker color="paper" rotate={rotate} radius={10} style={styles.ticket}>
				<View style={styles.ticketInner}>
					<View
						style={[
							styles.coin,
							{ backgroundColor: WHIMSY[chipColor] },
						]}
					>
						<Text style={styles.coinSymbol}>{chipSymbol}</Text>
					</View>
					<View style={{ flex: 1, minWidth: 0 }}>
						<View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
							<Text style={styles.ticketValue}>{value}</Text>
							{subValue && (
								<Text style={styles.ticketSub}>{subValue}</Text>
							)}
						</View>
						<Text style={styles.ticketLabel}>{label}</Text>
					</View>
				</View>
			</Sticker>
		</Wrap>
	);
}

function WoodenSign({
	tier,
	totalTiers,
	onPress,
}: {
	tier: number;
	totalTiers: number;
	onPress: () => void;
}) {
	return (
		<Pressable onPress={onPress} style={styles.signWrap}>
			{/* Post (drawn first, behind sign) */}
			<View style={styles.signPost} />
			<Sticker color="peach" rotate={-2.5} radius={12} style={styles.sign}>
				<View style={styles.signInner}>
					<View style={{ flex: 1 }}>
						<Text style={styles.signLabel}>snout season 1 ★</Text>
						<Text style={styles.signTier}>
							Tier {tier} of {totalTiers}
						</Text>
					</View>
					<Icon name="arrowRight" size={20} color={WHIMSY.ink} strokeWidth={2.5} />
				</View>
			</Sticker>
		</Pressable>
	);
}

export default function Barn() {
	const [stats, setStats] = useState<Stats>({
		counter: 0,
		ticklesEarned: 0,
		itemCount: 0,
		cap: 25,
		nextRegenSeconds: null,
		activeHatId: null,
		activeCategory: null,
		activeEmoji: null,
		currentTier: 1,
		totalTiers: 30,
	});
	const [statsLoaded, setStatsLoaded] = useState(false);
	const [sixSevenTick, setSixSevenTick] = useState(0);
	const sixSevenPromptedRef = useRef(false);
	const player = useAudioPlayer(tickleSound);
	const [toast, setToast] = useState<{
		title: string;
		body: string;
		onPress?: () => void;
	} | null>(null);
	const toastOpacity = useRef(new Animated.Value(0)).current;
	const toastY = useRef(new Animated.Value(-20)).current;
	// Track which pass-event IDs we've already surfaced this session so a
	// focus-bounce (or a delayed seen-write) doesn't replay the same toast.
	const shownPassEventIds = useRef<Set<number>>(new Set());

	const showToast = useCallback(
		(title: string, body: string, onPress?: () => void) => {
			setToast({ title, body, onPress });
			toastOpacity.setValue(0);
			toastY.setValue(-20);
			Animated.sequence([
				Animated.parallel([
					Animated.timing(toastOpacity, {
						toValue: 1,
						duration: 220,
						useNativeDriver: true,
					}),
					Animated.timing(toastY, {
						toValue: 0,
						duration: 220,
						useNativeDriver: true,
					}),
				]),
				Animated.delay(2400),
				Animated.parallel([
					Animated.timing(toastOpacity, {
						toValue: 0,
						duration: 300,
						useNativeDriver: true,
					}),
					Animated.timing(toastY, {
						toValue: -20,
						duration: 300,
						useNativeDriver: true,
					}),
				]),
			]).start(() => setToast(null));
		},
		[toastOpacity, toastY]
	);

	// Friendly, slightly competitive pig-voice lines for pass events. Picked
	// at random so it doesn't feel like the same robotic notification.
	const PASS_LINES = [
		(name: string) => `Oink! ${name} just trotted past you.`,
		(name: string) => `${name} snouted ahead. Don't look back.`,
		(name: string) => `${name} just hoofed past you on the board.`,
		(name: string) => `Squeal — ${name} edged ahead of you.`,
		(name: string) => `${name} muddied your lead.`,
	];

	const checkPassEvents = useCallback(async () => {
		try {
			const { data, error } = await supabase.rpc("unseen_pass_events");
			if (error) return; // RPC may not exist yet pre-migration — fail quiet.
			const rows = (data ?? []) as {
				id: number;
				passer_id: string;
				passer_username: string | null;
				passer_tickles: number;
				passed_tickles: number;
			}[];
			// Most recent first from the RPC — show the freshest pass we
			// haven't already surfaced this session.
			const fresh = rows.find((r) => !shownPassEventIds.current.has(r.id));
			if (!fresh) return;
			shownPassEventIds.current.add(fresh.id);
			const name = fresh.passer_username?.trim() || "Someone";
			const line =
				PASS_LINES[Math.floor(Math.random() * PASS_LINES.length)](name);
			showToast(line, "Tap to see the leaderboard.", () => {
				supabase
					.rpc("mark_pass_event_seen", { event_id: fresh.id })
					.then(() => {});
				router.push("/leaderboard");
			});
			// Fire-and-forget: mark seen so the next poll doesn't return it.
			supabase
				.rpc("mark_pass_event_seen", { event_id: fresh.id })
				.then(() => {});
		} catch {
			// Network blips silently — pass events are non-critical UX.
		}
	}, [showToast]);

	useEffect(() => {
		if (sixSevenPromptedRef.current) return;
		if (stats.counter < 67) return;
		sixSevenPromptedRef.current = true;
		(async () => {
			const seen = await AsyncStorage.getItem("seen_67");
			if (seen === "1") return;
			Alert.alert(
				"6 7! 🐷",
				"You've crossed 67 tickles. Wanna celebrate with a six-seven?",
				[
					{
						text: "Skip",
						style: "cancel",
						onPress: () => AsyncStorage.setItem("seen_67", "1"),
					},
					{
						text: "Six seven!",
						onPress: () => {
							AsyncStorage.setItem("seen_67", "1");
							setSixSevenTick((t) => t + 1);
						},
					},
				]
			);
		})();
	}, [stats.counter]);

	useFocusEffect(
		useCallback(() => {
			fetchStats();
			checkPassEvents();
			setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
		}, [checkPassEvents])
	);

	const fetchStats = async () => {
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) throw new Error("User not logged in");

			const [profileResult, infoResult, seasonResult] = await Promise.all([
				supabase
					.from("profiles")
					.select("counter, tickles_earned, active_hat_id")
					.eq("id", user.id)
					.single(),
				supabase.rpc("tickle_info", { uid: user.id }),
				supabase.rpc("season_state"),
			]);

			if (profileResult.error) throw profileResult.error;

			const info = infoResult.data as {
				balance?: number;
				cap?: number;
				next_regen_seconds?: number | null;
			} | null;
			const season = seasonResult.data as {
				current_tier?: number;
				season?: { total_tiers?: number };
			} | null;
			const activeId = profileResult.data?.active_hat_id ?? null;

			let activeCategory: string | null = null;
			let activeEmoji: string | null = null;
			if (activeId) {
				const { data: hat } = await supabase
					.from("hats")
					.select("category, emoji")
					.eq("id", activeId)
					.single();
				activeCategory = hat?.category ?? null;
				activeEmoji = hat?.emoji ?? null;
			}

			setStats({
				counter: profileResult.data?.counter || 0,
				ticklesEarned: profileResult.data?.tickles_earned ?? 0,
				itemCount: info?.balance ?? 0,
				cap: info?.cap ?? 25,
				nextRegenSeconds: info?.next_regen_seconds ?? null,
				activeHatId: activeId,
				activeCategory,
				activeEmoji,
				currentTier: season?.current_tier ?? 1,
				totalTiers: season?.season?.total_tiers ?? 30,
			});
			setStatsLoaded(true);
		} catch (error) {
			log.error("Error fetching stats:", error);
		}
	};

	const handleIncrement = async () => {
		if (stats.itemCount <= 0) {
			const next = stats.nextRegenSeconds;
			showToast(
				"Out of tickles!",
				next != null
					? `Next tickle in ${formatCountdown(next)} · max ${stats.cap}`
					: `Wait for regen or buy more soon.`
			);
			return;
		}

		try {
			player.seekTo(0);
			player.play();
		} catch {}

		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) throw new Error("User not logged in");

			const { error } = await supabase.rpc("update_profile_and_item_count", {
				uid: user.id,
			});

			if (error) throw error;
			fetchStats();
			// Also re-check pass events so a friend who just got passed
			// hears about it on their next tap (and so any incoming pass
			// against us surfaces quickly between focus events).
			checkPassEvents();
		} catch (error) {
			log.error("Error incrementing count:", error);
		}
	};

	const handleAvailableTap = () => {
		if (stats.itemCount >= stats.cap) {
			Alert.alert("Tickle bank full", `You're at the ${stats.cap} max.`);
			return;
		}
		if (stats.nextRegenSeconds == null) {
			Alert.alert("Tickle bank", `${stats.itemCount} / ${stats.cap}`);
			return;
		}
		Alert.alert(
			"Next tickle",
			`In ${formatCountdown(stats.nextRegenSeconds)}.\nYou regenerate +1 every hour, up to ${stats.cap}.`
		);
	};

	return (
		<ImageBackground
			source={require("../assets/images/homepage-bg.jpg")}
			style={styles.backgroundImage}
			resizeMode="cover"
		>
			<SafeAreaView style={styles.contentContainer}>
				<View style={styles.statsRow}>
					<PaperTicket
						label="TICKLES EARNED"
						value={stats.ticklesEarned.toLocaleString()}
						tapeColor="sun"
						rotate={-3}
						chipColor="roseDeep"
						chipSymbol="♥"
					/>
					<PaperTicket
						label="READY TO TICKLE"
						value={`${stats.itemCount}`}
						subValue={`/ ${stats.cap}`}
						tapeColor="rose"
						rotate={2.5}
						chipColor="lilacDeep"
						chipSymbol="✦"
						onPress={handleAvailableTap}
					/>
				</View>

				<View style={styles.mainSection}>
					<View style={styles.swipeContainer}>
						<SwipeElement
							onLuckySwipe={handleIncrement}
							canTickle={!statsLoaded || stats.itemCount > 0}
							playSixSeven={sixSevenTick}
							equipped={
								stats.activeHatId
									? {
											id: stats.activeHatId,
											category: stats.activeCategory,
											emoji: stats.activeEmoji,
										}
									: null
							}
						/>
					</View>
				</View>

				<WoodenSign
					tier={stats.currentTier}
					totalTiers={stats.totalTiers}
					onPress={() => router.push("/season")}
				/>

				{__DEV__ && (
					<Pressable
						onPress={() => router.push("/align")}
						style={styles.devAlign}
					>
						<Text style={styles.devAlignText}>⊕ align</Text>
					</Pressable>
				)}

				{toast && (
					<Animated.View
						pointerEvents={toast.onPress ? "box-none" : "none"}
						style={[
							styles.toastWrap,
							{
								opacity: toastOpacity,
								transform: [{ translateY: toastY }],
							},
						]}
					>
						<Pressable
							onPress={toast.onPress}
							disabled={!toast.onPress}
						>
							<Sticker color="rose" rotate={-1.2} radius={14} style={styles.toast}>
								<View style={styles.toastInner}>
									<View style={styles.toastIcon}>
										<Text style={styles.toastIconText}>♥</Text>
									</View>
									<View style={{ flex: 1, minWidth: 0 }}>
										<Text style={styles.toastTitle}>{toast.title}</Text>
										<Text style={styles.toastBody}>{toast.body}</Text>
									</View>
								</View>
							</Sticker>
						</Pressable>
					</Animated.View>
				)}
			</SafeAreaView>
		</ImageBackground>
	);
}

const styles = StyleSheet.create({
	backgroundImage: {
		position: "absolute",
		left: 0,
		top: 0,
		right: 0,
		bottom: 0,
		width: "100%",
		height: SCREEN_HEIGHT,
	},
	contentContainer: {
		flex: 1,
		height: SCREEN_HEIGHT,
	},
	statsRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingHorizontal: 14,
		paddingTop: Platform.OS === "ios" ? 12 : 24,
		gap: 10,
		zIndex: 1,
	},
	ticketWrap: {
		position: "relative",
		paddingTop: 12,
		flex: 1,
	},
	tape: {
		position: "absolute",
		top: 0,
		alignSelf: "center",
		zIndex: 2,
	},
	ticket: {
		paddingHorizontal: 14,
		paddingVertical: 12,
		minWidth: 168,
	},
	ticketInner: {
		flexDirection: "row",
		alignItems: "center",
		gap: 11,
	},
	coin: {
		width: 32,
		height: 32,
		borderRadius: 16,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	coinSymbol: {
		color: WHIMSY.paper,
		fontFamily: FONTS.bodyExtra,
		fontSize: 16,
		lineHeight: 17,
	},
	ticketLabel: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		color: WHIMSY.ink,
		lineHeight: 12,
		marginTop: 4,
		letterSpacing: 1.4,
	},
	ticketValue: {
		fontFamily: FONTS.whimsy,
		fontSize: 30,
		color: WHIMSY.ink,
		lineHeight: 30,
	},
	ticketSub: {
		fontFamily: FONTS.hand,
		fontSize: 17,
		color: WHIMSY.mute,
	},
	mainSection: {
		flex: 1,
		justifyContent: "flex-end",
	},
	swipeContainer: {
		width: "100%",
		alignItems: "center",
		// Push the pig past the bottom edge so its feet are clipped. ~11% of
		// screen height keeps the framing consistent across iPhone SE → Pro Max.
		marginBottom: -Math.round(SCREEN_HEIGHT * 0.11),
	},
	signWrap: {
		alignItems: "center",
		marginBottom: Platform.OS === "ios" ? 16 : 36,
	},
	signPost: {
		width: 14,
		height: 28,
		backgroundColor: WHIMSY.peach,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		marginBottom: -10,
		zIndex: 0,
		transform: [{ rotate: "-1.5deg" }],
	},
	sign: {
		paddingHorizontal: 18,
		paddingVertical: 12,
		minWidth: "78%",
		zIndex: 1,
	},
	signInner: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	signLabel: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		marginBottom: 2,
	},
	signTier: {
		fontFamily: FONTS.whimsy,
		fontSize: 18,
		color: WHIMSY.ink,
	},
	dev67: {
		position: "absolute",
		bottom: 100,
		left: 14,
		width: 48,
		height: 48,
		borderRadius: 24,
		backgroundColor: "rgba(0,0,0,0.7)",
		borderWidth: 2,
		borderColor: WHIMSY.sun,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 20,
	},
	devOnboarding: {
		position: "absolute",
		bottom: 100,
		left: 70,
		width: 48,
		height: 48,
		borderRadius: 24,
		backgroundColor: "rgba(0,0,0,0.7)",
		borderWidth: 2,
		borderColor: WHIMSY.sun,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 20,
	},
	dev67Text: {
		color: WHIMSY.sun,
		fontFamily: FONTS.whimsy,
		fontSize: 18,
	},
devAlign: {
		position: "absolute",
		top: Platform.OS === "ios" ? 60 : 24,
		right: 12,
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 14,
		backgroundColor: "rgba(0,0,0,0.7)",
		borderWidth: 1.5,
		borderColor: WHIMSY.sun,
		zIndex: 50,
	},
	devAlignText: {
		color: WHIMSY.sun,
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		letterSpacing: 0.5,
	},
	toastWrap: {
		position: "absolute",
		top: Platform.OS === "ios" ? 180 : 160,
		left: 16,
		right: 16,
		zIndex: 30,
	},
	toast: {
		paddingHorizontal: 14,
		paddingVertical: 10,
	},
	toastInner: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	toastIcon: {
		width: 32,
		height: 32,
		borderRadius: 16,
		backgroundColor: WHIMSY.roseDeep,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	toastIconText: {
		color: WHIMSY.paper,
		fontFamily: FONTS.bodyExtra,
		fontSize: 15,
	},
	toastTitle: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.ink,
		lineHeight: 18,
	},
	toastBody: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		marginTop: 1,
	},
});

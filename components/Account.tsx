import { useCallback, useState } from "react";
import {
	ScrollView,
	StyleSheet,
	View,
	SafeAreaView,
	Pressable,
	Share,
	Text,
	Alert,
	Linking,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../utils/supabase";
import Friends from "./Friends";
import { Card, Button } from "./ui";
import { Icon } from "./ui/Icon";
import { SnoutCoin } from "./ui/SnoutCoin";
import { PigAvatar } from "./ui/PigAvatar";
import { Sticker, Tape } from "./ui/Sticker";
import { COLORS, FONTS, KICKER_TEXT, TITLE_RULE, WHIMSY, STICKER_SHADOW } from "@/constants/theme";
import {
	initIAP,
	isPro,
	presentPaywall,
	presentCustomerCenter,
	restorePurchases,
	onCustomerInfoUpdate,
} from "../utils/iap";

export function Account({ session }: { session: Session }) {
	const [username, setUsername] = useState<string | null>(null);
	const [counter, setCounter] = useState<number>(0);
	const [activeHat, setActiveHat] = useState<string | null>(null);
	const [isVip, setIsVip] = useState<boolean>(false);
	const [busy, setBusy] = useState<boolean>(false);

	useFocusEffect(
		useCallback(() => {
			supabase
				.from("profiles")
				.select("username, counter, active_hat_id, is_vip")
				.eq("id", session.user.id)
				.single()
				.then(({ data }) => {
					setUsername(data?.username ?? null);
					setCounter(data?.counter ?? 0);
					setActiveHat(data?.active_hat_id ?? null);
					setIsVip(data?.is_vip ?? false);
				});
		}, [session.user.id])
	);

	const handleShare = async () => {
		if (!username) return;
		try {
			await Share.share({
				message: `Add me on Tickle the Pig — my code is ${username}`,
			});
		} catch {}
	};

	// Listen for entitlement changes from RC (e.g., webhook flips after sandbox renewal)
	useFocusEffect(
		useCallback(() => {
			const unsub = onCustomerInfoUpdate(async (info) => {
				const pro = !!info.entitlements.active["tickle_the_pig_pro"];
				if (pro && !isVip) {
					setIsVip(true);
					await supabase.rpc("dev_set_vip", { target: true });
				}
			});
			return unsub;
		}, [isVip])
	);

	const handleUnlockPro = async () => {
		if (busy) return;
		setBusy(true);
		try {
			await initIAP(session.user.id);
		} catch {}
		const result = await presentPaywall();
		setBusy(false);
		if (result.ok) {
			const pro = await isPro();
			if (pro) {
				await supabase.rpc("dev_set_vip", { target: true });
				setIsVip(true);
				Alert.alert("Welcome to Pro!", "Your perks are live.");
			}
			return;
		}
		if (result.reason === "cancelled") return;
		if (result.reason === "no_offering") {
			Alert.alert(
				"Tickle the Pig Pro",
				"Storefront not configured yet (need ASC products + RC offering). Unlock for free in dev?",
				[
					{ text: "Cancel", style: "cancel" },
					{
						text: "Unlock (dev)",
						onPress: async () => {
							await supabase.rpc("dev_set_vip", { target: true });
							setIsVip(true);
						},
					},
				]
			);
			return;
		}
		Alert.alert("Couldn't open paywall", "Please try again.");
	};

	const handleManage = async () => {
		await presentCustomerCenter();
	};

	const handleRestore = async () => {
		const result = await restorePurchases();
		if (result.ok) {
			const pro = await isPro();
			if (pro) {
				await supabase.rpc("dev_set_vip", { target: true });
				setIsVip(true);
				Alert.alert("Restored", "Your Pro access is active.");
			} else {
				Alert.alert("Nothing to restore", "No active Pro subscription on this Apple ID.");
			}
		} else {
			Alert.alert("Restore failed", "Please try again.");
		}
	};

	return (
		<View style={styles.container}>
			<SafeAreaView style={styles.safe}>
				<ScrollView contentContainerStyle={styles.content}>
					<Text style={styles.kicker}>★ your scrapbook</Text>
					<Text style={styles.title}>Account</Text>
					<View style={styles.titleRule} />

					{/* Your code card — scrapbook page */}
					{username && (
						<View style={styles.codeWrap}>
							<Tape
								color="sun"
								rotate={-10}
								width={66}
								height={18}
								style={styles.codeTape}
							/>
							<Sticker color="rose" rotate={-1} radius={18} style={styles.codeCard}>
								<View style={styles.codeRow}>
									<View style={styles.codeAvatar}>
										<PigAvatar size={56} hatId={activeHat} />
									</View>
									<View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
										<Text style={styles.codeLabel}>your code</Text>
										<Text style={styles.codeValue}>{username}</Text>
										<View style={styles.codeStats}>
											<SnoutCoin size={13} />
											<Text style={styles.codeStatsText}>
												{counter.toLocaleString()} lifetime tickles
											</Text>
										</View>
									</View>
								</View>
								<Pressable onPress={handleShare} style={styles.shareBtn}>
									<Icon name="share" size={16} color={WHIMSY.ink} strokeWidth={2.2} />
									<Text style={styles.shareBtnText}>Share my code</Text>
								</Pressable>
							</Sticker>
						</View>
					)}

					{/* Pro card — torn ticket stub */}
					<Sticker
						color={isVip ? "lilac" : "sun"}
						rotate={1.2}
						radius={16}
						style={styles.vipWrap}
					>
						<View style={styles.vipBadgeRow}>
							<Icon name="star" size={14} filled color={WHIMSY.ink} strokeWidth={0} />
							<Text style={styles.vipBadge}>TICKLE THE PIG PRO</Text>
						</View>
						<Text style={styles.vipTitle}>
							{isVip ? "You're Pro" : "Become Pro"}
						</Text>
						<Text style={styles.vipDesc}>
							{isVip
								? "+25 cap · 2× regen · all premium passes · exclusive cosmetics"
								: "+25 cap · 2× regen · all premium passes · exclusive cosmetics"}
						</Text>
						{isVip ? (
							<Pressable
								onPress={handleManage}
								style={[styles.vipBtn, { backgroundColor: WHIMSY.paper }]}
							>
								<Text style={styles.vipBtnText}>Manage subscription</Text>
							</Pressable>
						) : (
							<Pressable
								onPress={handleUnlockPro}
								disabled={busy}
								style={[styles.vipBtn, { backgroundColor: WHIMSY.lilac }]}
							>
								<Text style={styles.vipBtnText}>Unlock Pro</Text>
							</Pressable>
						)}
					</Sticker>

					<Pressable onPress={handleRestore} style={styles.restoreLink}>
						<Text style={styles.restoreLinkText}>Restore purchases</Text>
					</Pressable>

					<View style={{ marginTop: 8 }}>
						<Friends userId={session.user.id} />
					</View>

					{__DEV__ && (
						<Pressable
							onPress={() => router.push("/align")}
							style={({ pressed }) => [
								styles.devLink,
								{ opacity: pressed ? 0.6 : 1 },
							]}
						>
							<Text style={styles.devLinkText}>🛠 DEV · Align items</Text>
						</Pressable>
					)}

					<Pressable
						onPress={() => supabase.auth.signOut()}
						style={({ pressed }) => [
							styles.signOut,
							{ opacity: pressed ? 0.6 : 1 },
						]}
					>
						<Text style={styles.signOutText}>Sign Out</Text>
					</Pressable>
				</ScrollView>
			</SafeAreaView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: WHIMSY.cream },
	safe: { flex: 1 },
	content: { padding: 18, paddingBottom: 120 },
	kicker: {
		...KICKER_TEXT,
		marginBottom: 4,
	},
	title: {
		fontSize: 32,
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
		marginBottom: 4,
	},
	titleRule: {
		...TITLE_RULE,
		width: 80,
		marginBottom: 18,
	},
	codeWrap: {
		position: "relative",
		paddingTop: 12,
		marginBottom: 18,
	},
	codeTape: {
		position: "absolute",
		top: 0,
		left: 32,
		zIndex: 2,
	},
	codeCard: {
		padding: 16,
	},
	codeRow: {
		flexDirection: "row",
		alignItems: "center",
	},
	codeAvatar: {
		borderRadius: 32,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		padding: 2,
	},
	codeLabel: {
		fontSize: 12,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
	},
	codeValue: {
		fontSize: 24,
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
		lineHeight: 26,
		marginTop: 2,
	},
	codeStats: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		marginTop: 4,
	},
	codeStatsText: {
		fontSize: 13,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
	},
	shareBtn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		marginTop: 14,
		paddingVertical: 9,
		borderRadius: 12,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
	},
	shareBtnText: {
		fontFamily: FONTS.whimsy,
		fontSize: 14,
		color: WHIMSY.ink,
	},
	vipWrap: {
		marginBottom: 16,
		padding: 16,
	},
	vipBadgeRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 5,
		marginBottom: 4,
	},
	vipBadge: {
		fontSize: 11,
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
		letterSpacing: 1,
	},
	vipTitle: {
		fontSize: 22,
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
		lineHeight: 24,
	},
	vipDesc: {
		fontSize: 13,
		fontFamily: FONTS.hand,
		color: WHIMSY.ink,
		opacity: 0.7,
		marginTop: 2,
		lineHeight: 17,
	},
	vipCtas: {
		flexDirection: "row",
		gap: 8,
		marginTop: 12,
	},
	vipBtn: {
		paddingVertical: 9,
		borderRadius: 12,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		marginTop: 12,
	},
	vipBtnText: {
		fontFamily: FONTS.whimsy,
		fontSize: 13,
		color: WHIMSY.ink,
	},
	restoreLink: {
		alignItems: "center",
		marginTop: 8,
		marginBottom: 8,
		paddingVertical: 8,
	},
	restoreLinkText: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.accent,
		textDecorationLine: "underline",
	},
	signOut: {
		alignItems: "center",
		marginTop: 22,
		paddingVertical: 12,
	},
	signOutText: {
		fontSize: 14,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
	},
	devLink: {
		alignItems: "center",
		marginTop: 18,
		paddingVertical: 10,
		borderRadius: 12,
		backgroundColor: WHIMSY.paper,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderStyle: "dashed",
	},
	devLinkText: {
		fontSize: 13,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		letterSpacing: 0.4,
	},
});

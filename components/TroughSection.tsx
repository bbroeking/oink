// The Trough — friend-funded item drives, surfaced as a section in the Shop.
// Lists open Troughs from your Sounder (my_drives), lets you chip in snouts
// (2 snouts → 1 tickle), and claim rewards from drives that funded. Styling is
// functional/basic — the polished look comes from the claude.ai/design pass
// (see docs/trough-ui-prompt.md).
import { useCallback, useState } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { rpc } from "@/utils/rpc";
import { HAT_IMAGES } from "@/constants/hats";
import { FONTS, WHIMSY } from "@/constants/theme";
import { SectionHeader } from "./ui";
import * as Haptics from "expo-haptics";

interface Drive {
	id: string;
	item_id: string;
	opener_id: string;
	opener_name: string | null;
	target: number;
	raised: number;
	status: string;
	closes_at: string;
	is_mine: boolean;
}
interface Claimable {
	donation_id: string;
	drive_id: string;
	tickle_reward: number;
	item_id: string;
}

function hoursLeft(iso: string): string {
	const ms = new Date(iso).getTime() - Date.now();
	if (ms <= 0) return "closing";
	const h = Math.floor(ms / 3_600_000);
	const m = Math.floor((ms % 3_600_000) / 60_000);
	return h > 0 ? `${h}h left` : `${m}m left`;
}

export function TroughSection() {
	const [drives, setDrives] = useState<Drive[]>([]);
	const [claimable, setClaimable] = useState<Claimable[]>([]);
	const [amounts, setAmounts] = useState<Record<string, number>>({});
	const [busy, setBusy] = useState<string | null>(null);

	const load = useCallback(async () => {
		const r = await rpc<{ ok?: boolean; drives: Drive[]; claimable: Claimable[] }>(
			"my_drives"
		);
		if (r?.ok) {
			setDrives(r.drives ?? []);
			setClaimable(r.claimable ?? []);
		}
	}, []);

	useFocusEffect(
		useCallback(() => {
			load();
		}, [load])
	);

	const amountFor = (d: Drive) =>
		Math.min(amounts[d.id] ?? 20, d.target - d.raised);

	const bump = (id: string, delta: number, max: number) =>
		setAmounts((p) => ({
			...p,
			[id]: Math.max(2, Math.min(max, (p[id] ?? 20) + delta)),
		}));

	const donate = async (d: Drive) => {
		if (busy) return;
		setBusy(d.id);
		Haptics.selectionAsync().catch(() => {});
		await rpc("donate_to_drive", { drive_id: d.id, snouts: amountFor(d) });
		await load();
		setBusy(null);
	};

	const claim = async (c: Claimable) => {
		if (busy) return;
		setBusy(c.donation_id);
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
			() => {}
		);
		await rpc("claim_drive_reward", { donation_id: c.donation_id });
		await load();
		setBusy(null);
	};

	if (drives.length === 0 && claimable.length === 0) return null;

	return (
		<View style={styles.wrap}>
			<SectionHeader kicker="the trough" title="Group drives" ruleWidth={110} />

			{claimable.map((c) => (
				<View key={c.donation_id} style={styles.claimCard}>
					<Text style={styles.claimText}>
						You helped land the {c.item_id} — claim {c.tickle_reward} tickles
					</Text>
					<Pressable
						onPress={() => claim(c)}
						style={({ pressed }) => [styles.claimBtn, pressed && { opacity: 0.7 }]}
					>
						<Text style={styles.claimBtnText}>
							{busy === c.donation_id ? "…" : "Claim"}
						</Text>
					</Pressable>
				</View>
			))}

			{drives.map((d) => {
				const gap = d.target - d.raised;
				const pct = Math.min(1, d.raised / d.target);
				const amt = amountFor(d);
				return (
					<View key={d.id} style={styles.card}>
						<View style={styles.cardTop}>
							{HAT_IMAGES[d.item_id] ? (
								<Image
									source={HAT_IMAGES[d.item_id]}
									style={styles.itemImg}
									resizeMode="contain"
								/>
							) : (
								<View style={styles.itemImg} />
							)}
							<View style={{ flex: 1, minWidth: 0 }}>
								<Text style={styles.cardTitle} numberOfLines={1}>
									{d.is_mine ? "Your Trough" : `${d.opener_name ?? "A friend"}'s Trough`}
								</Text>
								<Text style={styles.cardSub}>{hoursLeft(d.closes_at)}</Text>
							</View>
						</View>

						<View style={styles.track}>
							<View style={[styles.fill, { width: `${Math.round(pct * 100)}%` }]} />
						</View>
						<Text style={styles.raised}>
							{d.raised} / {d.target} snouts
						</Text>

						{!d.is_mine && gap > 0 && (
							<View style={styles.donateRow}>
								<Pressable onPress={() => bump(d.id, -2, gap)} style={styles.step}>
									<Text style={styles.stepText}>−</Text>
								</Pressable>
								<Text style={styles.amount}>{amt}</Text>
								<Pressable onPress={() => bump(d.id, 2, gap)} style={styles.step}>
									<Text style={styles.stepText}>+</Text>
								</Pressable>
								<Pressable
									onPress={() => donate(d)}
									style={({ pressed }) => [
										styles.donateBtn,
										pressed && { opacity: 0.75 },
									]}
								>
									<Text style={styles.donateBtnText}>
										{busy === d.id ? "…" : `Chip in (${amt})`}
									</Text>
								</Pressable>
							</View>
						)}
					</View>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { marginTop: 8 },
	card: {
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 16,
		padding: 12,
		marginBottom: 10,
	},
	cardTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
	itemImg: { width: 44, height: 44 },
	cardTitle: { fontFamily: FONTS.whimsy, fontSize: 16, color: WHIMSY.ink },
	cardSub: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.mute },
	track: {
		height: 14,
		borderRadius: 999,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream2,
		overflow: "hidden",
	},
	fill: { height: "100%", backgroundColor: WHIMSY.sun },
	raised: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: WHIMSY.mute,
		marginTop: 4,
	},
	donateRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
	step: {
		width: 30,
		height: 30,
		borderRadius: 999,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	stepText: { fontFamily: FONTS.whimsy, fontSize: 18, color: WHIMSY.ink },
	amount: { fontFamily: FONTS.whimsy, fontSize: 16, color: WHIMSY.ink, minWidth: 36, textAlign: "center" },
	donateBtn: {
		flex: 1,
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 12,
		paddingVertical: 8,
		alignItems: "center",
	},
	donateBtnText: { fontFamily: FONTS.whimsy, fontSize: 15, color: WHIMSY.ink },
	claimCard: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		backgroundColor: WHIMSY.sage,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 14,
		padding: 10,
		marginBottom: 10,
	},
	claimText: { flex: 1, fontFamily: FONTS.hand, fontSize: 13, color: WHIMSY.ink },
	claimBtn: {
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 6,
	},
	claimBtnText: { fontFamily: FONTS.whimsy, fontSize: 14, color: WHIMSY.ink },
});

import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import { supabase } from "../utils/supabase";
import { Sticker } from "./ui/Sticker";
import { FONTS, WHIMSY } from "@/constants/theme";

type Placement = "pre" | "post";

interface OwnedTitle {
	id: string;
	name: string;
	placement: Placement;
	description: string | null;
}

interface RawRow {
	title_id: string;
	titles: {
		id: string;
		name: string;
		placement: Placement;
		description: string | null;
	};
}

interface Props {
	userId: string;
	activeTitleId: string | null;
	onChange: (next: string | null) => void;
}

export function TitlesSection({ userId, activeTitleId, onChange }: Props) {
	const [titles, setTitles] = useState<OwnedTitle[]>([]);
	const [busy, setBusy] = useState(false);

	const load = useCallback(async () => {
		// user_titles is added by the 20260511 migration. If it hasn't been
		// pushed yet, the query 404s — just leave the section empty.
		const { data, error } = await supabase
			.from("user_titles")
			.select("title_id, titles(id, name, placement, description)")
			.eq("user_id", userId);
		if (error) {
			setTitles([]);
			return;
		}
		const rows = (data ?? []) as unknown as RawRow[];
		setTitles(
			rows
				.map((r) => r.titles)
				.filter((t): t is OwnedTitle => !!t)
				.sort((a, b) => a.name.localeCompare(b.name))
		);
	}, [userId]);

	useEffect(() => {
		load();
	}, [load]);

	const setActive = async (id: string | null) => {
		if (busy) return;
		setBusy(true);
		const previous = activeTitleId;
		onChange(id); // optimistic
		const { data, error } = await supabase.rpc("equip_title", {
			target_title_id: id,
		});
		setBusy(false);
		const ok = (data as { ok?: boolean } | null)?.ok === true;
		if (error || !ok) {
			onChange(previous); // revert on failure
			Alert.alert(
				"Couldn't equip title",
				(data as { reason?: string } | null)?.reason === "not_owned"
					? "You don't own that title yet."
					: "Try again in a moment."
			);
		}
	};

	if (titles.length === 0) {
		return (
			<View style={styles.wrap}>
				<Text style={styles.kicker}>★ titles</Text>
				<Sticker color="paper" rotate={-0.4} radius={14} style={styles.empty}>
					<Text style={styles.emptyText}>
						Earn titles by climbing the snout season pass.
					</Text>
				</Sticker>
			</View>
		);
	}

	return (
		<View style={styles.wrap}>
			<Text style={styles.kicker}>★ titles · {titles.length}</Text>
			<View style={styles.chipsWrap}>
				{titles.map((t) => {
					const active = t.id === activeTitleId;
					return (
						<Pressable
							key={t.id}
							onPress={() => setActive(active ? null : t.id)}
							disabled={busy}
							style={[styles.chip, active && styles.chipActive]}
						>
							<Text style={[styles.chipText, active && styles.chipTextActive]}>
								{t.name}
							</Text>
							<Text
								style={[
									styles.chipPlacement,
									active && styles.chipPlacementActive,
								]}
							>
								{t.placement === "pre" ? "before name" : "after name"}
							</Text>
						</Pressable>
					);
				})}
			</View>
			{activeTitleId && (
				<Pressable onPress={() => setActive(null)} style={styles.unequipLink}>
					<Text style={styles.unequipText}>Unequip title</Text>
				</Pressable>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { marginTop: 16 },
	kicker: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: WHIMSY.mute,
		letterSpacing: 1.6,
		marginBottom: 8,
		textTransform: "uppercase",
	},
	empty: {
		paddingHorizontal: 14,
		paddingVertical: 14,
	},
	emptyText: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		textAlign: "center",
	},
	chipsWrap: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
	},
	chip: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 14,
		backgroundColor: WHIMSY.paper,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		alignItems: "center",
	},
	chipActive: {
		backgroundColor: WHIMSY.lilac,
	},
	chipText: {
		fontFamily: FONTS.whimsy,
		fontSize: 14,
		color: WHIMSY.ink,
		lineHeight: 16,
	},
	chipTextActive: {
		color: WHIMSY.ink,
	},
	chipPlacement: {
		fontFamily: FONTS.hand,
		fontSize: 10,
		color: WHIMSY.mute,
		marginTop: 1,
	},
	chipPlacementActive: {
		color: WHIMSY.ink,
	},
	unequipLink: {
		alignSelf: "center",
		marginTop: 10,
	},
	unequipText: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		textDecorationLine: "underline",
	},
});

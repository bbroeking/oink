import { useCallback, useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { router } from "expo-router";
import { supabase } from "../utils/supabase";
import { rpc } from "@/utils/rpc";
import {
	Button,
	Chip,
	EmptyState,
	SectionHeader,
} from "./ui";
import { showAppToast } from "./PurchaseToast";
import { SPACE } from "@/constants/theme";
import type { TitleRow } from "@/constants/title_types";

interface RawRow {
	title_id: string;
	titles: TitleRow;
}

interface Props {
	userId: string;
	activeTitleId: string | null;
	onChange: (next: string | null) => void;
	// Lets a host (ClosetView's preview title chip) reuse the owned-title
	// rows this section already loads, instead of re-querying user_titles.
	onTitlesLoaded?: (titles: TitleRow[]) => void;
}

const placementLine = (placement: TitleRow["placement"]) =>
	placement === "pre" ? "before name" : "after name";

export function TitlesSection({ userId, activeTitleId, onChange, onTitlesLoaded }: Props) {
	const [titles, setTitles] = useState<TitleRow[]>([]);
	const [busy, setBusy] = useState(false);

	const load = useCallback(async () => {
		// user_titles is added by the 20260511 migration. If it hasn't been
		// pushed yet, the query 404s — just leave the section empty.
		const { data, error } = await supabase
			.from("user_titles")
			.select("title_id, titles(id, name, placement, description)")
			// Nested-join select → PostgREST infers a parser-error row shape;
			// declare our known row type through the builder instead of casting.
			.eq("user_id", userId)
			.returns<RawRow[]>();
		if (error) {
			setTitles([]);
			onTitlesLoaded?.([]);
			return;
		}
		const rows = data ?? [];
		const loaded = rows
			.map((r) => r.titles)
			.filter((t): t is TitleRow => !!t)
			.sort((a, b) => a.name.localeCompare(b.name));
		setTitles(loaded);
		onTitlesLoaded?.(loaded);
	}, [userId, onTitlesLoaded]);

	useEffect(() => {
		load();
	}, [load]);

	const setActive = async (id: string | null) => {
		if (busy) return;
		setBusy(true);
		const previous = activeTitleId;
		onChange(id); // optimistic
		const data = await rpc<{ ok?: boolean; reason?: string }>("equip_title", {
			target_title_id: id,
		});
		setBusy(false);
		const ok = data?.ok === true;
		if (!ok) {
			onChange(previous); // revert on failure
			showAppToast({
				type: "fail",
				title: "Couldn't equip title",
				text:
					data?.reason === "not_owned"
						? "You don't own that title yet."
						: "Try again in a moment.",
			});
		}
	};

	if (titles.length === 0) {
		return (
			<View style={styles.wrap}>
				<SectionHeader title="Titles" />
				<EmptyState
					glyph="star"
					title="No titles yet"
					sub="Climb the snout season pass to earn your first."
					action={
						<Button
							variant="handLink"
							size="sm"
							onPress={() => router.push("/(tabs)/season")}
							accessibilityLabel="Open the snout season pass"
							accessibilityHint="Leaves the Closet for the Season tab"
						>
							See the season pass ›
						</Button>
					}
				/>
			</View>
		);
	}

	return (
		<View style={styles.wrap}>
			<SectionHeader title="Titles" right={`${titles.length} owned`} />
			<View
				style={styles.chipsWrap}
				accessibilityRole="radiogroup"
				accessibilityLabel="Your titles"
			>
				{titles.map((t) => {
					const active = t.id === activeTitleId;
					return (
						<Chip
							key={t.id}
							label={t.name}
							sub={placementLine(t.placement)}
							tone={active ? "lilac" : "paper"}
							selected={active}
							role="radio"
							onPress={() => setActive(active ? null : t.id)}
							accessibilityLabel={`${t.name}, shown ${placementLine(t.placement)}`}
							accessibilityHint={
								active
									? "Takes this title off your name"
									: "Wears this title beside your name"
							}
						/>
					);
				})}
			</View>
			{activeTitleId && (
				<Button
					variant="handLink"
					size="sm"
					onPress={() => setActive(null)}
					style={styles.unequip}
					accessibilityLabel="Unequip title"
					accessibilityHint="Removes the title shown beside your name"
				>
					Unequip title
				</Button>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { marginTop: SPACE.lg },
	chipsWrap: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: SPACE.sm,
	},
	unequip: { alignSelf: "center", marginTop: SPACE.sm },
});

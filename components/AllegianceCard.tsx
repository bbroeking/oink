// Shop re-entry point for the World Cup allegiance pick — for players who
// tapped "Maybe later" on the launch modal. Renders a small prompt card only
// while they haven't chosen a country; opens the same AllegianceModal. Once
// they pick (or if they already had), it renders nothing.
import { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/utils/supabase";
import { FONTS, WHIMSY } from "@/constants/theme";
import { AllegianceModal } from "./AllegianceModal";

export function AllegianceCard() {
	// undefined = still loading, null = not chosen, string = chosen (hide).
	const [chosen, setChosen] = useState<string | null | undefined>(undefined);
	const [open, setOpen] = useState(false);

	const load = useCallback(async () => {
		const { data: ures } = await supabase.auth.getUser();
		if (!ures.user) return;
		const { data } = await supabase
			.from("profiles")
			.select("allegiance_country")
			.eq("id", ures.user.id)
			.maybeSingle();
		setChosen(
			(data as { allegiance_country?: string | null } | null)
				?.allegiance_country ?? null
		);
	}, []);

	useFocusEffect(
		useCallback(() => {
			load();
		}, [load])
	);

	// Loading, or already backing a country → nothing to show.
	if (chosen === undefined || chosen) return null;

	return (
		<>
			<Pressable onPress={() => setOpen(true)} style={styles.card}>
				<Text style={styles.emoji}>🏆</Text>
				<View style={{ flex: 1, minWidth: 0 }}>
					<Text style={styles.title}>Back your country</Text>
					<Text style={styles.sub}>
						Pick a team for the World Cup — flag + a soccer background await.
					</Text>
				</View>
				<Text style={styles.cta}>Pick →</Text>
			</Pressable>

			{open && (
				<AllegianceModal
					visible
					onSkip={() => setOpen(false)}
					onChosen={() => {
						setOpen(false);
						load();
					}}
				/>
			)}
		</>
	);
}

const styles = StyleSheet.create({
	card: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		backgroundColor: WHIMSY.sky,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 16,
		padding: 12,
		marginTop: 12,
	},
	emoji: { fontSize: 30 },
	title: { fontFamily: FONTS.whimsy, fontSize: 17, color: WHIMSY.ink },
	sub: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.ink, opacity: 0.8 },
	cta: { fontFamily: FONTS.whimsy, fontSize: 15, color: WHIMSY.ink },
});

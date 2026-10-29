import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { BORDER, RADII, SPACE, TYPE, UI_COLORS, WHIMSY } from "@/constants/theme";
import { ROSIE_COSTUME_FIT_BY_ID } from "@/features/cards/data/costumeFits";
import { CostumeRosieStage } from "./CostumeRosieStage";

export interface CostumeMaskProofProps { active?: boolean; reduceMotion?: boolean }

const HOLLOW_JACK = ROSIE_COSTUME_FIT_BY_ID.get("halloween_2026_hollow_jack_costume")!;

export default function CostumeMaskProof({ active = true, reduceMotion }: CostumeMaskProofProps) {
  return <View style={styles.root} accessibilityLabel="Hollow Jack fitted to Rosie front idle study">
    <Text style={styles.kicker}>BOUNDED FIT STUDY</Text>
    <Text style={styles.title}>Hollow Jack, fitted to Rosie</Text>
    <Text style={styles.body}>Rosie's source frame stays unchanged. The measured hood follows her crown while the short romper keeps her face, inner ears and hooves visible.</Text>
    <CostumeRosieStage fit={HOLLOW_JACK} active={active} reduceMotion={reduceMotion}/>
    <Text style={styles.body}>Front idle on Rosie only. Other pigs, turned poses and reactions still need authored fitting and occlusion review.</Text>
  </View>;
}

const styles = StyleSheet.create({
  root: { width: "100%", alignItems: "center", padding: SPACE.lg, gap: SPACE.md, backgroundColor: WHIMSY.cream2, borderWidth: BORDER.ink, borderColor: UI_COLORS.border, borderRadius: RADII.lg },
  kicker: { ...TYPE.kickerPill, color: UI_COLORS.action },
  title: { ...TYPE.cardTitle, color: UI_COLORS.textPrimary, textAlign: "center" },
  body: { ...TYPE.bodySm, color: UI_COLORS.textSecondary, textAlign: "center", maxWidth: 620 },
});

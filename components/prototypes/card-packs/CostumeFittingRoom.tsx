import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { ROSIE_COSTUME_FITS, ROSIE_COSTUME_FIT_BY_ID } from "@/features/cards/data/costumeFits";
import { BORDER, RADII, SHADOW_SM, SPACE, TYPE, UI_COLORS, WHIMSY } from "@/constants/theme";
import { CostumeRosieStage } from "./CostumeRosieStage";

export interface CostumeFittingRoomProps {
  ownedCostumeIds: readonly string[];
  equippedCostumeId: string | null;
  onEquip: (costumeId: string | null) => void;
  active?: boolean;
  reduceMotion?: boolean;
  initialPreviewCostumeId?: string | null;
}

export default function CostumeFittingRoom({ ownedCostumeIds, equippedCostumeId, onEquip, active = true, reduceMotion, initialPreviewCostumeId = null }: CostumeFittingRoomProps) {
  const { width } = useWindowDimensions();
  const owned = useMemo(() => new Set(ownedCostumeIds), [ownedCostumeIds]);
  const [previewId, setPreviewId] = useState<string | null>(initialPreviewCostumeId ?? equippedCostumeId);
  const preview = previewId ? ROSIE_COSTUME_FIT_BY_ID.get(previewId) ?? null : null;
  const previewOwned = preview ? owned.has(preview.id) : true;
  const wearingPreview = preview?.id === equippedCostumeId;
  const stageSize = width >= 720 ? 360 : width < 380 ? 280 : 300;
  const narrow = width < 380;
  const stacked = width < 900;

  return <View style={[styles.room, narrow && styles.roomNarrow]}>
    <View style={styles.heading}>
      <Text style={styles.kicker}>ROSIE'S FITTING ROOM</Text>
      <Text style={styles.title}>Choose a costume to preview.</Text>
      <Text style={styles.body}>A preview lets you inspect every front-idle frame. Rosie can wear a costume only after its card grants the matching local item.</Text>
    </View>
    <View style={[styles.layout, stacked && styles.layoutStacked]}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Choose a costume preview" style={[styles.rail, stacked && styles.fullWidth]}>
        <Pressable accessibilityRole="radio" accessibilityState={{ selected: previewId === null }} accessibilityLabel="No costume" onPress={() => setPreviewId(null)} style={[styles.option, previewId === null && styles.selectedOption]}>
          <View style={[styles.radio, previewId === null && styles.radioSelected]}/><View style={styles.optionCopy}><Text style={styles.optionName}>No costume</Text><Text style={styles.optionStatus}>{equippedCostumeId === null ? "Wearing" : "Rosie underneath it all"}</Text></View>
        </Pressable>
        {ROSIE_COSTUME_FITS.map((fit) => {
          const isOwned = owned.has(fit.id);
          const selected = previewId === fit.id;
          const wearing = equippedCostumeId === fit.id;
          return <Pressable key={fit.id} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={`${fit.name}, ${isOwned ? wearing ? "owned, wearing" : "owned" : "locked, preview"}`} onPress={() => setPreviewId(fit.id)} style={[styles.option, selected && styles.selectedOption]}>
            <View style={[styles.radio, selected && styles.radioSelected]}/><View style={styles.optionCopy}><Text style={styles.optionName}>{fit.name}</Text><Text style={[styles.optionStatus, !isOwned && styles.locked]}>{isOwned ? wearing ? "Owned · Wearing" : "Owned" : "Locked · Preview"}</Text></View>
          </Pressable>;
        })}
      </View>
      <View style={[styles.preview, stacked && styles.previewStacked]}>
        <CostumeRosieStage fit={preview} active={active} reduceMotion={reduceMotion} displaySize={stageSize}/>
        <Text style={styles.previewTitle}>{preview?.name ?? "No costume"}</Text>
        <Text style={styles.body}>{preview ? previewOwned ? wearingPreview ? "Rosie is wearing this costume." : "This costume is owned and ready to wear." : "Preview only. Find its Spooky Snouts card before Rosie can wear it." : "Rosie's source sprite stays unchanged beneath the costumes. Taking one off restores her original appearance."}</Text>
        {preview ? <Pressable accessibilityRole="button" accessibilityLabel={`Try on ${preview.name}`} accessibilityState={{ disabled: !previewOwned || wearingPreview }} disabled={!previewOwned || wearingPreview} onPress={() => onEquip(preview.id)} style={[styles.action, (!previewOwned || wearingPreview) && styles.disabled]}><Text style={styles.actionText}>{wearingPreview ? "Wearing" : previewOwned ? "Try on" : "Locked"}</Text></Pressable>
          : <Pressable accessibilityRole="button" accessibilityLabel="Take off costume" accessibilityState={{ disabled: equippedCostumeId === null }} disabled={equippedCostumeId === null} onPress={() => onEquip(null)} style={[styles.action, equippedCostumeId === null && styles.disabled]}><Text style={styles.actionText}>{equippedCostumeId === null ? "No costume equipped" : "Take off"}</Text></Pressable>}
        {equippedCostumeId && previewId !== null && <Pressable accessibilityRole="button" accessibilityLabel="Take off costume" onPress={() => { onEquip(null); setPreviewId(null); }} style={[styles.action, styles.secondary]}><Text style={styles.actionText}>Take off</Text></Pressable>}
      </View>
    </View>
    <Text style={styles.scope}>Front idle on Rosie only. Other pigs, turned poses and reactions still need authored fitting and occlusion review.</Text>
  </View>;
}

const styles = StyleSheet.create({
  room: { gap: SPACE.lg, padding: SPACE.lg, backgroundColor: WHIMSY.paper, borderWidth: BORDER.ink, borderColor: UI_COLORS.border, borderRadius: RADII.lg, ...SHADOW_SM },
  roomNarrow: { padding: SPACE.sm },
  heading: { gap: SPACE.sm },
  kicker: { ...TYPE.kickerPill, color: UI_COLORS.action, alignSelf: "flex-start" },
  title: { ...TYPE.sectionTitle, color: UI_COLORS.textPrimary },
  body: { ...TYPE.bodySm, color: UI_COLORS.textSecondary, maxWidth: 620 },
  layout: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.xl, alignItems: "flex-start", justifyContent: "center" },
  layoutStacked: { flexDirection: "column", alignItems: "center" },
  rail: { width: "100%", maxWidth: 280, gap: SPACE.sm },
  option: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: SPACE.sm, paddingVertical: SPACE.sm, paddingHorizontal: SPACE.md, backgroundColor: WHIMSY.cream2, borderWidth: 2, borderColor: "transparent", borderRadius: RADII.md },
  selectedOption: { borderColor: UI_COLORS.border, backgroundColor: WHIMSY.lilac },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: UI_COLORS.border, backgroundColor: UI_COLORS.surface },
  radioSelected: { borderWidth: 6, backgroundColor: WHIMSY.sun },
  optionCopy: { flex: 1, gap: 2 },
  optionName: { ...TYPE.label, color: UI_COLORS.textPrimary },
  optionStatus: { ...TYPE.bodySm, color: UI_COLORS.textSecondary },
  locked: { color: UI_COLORS.action },
  preview: { flexGrow: 1, flexShrink: 1, flexBasis: 360, minWidth: 0, width: "100%", maxWidth: 520, alignItems: "center", gap: SPACE.md },
  previewStacked: { flexGrow: 0, flexShrink: 0, flexBasis: "auto" },
  fullWidth: { maxWidth: "100%" },
  previewTitle: { ...TYPE.cardTitle, color: UI_COLORS.textPrimary, textAlign: "center" },
  action: { minWidth: 180, minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: SPACE.lg, backgroundColor: WHIMSY.sun, borderWidth: BORDER.ink, borderColor: UI_COLORS.border, borderRadius: RADII.xxl, ...SHADOW_SM },
  secondary: { backgroundColor: WHIMSY.cream2 },
  disabled: { opacity: 0.48 },
  actionText: { ...TYPE.label, color: UI_COLORS.textPrimary },
  scope: { ...TYPE.bodySm, color: UI_COLORS.textSecondary, textAlign: "center" },
});

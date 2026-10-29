import React, { useMemo, useState } from "react";
import {
  Pressable,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from "react-native";

import { FONTS, WHIMSY as C } from "../../../constants/theme";
import { CARD_CATALOG } from "../../../features/cards/data/catalog";
import { cardArtSources as generatedCardArtSources } from "../../../features/cards/data/cardArt";
import type { CardCatalogEntry } from "../../../features/cards/domain/catalog";
import {
  addConstructedCard,
  changeConstructedLegend,
  CONSTRUCTED_DECK_SIZE,
  fillLegalDeck,
  PIG_LEGENDS,
  removeConstructedCard,
  validateConstructedDeck,
  type ConstructedDeckState,
} from "../../../features/cards/domain/constructedDeck";
import { CollectibleCard } from "./CollectibleCard";

const catalog: readonly CardCatalogEntry[] = CARD_CATALOG;
const cardById = new Map(catalog.map((card) => [card.id, card]));
const cardArtSources: Readonly<Record<string, ImageSourcePropType>> = generatedCardArtSources;

export interface DeckBuilderProps {
  deck: ConstructedDeckState;
  copies: Readonly<Record<string, number>>;
  onChange: (deck: ConstructedDeckState) => void;
  onSave: () => void;
  onInspect: (cardId: string) => void;
}

function ActionButton({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        disabled && styles.disabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function issueText(code: string, actual?: number, expected?: number): string {
  if (code === "deck_size") return `${actual ?? 0} of ${expected ?? CONSTRUCTED_DECK_SIZE} cards planned`;
  if (code === "style_mismatch") return "Some cards do not match this Legend's favored styles";
  if (code === "legendary_copy_limit") return "A Legendary card has more than one copy";
  if (code === "copy_limit") return "A card exceeds its copy limit";
  if (code === "legend_in_deck") return "A Legend is inside the deck";
  return "The plan contains an unknown card or Legend";
}

export function DeckBuilder({ deck, copies, onChange, onSave, onInspect }: DeckBuilderProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 760;
  const [query, setQuery] = useState("");
  const selectedLegend = PIG_LEGENDS.find((legend) => legend.id === deck.legendId) ?? PIG_LEGENDS[0];
  const selectedLegendCard = cardById.get(selectedLegend.id)!;
  const validation = validateConstructedDeck(deck);

  const plannedCards = useMemo(
    () => Object.entries(deck.copies)
      .map(([cardId, count]) => ({ card: cardById.get(cardId), count }))
      .filter((entry): entry is { card: CardCatalogEntry; count: number } => Boolean(entry.card))
      .sort((a, b) => a.card.number.localeCompare(b.card.number)),
    [deck.copies],
  );

  const choices = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return catalog.filter((card) =>
      card.type !== "legend" &&
      typeof card.style === "string" &&
      selectedLegend.favoredStyles.includes(card.style) &&
      (!normalizedQuery || `${card.name} ${card.type} ${card.style}`.toLocaleLowerCase().includes(normalizedQuery)),
    );
  }, [query, selectedLegend]);

  const issueLabels = [...new Set(validation.issues.map((issue) => issueText(issue.code, issue.actual, issue.expected)))];

  return (
    <View style={styles.root}>
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>CONSTRUCTED DECK PLAN</Text>
        <Text style={styles.title}>Build around a Pig Legend.</Text>
        <Text style={styles.body}>
          Choose one guaranteed Legend outside your deck, then plan 24 cards in either favored style.
          This plan is separate from Hedge Run and does not grant or spend cards.
        </Text>
      </View>

      <View accessibilityRole="radiogroup" accessibilityLabel="Choose a Pig Legend" style={styles.legendGrid}>
        {PIG_LEGENDS.map((legend, index) => {
          const selected = legend.id === selectedLegend.id;
          const tint = [C.rose, C.sage, C.lilac, C.sun, C.sky, C.peach][index];
          return (
            <Pressable
              key={legend.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              aria-checked={selected}
              accessibilityLabel={`${legend.name}, ${legend.favoredStyles.join(" and ")}`}
              onPress={() => onChange(changeConstructedLegend(deck, legend.id))}
              style={({ pressed }) => [
                styles.legendChoice,
                { backgroundColor: tint },
                selected && styles.legendChoiceSelected,
                pressed && styles.choicePressed,
              ]}
            >
              <Image
                source={cardArtSources[legend.id]}
                resizeMode="cover"
                style={styles.legendPortrait}
                accessibilityIgnoresInvertColors
              />
              <View style={styles.legendChoiceCopy}>
                <Text numberOfLines={1} style={styles.legendName}>{legend.name.split(",")[0]}</Text>
                <Text style={styles.legendStyles}>{legend.favoredStyles.join(" + ")}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.builder, isWide && styles.builderWide]}>
        <View style={[styles.legendPanel, isWide && styles.legendPanelWide]}>
          <CollectibleCard
            card={selectedLegendCard}
            artSource={cardArtSources[selectedLegend.id]}
            variant="detail"
          />
          <View style={styles.legendCopy}>
            <Text style={styles.sectionKicker}>YOUR LEGEND · OUTSIDE THE DECK</Text>
            <Text style={styles.sectionTitle}>{selectedLegend.name}</Text>
            <View style={styles.styleRow}>
              {selectedLegend.favoredStyles.map((style) => (
                <View key={style} style={styles.stylePill}><Text style={styles.stylePillText}>{style}</Text></View>
              ))}
            </View>
            <Text style={styles.abilityName}>{selectedLegend.abilityName}</Text>
            <Text style={styles.body}>{selectedLegend.text}</Text>
          </View>
        </View>

        <View style={[styles.planPanel, isWide && styles.planPanelWide]}>
          <View style={styles.planHeader}>
            <View>
              <Text style={styles.sectionKicker}>YOUR 24-CARD PLAN</Text>
              <Text style={styles.sectionTitle}>{validation.totalCards} / {CONSTRUCTED_DECK_SIZE}</Text>
            </View>
            <View style={[styles.status, validation.valid ? styles.statusReady : styles.statusDraft]}>
              <Text style={styles.statusText}>{validation.valid ? "READY" : "DRAFT"}</Text>
            </View>
          </View>

          {issueLabels.length > 0 && (
            <View accessibilityLiveRegion="polite" style={styles.validationBox}>
              {issueLabels.map((label) => <Text key={label} style={styles.validationText}>• {label}</Text>)}
            </View>
          )}

          <View style={styles.actionRow}>
            <ActionButton label="Fill legal example" secondary onPress={() => onChange(fillLegalDeck(selectedLegend.id))} />
            <ActionButton label="Save local plan" onPress={onSave} />
          </View>

          {plannedCards.length === 0 ? (
            <View style={styles.emptyPlan}>
              <Text style={styles.emptyTitle}>An empty field notebook.</Text>
              <Text style={styles.body}>Add cards below or fill a legal example to start with a complete plan.</Text>
            </View>
          ) : (
            <View style={styles.planList}>
              {plannedCards.map(({ card, count }) => {
                const missing = Math.max(0, count - (copies[card.id] ?? 0));
                return (
                  <View key={card.id} style={styles.planRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Inspect ${card.name}`}
                      onPress={() => onInspect(card.id)}
                      style={styles.planIdentity}
                    >
                      <Text style={styles.cardName}>{card.name}</Text>
                      <Text style={styles.meta}>{card.type} · {card.style} · {card.rarity}</Text>
                      {missing > 0 && <Text style={styles.missing}>Missing {missing} {missing === 1 ? "copy" : "copies"}</Text>}
                    </Pressable>
                    <View style={styles.countControls}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove one ${card.name}`}
                        onPress={() => onChange(removeConstructedCard(deck, card.id))}
                        style={styles.countButton}
                      ><Text style={styles.countButtonText}>−</Text></Pressable>
                      <Text accessibilityLabel={`${count} copies`} style={styles.count}>{count}</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Add one ${card.name}`}
                        onPress={() => onChange(addConstructedCard(deck, card.id))}
                        style={styles.countButton}
                      ><Text style={styles.countButtonText}>+</Text></Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </View>

      <View style={styles.library}>
        <Text style={styles.sectionKicker}>MATCHING CARDS</Text>
        <Text style={styles.sectionTitle}>Browse {selectedLegend.favoredStyles.join(" + ")}</Text>
        <TextInput
          accessibilityLabel="Search matching cards"
          placeholder="Search by name, type, or style"
          placeholderTextColor={C.muteDim}
          value={query}
          onChangeText={setQuery}
          style={styles.search}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRail}>
          {choices.map((card) => {
            const planned = deck.copies[card.id] ?? 0;
            const limit = card.rarity === "legendary" ? 1 : 2;
            const disabled = validation.totalCards >= CONSTRUCTED_DECK_SIZE || planned >= limit;
            return (
              <View key={card.id} style={styles.libraryCard}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Inspect ${card.name}`} onPress={() => onInspect(card.id)}>
                  <CollectibleCard card={card} artSource={cardArtSources[card.id]} variant="compact" />
                </Pressable>
                <Text style={styles.libraryCount}>{planned} planned · {copies[card.id] ?? 0} owned</Text>
                <ActionButton
                  label={disabled ? `${card.name} limit reached` : `Add ${card.name}`}
                  disabled={disabled}
                  onPress={() => onChange(addConstructedCard(deck, card.id))}
                />
              </View>
            );
          })}
        </ScrollView>
        {choices.length === 0 && <Text style={styles.body}>No matching cards found.</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: "100%", gap: 24, paddingVertical: 8 },
  intro: { gap: 8, maxWidth: 720 },
  eyebrow: { fontFamily: FONTS.bodyExtra, fontSize: 12, lineHeight: 18, letterSpacing: 1.4, color: C.accent },
  title: { fontFamily: FONTS.whimsy, fontSize: 34, lineHeight: 40, color: C.ink },
  body: { fontFamily: FONTS.body, fontSize: 15, lineHeight: 22, color: C.mute },
  legendGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  legendChoice: { minWidth: 138, flexGrow: 1, flexBasis: 138, maxWidth: 190, minHeight: 64, flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: C.ink, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 7, gap: 8 },
  legendChoiceSelected: { borderWidth: 4, paddingHorizontal: 7, paddingVertical: 6 },
  choicePressed: { transform: [{ translateY: 1 }] },
  legendPortrait: { width: 46, height: 46, borderWidth: 1, borderColor: C.ink, borderRadius: 23, backgroundColor: C.paper },
  legendChoiceCopy: { flex: 1, minWidth: 0, gap: 1 },
  legendName: { fontFamily: FONTS.bodyExtra, fontSize: 15, lineHeight: 20, color: C.ink },
  legendStyles: { fontFamily: FONTS.body, fontSize: 12, lineHeight: 17, color: C.mute, textTransform: "capitalize" },
  builder: { gap: 18 },
  builderWide: { flexDirection: "row", alignItems: "flex-start" },
  legendPanel: { gap: 16, padding: 14, borderWidth: 2, borderColor: C.ink, borderRadius: 16, backgroundColor: C.cream },
  legendPanelWide: { width: "40%" },
  legendCopy: { gap: 8 },
  planPanel: { flex: 1, gap: 14, padding: 14, borderWidth: 2, borderColor: C.ink, borderRadius: 16, backgroundColor: C.paper },
  planPanelWide: { minWidth: 0 },
  sectionKicker: { fontFamily: FONTS.bodyExtra, fontSize: 12, lineHeight: 18, letterSpacing: 1, color: C.accent },
  sectionTitle: { fontFamily: FONTS.whimsy, fontSize: 24, lineHeight: 30, color: C.ink },
  styleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stylePill: { paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.ink, borderRadius: 999, backgroundColor: C.lilac },
  stylePillText: { fontFamily: FONTS.bodyExtra, fontSize: 13, lineHeight: 18, color: C.ink, textTransform: "capitalize" },
  abilityName: { fontFamily: FONTS.bodyExtra, fontSize: 17, lineHeight: 23, color: C.ink },
  planHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  status: { borderWidth: 1.5, borderColor: C.ink, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 5 },
  statusReady: { backgroundColor: C.sage },
  statusDraft: { backgroundColor: C.rose },
  statusText: { fontFamily: FONTS.bodyExtra, fontSize: 12, lineHeight: 17, color: C.ink },
  validationBox: { gap: 4, padding: 12, backgroundColor: C.lilac, borderRadius: 10 },
  validationText: { fontFamily: FONTS.body, fontSize: 14, lineHeight: 20, color: C.ink },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  button: { minHeight: 46, justifyContent: "center", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderWidth: 2, borderColor: C.ink, borderRadius: 23, backgroundColor: C.sun, boxShadow: `3px 3px 0 ${C.ink}` },
  buttonSecondary: { backgroundColor: C.paper },
  buttonPressed: { transform: [{ translateY: 2 }], boxShadow: `1px 1px 0 ${C.ink}` },
  buttonText: { fontFamily: FONTS.bodyExtra, fontSize: 14, lineHeight: 20, color: C.ink, textAlign: "center" },
  disabled: { opacity: 0.55 },
  emptyPlan: { gap: 6, padding: 18, backgroundColor: C.cream2, borderWidth: 1.5, borderColor: C.muteSoft, borderStyle: "dashed", borderRadius: 12 },
  emptyTitle: { fontFamily: FONTS.whimsy, fontSize: 20, lineHeight: 26, color: C.ink },
  planList: { gap: 8 },
  planRow: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderWidth: 1, borderColor: C.ink, borderRadius: 10, backgroundColor: C.cream },
  planIdentity: { flex: 1, minWidth: 0, gap: 2 },
  cardName: { fontFamily: FONTS.bodyExtra, fontSize: 15, lineHeight: 20, color: C.ink },
  meta: { fontFamily: FONTS.body, fontSize: 13, lineHeight: 18, color: C.mute, textTransform: "capitalize" },
  missing: { fontFamily: FONTS.bodyExtra, fontSize: 13, lineHeight: 18, color: C.accent },
  countControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  countButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: C.ink, borderRadius: 22, backgroundColor: C.paper },
  countButtonText: { fontFamily: FONTS.bodyExtra, fontSize: 22, lineHeight: 26, color: C.ink },
  count: { minWidth: 18, fontFamily: FONTS.bodyExtra, fontSize: 16, lineHeight: 22, color: C.ink, textAlign: "center" },
  library: { gap: 12, padding: 14, borderWidth: 2, borderColor: C.ink, borderRadius: 16, backgroundColor: C.sage },
  search: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 2, borderColor: C.ink, borderRadius: 10, backgroundColor: C.paper, fontFamily: FONTS.body, fontSize: 16, color: C.ink },
  choiceRail: { gap: 14, paddingHorizontal: 3, paddingVertical: 4 },
  libraryCard: { width: 180, gap: 9, paddingBottom: 4 },
  libraryCount: { fontFamily: FONTS.body, fontSize: 13, lineHeight: 18, color: C.ink },
});

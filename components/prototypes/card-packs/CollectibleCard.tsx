import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import { FONTS, WHIMSY as C } from '../../../constants/theme';
import type { CardCatalogEntry, CardFinish } from '../../../features/cards/domain/catalog';

export type CollectibleCardVariant = 'ceremony' | 'compact' | 'detail';

export type CollectibleCardProps = {
  card: CardCatalogEntry;
  artSource?: ImageSourcePropType;
  finish?: CardFinish;
  variant?: CollectibleCardVariant;
  artwork?: React.ReactNode;
  isNew?: boolean;
  copyNumber?: number;
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
};

const STYLE_COLORS: Readonly<Record<string, string>> = { brave: '#d85f52', steady: '#668a55', spark: '#7766ba' };
const STYLE_TINTS: Readonly<Record<string, string>> = { brave: '#f6c8bd', steady: '#cfe3bf', spark: '#d9d0f3' };
const TYPE_LABELS = { legend: 'LEGEND', gear: 'GEAR', critter: 'CRITTER', enemy: 'ENEMY', stunt: 'STUNT', place: 'PLACE' } as const;
const RARITY_MARKS = { common: 'C', uncommon: 'U ✦', rare: 'R ✦✦', epic: 'E ✦✦✦', legendary: 'L ✦✦✦✦' } as const;
const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

export function CollectibleCard({ card, artSource, finish = 'standard', variant = 'ceremony', artwork, isNew, copyNumber, animate = false, style }: CollectibleCardProps) {
  const compact = variant === 'compact';
  const detail = variant === 'detail';
  const seasonalUnlock = card.collectionKind === 'cosmetic-unlock' && card.unlock;
  const seasonalTypeLabel = seasonalUnlock ? seasonalUnlock.category === 'background' ? 'PLACE' : seasonalUnlock.category === 'costume' ? 'COSTUME' : 'ITEM' : undefined;
  const [gleam] = useState(() => new Animated.Value(-1));
  const perimeter = seasonalUnlock ? C.lilacDeep : card.style ? STYLE_COLORS[card.style] : C.roseDeep;
  const bandTint = card.style ? STYLE_TINTS[card.style] : C.rose;
  const styleLabel = card.style?.toUpperCase();
  const stats = card.type === 'legend' ? [] : [
      ...(card.bash == null ? [] : [{ label: 'BASH', value: card.bash }]),
      ...(card.guard == null ? [] : [{ label: 'GUARD', value: card.guard }]),
      ...(card.hearts == null ? [] : [{ label: 'HEARTS', value: card.hearts }]),
    ];
  const actionName = seasonalUnlock ? undefined : card.type === 'legend' ? card.abilityName : 'Play';
  const footerRule = seasonalUnlock ? 'FIRST COPY UNLOCK'
    : card.type === 'legend' ? 'OUTSIDE DECK'
    : card.type === 'gear' ? `${card.slot?.toUpperCase()} SLOT`
    : card.type === 'enemy' ? 'TROUBLE ROW'
    : card.type === 'place' ? 'ONE PLACE IN PLAY'
    : card.type === 'stunt' ? 'RESOLVE · DISCARD'
    : 'ATTACK · PROTECT';

  useEffect(() => {
    gleam.stopAnimation();
    gleam.setValue(-1);
    if (!animate || variant !== 'ceremony' || finish !== 'foil') return;
    const sweep = Animated.sequence([
      Animated.delay(350),
      Animated.timing(gleam, {
        toValue: 1,
        duration: 650,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    sweep.start();
    return () => sweep.stop();
  }, [animate, card.id, finish, gleam, variant]);

  const gleamX = gleam.interpolate({ inputRange: [-1, 1], outputRange: [-330, 330] });

  return <View accessibilityLabel={`${card.name}, ${seasonalTypeLabel ?? TYPE_LABELS[card.type]}, ${card.rarity}`}
    style={[styles.card, styles[variant], { borderColor: perimeter }, finish === 'foil' && styles.foil, finish === 'living' && styles.living, style]}>
    <View style={[styles.perimeter, { backgroundColor: perimeter }]} />
    <View style={styles.titlePlate}>
      <View style={styles.identity}>
        <Text style={[styles.name, compact && styles.compactName]}>{card.name}</Text>
        <Text style={[styles.meta, compact && styles.compactMeta]}>{seasonalTypeLabel ?? TYPE_LABELS[card.type]}{!seasonalUnlock && card.slot ? ` · ${card.slot.toUpperCase()}` : ''}{styleLabel ? ` · ${styleLabel}` : ''} · {card.rarity.toUpperCase()}</Text>
      </View>
      {!seasonalUnlock && <View style={[styles.rankSocket, card.type === 'legend' && styles.cheerSocket]}>
        <Text style={styles.socketLabel}>{card.type === 'legend' ? 'CHEER' : 'RANK'}</Text>
        <Text style={[styles.socketNumber, compact && styles.compactSocket]}>{card.type === 'legend' ? card.startingCheer : card.rank}</Text>
      </View>}
    </View>

    <View style={[styles.artWindow, compact && styles.compactArt, detail && styles.detailArt]}>
      {artwork ?? (artSource ? <Image source={artSource} resizeMode={card.unlock ? card.unlock.category === 'background' ? 'cover' : 'contain' : card.art?.includes('/hats/') ? 'contain' : 'cover'} style={styles.art} accessibilityLabel={`${card.name} illustration`} /> : null)}
      {!!stats.length && <View style={styles.stats}>{stats.map(stat => <View key={stat.label} style={styles.stat}>
        <Text style={[styles.statNumber, compact && styles.compactStat]}>{stat.value}</Text>
        <Text style={styles.statLabel}>{stat.label}</Text>
      </View>)}</View>}
      {finish !== 'standard' && <View pointerEvents="none" style={[styles.finishWash, finish === 'living' ? styles.livingWash : styles.foilWash]} />}
      {animate && variant === 'ceremony' && finish === 'foil' && <AnimatedGradient pointerEvents="none"
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.72)', 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={[styles.gleam, { transform: [{ translateX: gleamX }, { rotate: '16deg' }] }]} />}
    </View>

    {!compact && <View style={[styles.rules, detail && styles.detailRules]}>
      <Text style={styles.rulesLabel}>{seasonalUnlock ? `${seasonalTypeLabel} · FIRST COPY UNLOCK` : card.type === 'legend' ? 'LEGEND ABILITY' : 'PLAY'}{actionName && actionName !== 'Play' ? ` · ${actionName}` : ''}</Text>
      <Text style={[styles.rulesText, detail && styles.detailText]}>{card.text}</Text>
      {detail && <Text style={styles.flavor}>{card.flavor}</Text>}
    </View>}

    {!compact && (seasonalUnlock ? <View style={styles.collectionBand}>
      <Text style={styles.collectionBandLabel}>COLLECTION CARD</Text>
      <Text style={styles.collectionBandText}>COSMETIC · NOT IN DECKS OR HEDGE RUN</Text>
    </View> : card.type === 'legend' ? <View style={[styles.training, { backgroundColor: bandTint }]}> 
      <Text style={styles.trainingLabel}>FAVORED STYLES</Text>
      <Text style={styles.trainingText}>{card.favoredStyles?.map(value => value.toUpperCase()).join('  +  ')}</Text>
    </View> : card.training && <View style={[styles.training, { backgroundColor: bandTint }]}>
      <Text style={styles.trainingLabel}>{styleLabel ? `${styleLabel} · ` : ''}TRAINING {card.training.kind.toUpperCase()} · {card.training.name}</Text>
      <Text style={[styles.trainingText, detail && styles.detailText]}>{card.training.text}</Text>
    </View>)}

    {compact && <View style={styles.compactMechanical}>
      <Text style={styles.compactMechanicalText}>{seasonalUnlock ? seasonalTypeLabel : card.style?.toUpperCase() ?? card.favoredStyles?.join(' + ').toUpperCase()}</Text>
      <Text style={styles.compactMechanicalText}>{seasonalUnlock ? 'FIRST COPY UNLOCK' : stats.map(stat => `${stat.value} ${stat.label}`).join(' · ') || (card.training ? 'PLAY / TRAIN' : 'LEGEND')}</Text>
    </View>}

    <View style={styles.footer}>
      <Text style={[styles.collector, compact && styles.compactCollector]}>{card.setCode ?? 'RLB'} · {card.number}/{card.setSize ?? 88}</Text>
      <Text style={[styles.collector, compact && styles.compactCollector]}>{RARITY_MARKS[card.rarity]}{finish === 'standard' ? '' : ` · ${finish.toUpperCase()}`}</Text>
      {!compact && <Text style={styles.collector}>{footerRule}</Text>}
    </View>
    {(isNew || copyNumber) && <View style={styles.copyFlag}><Text style={styles.copyFlagText}>{isNew ? 'NEW' : `COPY ${copyNumber}`}</Text></View>}
  </View>;
}

const styles = StyleSheet.create({
  card: { position: 'relative', overflow: 'hidden', backgroundColor: '#fff5df', borderWidth: 4, borderRadius: 18, padding: 8, gap: 5, boxShadow: `5px 7px 0 ${C.ink}` },
  ceremony: { width: 300, height: 420 },
  compact: { width: '100%', maxWidth: 156, height: 218, borderWidth: 3, borderRadius: 11, padding: 5, gap: 3, boxShadow: `2px 3px 0 ${C.ink}` },
  detail: { width: '100%', maxWidth: 380, minHeight: 540, padding: 12, gap: 8 },
  perimeter: { position: 'absolute', inset: 0, opacity: 0.12 },
  foil: { backgroundColor: '#fff1b8' },
  living: { backgroundColor: '#eee7ff' },
  titlePlate: { zIndex: 1, minHeight: 47, flexDirection: 'row', alignItems: 'center', gap: 7, paddingLeft: 7, backgroundColor: '#fff8e8', borderWidth: 1.5, borderColor: C.ink, borderRadius: 9 },
  identity: { flex: 1, minWidth: 0 },
  name: { fontFamily: FONTS.display, color: C.ink, fontSize: 18, lineHeight: 20 },
  compactName: { fontSize: 11, lineHeight: 12 },
  meta: { fontFamily: FONTS.bodyExtra, color: C.mute, fontSize: 9, lineHeight: 12, letterSpacing: 0.45 },
  compactMeta: { fontSize: 6.5, lineHeight: 8 },
  rankSocket: { width: 46, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', backgroundColor: C.sun, borderLeftWidth: 1.5, borderColor: C.ink, borderTopRightRadius: 7, borderBottomRightRadius: 7 },
  cheerSocket: { backgroundColor: C.rose },
  socketLabel: { fontFamily: FONTS.bodyExtra, color: C.ink, fontSize: 7, letterSpacing: 0.5 },
  socketNumber: { fontFamily: FONTS.whimsy, color: C.ink, fontSize: 22, lineHeight: 24 },
  compactSocket: { fontSize: 15, lineHeight: 16 },
  artWindow: { zIndex: 1, height: 190, overflow: 'hidden', backgroundColor: C.cream2, borderWidth: 1.5, borderColor: C.ink, borderRadius: 7 },
  compactArt: { height: 121 },
  detailArt: { height: 250 },
  art: { width: '100%', height: '100%' },
  stats: { position: 'absolute', left: 5, right: 5, bottom: 5, flexDirection: 'row', justifyContent: 'space-between', gap: 5 },
  stat: { minWidth: 43, minHeight: 37, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff8e8', borderWidth: 2, borderColor: C.ink, borderRadius: 20 },
  statNumber: { fontFamily: FONTS.whimsy, color: C.ink, fontSize: 18, lineHeight: 18 },
  compactStat: { fontSize: 12, lineHeight: 12 },
  statLabel: { fontFamily: FONTS.bodyExtra, color: C.mute, fontSize: 6.5, letterSpacing: 0.5 },
  finishWash: { position: 'absolute', inset: 0 },
  foilWash: { backgroundColor: 'rgba(255,216,122,0.10)' },
  livingWash: { backgroundColor: 'rgba(214,200,240,0.10)' },
  gleam: { position: 'absolute', top: -55, bottom: -55, left: '25%', width: '50%' },
  rules: { zIndex: 1, flexShrink: 1, minHeight: 61, paddingHorizontal: 7, paddingVertical: 5, backgroundColor: '#fffaf0', borderWidth: 1, borderColor: C.tapeEdge, borderRadius: 6 },
  detailRules: { minHeight: 90, padding: 9 },
  rulesLabel: { fontFamily: FONTS.display, color: C.ink, fontSize: 10, lineHeight: 12 },
  rulesText: { fontFamily: FONTS.body, color: C.ink, fontSize: 13, lineHeight: 16 },
  detailText: { fontSize: 14, lineHeight: 19 },
  flavor: { fontFamily: FONTS.hand, color: C.mute, fontSize: 9, lineHeight: 11, marginTop: 2 },
  training: { zIndex: 1, minHeight: 46, paddingHorizontal: 7, paddingVertical: 4, borderWidth: 1.5, borderColor: C.ink, borderRadius: 6 },
  trainingLabel: { fontFamily: FONTS.display, color: C.ink, fontSize: 9, lineHeight: 11 },
  trainingText: { fontFamily: FONTS.bodyExtra, color: C.ink, fontSize: 12, lineHeight: 15 },
  collectionBand: { zIndex: 1, minHeight: 46, marginTop: 'auto', paddingHorizontal: 8, paddingVertical: 5, justifyContent: 'center', backgroundColor: C.ink, borderWidth: 1.5, borderColor: C.lilacDeep, borderRadius: 6 },
  collectionBandLabel: { fontFamily: FONTS.display, color: C.lilac, fontSize: 9, lineHeight: 11 },
  collectionBandText: { fontFamily: FONTS.bodyExtra, color: C.paper, fontSize: 11, lineHeight: 15 },
  compactMechanical: { zIndex: 1, flex: 1, justifyContent: 'center', paddingHorizontal: 3 },
  compactMechanicalText: { fontFamily: FONTS.bodyExtra, color: C.ink, fontSize: 7, lineHeight: 9 },
  footer: { zIndex: 1, minHeight: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 4 },
  collector: { fontFamily: FONTS.bodyExtra, color: C.mute, fontSize: 7.5, lineHeight: 10 },
  compactCollector: { fontSize: 6, lineHeight: 7 },
  copyFlag: { position: 'absolute', zIndex: 4, top: 58, right: 13, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: C.sage, borderWidth: 1, borderColor: C.ink, borderRadius: 5 },
  copyFlagText: { fontFamily: FONTS.bodyExtra, color: C.ink, fontSize: 8, letterSpacing: 0.5 },
});

import React, { memo, useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, StyleSheet, Switch, TextInput, View, useWindowDimensions } from 'react-native';
import { Button, T } from '@/components/ui';
import { BORDER, RADII, SHADOW_SM, SPACE, TYPE, UI_COLORS, WHIMSY as C } from '@/constants/theme';
import { useMotionPolicy } from '@/hooks/useMotionPolicy';
import { ROSIE_COSTUME_FITS, ROSIE_COSTUME_FIT_BY_ID } from '@/features/cards/data/costumeFits';
import { SPOOKY_SNOUTS_CATALOG } from '@/features/cards/data/seasonalCatalog';
import { SPOOKY_SNOUTS_ART_SOURCES } from '@/features/cards/data/seasonalCardArt';
import { HALLOWEEN_LOGIN_GIFT_POOL } from '@/features/cards/domain/halloweenLoginGift';
import type { CardCatalogEntry } from '@/features/cards/domain/catalog';
import { CollectibleCard } from './CollectibleCard';
import { CostumeRosieStage } from './CostumeRosieStage';
import { useCostumeGalleryPlayback } from './useCostumeGalleryPlayback';

type Category = 'all' | 'costume' | 'wearable' | 'background';
const NEW_IDS = new Set<string>(HALLOWEEN_LOGIN_GIFT_POOL.map(item => item.costumeId));
const categoryOf = (card: CardCatalogEntry): Category => card.unlock?.category === 'costume' ? 'costume' : card.unlock?.category === 'background' ? 'background' : 'wearable';
const FILTERS = [
  { id: 'all', label: 'All', count: SPOOKY_SNOUTS_CATALOG.length },
  { id: 'costume', label: 'Costumes', count: ROSIE_COSTUME_FITS.length },
  { id: 'wearable', label: 'Wearables', count: SPOOKY_SNOUTS_CATALOG.filter(card => categoryOf(card) === 'wearable').length },
  { id: 'background', label: 'Places', count: SPOOKY_SNOUTS_CATALOG.filter(card => categoryOf(card) === 'background').length },
] as const;
const COSTUME_CARDS = SPOOKY_SNOUTS_CATALOG.filter(card => categoryOf(card) === 'costume').sort((a, b) => Number(NEW_IDS.has(b.unlock!.itemId)) - Number(NEW_IDS.has(a.unlock!.itemId)) || a.number.localeCompare(b.number));

const PrintedItems = memo(function PrintedItems({ title, cards, tileWidth }: { title: string; cards: readonly CardCatalogEntry[]; tileWidth: number }) {
  if (!cards.length) return null;
  return <View style={s.section}>
    <T role="sectionTitle">{title} · {cards.length}</T>
    <View style={s.printGrid}>{cards.map(card => <View key={card.id} style={[s.printTile, { width: tileWidth }]} testID={`gallery-item-${card.id}`}>
      <CollectibleCard card={card} artSource={SPOOKY_SNOUTS_ART_SOURCES[card.id]} variant="compact" />
      <T role="bodySm" align="center">{card.name}</T>
    </View>)}</View>
  </View>;
});

/** Read-only catalog. It deliberately has no inventory, gift or equip callback. */
export default function HalloweenGallery({ onBack, active = true, reduceMotion }: { onBack?: () => void; active?: boolean; reduceMotion?: boolean }) {
  const { width } = useWindowDimensions();
  const motion = useMotionPolicy();
  const policyReduced = reduceMotion ?? motion.reduceMotion;
  const [manualReduction, setManualReduction] = useState(false);
  const reduced = policyReduced || manualReduction;
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [query, setQuery] = useState('');
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const [category, setCategory] = useState<Category>('all');
  const [selectedId, setSelectedId] = useState<string>(HALLOWEEN_LOGIN_GIFT_POOL[0].costumeId);
  const [original, setOriginal] = useState(false);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => setForeground(next === 'active'));
    return () => subscription.remove();
  }, []);
  const selected = ROSIE_COSTUME_FIT_BY_ID.get(selectedId)!;
  const term = query.trim().toLowerCase();
  const visible = useMemo(() => SPOOKY_SNOUTS_CATALOG.filter(card => (category === 'all' || categoryOf(card) === category) && (card.name.toLowerCase().includes(term) || card.number.includes(term))), [category, term]);
  const costumes = useMemo(() => COSTUME_CARDS.filter(card => visible.includes(card)), [visible]);
  const wearables = useMemo(() => visible.filter(card => categoryOf(card) === 'wearable'), [visible]);
  const places = useMemo(() => visible.filter(card => categoryOf(card) === 'background'), [visible]);
  const playback = useCostumeGalleryPlayback({ active: active && foreground && costumes.length > 0, reduceMotion: reduced });
  const contentWidth = Math.min(measuredWidth ?? Math.max(240, width - SPACE.lg * 2), 1120);
  const columns = width >= 1000 ? 3 : width >= 700 ? 2 : 1;
  const tileWidth = Math.floor((contentWidth - SPACE.md * (columns - 1)) / columns);
  const thumbnailSize = Math.min(280, tileWidth - SPACE.sm * 2 - BORDER.ink * 2);
  const viewerSize = Math.min(360, contentWidth - SPACE.md * 2 - BORDER.ink * 2);
  const printColumns = width >= 1100 ? 6 : width >= 820 ? 4 : width >= 520 ? 3 : width >= 360 ? 2 : 1;
  const printWidth = Math.floor((contentWidth - SPACE.md * (printColumns - 1)) / printColumns);

  return <View style={s.page} onLayout={event => setMeasuredWidth(event.nativeEvent.layout.width)}>
    {onBack ? <View style={s.back}><Button variant="link" onPress={onBack}>Back to game preview</Button></View> : null}
    <View style={s.heading}>
      <T role="displayLg">Spooky Snouts</T>
      <T role="body">Every spooky find, all in one place.</T>
      <T role="bodySm" tone="secondary">49 items · 11 costumes · 29 wearables · 9 places</T>
      <T role="bodySm" tone="secondary">Browse every look. Previewing keeps your wardrobe as it is.</T>
    </View>

    {costumes.length > 0 ? <View style={s.viewer} testID="gallery-selected-preview">
      <View style={s.viewerCopy}>
        <T role="sectionTitle">{original ? 'Rosie underneath it all' : selected.name}</T>
        <T role="bodySm" tone="secondary">The same Rosie, still blinking and breathing.</T>
        <View style={s.controls}>
          <Button variant={original ? 'lilac' : 'ghost'} onPress={() => setOriginal(value => !value)} testID="gallery-original-toggle">{original ? 'Show costume' : 'Show original Rosie'}</Button>
        </View>
        <T role="bodySm" tone="secondary">Rosie · front idle · 12 frames</T>
      </View>
      <CostumeRosieStage fit={original ? null : selected} frameIndex={playback.frameIndex} displaySize={viewerSize} showControls={false} active={false} reduceMotion={reduced}/>
    </View> : null}

    {costumes.length > 0 ? <View style={s.controlBar}>
      <View style={s.controls}>
        <Button variant="lilac" disabled={reduced} onPress={playback.playing ? playback.pause : playback.play} testID="gallery-play-pause">{playback.playing ? 'Pause all costumes' : 'Play all costumes'}</Button>
        <Button variant="ghost" onPress={() => playback.step(-1)} testID="gallery-previous">Previous frame</Button>
        <Button variant="ghost" onPress={() => playback.step(1)} testID="gallery-next">Next frame</Button>
      </View>
      <View style={s.controls}><T role="bodySm">Reduce motion</T><Switch accessibilityLabel="Reduce gallery motion" value={reduced} disabled={policyReduced} onValueChange={setManualReduction}/></View>
      <T role="bodySm" testID="gallery-frame-label">Frame {playback.frameIndex + 1} of {playback.frameCount}{playback.playing ? ' · Playing' : ' · Paused'}</T>
      {reduced ? <T role="bodySm" tone="secondary">Reduce Motion is on. Step through the frames at your own pace.</T> : null}
    </View> : null}

    <View style={s.browse}>
      <View accessibilityRole="tablist" accessibilityLabel="Filter Halloween items" style={s.controls}>{FILTERS.map(filter => <Pressable key={filter.id} accessibilityRole="tab" accessibilityState={{ selected: category === filter.id }} accessibilityLabel={`${filter.label} ${filter.count}`} onPress={() => setCategory(filter.id)} style={[s.filter, category === filter.id && s.filterSelected]}><T role="label">{filter.label} · {filter.count}</T></Pressable>)}</View>
      <TextInput accessibilityLabel="Search all Halloween items" placeholder="Search names or card numbers" placeholderTextColor={UI_COLORS.textSecondary} value={query} onChangeText={setQuery} style={s.search}/>
      <T role="bodySm" tone="secondary" accessibilityLiveRegion="polite">Showing {visible.length} of 49 items</T>
    </View>

    {costumes.length ? <View style={s.section}>
      <T role="sectionTitle">Costumes · {costumes.length}</T>
      <View style={s.costumeGrid}>{costumes.map(card => {
        const fit = ROSIE_COSTUME_FIT_BY_ID.get(card.unlock!.itemId)!;
        return <Pressable key={card.id} accessibilityRole="button" accessibilityLabel={`Preview ${fit.name}`} accessibilityState={{ selected: selectedId === fit.id }} onPress={() => { setSelectedId(fit.id); setOriginal(false); }} style={[s.costumeTile, { width: tileWidth }, selectedId === fit.id && s.costumeSelected]} testID={`gallery-item-${card.id}`}>
          <View style={s.tileHeading}><T role="cardTitle">{fit.name}</T>{NEW_IDS.has(fit.id) ? <View style={s.new}><T role="label">New</T></View> : null}</View>
          <CostumeRosieStage fit={fit} frameIndex={playback.frameIndex} displaySize={thumbnailSize} showControls={false} active={false} reduceMotion={reduced}/>
          <T role="bodySm" tone="secondary">SSN · {card.number}/49{selectedId === fit.id ? ' · Selected' : ''}</T>
        </Pressable>;
      })}</View>
    </View> : null}
    <PrintedItems title="Wearables" cards={wearables} tileWidth={printWidth}/>
    <PrintedItems title="Places" cards={places} tileWidth={printWidth}/>
    {!visible.length ? <View style={s.empty}><T role="sectionTitle">No spooky finds here yet.</T><T role="bodySm">Try another name or card number.</T><Button variant="ghost" onPress={() => { setQuery(''); setCategory('all'); }}>Show all 49 items</Button></View> : null}
    <T role="bodySm" tone="secondary">Local gallery preview. Costume playback covers Rosie's front idle; other poses and pigs still need fitting.</T>
  </View>;
}

const s = StyleSheet.create({
  page: { alignSelf: 'center', width: '100%', maxWidth: 1120, gap: SPACE.xl },
  back: { alignSelf: 'flex-start' }, heading: { gap: SPACE.sm },
  viewer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: SPACE.lg, padding: SPACE.md, backgroundColor: C.lilac, borderWidth: BORDER.ink, borderColor: UI_COLORS.border, borderRadius: RADII.lg },
  viewerCopy: { flex: 1, minWidth: 220, gap: SPACE.md },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, alignItems: 'center' },
  controlBar: { gap: SPACE.sm }, browse: { gap: SPACE.md },
  filter: { minHeight: 44, paddingHorizontal: SPACE.md, justifyContent: 'center', backgroundColor: C.paper, borderWidth: BORDER.ink, borderColor: UI_COLORS.border, borderRadius: RADII.pill },
  filterSelected: { backgroundColor: C.lilac },
  search: { minHeight: 48, borderWidth: BORDER.ink, borderColor: UI_COLORS.border, borderRadius: RADII.md, backgroundColor: C.paper, color: UI_COLORS.textPrimary, ...TYPE.bodyLg, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm },
  section: { gap: SPACE.lg }, costumeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md },
  costumeTile: { alignItems: 'center', gap: SPACE.sm, padding: SPACE.sm, backgroundColor: C.paper, borderWidth: BORDER.ink, borderColor: UI_COLORS.border, borderRadius: RADII.lg, ...SHADOW_SM },
  costumeSelected: { backgroundColor: C.lilac }, tileHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm },
  new: { paddingVertical: 4, paddingHorizontal: SPACE.sm, borderRadius: RADII.pill, backgroundColor: C.sun },
  printGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md }, printTile: { gap: SPACE.sm, alignItems: 'center' },
  empty: { paddingVertical: SPACE.xl, gap: SPACE.md, alignItems: 'center' },
});

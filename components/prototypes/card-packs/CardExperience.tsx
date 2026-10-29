import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image, Pressable, ScrollView, SafeAreaView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import { WHIMSY as C, FONTS } from '../../../constants/theme';
import { useMotionPolicy } from '../../../hooks/useMotionPolicy';
import { CARD_CATALOG, COLLECTION_CARD_BY_ID } from '../../../features/cards/data/catalog';
import { cardArtSources as GENERATED_CARD_ART_SOURCES } from '../../../features/cards/data/cardArt';
import { restoreCardAlbumSet, SPOOKY_SNOUTS_CATALOG, SPOOKY_SNOUTS_SET, type CardAlbumSet } from '../../../features/cards/data/seasonalCatalog';
import { SPOOKY_SNOUTS_ART_SOURCES, SPOOKY_SNOUTS_CONCEPT_ART } from '../../../features/cards/data/seasonalCardArt';
import type { CardCatalogEntry, CardFinish } from '../../../features/cards/domain/catalog';
import { createLocalCardAuthority, grantWelcomePack, grantFixturePack, grantSpookySnoutsPack, grantSpookySnoutsCostumePack, openLocalPack, claimLocalFoil, selectFoilGoal, restoreLocalCardAuthority, grantLocalHalloweenLoginGift, ackLocalHalloweenLoginGift, WELCOME_PACK_ID, type LocalCardAuthorityState } from '../../../features/cards/domain/localPrototypeAuthority';
import { restoreEquippedRosieCostume, ROSIE_COSTUME_FIT_BY_ID } from '../../../features/cards/data/costumeFits';
import { createOpeningPresentation, openingPresentationReducer, restoreOpeningPresentation, type OpeningPresentationState, type OpeningPresentationAction } from '../../../features/cards/domain/openingPresentation';
import { HEDGE_RUN_KIT, HEDGE_EVENTS, createHedgeRun, applyHedgeChoice, getRunTotals, restoreHedgeRun, viewHedgeChallenge, type HedgeRunState, type HedgeChallenge } from '../../../features/cards/domain/hedgeRun';
import { readCardDemo, writeCardDemo } from './storage';
import { useCardSensory } from './useCardSensory';
import { PerformanceStage } from './PerformanceStage';
import { riveCardArtSources } from './riveArt';
import { OpeningCeremony } from './OpeningCeremony';
import { useOpeningPlayback } from './useOpeningPlayback';
import type { CardArtSource, CardPackSignal } from './riveTypes';
import { CollectibleCard } from './CollectibleCard';
import { DeckBuilder } from './DeckBuilder';
import { createConstructedDeck, restoreConstructedDeck, type ConstructedDeckState } from '../../../features/cards/domain/constructedDeck';
import HalloweenWorkshop from './HalloweenWorkshop';
import HalloweenGallery from './HalloweenGallery';
import { HalloweenLoginGiftContent } from '../../HalloweenLoginGift';

type Screen = 'arrival' | 'shelf' | 'opening' | 'album' | 'sleeve' | 'practice' | 'deck' | 'workshop' | 'gift' | 'gallery';
type Snapshot = { version: 1; deck: ConstructedDeckState; authority: LocalCardAuthorityState; opening: OpeningPresentationState | null; activePackId: string; screen: Screen; run: HedgeRunState | null; challenge: HedgeChallenge | null; look: string | null; activeMs: number; selectedCardId: string; albumSet: CardAlbumSet; selectedEquippedCostumeId: string | null };
const CARD_BY_ID: ReadonlyMap<string, CardCatalogEntry> = COLLECTION_CARD_BY_ID;
const cardArtSources: Readonly<Record<string, ImageSourcePropType>> = GENERATED_CARD_ART_SOURCES;
const fresh = (): Snapshot => ({ version: 1, deck: createConstructedDeck(), authority: grantSpookySnoutsCostumePack(grantSpookySnoutsPack(grantWelcomePack(createLocalCardAuthority()))), opening: null, activePackId: WELCOME_PACK_ID, screen: 'arrival', run: null, challenge: null, look: null, activeMs: 0, selectedCardId: 'moon_firefly', albumSet: 'base', selectedEquippedCostumeId: null });
const name = (id: string) => CARD_BY_ID.get(id)?.name ?? id;
const quick = (id: string) => HEDGE_RUN_KIT.find(card => card.cardId === id);
const finishLabel = (finish: CardFinish) => finish === 'living' ? 'Living illustration' : finish === 'foil' ? 'Foil' : 'Standard';
const blankOpening = createOpeningPresentation('', 3);
const packSize = (length: number): 3 | 5 => length === 3 ? 3 : 5;
const shadow = { boxShadow: `4px 5px 0 ${C.ink}` };
const screens: readonly Screen[] = ['arrival', 'shelf', 'opening', 'album', 'sleeve', 'practice', 'deck', 'workshop', 'gift', 'gallery'];

function restoreChallenge(value: unknown, ownRun: HedgeRunState | null): HedgeChallenge | null {
  if (!value || typeof value !== 'object' || !ownRun) return null;
  const saved = value as Partial<HedgeChallenge>;
  if (
    typeof saved.id !== 'string' || typeof saved.seed !== 'string' || saved.seed !== ownRun.seed ||
    saved.creatorId !== 'you' || typeof saved.friendId !== 'string' || !saved.friendId.trim() ||
    !saved.runs || typeof saved.runs !== 'object'
  ) return null;
  const creator = restoreHedgeRun(saved.runs.creator);
  if (!creator || creator.seed !== saved.seed || JSON.stringify(creator.choices) !== JSON.stringify(ownRun.choices)) return null;
  const friend = saved.runs.friend ? restoreHedgeRun(saved.runs.friend) : null;
  if (saved.runs.friend && (!friend || friend.seed !== saved.seed)) return null;
  return { id: saved.id, seed: saved.seed, creatorId: 'you', friendId: saved.friendId, runs: { creator: ownRun, ...(friend ? { friend } : {}) } };
}

function Button({ children, onPress, secondary = false, disabled = false, label }: { children: React.ReactNode; onPress: () => void; secondary?: boolean; disabled?: boolean; label?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label ?? (typeof children === 'string' ? children : undefined)} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, disabled && s.disabled, pressed && s.pressed]}><Text style={s.buttonText}>{children}</Text></Pressable>;
}
function Tag({ children, color = C.sage }: { children: React.ReactNode; color?: string }) { return <View style={[s.tag, { backgroundColor: color }]}><Text style={s.tagText}>{children}</Text></View>; }
function CardArt({ id, compact = false, finish = 'standard', detail = false, animate = false }: { id: string; compact?: boolean; finish?: CardFinish; detail?: boolean; animate?: boolean }) {
  const card = CARD_BY_ID.get(id);
  if (!card) return null;
  const seasonalArt = SPOOKY_SNOUTS_ART_SOURCES[id];
  const concept = seasonalArt ? undefined : SPOOKY_SNOUTS_CONCEPT_ART[id];
  const artwork = concept ? <View accessibilityLabel={concept.label} style={[s.seasonalConcept, { backgroundColor: concept.background }]}>
    <Text style={[s.seasonalGlyph, { color: concept.accent }]}>{concept.glyph}</Text>
    <Text style={s.seasonalConceptLabel}>CONCEPT ART · FINAL ILLUSTRATION PENDING</Text>
  </View> : undefined;
  return <CollectibleCard card={card} artSource={seasonalArt ?? cardArtSources[id]} artwork={artwork} finish={finish} animate={animate} variant={compact ? 'compact' : detail ? 'detail' : 'ceremony'}/>;
}
function Packet({ progress = 0, count = 3, setName }: { progress?: number; count?: number; setName?: string }) {
  if (count === 3) return <View style={{ width: 252, height: 374, overflow: 'hidden', margin: 12 }}><Image source={require('../../../assets/rive/card-packs/sealed-packet-poster.png')} accessibilityLabel="Rosie's Loadout waxed seed packet, three cards" style={{ position: 'absolute', width: 318, height: 688, left: -35, top: -168 }}/></View>;
  const costumePacket = setName === 'SPOOKY SNOUTS';
  return <View style={s.packet} accessibilityLabel={`${setName ?? "Rosie's Loadout"} packet, ${count} cards`}><View style={s.seam}><View style={[s.tearFill, { width: `${progress * 100}%` }]} /></View><Text style={s.packetKicker}>{setName ?? "ROSIE'S LOADOUT"}</Text><Image source={typeof cardArtSources.legend_rosie === 'string' ? { uri: cardArtSources.legend_rosie } : cardArtSources.legend_rosie} style={s.packetPig} resizeMode="contain" accessibilityLabel="Rosie among the flowers"/><Text style={s.packetTitle}>{costumePacket ? 'Costume fittings.\nFive spooky looks.' : 'Little things.\nLovely finds.'}</Text><Text style={s.packetFoot}>{costumePacket ? `${count} costume cards inside` : `${count} cards from the bog`}</Text></View>;
}

export default function CardExperience() {
  const [state, setState] = useState<Snapshot>(fresh);
  const current = useRef(state);
  const scroll = useRef<ScrollView>(null);
  const queue = useRef(Promise.resolve());
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [choiceBusy, setChoiceBusy] = useState(false);
  const choiceBusyRef = useRef(false);
  const [message, setMessage] = useState('');
  const motionPolicy = useMotionPolicy();
  const [motionOverride, setReduceMotion] = useState<boolean | undefined>(undefined);
  const reduceMotion = motionOverride ?? motionPolicy.reduceMotion;
  const [haptics, setHaptics] = useState(true);
  const [sound, setSound] = useState(false);
  const sensory = useCardSensory({ soundEnabled: sound, hapticsEnabled: haptics, reduceMotion, active: loaded });
  const cue = sensory.cue;
  const [staticMode, setStaticMode] = useState(false);
  const [runtimeStatus, setRuntimeStatus] = useState('Awaiting first animation load.');
  const [visualSignals, setVisualSignals] = useState<string[]>([]);
  const [review, setReview] = useState(false);
  const [failure, setFailure] = useState<'none' | 'before' | 'after'>('none');
  const selected = state.selectedCardId;
  const [query, setQuery] = useState('');
  const [ownedOnly, setOwnedOnly] = useState(true);
  const [selectedHand, setSelectedHand] = useState<string | null>(null);
  const [friendName, setFriendName] = useState('Sam');
  const [lastRound, setLastRound] = useState('');
  const [workshopPreviewCostumeId, setWorkshopPreviewCostumeId] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const compact = width < 600;
  const persist = useCallback((next: Snapshot) => {
    current.current = next; setState(next);
    queue.current = queue.current.catch(() => undefined).then(() => writeCardDemo(next));
    return queue.current;
  }, []);
  const update = useCallback((patch: Partial<Snapshot>) => {
    void persist({ ...current.current, ...patch }).catch(() => setMessage('This device could not save progress. Keep this page open and try again.'));
  }, [persist]);
  const setSelected = (selectedCardId: string) => update({ selectedCardId });
  const act = useCallback((action: OpeningPresentationAction) => {
    const opening = current.current.opening;
    if (!opening) return;
    const next = openingPresentationReducer(opening, action);
    if (next === opening) return;
    update({ opening: next });
    if (action.type === 'inspect') cue('inspect');
    if (next.phase === 'receipt' && opening.phase !== 'receipt') cue('receipt');
  }, [cue, update]);
  const onRevealCue = useCallback(() => cue('reveal'), [cue]);
  const { reveal, cancel: cancelReveal, settle } = useOpeningPlayback({ opening: state.opening, active: loaded && state.screen === 'opening', reduceMotion: reduceMotion || staticMode, onAction: act, onReveal: onRevealCue });
  useEffect(() => {
    void readCardDemo().then(async value => {
      const saved = value && typeof value === 'object' && (value as Partial<Snapshot>).version === 1
        ? value as Partial<Snapshot>
        : null;
      const restoredAuthority = saved ? grantSpookySnoutsCostumePack(grantSpookySnoutsPack(grantWelcomePack(restoreLocalCardAuthority(saved.authority)))) : fresh().authority;
      // Local preview only: save the resolved gift before its presentation.
      const authority = grantLocalHalloweenLoginGift(restoredAuthority, { draw: Math.random() }).state;
      const activePackId = saved && typeof saved.activePackId === 'string' && authority.grants[saved.activePackId] ? saved.activePackId : WELCOME_PACK_ID;
      const receipt = authority.receipts[activePackId];
      const run = saved?.run ? restoreHedgeRun(saved.run) : null;
      const challenge = restoreChallenge(saved?.challenge, run);
      const savedScreen = saved && screens.includes(saved.screen as Screen) ? saved.screen as Screen : null;
      const screen: Screen = savedScreen === 'opening' && receipt ? 'opening'
        : savedScreen === 'practice' && run ? 'practice'
        : savedScreen === 'arrival' && !receipt ? 'arrival'
        : savedScreen === 'album' || savedScreen === 'sleeve' || savedScreen === 'deck' || savedScreen === 'workshop' || savedScreen === 'gallery' ? savedScreen
        : !saved ? 'arrival' : 'shelf';
      const look = saved && typeof saved.look === 'string' && quick(saved.look) && authority.copies[saved.look] > 0 ? saved.look : null;
      const selectedCardId = saved && typeof saved.selectedCardId === 'string' && CARD_BY_ID.has(saved.selectedCardId) ? saved.selectedCardId : 'moon_firefly';
      const albumSet = restoreCardAlbumSet(saved?.albumSet, selectedCardId);
      const selectedEquippedCostumeId = restoreEquippedRosieCostume(saved?.selectedEquippedCostumeId, authority.cosmeticUnlocks);
      const next: Snapshot = {
        ...fresh(), authority, activePackId, run, challenge, look, deck: restoreConstructedDeck(saved?.deck),
        selectedCardId, albumSet, selectedEquippedCostumeId,
        activeMs: saved && Number.isFinite(saved.activeMs) && saved.activeMs! >= 0 ? saved.activeMs! : 0,
        opening: receipt ? restoreOpeningPresentation(saved?.opening, receipt.id, packSize(receipt.results.length)) : null,
        screen: authority.loginGift?.acknowledgedAt === null ? 'gift' : screen,
      };
      await writeCardDemo(next);
      current.current = next; setState(next);
    }).catch(() => setMessage('Saved demo data could not be read. A fresh local album is ready.')).finally(() => setLoaded(true));
    return () => cancelReveal();
  }, [cancelReveal]);
  useEffect(() => {
    if (!loaded) return;
    const subscription = AppState.addEventListener('change', next => {
      if (next !== 'active') void persist(current.current).catch(() => undefined);
    });
    return () => subscription.remove();
  }, [loaded, persist]);
  useEffect(() => {
    if (!loaded || state.screen !== 'practice' || state.run?.status !== 'active') return;
    let start = Date.now();
    let active = AppState.currentState === 'active';
    const bank = () => { if (active) current.current = { ...current.current, activeMs: current.current.activeMs + Date.now() - start }; start = Date.now(); };
    const sub = AppState.addEventListener('change', next => { bank(); active = next === 'active'; void persist(current.current).catch(() => undefined); });
    return () => { bank(); sub.remove(); void persist(current.current).catch(() => undefined); };
  }, [loaded, persist, state.run?.status, state.screen]);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [state.screen]);
  const tick = () => sensory.cue('pickup');
  const opening = state.opening ?? blankOpening;
  const receipt = state.authority.receipts[state.activePackId];
  const activeGrant = state.authority.grants[state.activePackId];
  const index = Math.max(0, Math.min(opening.cardCount - 1, opening.revealedCount - 1));
  const activeResult = receipt?.results[opening.inspectingIndex ?? index];
  const performanceIndex = opening.revealPending ? Math.min(opening.cardCount - 1, opening.revealedCount) : index;
  const performanceResult = receipt?.results[performanceIndex];
  const seasonalStaticPerformance = Boolean(performanceResult && SPOOKY_SNOUTS_CATALOG.some(card => card.id === performanceResult.cardId) && !SPOOKY_SNOUTS_ART_SOURCES[performanceResult.cardId]);
  function visualSignal(signal: CardPackSignal, openingId: string, cardIndex: number) {
    setVisualSignals(previous => [...previous.slice(-7), `${signal} · ${cardIndex + 1}`]);
    if (signal === 'cardSettled') settle(openingId, cardIndex);
  }
  const stage = (child: React.ReactNode) => <PerformanceStage immersive key={opening.openingId} art={(riveCardArtSources[performanceResult?.cardId ?? 'firefly_swarm'] ?? SPOOKY_SNOUTS_ART_SOURCES[performanceResult?.cardId ?? ''] ?? cardArtSources[performanceResult?.cardId ?? 'firefly_swarm'] ?? SPOOKY_SNOUTS_ART_SOURCES.halloween_2026_card_moonbrew_witch_hat) as CardArtSource} finish={performanceResult?.finish ?? 'standard'} phase={opening.phase === 'receipt' ? 'complete' : opening.phase} tearProgress={opening.tearProgress} index={performanceIndex} revealedCount={opening.revealedCount} revealPending={opening.revealPending} reduceMotion={reduceMotion} staticMode={staticMode || seasonalStaticPerformance} onStatus={setRuntimeStatus} onSignal={signal => visualSignal(signal, opening.openingId, performanceIndex)}>{child}</PerformanceStage>;

  async function openPack(packId = current.current.activePackId) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setMessage('');
    try {
      cancelReveal();
      await persist({ ...current.current, activePackId: packId });
      if (failure === 'before') { setFailure('none'); throw new Error('Your packet is still on the shelf. Try opening it again.'); }
      const result = openLocalPack(current.current.authority, packId);
      // The immutable receipt and every copy are persisted before presentation.
      const savedOpening = current.current.opening?.openingId === result.receipt.id
        ? restoreOpeningPresentation(current.current.opening, result.receipt.id, packSize(result.receipt.results.length))
        : createOpeningPresentation(result.receipt.id, packSize(result.receipt.results.length));
      const nextOpening = result.state.grants[packId]?.fixtureId === 'tenth-pack' && savedOpening.phase === 'sealed'
        ? openingPresentationReducer(savedOpening, { type: 'open' })
        : savedOpening;
      const next = { ...current.current, authority: result.state, opening: nextOpening, activePackId: packId };
      await persist(next);
      if (failure === 'after') { setFailure('none'); throw new Error('The opening was saved, but the response was interrupted. Resume the same packet from the shelf.'); }
      await persist({ ...next, screen: 'opening' }); tick();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Opening could not be saved. Try again.'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function continueLoginGift(tryOn = false): Promise<boolean> {
    if (busyRef.current) return false;
    busyRef.current = true; setBusy(true); setMessage('');
    try {
      const authority = ackLocalHalloweenLoginGift(current.current.authority);
      const next: Snapshot = { ...current.current, authority, screen: 'workshop',
        selectedEquippedCostumeId: tryOn ? authority.loginGift?.costumeId ?? null : current.current.selectedEquippedCostumeId };
      await queue.current.catch(() => undefined);
      await writeCardDemo(next);
      current.current = next; setState(next);
      return true;
    } catch { setMessage('Your saved gift is safe. Please try Continue again.'); return false; }
    finally { busyRef.current = false; setBusy(false); }
  }
  const goto = (screen: Screen) => { cancelReveal(); setMessage(''); if (screen === 'workshop') setWorkshopPreviewCostumeId(null); update({ screen }); };
  function fixture(kind: 'all-repeat' | 'tenth-pack' | 'dig-demo') {
    setMessage('');
    const id = `local-demo:${kind}:${Object.keys(current.current.authority.grants).length}`;
    update({ authority: grantFixturePack(current.current.authority, id, kind), activePackId: id, opening: null, screen: 'shelf' });
  }
  function startPractice(challenge = false) {
    cancelReveal();
    const seed = `hedge-demo-${Date.now()}`;
    const run = createHedgeRun(seed, 'legend_copper');
    const friend = friendName.trim() || 'Sam';
    update({ run, activeMs: 0, screen: 'practice', challenge: challenge ? { id: `demo:${seed}`, seed, creatorId: 'you', friendId: friend, runs: { creator: run } } : null });
    setSelectedHand(run.hand[0]); setLastRound('');
  }
  function choose(mode: 'play' | 'train') {
    if (choiceBusyRef.current) return;
    const run = current.current.run;
    const cardId = selectedHand ?? run?.hand[0];
    if (!run || !cardId) return;
    try {
      choiceBusyRef.current = true; setChoiceBusy(true);
      const next = applyHedgeChoice(run, { cardId, mode });
      const round = next.resolvedRounds.at(-1)!;
      setLastRound(`${name(cardId)} ${mode === 'train' ? 'trained' : 'played'}. ${round.damage ? `Lost ${round.damage} Cheer.` : 'Safe this round.'} ${round.foundDiscovery ? 'Discovery found!' : 'No discovery this time.'}`);
      const snapshot = {
        ...current.current,
        run: next,
        challenge: current.current.challenge ? { ...current.current.challenge, runs: { ...current.current.challenge.runs, creator: next } } : null,
      };
      void persist(snapshot).catch(() => setMessage('This device could not save the round. Keep this page open and try again.')).finally(() => {
        choiceBusyRef.current = false; setChoiceBusy(false);
      });
      setSelectedHand(next.hand[0] ?? null); tick();
    } catch (error) {
      choiceBusyRef.current = false; setChoiceBusy(false);
      setMessage(error instanceof Error ? error.message : 'Choose a card in your hand.');
    }
  }
  function simulateFriend() {
    const challenge = current.current.challenge;
    if (!challenge) return;
    let friend = createHedgeRun(challenge.seed, 'legend_copper');
    while (friend.status === 'active') friend = applyHedgeChoice(friend, { cardId: friend.hand[0], mode: 'play' });
    update({ challenge: { ...challenge, runs: { ...challenge.runs, friend } } });
  }
  const owned = CARD_CATALOG.filter(card => state.authority.copies[card.id] > 0).length;
  const albumCards: readonly CardCatalogEntry[] = state.albumSet === 'base' ? CARD_CATALOG : SPOOKY_SNOUTS_CATALOG;
  const albumOwned = albumCards.filter(card => state.authority.copies[card.id] > 0).length;
  const goal = state.authority.selectedFoilGoal;
  const selectedCard = CARD_BY_ID.get(selected);
  const selectedCostumeFit = selectedCard?.unlock?.category === 'costume'
    ? ROSIE_COSTUME_FIT_BY_ID.get(selectedCard.unlock.itemId)
    : undefined;
  const ownedCostumeIds = [...ROSIE_COSTUME_FIT_BY_ID.keys()].filter(id => Boolean(state.authority.cosmeticUnlocks[id]));
  const selectedFinish = state.authority.finishes[selected]?.includes('living') ? 'living' : state.authority.finishes[selected]?.includes('foil') ? 'foil' : 'standard';
  const run = state.run;
  const totals = run ? getRunTotals(run) : null;
  const event = run ? HEDGE_EVENTS.find(item => item.id === run.trail[run.round - 1]) : null;
  const nextEvent = run ? HEDGE_EVENTS.find(item => item.id === run.trail[run.round]) : null;
  const handId = run?.hand.includes(selectedHand ?? '') ? selectedHand! : run?.hand[0];
  const handCard = handId ? quick(handId) : undefined;
  const comparison = state.challenge ? viewHedgeChallenge(state.challenge, 'you') : null;
  if (!loaded) return <View style={s.loading}><Text style={s.body}>Opening your scrapbook…</Text></View>;
  if (state.screen === 'opening' && receipt && opening.phase !== 'receipt') return <OpeningCeremony
    setTitle={activeGrant?.fixtureId === 'spooky-snouts' || activeGrant?.fixtureId === 'spooky-snouts-costumes' ? 'SPOOKY SNOUTS' : "ROSIE'S LOADOUT"}
    key={opening.openingId} opening={opening} result={activeResult} card={activeResult ? CARD_BY_ID.get(activeResult.cardId) : undefined}
    performance={stage((opening.revealedCount > 0 || opening.revealPending) && performanceResult ? <CardArt id={performanceResult.cardId} finish={performanceResult.finish} animate={!reduceMotion && !staticMode}/> : <Packet progress={opening.tearProgress} count={opening.cardCount} setName={activeGrant?.fixtureId === 'spooky-snouts-costumes' ? 'SPOOKY SNOUTS' : undefined}/>)}
    packet={<Packet progress={opening.tearProgress} count={opening.cardCount} setName={activeGrant?.fixtureId === 'spooky-snouts-costumes' ? 'SPOOKY SNOUTS' : undefined}/>}
    staticCard={activeResult ? <CardArt id={activeResult.cardId} finish={activeResult.finish} detail/> : null}
    reduceMotion={reduceMotion || staticMode}
    onTear={progress => { if (progress >= 1 && (current.current.opening?.tearProgress ?? 1) < 1) cue('tear'); act({ type: 'tear', progress }); }}
    onOpen={() => { if (opening.phase === 'sealed' || opening.phase === 'tearing') { act({ type: 'open' }); cue('tear'); } }}
    onAdvance={reveal} onInspect={() => act({ type: 'inspect', index })}
    onCloseInspection={() => act({ type: 'closeInspection' })}
    onReceipt={() => { cancelReveal(); act({ type: 'showReceipt' }); }}
    onSkip={() => { cancelReveal(); act({ type: 'skipToReceipt' }); }} />;
  const loginGift = state.authority.loginGift;
  const loginGiftFit = loginGift ? ROSIE_COSTUME_FIT_BY_ID.get(loginGift.costumeId) : undefined;
  return <SafeAreaView style={s.page}><ScrollView ref={scroll} style={s.page} contentContainerStyle={s.pageContent}>
    <View style={s.topbar}><Text style={s.brand}>tickle the pig</Text><Tag color={C.rose}>LOCAL PLAYABLE PROTOTYPE</Tag></View>
    <View style={s.navigation}><Button secondary onPress={() => goto('shelf')}>Packets</Button><Button secondary onPress={() => goto('album')}>Album · {owned}/88</Button><Button secondary onPress={() => goto('gallery')}>All Halloween items</Button><Button secondary onPress={() => goto('workshop')}>Halloween Workshop</Button><Button secondary onPress={() => goto('deck')}>Legends & decks</Button><Button secondary onPress={() => run ? goto('practice') : startPractice()}>Practice</Button></View>
    {loginGift && loginGift.acknowledgedAt === null && state.screen !== 'gift' && <Button onPress={() => goto('gift')}>Resume your Halloween gift</Button>}
    {state.screen === 'gift' && loginGift && loginGiftFit && <View style={[s.center, { backgroundColor: C.lilac, borderRadius: 20, padding: 12 }]}><Tag>LOCAL LOGIN GIFT PREVIEW</Tag><HalloweenLoginGiftContent receipt={loginGift} costume={{ name: loginGiftFit.name, fit: loginGiftFit }} busy={busy} reduceMotion={reduceMotion} onContinue={() => continueLoginGift()} onLater={() => goto('workshop')} onTryOn={() => { void continueLoginGift(true); }}/></View>}
    {!!message && <View accessibilityRole="alert" style={s.notice}><Text style={s.body}>{message}</Text></View>}
    {state.screen === 'gallery' && <HalloweenGallery reduceMotion={reduceMotion} onBack={() => goto('workshop')}/>}
    {state.screen === 'arrival' && <View style={s.center}><Tag>A LITTLE SOMETHING FOR YOU</Tag><Text style={[s.title, compact && s.mobileTitle]}>{'Care grows\nlovely things.'}</Text><Text style={s.lede}>A packet for your pocket. A whole bog of little stories to keep.</Text><Packet/><Text style={s.handwritten}>Rosie saved you the first one.</Text><Button onPress={() => goto('shelf')}>Visit your packet shelf</Button><Text style={s.caption}>Your welcome kit includes six pigs and the complete borrowed practice kit.</Text></View>}
    {state.screen === 'shelf' && <View style={s.section}>
      <Tag color={C.sun}>ROSIE'S LOADOUT</Tag><Text style={s.title}>A few lovely things.</Text><Text style={s.lede}>Fixed local packets for collection and costume playtests.</Text>
      <Button onPress={() => { fixture('dig-demo'); void openPack(); }}>Try a three-card packet</Button>
      <View style={s.shelf}>{Object.values(state.authority.grants).map(grant => {
        const costumePacket = grant.fixtureId === 'spooky-snouts-costumes';
        const spookyPacket = grant.fixtureId === 'spooky-snouts';
        const packetName = costumePacket ? 'Spooky Snouts costume' : spookyPacket ? 'Spooky Snouts' : grant.fixtureId === 'welcome' ? 'Welcome' : 'demo';
        const count = state.authority.receipts[grant.id]?.results.length ?? (costumePacket ? 5 : 3);
        return <View key={grant.id} style={s.shelfItem}>
          <Packet count={count} setName={costumePacket ? 'SPOOKY SNOUTS' : undefined}/>
          <Text style={s.subheading}>{grant.fixtureId === 'welcome' ? 'Welcome to the bog' : costumePacket ? 'Spooky Snouts · costume fitting packet' : spookyPacket ? 'Spooky Snouts · preview packet' : grant.fixtureId === 'tenth-pack' ? 'Your tenth packet · fast path' : grant.fixtureId === 'all-repeat' ? 'Familiar little friends · fixed repeats' : 'Fixed review packet from a good dig'}</Text>
          <Text style={s.caption}>{grant.opened ? `${count} cards already tucked into your collection.` : costumePacket ? 'Five fixed costume cards · first copies unlock five wearable local items' : spookyPacket ? 'Three fixed local preview cards · first copies unlock demo cosmetics only' : 'Three fixed demo cards · no server reward claimed'}</Text>
          <Button label={`${grant.opened ? 'Resume' : 'Pick up'} ${packetName} packet`} disabled={busy} onPress={() => void openPack(grant.id)}>{grant.opened ? 'Resume opening' : 'Pick up packet'}</Button>
          {grant.opened && <Button secondary onPress={() => { cancelReveal(); const receipt = state.authority.receipts[grant.id]; update({ activePackId: grant.id, opening: openingPresentationReducer(createOpeningPresentation(receipt.id, packSize(receipt.results.length)), { type: 'skipToReceipt' }), screen: 'opening' }); }}>View receipt</Button>}
        </View>;
      })}</View>
    </View>}
    {state.screen === 'opening' && receipt && opening.phase === 'receipt' && <View style={s.center}><><Tag color={C.sun}>{`ALL ${receipt.results.length === 3 ? 'THREE' : 'FIVE'}, SAFELY HOME`}</Tag><Text style={s.title}>{receipt.newCardCount ? `${receipt.newCardCount} new little stories.` : 'Good to see you again.'}</Text><Text style={s.lede}>{receipt.results.some(result => result.itemUnlock) ? 'First copies unlocked their matching local preview cosmetics.' : receipt.newCardCount ? 'A little more of the bog, just for you.' : 'Familiar cards. Fresh shine for your favorite.'}</Text><View style={s.receiptGrid}>{receipt.results.map(result => <Pressable key={result.cardId} accessibilityRole="button" accessibilityLabel={`Inspect ${name(result.cardId)}, ${result.isNew ? 'new' : 'repeat'}`} style={s.receiptCard} onPress={() => { setSelected(result.cardId); goto('sleeve'); }}><CardArt id={result.cardId} finish={result.finish} compact/><Tag color={result.isNew ? C.sage : C.cream2}>{result.isNew ? 'NEW' : `REPEAT · COPY ${result.copyNumber}`}</Tag>{result.itemUnlock && <Text style={s.caption}>{result.itemUnlock.newlyOwned ? `${CARD_BY_ID.get(result.cardId)?.unlock?.category === "background" ? "Place unlocked" : "Wearable added"}: ${result.itemUnlock.itemName}.` : `${result.itemUnlock.itemName} was already unlocked.`}</Text>}</Pressable>)}</View>{receipt.results.some(result => result.itemUnlock) ? <View style={s.progressPanel}><Text style={s.subheading}>Spooky Snouts unlocks</Text><Text style={s.body}>These cosmetic unlocks are saved only in this local prototype.</Text><Text style={s.caption}>The production seasonal catalog and reward RPC remain inactive.</Text></View> : <View style={s.progressPanel}><Text style={s.subheading}>A little closer to a foil</Text><Text style={s.body}>+{receipt.repeatProgressCredit} repeat progress · {state.authority.repeatProgress}/10 banked</Text><Text style={s.caption}>{goal ? `Your goal: ${name(goal)}` : 'Choose your favorite in the album. Progress waits for you.'}</Text></View>}<Button onPress={() => { if (receipt.results.some(result => result.itemUnlock)) update({ albumSet: 'spooky', screen: 'album' }); else goto('album'); }}>Keep in album</Button><Button secondary onPress={() => startPractice()}>Try a practice run</Button><Text style={s.caption}>Owned before the tear. This button just closes the ceremony.</Text></></View>}
    {state.screen === 'album' && <View style={s.section}><Tag color={C.lilac}>{state.albumSet === 'base' ? 'THE HUNGER IN THE BOG' : 'SPOOKY SNOUTS · LOCAL PREVIEW'}</Tag><Text style={s.title}>{'Your little corner\nof the bog.'}</Text><View style={s.row}><Button secondary={state.albumSet !== 'base'} onPress={() => update({ albumSet: 'base' })}>Base set · {owned}/88</Button><Button secondary={state.albumSet !== 'spooky'} onPress={() => update({ albumSet: 'spooky' })}>Spooky Snouts · {SPOOKY_SNOUTS_SET.cardCount} cards</Button></View><Text style={s.lede}>{albumOwned} of {albumCards.length} {state.albumSet === 'base' ? 'stories' : 'seasonal unlock cards'} found. Every copy stays yours.</Text>{state.albumSet === 'base' ? <View style={s.progressPanel}><Text style={s.subheading}>{goal ? `A foil for ${name(goal)}` : 'Let a favorite shine.'}</Text><Text style={s.body}>{state.authority.repeatProgress}/10 repeat progress, safely banked.</Text>{goal && !state.authority.finishes[goal]?.includes('foil') && <Button disabled={state.authority.repeatProgress < 10} onPress={() => { try { update({ authority: claimLocalFoil(current.current.authority, goal, `foil:${goal}`) }); setMessage(`${name(goal)} has a foil finish. Every copy is still yours.`); } catch (error) { setMessage(String(error)); } }}>Claim this foil</Button>}</View> : <View style={s.progressPanel}><Text style={s.subheading}>First copy, matching cosmetic</Text><Text style={s.body}>Each collected SSN card names the wearable or background it unlocks in this local demo.</Text><Text style={s.caption}>These cards stay outside decks and Hedge Run.</Text><Button onPress={() => goto('workshop')}>Trade a spooky spare</Button></View>}<TextInput accessibilityLabel="Search the card album" placeholder="Find a name, item, or place…" value={query} onChangeText={setQuery} style={s.input}/><View style={s.toggle}><Text style={s.body}>Only my collected cards</Text><Switch accessibilityLabel="Only collected cards" value={ownedOnly} onValueChange={setOwnedOnly}/></View><View style={s.albumGrid}>{albumCards.filter(card => (!ownedOnly || state.authority.copies[card.id]) && card.name.toLowerCase().includes(query.toLowerCase())).map(card => <Pressable key={card.id} accessibilityRole="button" accessibilityLabel={`${card.name}, ${state.authority.copies[card.id] ?? 0} copies`} style={s.albumCard} onPress={() => { setSelected(card.id); goto('sleeve'); }}>{state.authority.copies[card.id] ? <CardArt id={card.id} compact finish={state.authority.finishes[card.id]?.includes('living') ? 'living' : state.authority.finishes[card.id]?.includes('foil') ? 'foil' : 'standard'}/> : <View style={s.missing}><Text style={s.missingNumber}>{card.number}</Text><Text style={s.smallName}>{card.name}</Text><Text style={s.caption}>Still to find</Text></View>}<Text style={s.caption}>{state.authority.copies[card.id] ?? 0} copies · {card.unlock ? `${card.unlock.category} unlock` : quick(card.id) ? 'Hedge Run look' : 'Collection card'}</Text></Pressable>)}</View></View>}
    {state.screen === 'workshop' && <HalloweenWorkshop reduceMotion={reduceMotion} ownedCostumeIds={ownedCostumeIds} equippedCostumeId={state.selectedEquippedCostumeId} initialPreviewCostumeId={workshopPreviewCostumeId} onEquipCostume={selectedEquippedCostumeId => update({ selectedEquippedCostumeId })} onBack={() => update({ screen: 'album', albumSet: 'spooky' })}/>}
    {state.screen === 'sleeve' && selectedCard && <View style={s.center}><Text style={s.eyebrow}>YOUR SCRAPBOOK SLEEVE</Text><PerformanceStage key={selected} art={(riveCardArtSources[selected] ?? SPOOKY_SNOUTS_ART_SOURCES[selected] ?? cardArtSources[selected] ?? SPOOKY_SNOUTS_ART_SOURCES.halloween_2026_card_moonbrew_witch_hat ?? cardArtSources.firefly_swarm) as CardArtSource} finish={selectedFinish} phase="revealing" tearProgress={1} index={0} revealedCount={1} reduceMotion={reduceMotion} staticMode onStatus={setRuntimeStatus}><CardArt id={selected} finish={selectedFinish}/></PerformanceStage><Text style={s.lede}>{selectedCard.flavor}</Text><View style={s.row}><Tag>{selectedCard.rarity}</Tag><Tag color={C.lilac}>{finishLabel(selectedFinish)}</Tag><Tag color={C.rose}>{state.authority.copies[selected] ?? 0} copies</Tag></View><Text style={s.eyebrow}>{selectedCard.unlock ? 'COSMETIC UNLOCK' : 'PRINTED TABLETOP RULES'}</Text><Text style={s.body}>{selectedCard.text}</Text>{selectedCard.training && <Text style={s.body}>{selectedCard.training.name}: {selectedCard.training.text}</Text>}{selectedCard.unlock ? <View style={s.progressPanel}><Text style={s.eyebrow}>{selectedCard.unlock.category.toUpperCase()} · FIRST COPY UNLOCK</Text><Text style={s.body}>{selectedCard.unlock.itemName}</Text><Text style={s.caption}>{state.authority.cosmeticUnlocks[selectedCard.unlock.itemId] ? 'Unlocked in this local preview.' : 'Collect the first copy to unlock this local preview cosmetic.'}</Text><Text style={s.caption}>Collection only. Not legal in constructed decks or Hedge Run.</Text>{selectedCostumeFit && <Button disabled={!state.authority.cosmeticUnlocks[selectedCostumeFit.id]} onPress={() => { setWorkshopPreviewCostumeId(selectedCostumeFit.id); update({ selectedEquippedCostumeId: selectedCostumeFit.id, screen: 'workshop' }); }}>{state.selectedEquippedCostumeId === selectedCostumeFit.id ? 'Wearing · open fitting room' : state.authority.cosmeticUnlocks[selectedCostumeFit.id] ? 'Try on in fitting room' : 'Locked · preview only'}</Button>}{selectedCostumeFit && <Button secondary onPress={() => { setWorkshopPreviewCostumeId(selectedCostumeFit.id); update({ screen: 'workshop' }); }}>Preview in fitting room</Button>}{selectedCostumeFit && state.selectedEquippedCostumeId === selectedCostumeFit.id && <Button secondary onPress={() => update({ selectedEquippedCostumeId: null })}>Take off</Button>}</View> : <View style={s.progressPanel}><Text style={s.eyebrow}>HEDGE RUN · DIGITAL QUICK PLAY</Text>{quick(selected) ? <><Text style={s.body}>{quick(selected)!.slot} · Guard {quick(selected)!.guard} · Search {quick(selected)!.search}</Text><Text style={s.caption}>Both pigs borrow the same kit. This changes only your illustration and finish.</Text><Button secondary onPress={() => { update({ look: selected }); startPractice(); }}>Try this look in Practice</Button></> : <Text style={s.body}>Collection card. This identity is not in the borrowed Hedge Run kit yet.</Text>}</View>}{!selectedCard.unlock && !!state.authority.copies[selected] && !state.authority.finishes[selected]?.includes('foil') && <Button onPress={() => { update({ authority: selectFoilGoal(current.current.authority, selected) }); setMessage(`Foil goal set: ${name(selected)}. Your banked progress stays.`); }}>Make this my foil goal</Button>}<Button secondary onPress={() => goto('album')}>Back to your album</Button></View>}
    {state.screen === 'deck' && <DeckBuilder deck={state.deck} copies={state.authority.copies} onChange={deck => { setMessage(''); update({ deck }); }} onSave={() => { void persist(current.current).then(() => setMessage('Deck plan saved on this device. Your collection stays yours.')).catch(() => setMessage('This device could not save the deck. Please try again.')); }} onInspect={id => { setSelected(id); goto('sleeve'); }}/> }
    {state.screen === 'practice' && run && <View style={s.section}><Tag color={C.sage}>{state.challenge ? `LOCAL CHALLENGE DEMO · ${state.challenge.friendId}` : 'SOLO PRACTICE · DIGITAL QUICK PLAY'}</Tag><Text style={s.title}>Hedge Run</Text><Text style={s.lede}>Borrow twelve cards. Make six little choices. See what you find.</Text><Text style={s.caption}>No currencies, inventory, rankings, or real invitations change.</Text><View style={s.stats}><Tag color={C.rose}>{run.cheer} Cheer</Tag><Tag>{totals!.guard} Guard</Tag><Tag color={C.sun}>{totals!.search} Search</Tag><Tag color={C.lilac}>{run.discoveries.length} Discoveries</Tag></View><View accessibilityLiveRegion="polite"><Text style={s.body}>{lastRound}</Text></View>{run.status === 'active' ? <><View style={s.event}><Text style={s.eyebrow}>ROUND {run.round} OF 6</Text><Text style={s.subheading}>{event?.name}</Text><Text style={s.body}>Danger {event?.danger} · Search {event?.searchTarget} to find {event?.discovery}</Text><Text style={s.caption}>{nextEvent ? `Next: ${nextEvent.name} · Danger ${nextEvent.danger} · Search ${nextEvent.searchTarget}` : 'The last stretch. Make it count.'}</Text></View><View style={s.loadout}>{(['head','held','aura','critter'] as const).map(slot => <View style={s.slot} key={slot}><Text style={s.eyebrow}>{slot}</Text><Text style={s.body}>{run.slots[slot] ? name(run.slots[slot]!) : 'Empty'}</Text></View>)}</View><Text style={s.subheading}>Choose from your hand</Text><ScrollView horizontal contentContainerStyle={s.handRow}>{run.hand.map(id => { const lookFinish: CardFinish = state.look === id ? (state.authority.finishes[id]?.includes('living') ? 'living' : state.authority.finishes[id]?.includes('foil') ? 'foil' : 'standard') : 'standard'; return <Pressable key={id} accessibilityRole="button" accessibilityLabel={`Select ${name(id)}${state.look === id ? `, chosen ${finishLabel(lookFinish)} look` : ''}`} accessibilityState={{ selected: handId === id, disabled: choiceBusy }} disabled={choiceBusy} onPress={() => setSelectedHand(id)} style={[s.handCard, handId === id && s.selectedHand]}><CardArt id={id} compact finish={lookFinish}/><Text style={s.body}>Guard {quick(id)?.guard} · Search {quick(id)?.search}</Text>{state.look === id && <Text style={s.caption}>Your selected {finishLabel(lookFinish).toLowerCase()} look</Text>}</Pressable>; })}</ScrollView>{handCard && <View style={s.decision}><Text style={s.subheading}>{name(handCard.cardId)}</Text><Text style={s.body}>Play into {handCard.slot}{run.slots[handCard.slot] ? `, replacing ${name(run.slots[handCard.slot]!)}` : ''}. Or Train for +1 Search in every remaining round.</Text><View style={s.row}><Button disabled={choiceBusy} onPress={() => choose('play')}>{choiceBusy ? 'Saving choice…' : `Play · ${handCard.guard} Guard / ${handCard.search} Search`}</Button><Button secondary disabled={choiceBusy || run.trainingIds.length >= 2} onPress={() => choose('train')}>Train · +1 Search ({run.trainingIds.length}/2)</Button></View><Text style={s.caption}>Danger takes Cheer first. Find the discovery only if you survive.</Text></View>}</> : <View style={s.progressPanel}><Text style={s.title}>{run.cheer ? 'Home with a story.' : 'A muddy escape.'}</Text><Text style={s.lede}>{run.discoveries.length} Discoveries · {run.cheer} Cheer</Text><Text style={s.body}>{run.discoveries.join(' · ') || 'An adventure is still an adventure.'}</Text><Text style={s.caption}>Active time on this device: {Math.round(state.activeMs / 1000)} seconds. The 2–3 minute target needs player testing.</Text>{comparison && <><Text style={s.subheading}>{comparison.result ? comparison.result === 'draw' ? 'A draw. Two good adventures.' : comparison.result === 'win' ? 'Your pig found the edge.' : `${state.challenge!.friendId} found the edge.` : `${state.challenge!.friendId}'s score is sealed.`}</Text><Text style={s.body}>{comparison.friendScore ? `${state.challenge!.friendId}: ${comparison.friendScore.discoveries} Discoveries / ${comparison.friendScore.cheer} Cheer` : 'You are done. Come back when both pigs have finished.'}</Text></>}<Button onPress={() => startPractice()}>Another solo practice</Button><Button secondary onPress={() => goto('album')}>Back to the album</Button></View>}</View>}
    <View style={s.footer}><Text style={s.caption}>A local, persistent playtest. Demo rewards stay on this device.</Text><View style={s.toggle}><Text style={s.body}>Reduce motion</Text><Switch accessibilityLabel="Reduce motion" value={reduceMotion} onValueChange={setReduceMotion}/></View><View style={s.toggle}><Text style={s.body}>Haptics</Text><Switch accessibilityLabel="Haptics" value={haptics} onValueChange={setHaptics}/></View><View style={s.toggle}><Text style={s.body}>Sound</Text><Switch accessibilityLabel="Sound" value={sound} onValueChange={setSound}/></View><Button secondary onPress={() => setReview(!review)}>{review ? 'Hide review controls' : 'Review scenarios'}</Button>{review && <View style={s.review}><Text style={s.subheading}>Playtest controls</Text><Text accessibilityLiveRegion="polite" style={s.caption}>{runtimeStatus}</Text><Text style={s.caption}>Visual signals: {visualSignals.join(' · ') || 'none observed yet'}</Text><Button secondary onPress={() => fixture('dig-demo')}>Simulate an earned Dig packet</Button><Button secondary onPress={() => fixture('all-repeat')}>All-repeat packet</Button><Button secondary onPress={() => fixture('tenth-pack')}>Tenth-opening fast path</Button><Button secondary onPress={() => { setFailure('before'); setMessage('Next opening will fail before its local commit.'); }}>Fail next opening before commit</Button><Button secondary onPress={() => { setFailure('after'); setMessage('Next opening will save its receipt, then lose its response.'); }}>Lose response after commit</Button><View style={s.toggle}><Text style={s.body}>Static renderer</Text><Switch accessibilityLabel="Static renderer" value={staticMode} onValueChange={setStaticMode}/></View><TextInput accessibilityLabel="Demo friend's name" value={friendName} onChangeText={setFriendName} style={s.input}/><Button secondary onPress={() => startPractice(true)}>Start named-friend demo</Button>{state.challenge && <Button secondary onPress={simulateFriend}>Simulate friend finishing</Button>}<Text style={s.caption}>These controls never send an invitation or grant a real reward.</Text></View>}</View>
  </ScrollView></SafeAreaView>;
}

const s = StyleSheet.create({
  performanceWrap: { width: '100%', maxWidth: 390 },
  page: { flex: 1, backgroundColor: C.cream }, pageContent: { padding: 20, paddingBottom: 60, gap: 24, width: '100%', maxWidth: 1120, alignSelf: 'center' }, loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.cream },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderBottomWidth: 2, borderColor: C.ink, paddingBottom: 20 }, brand: { fontFamily: FONTS.whimsy, fontSize: 24, color: C.ink }, navigation: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  center: { width: '100%', maxWidth: 600, alignSelf: 'center', alignItems: 'center', gap: 20 }, section: { gap: 20 }, title: { fontFamily: FONTS.whimsy, fontSize: 38, lineHeight: 46, color: C.ink }, mobileTitle: { fontSize: 32, lineHeight: 38 }, lede: { fontFamily: FONTS.body, fontSize: 18, lineHeight: 27, color: C.mute, maxWidth: 570 }, body: { fontFamily: FONTS.body, fontSize: 16, lineHeight: 24, color: C.ink }, caption: { fontFamily: FONTS.bodySemi, fontSize: 14, lineHeight: 21, color: C.mute }, eyebrow: { fontFamily: FONTS.bodyExtra, fontSize: 13, lineHeight: 20, color: C.mute, letterSpacing: 1 }, handwritten: { fontFamily: FONTS.hand, fontSize: 24, color: C.ink }, subheading: { fontFamily: FONTS.whimsy, fontSize: 23, lineHeight: 29, color: C.ink },
  button: { minHeight: 48, paddingVertical: 13, paddingHorizontal: 20, borderWidth: 2, borderColor: C.ink, borderRadius: 24, backgroundColor: C.sun, alignItems: 'center', justifyContent: 'center', ...shadow }, buttonText: { fontFamily: FONTS.bodyExtra, fontSize: 16, lineHeight: 22, color: C.ink, textAlign: 'center' }, secondary: { backgroundColor: C.paper, boxShadow: `2px 3px 0 ${C.ink}` }, disabled: { opacity: 0.5 }, pressed: { transform: [{ translateY: 2 }], boxShadow: `1px 1px 0 ${C.ink}` }, tag: { alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 10, borderWidth: 1.5, borderColor: C.ink, borderRadius: 5 }, tagText: { fontFamily: FONTS.bodyExtra, fontSize: 12, lineHeight: 18, color: C.ink }, row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', alignItems: 'center' },
  packet: { width: 252, height: 348, backgroundColor: C.tape, borderWidth: 2, borderColor: C.ink, borderRadius: 7, padding: 20, alignItems: 'center', transform: [{ rotate: '-3deg' }], boxShadow: `8px 9px 0 ${C.cream2}`, overflow: 'hidden', margin: 12 }, seam: { height: 10, alignSelf: 'stretch', borderTopWidth: 2, borderStyle: 'dashed', borderColor: C.ink }, tearFill: { height: 6, backgroundColor: C.paper }, packetKicker: { fontFamily: FONTS.bodyExtra, fontSize: 13, letterSpacing: 2, marginTop: 10 }, packetPig: { width: 178, height: 150, marginVertical: 8, borderRadius: 80 }, packetTitle: { fontFamily: FONTS.whimsy, fontSize: 25, lineHeight: 29, textAlign: 'center', color: C.ink }, packetFoot: { fontFamily: FONTS.hand, fontSize: 18, color: C.ink, marginTop: 10 }, tearArea: { paddingVertical: 12, touchAction: 'pan-y' },
  card: { width: 282, padding: 12, backgroundColor: C.paper, borderWidth: 2, borderColor: C.ink, borderRadius: 14, gap: 7, boxShadow: `5px 6px 0 ${C.ink}` }, smallCard: { width: '100%', padding: 8, gap: 5, borderRadius: 10, boxShadow: `2px 3px 0 ${C.ink}` }, cardHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 }, cardNumber: { fontFamily: FONTS.bodyExtra, fontSize: 13, lineHeight: 18, color: C.mute }, art: { width: '100%', height: 240, backgroundColor: C.cream2, borderWidth: 1, borderColor: C.ink, borderRadius: 6 }, smallArt: { height: 125 }, cardName: { fontFamily: FONTS.whimsy, color: C.ink, fontSize: 23, lineHeight: 29 }, smallName: { fontFamily: FONTS.whimsy, fontSize: 16, lineHeight: 21, color: C.ink }, cardType: { fontFamily: FONTS.body, fontSize: 13, lineHeight: 18, color: C.mute }, foilCard: { backgroundColor: C.sun, borderColor: C.goldInk }, livingCard: { backgroundColor: C.lilac },
  seasonalConcept: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', padding: 18, gap: 14 }, seasonalGlyph: { fontFamily: FONTS.whimsy, fontSize: 88, lineHeight: 98 }, seasonalConceptLabel: { fontFamily: FONTS.bodyExtra, fontSize: 11, lineHeight: 16, letterSpacing: 1, color: C.paper, textAlign: 'center' },
  shelf: { flexDirection: 'row', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }, shelfItem: { gap: 16, alignItems: 'center', width: '100%', maxWidth: 310, padding: 8 }, receiptGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, alignSelf: 'stretch', justifyContent: 'center' }, receiptCard: { width: '44%', maxWidth: 170, gap: 10 }, progressPanel: { backgroundColor: C.paper, borderWidth: 2, borderColor: C.ink, borderRadius: 12, padding: 20, gap: 12, alignSelf: 'stretch' }, albumGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 }, albumCard: { width: '44%', maxWidth: 180, gap: 10 }, missing: { minHeight: 235, backgroundColor: C.cream2, borderStyle: 'dashed', borderWidth: 2, borderColor: C.muteSoft, borderRadius: 10, padding: 14, justifyContent: 'center', gap: 12 }, missingNumber: { fontFamily: FONTS.whimsy, fontSize: 40, color: C.muteSoft }, input: { backgroundColor: C.paper, borderWidth: 2, borderColor: C.ink, borderRadius: 10, padding: 14, fontSize: 16, fontFamily: FONTS.body, color: C.ink }, toggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 }, stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, event: { backgroundColor: C.sage, padding: 20, borderWidth: 2, borderColor: C.ink, borderRadius: 12, gap: 8 }, loadout: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, slot: { width: '46%', padding: 12, backgroundColor: C.cream2, borderRadius: 8, gap: 5 }, handRow: { gap: 16, paddingVertical: 12, paddingHorizontal: 4 }, handCard: { width: 170, gap: 10, padding: 5, borderWidth: 3, borderColor: 'transparent', borderRadius: 14 }, selectedHand: { borderColor: C.accent }, decision: { gap: 16, padding: 20, backgroundColor: C.paper, borderRadius: 12, borderWidth: 2, borderColor: C.ink }, footer: { borderTopWidth: 2, borderColor: C.ink, paddingTop: 24, gap: 16, maxWidth: 600, width: '100%', alignSelf: 'center' }, review: { gap: 16, padding: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: C.mute, borderRadius: 10 }, notice: { padding: 16, borderWidth: 2, borderColor: C.ink, backgroundColor: C.sun, borderRadius: 10 },
});

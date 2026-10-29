import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { FONTS, WHIMSY as C } from '../../../constants/theme';
import { useMotionPolicy } from '../../../hooks/useMotionPolicy';
import { SPOOKY_SNOUTS_ART_SOURCES } from '../../../features/cards/data/seasonalCardArt';
import { SPOOKY_SNOUTS_BY_ID } from '../../../features/cards/data/seasonalCatalog';
import CostumeFittingRoom from './CostumeFittingRoom';
import SpookyTraderMiniGame from './SpookyTraderMiniGame';
import { CollectibleCard } from './CollectibleCard';
import {
  HALLOWEEN_TRADING_DEMO_SEED,
  cancelSeasonalTrade,
  confirmSeasonalTrade,
  createSeasonalTradingDemo,
  expireSeasonalTrades,
  openSeasonalTrade,
  reconstructSeasonalTrading,
  reviseSeasonalTrade,
  type SeasonalTrade,
  type SeasonalTradeFinish,
  type SeasonalTradingState,
} from '../../../features/cards/domain/seasonalTrading';

const STORAGE_KEY = 'ttp.halloween-workshop.demo.v1';
const TRADE_ID = 'night-two-witch-for-jack';
const WITCH = 'halloween_2026_card_moonbrew_witch_hat';
const JACK = 'halloween_2026_card_hollow_jack_costume';
const PORCH = 'halloween_2026_card_lantern_porch_bg';
const LITTLE_HAUNT = 'halloween_2026_card_little_haunt';
const TTL_MS = 15 * 60 * 1000;

type SavedWorkshop = { receipts?: unknown[] };

const ART_FALLBACKS: Readonly<Record<string, ImageSourcePropType>> = {
  [JACK]: require('../../../assets/images/trading-cards/halloween-2026/035-halloween-2026-hollow-jack-costume-card-v2.png'),
  [LITTLE_HAUNT]: require('../../../assets/images/trading-cards/halloween-2026/038-halloween-2026-little-haunt-card-v1.png'),
};

const labelByCard: Readonly<Record<string, string>> = {
  [WITCH]: 'Moonbrew Witch Hat',
  [JACK]: 'Hollow Jack',
  [PORCH]: 'Lantern Porch',
};

function asset(cardId: string, finish: 'standard' | 'foil' = 'standard') {
  return { cardId, finish, quantity: 1 } as const;
}

function openDefault(state: SeasonalTradingState, witchFinish: 'standard' | 'foil' = 'standard'): SeasonalTradingState {
  return openSeasonalTrade(state, {
    tradeId: TRADE_ID,
    proposerId: 'rosie',
    recipientId: 'pippin',
    proposerGives: asset(WITCH, witchFinish),
    recipientGives: asset(JACK),
    ttlMs: TTL_MS,
  });
}

function rebuild(saved: SavedWorkshop | null): SeasonalTradingState {
  let state = reconstructSeasonalTrading(HALLOWEEN_TRADING_DEMO_SEED, saved?.receipts ?? []);
  if (Object.keys(state.receipts).length) return state;
  return openDefault(state);
}

async function saveWorkshop(state: SeasonalTradingState): Promise<void> {
  const value: SavedWorkshop = { receipts: Object.values(state.receipts) };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function Button({ children, onPress, secondary = false, disabled = false }: { children: React.ReactNode; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={typeof children === 'string' ? children : undefined} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondaryButton, disabled && s.disabled, pressed && s.pressed]}><Text style={s.buttonText}>{children}</Text></Pressable>;
}

function Seal({ ready, name }: { ready: boolean; name: string }) {
  return <View accessibilityLabel={`${name} is ${ready ? 'ready' : 'not ready'}`} style={[s.seal, ready && s.readySeal]}><Text style={s.sealName}>{name}</Text><Text style={s.sealStatus}>{ready ? 'READY' : 'CHECKING OFFER'}</Text></View>;
}

function OfferCard({ owner, cardId, finish, inventory, mode = 'offered' }: { owner: string; cardId: string; finish: SeasonalTradeFinish; inventory: string; mode?: 'offered' | 'received' }) {
  const source = SPOOKY_SNOUTS_ART_SOURCES[cardId] ?? ART_FALLBACKS[cardId];
  const card = SPOOKY_SNOUTS_BY_ID.get(cardId);
  return <View style={s.offerColumn}>
    <Text style={s.owner}>{owner}</Text>
    {card ? <CollectibleCard card={card} artSource={source} finish={finish} variant="compact"/> : <View style={s.cardFrame}>{source ? <Image source={source} resizeMode="contain" style={s.cardArt} accessibilityLabel={`${labelByCard[cardId]} card artwork`}/> : <View style={s.missingArt}><Text style={s.missingArtText}>CARD ART PENDING</Text></View>}</View>}
    <Text style={s.offerTitle}>{labelByCard[cardId] ?? cardId}</Text>
    <View style={s.finishRow}><Text style={s.finish}>{finish.toUpperCase()}</Text><Text style={s.quantity}>{mode === 'received' ? '1 RECEIVED' : '1 OFFERED'}</Text></View>
    <Text style={s.inventory}>{mode === 'received' ? inventory : `${inventory} owned before swap`}</Text>
  </View>;
}

function activeTrade(state: SeasonalTradingState): SeasonalTrade | undefined {
  return state.trades[TRADE_ID];
}

export default function HalloweenWorkshop({ onBack, reduceMotion: motionOverride, ownedCostumeIds = [], equippedCostumeId = null, onEquipCostume = () => undefined, initialPreviewCostumeId = null }: { onBack: () => void; reduceMotion?: boolean; ownedCostumeIds?: readonly string[]; equippedCostumeId?: string | null; onEquipCostume?: (costumeId: string | null) => void; initialPreviewCostumeId?: string | null }) {
  const [authority, setAuthority] = useState<SeasonalTradingState>(() => openDefault(createSeasonalTradingDemo(HALLOWEEN_TRADING_DEMO_SEED)));
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [spooked, setSpooked] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [hauntReveal] = useState(() => new Animated.Value(0));
  const motionPolicy = useMotionPolicy();
  const reduceMotion = motionOverride ?? motionPolicy.reduceMotion;
  const trade = activeTrade(authority);
  const receipt = Object.values(authority.receipts).at(-1);
  const completed = trade?.status === 'completed' || Boolean(receipt);
  const rosieReady = Boolean(trade && trade.confirmations.rosie === trade.revision);
  const pippinReady = Boolean(trade && trade.confirmations.pippin === trade.revision);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      const parsed = raw ? JSON.parse(raw) as SavedWorkshop : null;
      setAuthority(rebuild(parsed));
    }).catch(() => setMessage('The trade mat could not read its saved receipt. A fresh local offer is ready.')).finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    const animation = Animated.timing(hauntReveal, {
      toValue: spooked ? 1 : 0,
      duration: reduceMotion ? 0 : spooked ? 260 : 160,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [hauntReveal, reduceMotion, spooked]);

  const commit = (next: SeasonalTradingState, nextMessage = '') => {
    setAuthority(next);
    setMessage(nextMessage);
    void saveWorkshop(next).catch(() => setMessage('Keep this page open. The local trade could not be saved.'));
  };

  const primary = () => {
    if (!trade || trade.status !== 'pending') return;
    try {
      const participantId = rosieReady ? 'pippin' : 'rosie';
      const result = confirmSeasonalTrade(authority, { tradeId: trade.tradeId, participantId, revision: trade.revision });
      const resultingTrade = result.state.trades[trade.tradeId];
      commit(result.state, result.receipt ? 'Swap complete. One receipt, both collections updated together.' : resultingTrade.status === 'expired' ? 'This offer expired before the final seal. Both pigs kept every card.' : 'Rosie sealed this exact revision. Pippin can check and seal the same offer.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'That seal could not be placed.'); }
  };

  const changeCard = () => {
    if (!trade || trade.status !== 'pending') return;
    try {
      const nextFinish = trade.proposerGives.finish === 'standard' ? 'foil' : 'standard';
      const next = reviseSeasonalTrade(authority, { tradeId: trade.tradeId, proposerId: 'rosie', expectedRevision: trade.revision, proposerGives: asset(WITCH, nextFinish), recipientGives: asset(JACK) });
      commit(next, `Offer changed to the ${nextFinish} Witch. Both ready seals were cleared for revision ${next.trades[TRADE_ID].revision}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The offer could not be changed.'); }
  };

  const reset = () => {
    const next = openDefault(createSeasonalTradingDemo(HALLOWEEN_TRADING_DEMO_SEED));
    commit(next, 'Fresh local offer laid on the mat.');
  };

  const replay = () => {
    if (!trade || trade.status !== 'completed') return;
    try {
      const result = confirmSeasonalTrade(authority, { tradeId: trade.tradeId, participantId: 'pippin', revision: trade.revision });
      commit(result.state, result.receipt?.receiptId === receipt?.receiptId ? 'Replay returned the same receipt. No card or unlock moved twice.' : 'Replay check completed.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Replay check failed.'); }
  };

  const expireDemo = () => {
    try {
      let next = createSeasonalTradingDemo(HALLOWEEN_TRADING_DEMO_SEED);
      next = openSeasonalTrade(next, { tradeId: TRADE_ID, proposerId: 'rosie', recipientId: 'pippin', proposerGives: asset(WITCH), recipientGives: asset(JACK), ttlMs: 10 }, () => 100);
      next = expireSeasonalTrades(next, () => 111);
      setAuthority(next);
      setMessage('The review offer expired untouched. Both pigs kept every card.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Expiry review failed.'); }
  };

  const inventory = useMemo(() => {
    const witch = authority.players.rosie.inventory[WITCH] ?? {};
    const jack = authority.players.pippin.inventory[JACK] ?? {};
    return { witch: `${witch.standard ?? 0} standard + ${witch.foil ?? 0} foil`, jack: `${jack.standard ?? 0} standard + ${jack.foil ?? 0} foil` };
  }, [authority]);

  if (!loaded) return <View style={s.loading}><Text style={s.body}>Unrolling the trade mat…</Text></View>;

  return <View style={s.page}>
    <View style={s.headingRow}><View style={s.headingCopy}><Text style={s.title}>Night Two at the Workshop</Text><Text style={s.lede}>A personal errand for Old Wisp, a wearable swap with a friend, and a pumpkin suit fitted around Rosie.</Text></View><Button secondary onPress={onBack}>Back to Spooky Album</Button></View>
    <View style={s.localNote}><Text style={s.localNoteTitle}>LOCAL TWO-PIG DEMO</Text><Text style={s.localNoteText}>No invitation, message, server reward, or production inventory change is created.</Text></View>

    <SpookyTraderMiniGame/>
    <Text style={s.showcaseTitle}>Earlier card-copy exchange workbench</Text>
    {!completed ? <View style={s.tradeMat}>
      <Text style={s.revision}>OFFER REVISION {trade?.revision ?? 1} · FIXED 15-MINUTE DEMO EXPIRY</Text>
      <View style={s.offers}>
        <OfferCard owner="ROSIE GIVES" cardId={WITCH} finish={trade?.proposerGives.finish ?? 'standard'} inventory={inventory.witch}/>
        <View style={s.swapMark}><Text style={s.swapMarkText}>SWAP</Text></View>
        <OfferCard owner="PIPPIN GIVES" cardId={JACK} finish="standard" inventory={inventory.jack}/>
      </View>
      <Text style={s.keepCopy}>Only exact-finish spares can sit on this mat. Each pig keeps at least one copy of every card identity.</Text>
      <View style={s.seals}><Seal name="Rosie" ready={rosieReady}/><Seal name="Pippin" ready={pippinReady}/></View>
      <Button disabled={trade?.status !== 'pending'} onPress={primary}>{rosieReady ? 'Seal as Pippin & complete swap' : 'Seal this offer as Rosie'}</Button>
      <View style={s.actionRow}><Button secondary disabled={trade?.status !== 'pending'} onPress={changeCard}>Change my card</Button><Button secondary disabled={trade?.status !== 'pending'} onPress={() => trade && commit(cancelSeasonalTrade(authority, trade.tradeId, 'rosie'), 'Offer cancelled. Both pigs kept every card.')}>Cancel offer</Button></View>
      {(trade?.status === 'cancelled' || trade?.status === 'expired') && <Button onPress={reset}>{trade.status === 'expired' ? 'Lay out a new offer' : 'Lay out a fresh offer'}</Button>}
    </View> : <View style={s.doneMat}>
      <Text style={s.doneTitle}>Tucked into the right albums.</Text>
      <Text style={s.lede}>The second matching seal committed both sides together.</Text>
      <View style={s.receivedRow}><OfferCard owner="ROSIE RECEIVED" cardId={JACK} finish="standard" inventory="First copy · costume unlocked" mode="received"/><OfferCard owner="PIPPIN RECEIVED" cardId={WITCH} finish={receipt?.transfers[0].asset.finish ?? 'standard'} inventory="First copy · wardrobe unlocked" mode="received"/></View>
      <View style={s.unlockNote}><Text style={s.unlockTitle}>Hollow Jack permanently unlocked</Text><Text style={s.body}>Rosie's Moonbrew wardrobe stays owned. Trading a spare card never removes an already unlocked cosmetic.</Text><Text style={s.caption}>Rosie kept {inventory.witch} Moonbrew Witch Hat · Pippin kept {inventory.jack} Hollow Jack.</Text></View>
    </View>}

    <View style={s.showcase}>
      <View style={s.baseline}><Text style={s.showcaseTitle}>Rosie, underneath it all</Text><Image source={require('../../../assets/images/sprites/rosie/idle_1.png')} style={s.pig} resizeMode="contain" accessibilityLabel="Rosie without a costume"/><Text style={s.caption}>Baseline pig identity stays intact.</Text></View>
      <View style={s.costumeConcept}><Text style={s.showcaseTitle}>Hollow Jack · Rosie fit reference</Text><Image source={SPOOKY_SNOUTS_ART_SOURCES[JACK] ?? ART_FALLBACKS[JACK]} style={s.costumeCard} resizeMode="contain" accessibilityLabel="Hollow Jack card concept preview"/><Text style={s.caption}>A broad hood and short romper made for Rosie. Live front-idle fitting is shown below; other pigs and poses remain pending.</Text><Text style={s.body}>Try on and Take off change Rosie's look in this fitting room.</Text></View>
    </View>
    <CostumeFittingRoom ownedCostumeIds={ownedCostumeIds} equippedCostumeId={equippedCostumeId} onEquip={onEquipCostume} initialPreviewCostumeId={initialPreviewCostumeId} active={loaded} reduceMotion={reduceMotion}/>

    <View style={s.spookStrip}>
      <View style={s.visitStage} accessibilityLabel={spooked ? 'Local visit preview with Rosie, Bandit, and Little Haunt' : 'Local visit preview with Rosie and Bandit'}>
        <View style={s.visitPig}><Image source={require('../../../assets/images/sprites/rosie/idle_1.png')} style={s.visitPigImage} resizeMode="contain" accessibilityLabel="Rosie"/><Text style={s.visitName}>Rosie</Text></View>
        <Animated.View accessibilityElementsHidden={!spooked} importantForAccessibility={spooked ? 'yes' : 'no-hide-descendants'} style={[s.hauntPop, { opacity: hauntReveal, transform: [{ translateY: hauntReveal.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}>
          <Image source={SPOOKY_SNOUTS_ART_SOURCES[LITTLE_HAUNT] ?? ART_FALLBACKS[LITTLE_HAUNT]} style={s.spookArt} resizeMode="contain" accessibilityLabel="Little Haunt pops up between the pigs"/>
        </Animated.View>
        <View style={s.visitPig}><Image source={require('../../../assets/images/pigs/normalized/bandit-v2.png')} style={s.visitPigImage} resizeMode="contain" accessibilityLabel="Bandit"/><Text style={s.visitName}>Bandit</Text></View>
      </View>
      <View style={s.spookCopy}><Text style={s.showcaseTitle}>Bring a Little Haunt</Text><Text style={s.body}>{spooked ? 'A friendly bog spirit pops up between the pigs. Bandit gets one tiny ghostly hello.' : 'During this local friend-visit preview, tap Spook to call up a playful apparition.'}</Text><Text style={s.caption}>Playful interaction only · no friend call, stats, currency, drop-rate, or race boost.</Text></View>
      <Button onPress={() => setSpooked(value => !value)}>{spooked ? 'Send the haunt home' : 'Spook'}</Button>
    </View>

    {!!message && <View accessibilityRole="alert" style={s.message}><Text style={s.body}>{message}</Text></View>}
    <Button secondary onPress={() => setShowReview(value => !value)}>{showReview ? 'Hide edge-case proofs' : 'Show edge-case proofs'}</Button>
    {showReview && <View style={s.review}><Text style={s.showcaseTitle}>Receipts from the workbench</Text><Button secondary disabled={!completed} onPress={replay}>Replay final confirmation</Button><Button secondary onPress={expireDemo}>Demonstrate expiry</Button><Button secondary onPress={reset}>Reset local trade demo</Button><Text style={s.caption}>Cancel and expiry leave both inventories untouched. Receipt replay returns the original result.</Text></View>}
  </View>;
}

const hardShadow = { boxShadow: `4px 5px 0 ${C.ink}` };
const s = StyleSheet.create({
  page: { gap: 24 }, loading: { minHeight: 280, justifyContent: 'center', alignItems: 'center' },
  headingRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start' }, headingCopy: { gap: 8, flex: 1, minWidth: 260 },
  title: { fontFamily: FONTS.whimsy, fontSize: 38, lineHeight: 44, color: C.ink }, lede: { fontFamily: FONTS.body, fontSize: 18, lineHeight: 26, color: C.mute, maxWidth: 650 }, body: { fontFamily: FONTS.body, fontSize: 15, lineHeight: 21, color: C.ink }, caption: { fontFamily: FONTS.bodySemi, fontSize: 13, lineHeight: 19, color: C.mute },
  localNote: { backgroundColor: C.bark, padding: 14, borderRadius: 12, gap: 3 }, localNoteTitle: { fontFamily: FONTS.bodyExtra, fontSize: 12, letterSpacing: 1.4, color: C.barkText }, localNoteText: { fontFamily: FONTS.body, fontSize: 14, lineHeight: 20, color: C.barkMute },
  tradeMat: { backgroundColor: C.tape, borderWidth: 2, borderColor: C.ink, borderRadius: 14, padding: 20, gap: 20, ...hardShadow }, doneMat: { backgroundColor: C.sage, borderWidth: 2, borderColor: C.ink, borderRadius: 14, padding: 20, gap: 18, ...hardShadow },
  revision: { fontFamily: FONTS.bodyExtra, fontSize: 12, letterSpacing: 1.2, color: C.mute, textAlign: 'center' }, offers: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 18 }, receivedRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 28 },
  offerColumn: { width: 250, alignItems: 'center', gap: 8 }, owner: { fontFamily: FONTS.bodyExtra, fontSize: 13, letterSpacing: 1.1, color: C.ink }, cardFrame: { width: 220, height: 305, backgroundColor: C.paper, borderWidth: 2, borderColor: C.ink, borderRadius: 12, padding: 6, transform: [{ rotate: '-1deg' }], ...hardShadow }, cardArt: { width: '100%', height: '100%' }, missingArt: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.cream2 }, missingArtText: { fontFamily: FONTS.bodyExtra, color: C.mute }, offerTitle: { fontFamily: FONTS.whimsy, fontSize: 19, lineHeight: 24, color: C.ink, textAlign: 'center' }, finishRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }, finish: { fontFamily: FONTS.bodyExtra, fontSize: 11, letterSpacing: 1, color: C.ink, backgroundColor: C.lilac, borderRadius: 5, paddingVertical: 4, paddingHorizontal: 8 }, quantity: { fontFamily: FONTS.body, fontSize: 12, color: C.ink, backgroundColor: C.paper, borderRadius: 5, paddingVertical: 4, paddingHorizontal: 8 }, inventory: { fontFamily: FONTS.bodySemi, fontSize: 12, lineHeight: 17, color: C.mute, textAlign: 'center' },
  swapMark: { width: 62, height: 62, borderRadius: 31, backgroundColor: C.sun, borderWidth: 2, borderColor: C.ink, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '4deg' }] }, swapMarkText: { fontFamily: FONTS.bodyExtra, fontSize: 12, color: C.ink }, keepCopy: { fontFamily: FONTS.hand, fontSize: 17, lineHeight: 23, color: C.ink, textAlign: 'center' },
  seals: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 }, seal: { minWidth: 150, backgroundColor: C.cream2, borderWidth: 2, borderStyle: 'dashed', borderColor: C.muteSoft, borderRadius: 40, paddingVertical: 10, paddingHorizontal: 18, alignItems: 'center', transform: [{ rotate: '-2deg' }] }, readySeal: { backgroundColor: C.sage, borderStyle: 'solid', borderColor: C.ink }, sealName: { fontFamily: FONTS.whimsy, fontSize: 17, color: C.ink }, sealStatus: { fontFamily: FONTS.bodyExtra, fontSize: 10, letterSpacing: 1, color: C.mute },
  button: { minHeight: 46, paddingVertical: 12, paddingHorizontal: 18, backgroundColor: C.sun, borderWidth: 2, borderColor: C.ink, borderRadius: 23, justifyContent: 'center', alignItems: 'center', boxShadow: `2px 3px 0 ${C.ink}` }, secondaryButton: { backgroundColor: C.paper }, disabled: { opacity: 0.5 }, pressed: { transform: [{ translateY: 2 }], boxShadow: `1px 1px 0 ${C.ink}` }, buttonText: { fontFamily: FONTS.bodyExtra, fontSize: 15, lineHeight: 20, color: C.ink, textAlign: 'center' }, actionRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  doneTitle: { fontFamily: FONTS.whimsy, fontSize: 30, lineHeight: 36, color: C.ink }, unlockNote: { backgroundColor: C.paper, borderWidth: 2, borderColor: C.ink, borderRadius: 12, padding: 16, gap: 6 }, unlockTitle: { fontFamily: FONTS.whimsy, fontSize: 20, lineHeight: 25, color: C.ink },
  showcase: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 }, baseline: { flex: 1, minWidth: 250, backgroundColor: C.rose, borderWidth: 2, borderColor: C.ink, borderRadius: 14, padding: 18, alignItems: 'center', gap: 10, ...hardShadow }, costumeConcept: { flex: 2, minWidth: 280, backgroundColor: C.cream2, borderWidth: 2, borderColor: C.ink, borderRadius: 14, padding: 18, alignItems: 'center', gap: 10, ...hardShadow }, showcaseTitle: { fontFamily: FONTS.whimsy, fontSize: 20, lineHeight: 25, color: C.ink }, pig: { width: 220, height: 210 }, costumeCard: { width: 250, height: 340 },
  spookStrip: { gap: 16, alignItems: 'stretch', backgroundColor: C.lilac, borderWidth: 2, borderColor: C.ink, borderRadius: 14, padding: 16 }, visitStage: { minHeight: 190, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4, backgroundColor: C.paper, borderWidth: 2, borderColor: C.ink, borderRadius: 12, paddingHorizontal: 10, paddingTop: 10, overflow: 'hidden' }, visitPig: { width: '34%', maxWidth: 190, alignItems: 'center' }, visitPigImage: { width: '100%', height: 145 }, visitName: { fontFamily: FONTS.hand, fontSize: 17, lineHeight: 22, color: C.ink }, hauntPop: { width: '28%', maxWidth: 135, alignSelf: 'center', zIndex: 2 }, spookArt: { width: '100%', height: 150 }, spookCopy: { gap: 5 },
  message: { backgroundColor: C.sun, borderWidth: 2, borderColor: C.ink, borderRadius: 10, padding: 14 }, review: { backgroundColor: C.paper, borderWidth: 2, borderStyle: 'dashed', borderColor: C.mute, borderRadius: 12, padding: 16, gap: 12 },
});

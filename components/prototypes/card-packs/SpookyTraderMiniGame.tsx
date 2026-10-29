import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { FONTS, WHIMSY as C } from '../../../constants/theme';
import { SPOOKY_SNOUTS_ART_SOURCES } from '../../../features/cards/data/seasonalCardArt';
import { createSpookyTraderDemo, redeemSpookyTraderRequest, spookyTraderRequestFor, tradeSpookyWearables, type SpookyTraderState } from '../../../features/cards/domain/spookyTrader';

const SET = 'halloween_2026_v1';
const ITEMS = [
  { id: 'moonbrew_witch_hat', name: 'Moonbrew Witch Hat', cardId: 'halloween_2026_card_moonbrew_witch_hat' },
  { id: 'friendly_skull_facepaint', name: 'Bone Mask', cardId: 'halloween_2026_card_friendly_skull_facepaint' },
  { id: 'crossbones_bow', name: 'Crossbones Bow', cardId: 'halloween_2026_card_crossbones_bow' },
  { id: 'halloween_2026_pirate_tricorn_hat', name: 'Moonwake Tricorn', cardId: 'halloween_2026_card_pirate_tricorn_hat' },
] as const;
const ITEM_IDS = ITEMS.map(item => item.id);
const itemById = new Map(ITEMS.map(item => [item.id, item]));

function localDay(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function fixture(day: string) {
  const blank = (banditId: string) => createSpookyTraderDemo({ setKey: SET, eligibleWearableIds: ITEM_IDS, draftTickles: 7, players: [{ playerId: 'rosie', wearables: {} }, { playerId: banditId, wearables: {} }] });
  let banditId = 'bandit';
  let base = blank(banditId);
  const rosieWant = spookyTraderRequestFor(base, { playerId: 'rosie', day }).wearableId;
  for (let suffix = 0; spookyTraderRequestFor(base, { playerId: banditId, day }).wearableId === rosieWant; suffix += 1) {
    banditId = `bandit-${suffix + 1}`;
    base = blank(banditId);
  }
  const banditWant = spookyTraderRequestFor(base, { playerId: banditId, day }).wearableId;
  return {
    banditId,
    state: createSpookyTraderDemo({ setKey: SET, eligibleWearableIds: ITEM_IDS, draftTickles: 7, players: [{ playerId: 'rosie', wearables: { [banditWant]: 1 } }, { playerId: banditId, wearables: { [rosieWant]: 1 } }] }),
  };
}

function Button({ label, onPress, quiet = false, disabled = false }: { label: string; onPress: () => void; quiet?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, quiet && s.quietButton, disabled && s.disabled, pressed && s.pressed]}><Text style={s.buttonText}>{label}</Text></Pressable>;
}

function Wearable({ wearableId, caption }: { wearableId: string; caption: string }) {
  const item = itemById.get(wearableId as typeof ITEMS[number]['id']);
  const art = item ? SPOOKY_SNOUTS_ART_SOURCES[item.cardId] : undefined;
  return <View style={s.wearable}><View style={s.artFrame}>{art ? <Image source={art as ImageSourcePropType} style={s.art} resizeMode="contain" accessibilityLabel={`${item?.name} artwork`}/> : null}</View><Text style={s.itemName}>{item?.name ?? wearableId}</Text><Text style={s.caption}>{caption}</Text></View>;
}

function SpookyTraderMiniGameStory({ day }: { day: string }) {
  const setup = useMemo(() => fixture(day), [day]);
  const [authority, setAuthority] = useState<SpookyTraderState>(setup.state);
  const [viewer, setViewer] = useState<'rosie' | 'bandit'>('rosie');
  const [rosieReady, setRosieReady] = useState(false);
  const [banditReady, setBanditReady] = useState(false);
  const [swapped, setSwapped] = useState(false);
  const playerId = viewer === 'rosie' ? 'rosie' : setup.banditId;
  const otherId = viewer === 'rosie' ? setup.banditId : 'rosie';
  const name = viewer === 'rosie' ? 'Rosie' : 'Bandit';
  const otherName = viewer === 'rosie' ? 'Bandit' : 'Rosie';
  const request = spookyTraderRequestFor(authority, { playerId, day });
  const otherRequest = spookyTraderRequestFor(authority, { playerId: otherId, day });
  const requestItem = itemById.get(request.wearableId as typeof ITEMS[number]['id']);
  const done = Boolean(authority.dailyReceiptIds[`${playerId}:${day}`]);
  const ownsRequestedWearable = (authority.players[playerId].wearables[request.wearableId] ?? 0) > 0;
  const requestCaption = done ? 'handed to Old Wisp' : ownsRequestedWearable ? 'now in your wardrobe' : `currently with ${otherName}`;

  const agree = () => {
    if (!rosieReady || !banditReady || swapped) return;
    const result = tradeSpookyWearables(authority, { tradeId: `old-wisp-swap-${day}`, firstPlayerId: 'rosie', secondPlayerId: setup.banditId, firstGives: spookyTraderRequestFor(authority, { playerId: setup.banditId, day }).wearableId, secondGives: spookyTraderRequestFor(authority, { playerId: 'rosie', day }).wearableId });
    setAuthority(result.state); setSwapped(true);
  };
  const handOver = () => {
    const result = redeemSpookyTraderRequest(authority, { redemptionId: `old-wisp-${playerId}-${day}`, playerId, day });
    setAuthority(result.state);
  };

  return <View style={s.shell} testID="spooky-trader-mini-game">
    <View style={s.heading}><View style={s.titleCopy}><Text style={s.kicker}>OLD WISP'S DAILY ERRAND · {day}</Text><Text style={s.title}>A lantern is waiting at the hedge.</Text><Text style={s.lede}>Old Wisp wants a different wardrobe piece from each pig. Trade with a friend, then decide whether to let yours go.</Text></View><Image source={require('../../../assets/images/trader/ghost_sheep_b_glow.png')} style={s.wisp} resizeMode="contain" accessibilityLabel="Old Wisp glowing beside a lantern"/></View>
    <View style={s.demoNote}><Text style={s.demoTitle}>LOCAL TWO-PIG STORY</Text><Text style={s.demoText}>This does not contact a friend, change live equipment, or award real Tickles.</Text></View>
    <View style={s.switcher}><Button label="View as Rosie" quiet={viewer !== 'rosie'} onPress={() => setViewer('rosie')}/><Button label="View as Bandit" quiet={viewer !== 'bandit'} onPress={() => setViewer('bandit')}/></View>

    <View style={s.askCard}><View style={s.portraitWrap}><Image source={viewer === 'rosie' ? require('../../../assets/images/sprites/rosie/idle_1.png') : require('../../../assets/images/pigs/normalized/bandit-v2.png')} style={s.portrait} resizeMode="contain" accessibilityLabel={name}/><Text style={s.pigName}>{name}</Text></View><View style={s.askCopy}><Text style={s.sectionKicker}>TODAY, OLD WISP ASKS YOU FOR</Text><Text style={s.askName}>{requestItem?.name}</Text><Text style={s.hand}>“Bring me this before the lantern goes out.”</Text><Text style={s.caption}>{otherName}'s errand asks for {itemById.get(otherRequest.wearableId as typeof ITEMS[number]['id'])?.name}. Requests stay tied to each pig and day.</Text></View><Wearable wearableId={request.wearableId} caption={requestCaption}/></View>

    {!swapped ? <View style={s.tradeMat}><Text style={s.sectionTitle}>Lay both garments on the trade mat</Text><Text style={s.body}>This preview simulates a reply from your friend. Both ready marks must agree to the same two wearable identities; then both move together.</Text><View style={s.offers}><Wearable wearableId={spookyTraderRequestFor(authority, { playerId: setup.banditId, day }).wearableId} caption="Rosie gives"/><Text style={s.swapGlyph}>↔</Text><Wearable wearableId={spookyTraderRequestFor(authority, { playerId: 'rosie', day }).wearableId} caption="Bandit gives"/></View><View style={s.readyRow}><Button label={rosieReady ? 'Rosie ready ✓' : 'Mark Rosie ready'} quiet={!rosieReady} onPress={() => setRosieReady(value => !value)}/><Button label={banditReady ? 'Bandit ready ✓' : 'Simulate Bandit reply: ready'} quiet={!banditReady} onPress={() => setBanditReady(value => !value)}/></View><Button label="Review offer again · clear ready marks" quiet onPress={() => { setRosieReady(false); setBanditReady(false); }}/><Button label="Exchange both wearables" disabled={!rosieReady || !banditReady} onPress={agree}/></View> : !done ? <View style={s.handover}><Text style={s.sectionTitle}>The garment is yours now.</Text><Text style={s.warning}>This {requestItem?.name} leaves your wardrobe when you hand it over.</Text><Text style={s.body}>Its old card discovery stays in your album history, but that history will not mint the wearable again.</Text><Button label={`Hand ${requestItem?.name} to Old Wisp`} onPress={handOver}/></View> : <View style={s.receipt}><Text style={s.receiptKicker}>ERRAND DONE · SAME RECEIPT ON REPLAY</Text><Text style={s.receiptAmount}>+7 draft Tickles</Text><Text style={s.body}>{requestItem?.name} retired from {name}'s local wardrobe.</Text><Button label="Replay handover receipt" quiet onPress={handOver}/></View>}
  </View>;
}

export default function SpookyTraderMiniGame({ day = localDay() }: { day?: string }) {
  return <SpookyTraderMiniGameStory key={day} day={day}/>;
}

const shadow = { boxShadow: `4px 5px 0 ${C.ink}` };
const s = StyleSheet.create({
  shell: { gap: 20, padding: 20, backgroundColor: C.cream, borderWidth: 2, borderColor: C.ink, borderRadius: 18, ...shadow },
  heading: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'center' }, titleCopy: { flex: 1, minWidth: 250, gap: 7 }, kicker: { fontFamily: FONTS.bodyExtra, fontSize: 12, letterSpacing: 1.3, color: C.accent }, title: { fontFamily: FONTS.whimsy, fontSize: 30, lineHeight: 36, color: C.ink }, lede: { fontFamily: FONTS.body, fontSize: 16, lineHeight: 23, color: C.mute }, wisp: { width: 150, height: 140 },
  demoNote: { padding: 12, backgroundColor: C.bark, borderRadius: 10, gap: 2 }, demoTitle: { fontFamily: FONTS.bodyExtra, fontSize: 11, letterSpacing: 1.3, color: C.sun }, demoText: { fontFamily: FONTS.body, fontSize: 13, lineHeight: 19, color: C.barkText },
  switcher: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, button: { minHeight: 44, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: C.sun, borderWidth: 2, borderColor: C.ink, borderRadius: 24, alignItems: 'center', justifyContent: 'center', boxShadow: `2px 3px 0 ${C.ink}` }, quietButton: { backgroundColor: C.paper }, disabled: { opacity: 0.45 }, pressed: { transform: [{ translateY: 2 }], boxShadow: `1px 1px 0 ${C.ink}` }, buttonText: { fontFamily: FONTS.bodyExtra, fontSize: 14, lineHeight: 20, color: C.ink, textAlign: 'center' },
  askCard: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 18, padding: 16, backgroundColor: C.lilac, borderWidth: 2, borderColor: C.ink, borderRadius: 14 }, portraitWrap: { width: 130, alignItems: 'center' }, portrait: { width: 125, height: 115 }, pigName: { fontFamily: FONTS.hand, fontSize: 20, color: C.ink }, askCopy: { flex: 1, minWidth: 210, gap: 6 }, sectionKicker: { fontFamily: FONTS.bodyExtra, fontSize: 11, letterSpacing: 1.1, color: C.mute }, askName: { fontFamily: FONTS.whimsy, fontSize: 24, lineHeight: 30, color: C.ink }, hand: { fontFamily: FONTS.hand, fontSize: 19, lineHeight: 25, color: C.ink }, caption: { fontFamily: FONTS.bodySemi, fontSize: 12, lineHeight: 17, color: C.mute, textAlign: 'center' },
  wearable: { width: 145, alignItems: 'center', gap: 6 }, artFrame: { width: 116, height: 116, overflow: 'hidden', backgroundColor: C.paper, borderWidth: 2, borderColor: C.ink, borderRadius: 12, transform: [{ rotate: '-1.5deg' }] }, art: { width: '100%', height: '100%' }, itemName: { fontFamily: FONTS.whimsy, fontSize: 16, lineHeight: 21, color: C.ink, textAlign: 'center' },
  tradeMat: { gap: 16, padding: 18, backgroundColor: C.tape, borderWidth: 2, borderColor: C.ink, borderRadius: 14 }, sectionTitle: { fontFamily: FONTS.whimsy, fontSize: 22, lineHeight: 28, color: C.ink }, body: { fontFamily: FONTS.body, fontSize: 14, lineHeight: 21, color: C.ink }, offers: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center', alignItems: 'center' }, swapGlyph: { fontFamily: FONTS.whimsy, fontSize: 32, color: C.ink }, readyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  handover: { gap: 12, padding: 18, backgroundColor: C.rose, borderWidth: 2, borderColor: C.ink, borderRadius: 14 }, warning: { fontFamily: FONTS.hand, fontSize: 21, lineHeight: 27, color: C.ink }, receipt: { gap: 10, padding: 18, alignItems: 'center', backgroundColor: C.sage, borderWidth: 2, borderColor: C.ink, borderRadius: 14 }, receiptKicker: { fontFamily: FONTS.bodyExtra, fontSize: 11, letterSpacing: 1.2, color: C.mute }, receiptAmount: { fontFamily: FONTS.whimsy, fontSize: 30, lineHeight: 36, color: C.ink }, receiptId: { fontFamily: FONTS.bodySemi, fontSize: 11, color: C.mute },
});

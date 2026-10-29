import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { FONTS, WHIMSY as C } from '../../../constants/theme';
import type { CardCatalogEntry, CardFinish } from '../../../features/cards/domain/catalog';
import type { OpeningPresentationState } from '../../../features/cards/domain/openingPresentation';

export type OpeningCeremonyResult = {
  cardId: string;
  finish: CardFinish;
  isNew: boolean;
  copyNumber: number;
};

export type OpeningCeremonyProps = {
  setTitle?: string;
  opening: OpeningPresentationState;
  result?: OpeningCeremonyResult;
  card?: CardCatalogEntry;
  performance: React.ReactNode;
  packet: React.ReactNode;
  staticCard: React.ReactNode;
  reduceMotion: boolean;
  onTear: (progress: number) => void;
  onOpen: () => void;
  onAdvance: () => void;
  onInspect: () => void;
  onCloseInspection: () => void;
  onReceipt: () => void;
  onSkip: () => void;
};

const SWIPE_THRESHOLD = 72;
const SWIPE_VELOCITY = 0.55;
const DISMISS_MS = 210;

export function OpeningCeremony(props: OpeningCeremonyProps) {
  const { opening } = props;
  const cardCount = opening.cardCount;
  const { height, width } = useWindowDimensions();
  const compactHeight = height < 700;
  const travel = Math.max(420, width + 120);
  const [dragX] = useState(() => new Animated.Value(0));
  const tearStart = useRef(0);
  const transitionLock = useRef(false);
  const mounted = useRef(true);
  const latest = useRef(props);
  const [transitioning, setTransitioning] = useState(false);
  const [stageHeight, setStageHeight] = useState(0);
  const currentIndex = Math.max(0, Math.min(cardCount - 1, opening.revealedCount - 1));
  const sealed = opening.phase === 'sealed' || opening.phase === 'tearing';
  const inspecting = opening.phase === 'inspecting';
  const hasCard = opening.revealedCount > 0 && Boolean(props.result);
  const canDismiss = opening.phase === 'revealing' && !opening.revealPending &&
    opening.revealedCount > 0 && opening.revealedCount < cardCount && !transitioning;
  const deckScale = stageHeight > 0
    ? Math.min(1, Math.min(width, 320) / 320, stageHeight / 440)
    : 0;

  useEffect(() => { latest.current = props; }, [props]);

  useEffect(() => {
    transitionLock.current = false;
    dragX.stopAnimation();
    // Once the host accepts advance, the old card is already offscreen. Put
    // the same wrapper at center before binding/animating the next card.
    dragX.setValue(0);
    queueMicrotask(() => setTransitioning(false));
  }, [currentIndex, dragX, opening.revealPending, props.reduceMotion]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      transitionLock.current = true;
      dragX.stopAnimation();
    };
  }, [dragX]);

  const settle = () => {
    if (props.reduceMotion) {
      dragX.setValue(0);
      return;
    }
    Animated.spring(dragX, {
      toValue: 0,
      damping: 20,
      stiffness: 220,
      mass: 0.75,
      useNativeDriver: true,
    }).start();
  };

  const dismiss = (direction: -1 | 1) => {
    if (!canDismiss || transitionLock.current) return;
    transitionLock.current = true;
    setTransitioning(true);
    if (props.reduceMotion) {
      dragX.setValue(0);
      props.onAdvance();
      return;
    }
    Animated.timing(dragX, {
      toValue: direction * travel,
      duration: DISMISS_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!mounted.current) return;
      if (finished) props.onAdvance();
      else {
        transitionLock.current = false;
        setTransitioning(false);
        settle();
      }
    });
  };

  // PanResponder callbacks read refs only after a native gesture begins.
  // eslint-disable-next-line react-hooks/refs
  const cardGesture = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => canDismiss &&
      Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderMove: (_event, gesture) => {
      if (!transitionLock.current) dragX.setValue(gesture.dx);
    },
    onPanResponderRelease: (_event, gesture) => {
      if (Math.abs(gesture.dx) >= SWIPE_THRESHOLD || Math.abs(gesture.vx) >= SWIPE_VELOCITY) {
        dismiss(gesture.dx < 0 || (gesture.dx === 0 && gesture.vx < 0) ? -1 : 1);
      } else settle();
    },
    onPanResponderTerminate: settle,
    onPanResponderTerminationRequest: () => false,
  // PanResponder invokes these closures from gesture events, and rebuilding it
  // when eligibility changes prevents a stale gesture from advancing a card.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [canDismiss, props.reduceMotion, travel]);

  // eslint-disable-next-line react-hooks/refs
  const [tearGesture] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => {
      const phase = latest.current.opening.phase;
      return phase === 'sealed' || phase === 'tearing';
    },
    onMoveShouldSetPanResponder: (_event, gesture) => {
      const phase = latest.current.opening.phase;
      return (phase === 'sealed' || phase === 'tearing') &&
        Math.abs(gesture.dx) > 5 && Math.abs(gesture.dx) > Math.abs(gesture.dy);
    },
    onPanResponderGrant: () => { tearStart.current = latest.current.opening.tearProgress; },
    onPanResponderMove: (_event, gesture) => {
      const current = latest.current;
      current.onTear(Math.min(1, Math.max(current.opening.tearProgress, tearStart.current + Math.max(0, gesture.dx) / 230)));
    },
    onPanResponderRelease: () => {
      const current = latest.current;
      if (current.opening.tearProgress >= 1) current.onOpen();
    },
    onPanResponderTerminationRequest: () => true,
  }));

  const rotation = dragX.interpolate({
    inputRange: [-travel, 0, travel],
    outputRange: ['-8deg', '0deg', '8deg'],
  });
  const position = opening.revealedCount === 0 ? 0 : currentIndex;
  const measureStage = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    setStageHeight(previous => Math.abs(previous - next) < 1 ? previous : next);
  };

  return <SafeAreaView style={styles.safe}>
    <View style={styles.shell} accessibilityElementsHidden={inspecting} importantForAccessibility={inspecting ? 'no-hide-descendants' : 'auto'} aria-hidden={inspecting}>
      <View style={styles.topbar}>
        <Text style={styles.kicker}>{props.setTitle ?? 'ROSIE’S LOADOUT'}</Text>
        <Pressable accessibilityRole="button" onPress={props.onSkip}
          style={({ pressed }) => [styles.skip, pressed && styles.pressed]}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      <View style={styles.progress} accessibilityLabel={`${Math.min(opening.revealedCount, cardCount)} of ${cardCount} cards revealed`}>
        {Array.from({ length: cardCount }, (_, index) => <View key={index}
          style={[styles.tick, index < opening.revealedCount && styles.tickDone, index === position && !sealed && styles.tickCurrent]} />)}
      </View>

      <View onLayout={measureStage} style={[styles.stage, compactHeight && styles.compactStage]}>
        {!sealed && hasCard && opening.revealedCount < cardCount - 1 && <View pointerEvents="none" style={[styles.deckBackTwo, { width: 294 * deckScale, height: 412 * deckScale }]} />}
        {!sealed && hasCard && opening.revealedCount < cardCount && <View pointerEvents="none" style={[styles.deckBackOne, { width: 298 * deckScale, height: 416 * deckScale }]} />}
        <Animated.View key="performance-stage"
          {...(sealed ? tearGesture.panHandlers : cardGesture.panHandlers)}
          style={[styles.cardMotion, sealed && styles.packetHitArea, {
            transform: [{ translateX: dragX }, { rotate: rotation }],
          }]}>
          {props.performance}
          {sealed && <View pointerEvents="none" style={styles.seamHint}><Text style={styles.seamText}>PULL TO OPEN</Text></View>}
        </Animated.View>
      </View>

      <View style={[styles.details, sealed ? styles.sealedDetails : styles.revealedDetails,
        compactHeight && (sealed ? styles.compactSealedDetails : styles.compactRevealedDetails)]}>
        {sealed ? <>
          <Text style={styles.title}>A little rustle…</Text>
          <Text style={styles.caption}>{opening.tearProgress > 0
            ? `${Math.round(opening.tearProgress * 100)}% open. Your place is saved.`
            : 'Pull along the seam, or open with the button.'}</Text>
          <CeremonyButton label="Open packet" onPress={props.onOpen} disabled={transitioning} />
        </> : hasCard ? <>
          <View style={[styles.badge, props.result?.isNew ? styles.newBadge : styles.repeatBadge]}>
            <Text style={styles.badgeText}>{props.result?.isNew ? 'NEW TO YOUR ALBUM' : `HELLO AGAIN · COPY ${props.result?.copyNumber}`}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={props.onInspect}
              disabled={opening.revealPending || transitioning}
              accessibilityState={{ disabled: opening.revealPending || transitioning }}
              style={({ pressed }) => [styles.link, (opening.revealPending || transitioning) && styles.disabled, pressed && styles.pressed]}>
              <Text style={styles.linkText}>Inspect card</Text>
            </Pressable>
            {opening.revealedCount < cardCount
              ? <CeremonyButton label={opening.revealPending ? 'Settling…' : 'Swipe or reveal next'}
                onPress={() => dismiss(1)} disabled={!canDismiss} />
              : <CeremonyButton label={`See all ${cardCount === 3 ? 'three' : 'five'} cards`} onPress={props.onReceipt} disabled={transitioning} />}
          </View>
        </> : <>
          <Text style={styles.title}>Opening…</Text>
          <Text style={styles.caption}>Your first discovery is on its way.</Text>
        </>}
      </View>
      {!sealed && hasCard && !opening.revealPending && <Text accessibilityLiveRegion="polite" style={styles.srOnly}>
        {props.card?.name ?? props.result?.cardId}, card {opening.revealedCount} of {cardCount}, {props.result?.isNew ? 'new' : `copy ${props.result?.copyNumber}`}
      </Text>}
    </View>

    {inspecting && <View style={styles.overlay} accessibilityViewIsModal>
      <SafeAreaView style={styles.overlaySafe}>
        <ScrollView contentContainerStyle={styles.inspection}>
          <View style={styles.inspectCard}>{props.staticCard}</View>
          <Text accessibilityRole="header" style={styles.title}>{props.card?.name}</Text>
          <Text style={styles.flavor}>{props.card?.flavor}</Text>
          <Text style={styles.ruleLabel}>PRINTED TABLETOP RULES</Text>
          <Text style={styles.rule}>{props.card?.text}</Text>
          {props.card?.training && <Text style={styles.rule}>{props.card.training.name}: {props.card.training.text}</Text>}
          <CeremonyButton label="Back to packet" onPress={props.onCloseInspection} />
        </ScrollView>
      </SafeAreaView>
    </View>}
  </SafeAreaView>;
}

function CeremonyButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && styles.pressed]}>
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.cream },
  shell: { flex: 1, width: '100%', maxWidth: 460, alignSelf: 'center', paddingHorizontal: 18, paddingBottom: 14 },
  topbar: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { fontFamily: FONTS.bodyExtra, color: C.mute, fontSize: 13, letterSpacing: 1.5 },
  skip: { minWidth: 48, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  skipText: { fontFamily: FONTS.bodyExtra, color: C.accent, fontSize: 15, textDecorationLine: 'underline' },
  progress: { height: 22, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  tick: { width: 34, height: 5, borderRadius: 3, backgroundColor: C.cream2, borderWidth: 1, borderColor: C.muteSoft },
  tickDone: { backgroundColor: C.sage, borderColor: C.sageInk },
  tickCurrent: { height: 8, backgroundColor: C.sun, borderColor: C.goldInk },
  stage: { flex: 1, minHeight: 330, marginHorizontal: -18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  compactStage: { minHeight: 240 },
  packetHitArea: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  seamHint: { position: 'absolute', top: '17%', height: 44, minWidth: 180, alignItems: 'center', justifyContent: 'center' },
  seamText: { fontFamily: FONTS.bodyExtra, color: C.mute, fontSize: 11, letterSpacing: 1.6 },
  cardMotion: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  deckBackOne: { position: 'absolute', width: 286, height: 400, borderRadius: 18, backgroundColor: C.paper, borderWidth: 2, borderColor: C.ink, transform: [{ rotate: '3deg' }, { translateY: 5 }], zIndex: 2 },
  deckBackTwo: { position: 'absolute', width: 280, height: 394, borderRadius: 18, backgroundColor: C.rose, borderWidth: 2, borderColor: C.ink, transform: [{ rotate: '-3deg' }, { translateY: 9 }], zIndex: 1 },
  details: { alignItems: 'center', justifyContent: 'flex-end', gap: 7, paddingTop: 6 },
  sealedDetails: { minHeight: 172 },
  revealedDetails: { minHeight: 100 },
  compactSealedDetails: { minHeight: 138, gap: 4, paddingTop: 2 },
  compactRevealedDetails: { minHeight: 86, gap: 4, paddingTop: 2 },
  title: { fontFamily: FONTS.whimsy, color: C.ink, fontSize: 24, lineHeight: 30, textAlign: 'center' },
  caption: { fontFamily: FONTS.bodySemi, color: C.mute, fontSize: 14, lineHeight: 19, textAlign: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1.5, borderColor: C.ink, borderRadius: 6 },
  newBadge: { backgroundColor: C.sage },
  repeatBadge: { backgroundColor: C.rose },
  badgeText: { fontFamily: FONTS.bodyExtra, color: C.ink, fontSize: 11, letterSpacing: 0.7 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 3 },
  link: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  linkText: { fontFamily: FONTS.bodyExtra, color: C.accent, fontSize: 14, textDecorationLine: 'underline' },
  button: { minHeight: 46, paddingHorizontal: 18, paddingVertical: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: C.sun, borderWidth: 2, borderColor: C.ink, borderRadius: 24, boxShadow: `3px 4px 0 ${C.ink}` },
  buttonText: { fontFamily: FONTS.bodyExtra, color: C.ink, fontSize: 15, textAlign: 'center' },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.72, transform: [{ translateY: 1 }] },
  overlay: { position: 'absolute', inset: 0, zIndex: 20, backgroundColor: C.cream },
  overlaySafe: { flex: 1 },
  inspection: { width: '100%', maxWidth: 460, alignSelf: 'center', alignItems: 'center', gap: 16, padding: 22, paddingBottom: 42 },
  inspectCard: { width: '100%', alignItems: 'center' },
  flavor: { fontFamily: FONTS.hand, color: C.ink, fontSize: 22, lineHeight: 28, textAlign: 'center' },
  ruleLabel: { fontFamily: FONTS.bodyExtra, color: C.mute, fontSize: 12, letterSpacing: 1.2 },
  rule: { fontFamily: FONTS.body, color: C.ink, fontSize: 16, lineHeight: 24, alignSelf: 'stretch' },
  srOnly: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});

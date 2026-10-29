import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Image, PanResponder, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { CardPackRive } from './CardPackRive';
import type { CardPackAction, CardPackRiveProps, CardPackSignal, CardArtSource } from './riveTypes';

type Props = {
  children: React.ReactNode;
  art: CardArtSource;
  finish: CardPackRiveProps['finish'];
  phase: CardPackRiveProps['phase'];
  tearProgress: number;
  index: number;
  revealedCount: number;
  revealPending?: boolean;
  reduceMotion: boolean;
  staticMode: boolean;
  immersive?: boolean;
  onStatus: (status: string) => void;
  onSignal?: (signal: CardPackSignal) => void;
};

type CommandSnapshot = Pick<Props, 'phase' | 'tearProgress' | 'index' | 'revealedCount' | 'revealPending'>;

// The exported packet occupies y=207...664 (457 px) and the revealed card is
// about 454 px tall. The extra room keeps shadows and the reveal overshoot in
// view without shrinking a phone-sized stage unnecessarily.
const IMMERSIVE_CONTENT_HEIGHT = 440;
const IMMERSIVE_FALLBACK_HEIGHT = 440;
const OPEN_OVERLAY_MS = 700;

function initialCommand(snapshot: CommandSnapshot): CardPackAction {
  if (snapshot.phase === 'inspecting') return 'inspect';
  if (snapshot.phase === 'revealing') {
    // A restored opening starts on the last settled card, not at the pack-open
    // animation. A pending reveal likewise starts on its requested card.
    if (snapshot.revealPending || snapshot.revealedCount > 0) return 'reveal';
    if (snapshot.tearProgress === 1) return 'open';
  }
  return 'reset';
}

/** One disposable performance. Host controls, readable text and ownership stay outside Rive. */
export function PerformanceStage(props: Props) {
  const { onSignal, onStatus } = props;
  const { width } = useWindowDimensions();
  const [immersiveHeight, setImmersiveHeight] = useState(0);
  const availableWidth = Math.min(width, 390);
  const immersiveScale = props.immersive
    ? Math.min(1, availableWidth / 390, immersiveHeight > 0 ? immersiveHeight / IMMERSIVE_CONTENT_HEIGHT : 1)
    : 1;
  const immersiveWidth = 390 * immersiveScale;
  const immersiveArtboardHeight = 844 * immersiveScale;
  const immersiveFocusY = props.phase === 'sealed' || props.phase === 'tearing' ? 435.5 : 410;
  const immersiveTop = immersiveHeight > 0 ? immersiveHeight / 2 - immersiveFocusY * immersiveScale : 0;
  const fallbackScale = props.immersive && immersiveHeight > 0
    ? Math.min(1, availableWidth / 320, immersiveHeight / IMMERSIVE_FALLBACK_HEIGHT)
    : 1;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [openingOverlay, setOpeningOverlay] = useState(() => Boolean(
    props.immersive && !props.reduceMotion && !props.staticMode &&
    props.phase === 'revealing' && props.revealedCount === 0,
  ));
  const [arrival] = useState(() => new Animated.Value(1));
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [action, setAction] = useState<{ kind: CardPackAction; token: number }>(() => ({
    kind: initialCommand(props),
    token: 1,
  }));
  const previousCommand = useRef<CommandSnapshot | null>(null);
  const previousPhase = useRef(props.phase);
  useEffect(() => {
    const previous = previousPhase.current;
    previousPhase.current = props.phase;
    if (!props.immersive || props.reduceMotion || props.staticMode) return;
    if ((previous === 'sealed' || previous === 'tearing') &&
      props.phase === 'revealing' && props.revealedCount === 0) {
      let cancelled = false;
      queueMicrotask(() => { if (!cancelled) setOpeningOverlay(true); });
      return () => { cancelled = true; };
    }
  }, [props.immersive, props.phase, props.reduceMotion, props.revealedCount, props.staticMode]);
  useEffect(() => {
    if (!openingOverlay) return;
    const timeout = setTimeout(() => setOpeningOverlay(false), OPEN_OVERLAY_MS);
    return () => clearTimeout(timeout);
  }, [openingOverlay]);
  useLayoutEffect(() => {
    arrival.stopAnimation();
    if (!props.immersive || props.reduceMotion || props.staticMode || !props.revealPending) {
      arrival.setValue(1);
      return;
    }
    arrival.setValue(0);
    const rise = Animated.sequence([
      Animated.timing(arrival, {
        toValue: 1.08,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(arrival, {
        toValue: 1,
        duration: 70,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    rise.start();
    return () => rise.stop();
  }, [arrival, props.immersive, props.index, props.reduceMotion, props.revealPending, props.staticMode]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    const current: CommandSnapshot = {
      phase: props.phase,
      tearProgress: props.tearProgress,
      index: props.index,
      revealedCount: props.revealedCount,
      revealPending: props.revealPending,
    };
    const previous = previousCommand.current;
    previousCommand.current = current;
    if (!previous) return;

    let command: CardPackAction | null = null;
    if (current.phase === 'inspecting' && previous.phase !== 'inspecting') {
      command = 'inspect';
    } else if (current.revealPending &&
      !(props.immersive && openingOverlay && current.revealedCount === 0) &&
      (!previous.revealPending || current.index !== previous.index)) {
      command = 'reveal';
    } else if (
      (previous.phase === 'sealed' || previous.phase === 'tearing') &&
      current.phase === 'revealing' && current.revealedCount === 0
    ) {
      command = 'open';
    }

    const closedInspection = previous.phase === 'inspecting' && current.phase === 'revealing';
    if (!command && !closedInspection) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (command) setAction(value => ({ kind: command, token: value.token + 1 }));
      else {
        // Do not replay on close. Remember the settled-card command so a later
        // renderer remount resumes on this card instead of re-entering inspect.
        setAction(value => value.kind === 'reveal' ? value : { ...value, kind: 'reveal' });
      }
    });
    return () => { cancelled = true; };
  }, [openingOverlay, props.immersive, props.index, props.phase, props.revealPending, props.revealedCount, props.tearProgress]);
  useEffect(() => {
    if (ready || failed || props.staticMode || props.reduceMotion) return;
    const timeout = setTimeout(() => { setFailed(true); onStatus('Static fallback: animation did not become ready within 5 seconds.'); }, 5000);
    return () => clearTimeout(timeout);
  }, [ready, failed, onStatus, props.staticMode, props.reduceMotion]);
  const tiltGesture = PanResponder.create({
    onStartShouldSetPanResponder: () => props.phase === 'inspecting' && !props.reduceMotion,
    onPanResponderMove: (_event, gesture) => setTilt({ x: Math.max(-1, Math.min(1, gesture.dx / 100)), y: Math.max(-1, Math.min(1, gesture.dy / 100)) }),
    onPanResponderRelease: () => setTilt({ x: 0, y: 0 }),
    onPanResponderTerminate: () => setTilt({ x: 0, y: 0 }),
  });
  const enabled = !failed && !props.staticMode && !props.reduceMotion;
  const riveOwnsStage = enabled && (
    props.phase === 'sealed' || props.phase === 'tearing' ||
    openingOverlay ||
    (props.phase === 'revealing' && props.revealedCount === 0 && !props.revealPending)
  );
  const showChildren = !riveOwnsStage || Boolean(props.immersive && openingOverlay && props.revealPending);
  const arrivalY = arrival.interpolate({ inputRange: [0, 1, 1.08], outputRange: [22, 0, -8] });
  const arrivalScale = arrival.interpolate({ inputRange: [0, 1, 1.08], outputRange: [0.98, 1, 1.005] });
  const measureImmersive = (event: LayoutChangeEvent) => {
    if (!props.immersive) return;
    const next = event.nativeEvent.layout.height;
    setImmersiveHeight(previous => Math.abs(previous - next) < 1 ? previous : next);
  };
  return <View onLayout={measureImmersive} style={[styles.stage, props.immersive && styles.immersiveStage]} {...tiltGesture.panHandlers}>
    {(!ready || !riveOwnsStage) && !props.revealPending && props.revealedCount === 0 && props.immersive
      ? <Image source={require('../../../assets/rive/card-packs/sealed-packet-poster.png')} resizeMode="contain" accessibilityLabel="Rosie's Loadout waxed seed packet" style={{ position: 'absolute', top: immersiveTop, width: immersiveWidth, height: immersiveArtboardHeight }}/>
      : (showChildren || !ready) && <View style={[
      props.immersive && styles.immersiveFallback,
      props.immersive && { transform: [{ scale: fallbackScale }] },
    ]}><Animated.View style={props.immersive && {
        transform: [{ translateY: arrivalY }, { scale: arrivalScale }],
      }}>{props.children}</Animated.View></View>}
    {riveOwnsStage && <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[
      styles.performance,
      props.immersive && { position: 'absolute', top: immersiveTop, width: immersiveWidth, height: immersiveArtboardHeight },
      !ready && styles.hidden,
    ]}>
      <CardPackRive tearProgress={props.tearProgress} revealIndex={props.index} tiltX={tilt.x} tiltY={tilt.y}
        finish={props.finish} reduceMotion={props.reduceMotion} phase={props.phase} active={foreground}
        cardArt={props.art} actionToken={action.token} action={action.kind}
        onReady={() => { setReady(true); onStatus('Rive ready: the exact exported contract is bound.'); }}
        onError={error => { setFailed(true); onStatus(`Static fallback: ${error.message}`); }}
        onSignal={signal => onSignal?.(signal)} />
    </View>}
  </View>;
}
const styles = StyleSheet.create({
  stage: { width: '100%', minHeight: 410, alignItems: 'center', justifyContent: 'center' },
  immersiveStage: { flex: 1, minHeight: 0, overflow: 'hidden' },
  immersiveFallback: { width: 320, alignItems: 'center', justifyContent: 'center' },
  performance: { width: 330, height: 460 },
  hidden: { position: 'absolute', opacity: 0 },
});

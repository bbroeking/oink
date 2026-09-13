import React, { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, router } from "expo-router";
import { Button } from "@/components/ui/Button";
import { PigRenderer } from "@/components/ui/PigRenderer";
import { PigStage, type EquippedItem } from "@/components/ui/PigStage";
import { LoadingBeat } from "@/components/ui/EmptyState";
import { RIVE_PIG_SOURCE } from "@/components/ui/rivePigAsset";
import { PIG_ANIMATION_SPECS, type PigAnimation, type PigMood, type PigReaction, type PigReactionKind } from "@/components/ui/pigRendererContract";
import { MotionPolicyProvider } from "@/hooks/useMotionPolicy";
import { PIG_IDS, type PigId } from "@/utils/pigs";
import { WHIMSY, TYPE, SPACE } from "@/constants/theme";

type Load = "loading" | "ready" | "error";
const slot = (id: string, category: string): EquippedItem => ({ id, category, emoji: null });

export default function RosieGallery() {
  const [pigId, setPigId] = useState<PigId>("rosie");
  const [animation, setAnimation] = useState<PigAnimation>("idle");
  const [mood, setMood] = useState<PigMood>("content");
  const [reaction, setReaction] = useState<PigReaction | null>(null);
  const sequence = useRef(0);
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(true);
  const [failure, setFailure] = useState(false);
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState("Not mounted");
  const [equipment, setEquipment] = useState<"none" | "supported" | "unsupported">("none");
  const [request, setRequest] = useState({ id: 0, delay: 1200, fail: false });
  const [loading, setLoading] = useState<Load>("ready");
  const [completions, setCompletions] = useState(0);
  const [pigFrame, setPigFrame] = useState(0);
  const [frameSample, setFrameSample] = useState("Not sampled");
  const raf = useRef<number | null>(null);
  const sampleFrames = () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    const frames: number[] = [];
    let last = performance.now();
    const start = last;
    const step = (now: number) => {
      frames.push(now - last); last = now;
      if (now - start < 5000) { raf.current = requestAnimationFrame(step); return; }
      frames.sort((a, b) => a - b);
      setFrameSample(`${frames.length} JS frames / 5s · p95 ${frames[Math.floor(frames.length * .95)]?.toFixed(1)} ms · max ${frames.at(-1)?.toFixed(1)} ms`);
      raf.current = null;
    };
    raf.current = requestAnimationFrame(step);
  };
  useEffect(() => () => { if (raf.current !== null) cancelAnimationFrame(raf.current); }, []);
  useEffect(() => {
    if (!request.id) return;
    setLoading("loading");
    const timeout = setTimeout(() => setLoading(request.fail ? "error" : "ready"), request.delay);
    return () => clearTimeout(timeout);
  }, [request]);
  const load = (delay: number, fail = false) => setRequest((old) => ({ id: old.id + 1, delay, fail }));
  const react = (kind: PigReactionKind) => setReaction({ id: ++sequence.current, kind });
  const source = failure ? require("../../../assets/rive/prototype/runtime-sample.riv") : RIVE_PIG_SOURCE;
  const mountedAt = useRef(performance.now());
  useEffect(() => {
    mountedAt.current = performance.now();
    setStatus(source === undefined ? "Rosie runtime export missing — raster fallback" : reduced ? "Reduce Motion — raster fallback" : equipment === "unsupported" ? "Unsupported appearance — raster fallback" : "Loading Rive");
  }, [source, pigId, retry, equipment, reduced]);

  return <MotionPolicyProvider reduceMotion={reduced}>
    <Stack.Screen options={{ title: "Rosie · motion gallery" }} />
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>Rosie in motion</Text>
      <Text style={styles.copy}>Inspect one pig at a time. Change mood during a reaction, repeat the same tap, and equip items at the jump and wave extremes.</Text>
      <Text accessibilityRole="alert" style={styles.status}>{status}</Text>
      <View style={styles.stage}>
        {equipment === "none" ? <PigRenderer key={`${pigId}:${retry}:${failure}`} animation={animation} mood={mood} reaction={reaction}
          pigId={pigId} active={visible} renderer="rive" riveSource={source} rolloutEnabled
          onComplete={() => { setReaction(null); setCompletions((n) => n + 1); }}
          onRendererReady={() => setStatus(`Rive ready in ${(performance.now() - mountedAt.current).toFixed(0)} ms`)}
          onRendererError={(error) => setStatus(`Rive error → raster: ${error.message}`)} /> :
          <PigStage key={`${pigId}:${retry}:${failure}`} pigId={pigId} pigAnimation={animation} pigMood={mood} pigReaction={reaction} active={visible}
            pigFrameIdx={pigFrame} onPigFrame={setPigFrame}
            riveSource={source} riveRolloutEnabled
            onRiveReady={() => setStatus(`Rive ready in ${(performance.now() - mountedAt.current).toFixed(0)} ms`)}
            onRiveError={(error) => setStatus(`Rive error → raster: ${error.message}`)}
            equipped={slot(equipment === "supported" ? "party" : "cowboy", "hat")}
            equippedGlasses={equipment === "supported" ? slot("pixel_glasses", "glasses") : undefined}
            equippedHeld={equipment === "supported" ? slot("garden_trowel_held", "held") : undefined}
            onPigComplete={() => { setReaction(null); setCompletions((n) => n + 1); }} />}
      </View>
      <Text style={styles.copy}>Reaction #{reaction?.id ?? "—"} · completions {completions} · resting mood {mood}</Text>
      <Text style={styles.heading}>Identity</Text>
      <View style={styles.row}>{PIG_IDS.map((id) => <Button key={id} variant={id === pigId ? "primary" : "ghost"} onPress={() => setPigId(id)}>{id}</Button>)}</View>
      <Text style={styles.heading}>Persistent mood</Text>
      <View style={styles.row}>{(["content", "happy", "sad", "tired"] as const).map((value) => <Button key={value} variant="ghost" onPress={() => { setAnimation("idle"); setMood(value); }}>{value}</Button>)}</View>
      <Text style={styles.heading}>Animation / activity</Text>
      <View style={styles.row}>{(Object.keys(PIG_ANIMATION_SPECS) as PigAnimation[]).map((value) => <Button key={value} variant="ghost" onPress={() => { setReaction(null); setAnimation(value); }}>{value}</Button>)}</View>
      <Text style={styles.heading}>Interruptible reactions</Text>
      <View style={styles.row}>{(["happy", "jump", "surprise", "wave"] as const).map((kind) => <Button key={kind} variant="primary" onPress={() => react(kind)}>Tap {kind}</Button>)}</View>
      <View style={styles.row}>
        <Button variant="ghost" onPress={() => setReduced((v) => !v)}>Reduce Motion: {reduced ? "on" : "off"}</Button>
        <Button variant="ghost" onPress={() => setVisible((v) => !v)}>Animation: {visible ? "active" : "paused"}</Button>
        <Button variant="ghost" onPress={() => setFailure((v) => !v)}>Asset error: {failure ? "on" : "off"}</Button>
        <Button variant="ghost" onPress={() => { setFailure(false); setRetry((v) => v + 1); }}>Retry asset</Button>
        <Button variant="ghost" onPress={() => router.push("/ui-audit")}>Navigate away</Button>
      </View>
      <Text style={styles.heading}>Equipped pig</Text>
      <View style={styles.row}>{(["none", "supported", "unsupported"] as const).map((value) => <Button key={value} variant="ghost" onPress={() => setEquipment(value)}>{value}</Button>)}</View>
      <Text style={styles.copy}>Attachment candidates: party hat, pixel glasses, garden trowel. This gallery tests them when a Rosie export is present. Other loadouts, custom placement, and tints retain the raster stage. Production remains rollout gated.</Text>
      <Text style={styles.heading}>Frozen Shop preview</Text>
      <View style={styles.stage}>
        <PigStage pigId={pigId} pigFrozen equipped={slot("party", "hat")} equippedGlasses={slot("pixel_glasses", "glasses")} equippedHeld={slot("garden_trowel_held", "held")} />
      </View>
      <Text style={styles.heading}>Loading and recovery</Text>
      <View style={styles.row}>
        <Button variant="ghost" onPress={() => load(80)}>Fast success</Button>
        <Button variant="ghost" onPress={() => load(1800)}>Slow success</Button>
        <Button variant="ghost" onPress={() => load(800, true)}>Request error</Button>
      </View>
      <View style={styles.loading}>
        {loading === "loading" ? <LoadingBeat label="gathering your helpers" /> : loading === "error" ? <><Text style={styles.copy}>Couldn't reach the farm.</Text><Button onPress={() => load(800)}>Try again</Button></> : <Text style={styles.copy}>Content ready. No animation wait.</Text>}
      </View>
      <Text style={styles.heading}>JS frame sample</Text>
      <Text style={styles.copy}>{frameSample}</Text>
      <Button variant="ghost" onPress={sampleFrames}>Sample 5 seconds</Button>
      <Text style={styles.copy}>Development JS timing only; this does not measure native UI frames or prove a production performance improvement.</Text>
    </ScrollView>
  </MotionPolicyProvider>;
}
const styles = StyleSheet.create({
  page: { padding: SPACE.lg, paddingBottom: 64, gap: SPACE.md, backgroundColor: WHIMSY.cream },
  title: { ...TYPE.cardTitle, fontSize: 28, color: WHIMSY.ink },
  heading: { ...TYPE.cardTitle, color: WHIMSY.ink, marginTop: SPACE.lg },
  copy: { ...TYPE.hand, color: WHIMSY.ink },
  status: { ...TYPE.hand, color: WHIMSY.ink, backgroundColor: WHIMSY.sun, padding: SPACE.md, borderRadius: 12 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  stage: { alignItems: "center", minHeight: 420, paddingTop: 100 },
  loading: { minHeight: 160, justifyContent: "center", alignItems: "center" },
});

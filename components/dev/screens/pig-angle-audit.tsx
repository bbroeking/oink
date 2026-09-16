// Dev audit: every worn cosmetic × every angle the pig is drawn at, on one
// scrollable contact sheet — the real PigStage, frozen on a pinned frame and
// scaled down, so what is checked here is exactly what ships. Built for the
// side-sprite work (2026-09-15): a turned pig takes an item's side art when it
// exists and its front art when it does not, and both cases need eyes on them
// for all ~130 items, six pigs, standing and seated, mirrored and not.
//
//   xcrun simctl openurl <UDID> "ticklethepig://pig-angle-audit"
//   …?pig=pepper&views=front,turn_r,turn_sit&slot=hat&from=24&count=6&bare=1
//
// The query form pages the sheet for a screenshot run: `from`/`count` slice
// the filtered items, `bare` drops the chip stack so a page is only rows.
//
// Rows are items; columns are VIEWS (an animation family + a facing + a frame).
// Tap a cell for the full-size stage with a frame scrubber, then FLAG the view
// with a note. Flags persist locally; "Copy report" puts them on the clipboard
// as JSON for an issue or the regen studio.
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Chip, Tag } from "@/components/ui/Chip";
import { PigStage, type EquippedItem } from "@/components/ui/PigStage";
import { Sheet } from "@/components/ui/Sheet";
import { Sticker } from "@/components/ui/Sticker";
import { Hand, T } from "@/components/ui/Text";
import { TextField } from "@/components/ui/TextField";
import type {
  PigAnimation,
  PigFacing,
} from "@/components/ui/pigRendererContract";
import {
  PIG_ANIMATION_SPECS,
  resolveFacingAnimation,
} from "@/components/ui/pigRendererContract";
import { HAT_IMAGES, HAT_REL } from "@/constants/hats";
import { HAT_SIDE_IMAGES } from "@/constants/hat_side.generated";
import {
  ART_SIZE,
  BORDER,
  PAGE_PAD,
  RADII,
  SPACE,
  UI_COLORS,
} from "@/constants/theme";
import { PIG_IDS, pigDefinition, type PigId } from "@/utils/pigs";

export default function PigAngleAuditScreen() {
  // A second deep link with new params re-keys the sheet, so a screenshot
  // run can change pig / views / page on an already-open screen.
  const params = useLocalSearchParams<Params>();
  if (!__DEV__) return <Redirect href="/" />;
  return <PigAngleAudit key={JSON.stringify(params)} />;
}

// ---------------------------------------------------------------- views --

interface ViewDef {
  key: string;
  label: string;
  // The column header, short enough for one line over a thumb-wide cell.
  col: string;
  animation: PigAnimation;
  facing?: PigFacing;
  frame: number;
}

// The five rest views are the default sheet: the two front rests and the three
// turned rests (the visit mirrors the drawn-right family for a pig on the
// left, so the mirror is its own view — lettering and asymmetric art flip).
// Reaction families are opt-in columns; their frame is the widest pose.
const VIEWS: readonly ViewDef[] = [
  { key: "front", label: "Front", col: "Front", animation: "idle", frame: 0 },
  {
    key: "front_sit",
    label: "Front sit",
    col: "F·sit",
    animation: "sit",
    frame: 0,
  },
  {
    key: "turn_r",
    label: "Turn R",
    col: "Turn R",
    animation: "idle",
    facing: "right",
    frame: 0,
  },
  {
    key: "turn_l",
    label: "Turn L",
    col: "Turn L",
    animation: "idle",
    facing: "left",
    frame: 0,
  },
  {
    key: "turn_sit",
    label: "Turn L sit",
    col: "T·sit",
    animation: "sit",
    facing: "left",
    frame: 0,
  },
  { key: "walk", label: "Walk", col: "Walk", animation: "walk", frame: 1 },
  { key: "jump", label: "Jump", col: "Jump", animation: "jump", frame: 2 },
  { key: "wave", label: "Wave", col: "Wave", animation: "wave", frame: 1 },
  { key: "happy", label: "Happy", col: "Happy", animation: "happy", frame: 1 },
  { key: "sad", label: "Sad", col: "Sad", animation: "sad", frame: 0 },
  { key: "tired", label: "Tired", col: "Tired", animation: "tired", frame: 0 },
  {
    key: "surprise",
    label: "Surprise",
    col: "Surpr.",
    animation: "surprise",
    frame: 1,
  },
];
const DEFAULT_VIEW_KEYS = VIEWS.slice(0, 5).map((v) => v.key);

// ---------------------------------------------------------------- items --

type Slot = "hat" | "bow" | "glasses" | "neck" | "held" | "aura";
const SLOT_LABELS: Record<Slot, string> = {
  hat: "Hat",
  bow: "Bow",
  glasses: "Face",
  neck: "Neck",
  held: "Held",
  aura: "Aura",
};
const SLOTS = Object.keys(SLOT_LABELS) as Slot[];

interface AuditItem {
  id: string;
  slot: Slot;
  anchor: string;
  hasSide: boolean;
}

// Mud War game sprites share the hats folder but are not cosmetics
// (tools/placement_studio.py NON_COSMETIC).
const NON_COSMETIC = new Set([
  "goblin_grunt",
  "goblin_scout",
  "goblin_brute",
  "goblin_warboss",
  "goblin_grunt_hit",
  "goblin_scout_hit",
  "goblin_brute_hit",
  "goblin_warboss_hit",
  "mud_splat",
  "mud_splat_gold",
]);

// The app has no local id → category catalog (categories live in the DB), so
// the slot is read off the item's placement anchor, as pig-side-preview does.
function slotOf(id: string, anchor: string | undefined): Slot {
  if (anchor === "eyes" || anchor === "eye_l" || anchor === "eye_r")
    return "glasses";
  if (anchor === "neck") return id.includes("bow") ? "bow" : "neck";
  if (anchor === "hand_r" || anchor === "hand_l") return "held";
  if (anchor === "body") return "aura";
  return "hat";
}

const ITEMS: readonly AuditItem[] = Object.keys(HAT_IMAGES)
  .filter(
    (id) => HAT_REL[id] && !NON_COSMETIC.has(id) && !id.startsWith("flag_"),
  )
  .sort()
  .map((id) => {
    const anchor = HAT_REL[id]?.anchor ?? "head";
    return {
      id,
      slot: slotOf(id, anchor),
      anchor,
      hasSide: id in HAT_SIDE_IMAGES,
    };
  });

function equippedProps(item: AuditItem) {
  const eq: EquippedItem = { id: item.id, category: item.slot, emoji: null };
  switch (item.slot) {
    case "hat":
      return { equipped: eq };
    case "bow":
      return { equippedBow: eq };
    case "glasses":
      return { equippedGlasses: eq };
    case "neck":
      return { equippedNeck: eq };
    case "held":
      return { equippedHeld: eq };
    case "aura":
      return { equippedAura: eq };
  }
}

// ---------------------------------------------------------------- flags --

interface Flag {
  views: string[];
  note: string;
  at: string;
}
type Flags = Record<string, Flag>;
const FLAGS_KEY = "dev.pigAngleAudit.flags.v1";

// ---------------------------------------------------------------- cells --

const CANVAS_FIT = 0.82;

// One frozen stage, scaled from the 300pt canvas to the cell. Same wrapper
// math as PigAvatar's combined-outfit path.
const MiniStage = memo(function MiniStage({
  item,
  pigId,
  view,
  size,
  frame,
}: {
  item: AuditItem;
  pigId: PigId;
  view: ViewDef;
  size: number;
  frame?: number;
}) {
  // HEADROOM: a hat on the turned families rides above the canvas top, so the
  // canvas is scaled a little under the cell and nothing clips — a cut-off
  // brim read as a squashed hat on the first pass of this sheet (2026-09-15).
  // The room goes above; the pig's feet keep the cell's bottom edge.
  const scale = (size / ART_SIZE.stage) * CANVAS_FIT;
  const drop = (size * (1 - CANVAS_FIT)) / 2;
  return (
    <View
      style={{ width: size, height: size, overflow: "visible" }}
      pointerEvents="none"
    >
      <View
        style={{
          position: "absolute",
          left: (size - ART_SIZE.stage) / 2,
          top: (size - ART_SIZE.stage) / 2 + drop,
          width: ART_SIZE.stage,
          height: ART_SIZE.stage,
          transform: [{ scale }],
        }}
      >
        <PigStage
          pigFrozen
          pigId={pigId}
          pigAnimation={view.animation}
          pigMood="content"
          facing={view.facing}
          pigFrameIdx={frame ?? view.frame}
          {...equippedProps(item)}
        />
      </View>
    </View>
  );
});

const ItemRow = memo(function ItemRow({
  item,
  pigId,
  views,
  cell,
  flag,
  onOpen,
}: {
  item: AuditItem;
  pigId: PigId;
  views: readonly ViewDef[];
  cell: number;
  flag: Flag | undefined;
  onOpen: (item: AuditItem, view: ViewDef) => void;
}) {
  return (
    <Sticker
      color={flag ? "sun" : "paper"}
      rotate={0}
      radius={RADII.md}
      style={styles.row}
    >
      <View style={styles.rowHead}>
        <T role="cardTitleSm" numberOfLines={1} style={styles.rowTitle}>
          {item.id}
        </T>
        <Tag label={SLOT_LABELS[item.slot]} tone="paper" />
        <Tag
          label={item.hasSide ? "side art" : "front only"}
          tone={item.hasSide ? "sage" : "paper"}
        />
        {flag ? (
          <Tag label={`flag · ${flag.views.length}`} tone="rose" />
        ) : null}
      </View>
      <View style={styles.strip}>
        {views.map((view) => {
          const flagged = flag?.views.includes(view.key);
          return (
            <Pressable
              key={view.key}
              onPress={() => onOpen(item, view)}
              accessibilityRole="button"
              accessibilityLabel={`${item.id}, ${view.label}${flagged ? ", flagged" : ""}`}
              style={[
                styles.cell,
                { width: cell },
                flagged && styles.cellFlagged,
              ]}
            >
              <MiniStage item={item} pigId={pigId} view={view} size={cell} />
            </Pressable>
          );
        })}
      </View>
    </Sticker>
  );
});

// --------------------------------------------------------------- screen --

type Params = Partial<
  Record<
    "pig" | "views" | "slot" | "from" | "count" | "bare" | "side",
    string | string[]
  >
>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function PigAngleAudit() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<Params>();
  const pigParam = one(params.pig);
  const viewsParam = one(params.views)
    ?.split(",")
    .filter((k) => VIEWS.some((v) => v.key === k));
  const slotParam = one(params.slot);
  const from = Math.max(0, Number(one(params.from)) || 0);
  const count = Number(one(params.count)) || 0;
  const bare = one(params.bare) === "1";
  const [pigId, setPigId] = useState<PigId>(
    PIG_IDS.includes(pigParam as PigId) ? (pigParam as PigId) : "rosie",
  );
  const [slot, setSlot] = useState<Slot | null>(
    SLOTS.includes(slotParam as Slot) ? (slotParam as Slot) : null,
  );
  const [sideOnly, setSideOnly] = useState(one(params.side) === "1");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [viewKeys, setViewKeys] = useState<string[]>(
    viewsParam?.length ? viewsParam : DEFAULT_VIEW_KEYS,
  );
  const [flags, setFlags] = useState<Flags>({});
  const [focus, setFocus] = useState<{ item: AuditItem; view: ViewDef } | null>(
    null,
  );

  useEffect(() => {
    AsyncStorage.getItem(FLAGS_KEY)
      .then((raw) => {
        if (raw) setFlags(JSON.parse(raw) as Flags);
      })
      .catch(() => {});
  }, []);
  const saveFlags = useCallback((next: Flags) => {
    setFlags(next);
    AsyncStorage.setItem(FLAGS_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const views = useMemo(
    () => VIEWS.filter((v) => viewKeys.includes(v.key)),
    [viewKeys],
  );
  const items = useMemo(() => {
    const all = ITEMS.filter(
      (it) =>
        (!slot || it.slot === slot) &&
        (!sideOnly || it.hasSide) &&
        (!flaggedOnly || flags[it.id]),
    );
    return count > 0 ? all.slice(from, from + count) : all;
  }, [slot, sideOnly, flaggedOnly, flags, from, count]);

  // Cells share the row's width; the row's own padding + the sticker border
  // come off first. Six views on a phone still land above the thumb size.
  const rowInner = width - PAGE_PAD * 2 - SPACE.card * 2 - BORDER.ink * 2;
  const cell = Math.max(
    ART_SIZE.badge,
    Math.floor(
      (rowInner - SPACE.xs * (views.length - 1)) / Math.max(1, views.length),
    ),
  );

  const toggleView = (key: string) =>
    setViewKeys((keys) =>
      keys.includes(key)
        ? keys.length > 1
          ? keys.filter((k) => k !== key)
          : keys
        : VIEWS.filter((v) => v.key === key || keys.includes(v.key)).map(
            (v) => v.key,
          ),
    );

  const copyReport = async () => {
    const report = Object.entries(flags).map(([id, f]) => ({ id, ...f }));
    await Clipboard.setStringAsync(JSON.stringify(report, null, 1));
  };

  const sideCount = ITEMS.filter((i) => i.hasSide).length;
  const flagCount = Object.keys(flags).length;

  const header = (
    <View style={styles.header}>
      {bare ? (
        <Hand tone="secondary">
          {pigDefinition(pigId).name} · {slot ? SLOT_LABELS[slot] : "all slots"}{" "}
          · items {from + 1}–{from + items.length}
        </Hand>
      ) : (
        <>
          <T role="pageTitle">Angle audit</T>
          <Hand tone="secondary">
            {ITEMS.length} items · {sideCount} with side art · {flagCount}{" "}
            flagged · {items.length} shown
          </Hand>

          <View style={styles.chips}>
            {PIG_IDS.map((id) => (
              <Chip
                key={id}
                label={pigDefinition(id).name}
                selected={pigId === id}
                onPress={() => setPigId(id)}
              />
            ))}
          </View>
          <View style={styles.chips}>
            <Chip
              label="All slots"
              selected={slot === null}
              onPress={() => setSlot(null)}
            />
            {SLOTS.map((s) => (
              <Chip
                key={s}
                label={SLOT_LABELS[s]}
                selected={slot === s}
                onPress={() => setSlot(s)}
              />
            ))}
          </View>
          <View style={styles.chips}>
            <Chip
              label="Side art only"
              selected={sideOnly}
              onPress={() => setSideOnly((v) => !v)}
            />
            <Chip
              label="Flagged only"
              selected={flaggedOnly}
              onPress={() => setFlaggedOnly((v) => !v)}
            />
          </View>
          <View style={styles.chips}>
            {VIEWS.map((v) => (
              <Chip
                key={v.key}
                label={v.label}
                selected={viewKeys.includes(v.key)}
                onPress={() => toggleView(v.key)}
              />
            ))}
          </View>
        </>
      )}

      <View style={[styles.columns, { gap: SPACE.xs }]}>
        {views.map((v) => (
          <T
            key={v.key}
            role="kickerPillSm"
            tone="secondary"
            align="center"
            numberOfLines={1}
            style={{ width: cell }}
          >
            {v.col}
          </T>
        ))}
      </View>
    </View>
  );

  const focusFlag = focus ? flags[focus.item.id] : undefined;
  const focusFlagged = !!focus && !!focusFlag?.views.includes(focus.view.key);
  const toggleFocusFlag = () => {
    if (!focus) return;
    const prev = flags[focus.item.id];
    const nextViews = focusFlagged
      ? (prev?.views ?? []).filter((k) => k !== focus.view.key)
      : [...(prev?.views ?? []), focus.view.key];
    const next = { ...flags };
    if (nextViews.length === 0 && !prev?.note) delete next[focus.item.id];
    else
      next[focus.item.id] = {
        views: nextViews,
        note: prev?.note ?? "",
        at: new Date().toISOString(),
      };
    saveFlags(next);
  };
  const setFocusNote = (note: string) => {
    if (!focus) return;
    const prev = flags[focus.item.id];
    const next = { ...flags };
    if (!note && !prev?.views.length) delete next[focus.item.id];
    else
      next[focus.item.id] = {
        views: prev?.views ?? [],
        note,
        at: new Date().toISOString(),
      };
    saveFlags(next);
  };

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ headerShown: false }} />
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={({ item }) => (
          <ItemRow
            item={item}
            pigId={pigId}
            views={views}
            cell={cell}
            flag={flags[item.id]}
            onOpen={(it, v) => setFocus({ item: it, view: v })}
          />
        )}
        ListHeaderComponent={header}
        ListFooterComponent={
          <View style={styles.footer}>
            <Button
              variant="gold"
              size="sm"
              onPress={copyReport}
              disabled={flagCount === 0}
            >
              Copy report
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => saveFlags({})}
              disabled={flagCount === 0}
            >
              Clear flags
            </Button>
          </View>
        }
        contentContainerStyle={[
          styles.list,
          { paddingTop: insets.top + SPACE.lg },
        ]}
        initialNumToRender={4}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews
      />

      <Sheet
        open={focus !== null}
        onClose={() => setFocus(null)}
        kicker={
          focus
            ? `${SLOT_LABELS[focus.item.slot]} · ${focus.item.anchor} · ${focus.item.hasSide ? "side art" : "front only"}`
            : undefined
        }
        title={focus?.item.id}
        subtitle={
          focus
            ? `${pigDefinition(pigId).name} · ${focus.view.label}`
            : undefined
        }
      >
        {focus ? (
          <FocusBody
            focus={focus}
            pigId={pigId}
            flagged={focusFlagged}
            note={focusFlag?.note ?? ""}
            onView={(view) => setFocus({ item: focus.item, view })}
            onPig={setPigId}
            onToggleFlag={toggleFocusFlag}
            onNote={setFocusNote}
          />
        ) : null}
      </Sheet>
    </View>
  );
}

function FocusBody({
  focus,
  pigId,
  flagged,
  note,
  onView,
  onPig,
  onToggleFlag,
  onNote,
}: {
  focus: { item: AuditItem; view: ViewDef };
  pigId: PigId;
  flagged: boolean;
  note: string;
  onView: (view: ViewDef) => void;
  onPig: (id: PigId) => void;
  onToggleFlag: () => void;
  onNote: (note: string) => void;
}) {
  // The scrubber resets to the view's pinned frame whenever the view changes.
  const [scrub, setScrub] = useState<{ view: ViewDef; frame: number } | null>(
    null,
  );
  const frame = scrub?.view === focus.view ? scrub.frame : focus.view.frame;
  const setFrame = (f: number) => setScrub({ view: focus.view, frame: f });
  // A facing swaps the rest family (idle → face, sit → face_sit), so the
  // scrubber counts the frames of the family the stage actually draws.
  const drawn = resolveFacingAnimation(focus.view.animation, focus.view.facing);
  const spec = PIG_ANIMATION_SPECS[drawn] ?? PIG_ANIMATION_SPECS.idle;
  const frames = spec.frames.length;
  return (
    <View style={styles.focus}>
      <View style={styles.focusStage}>
        <MiniStage
          item={focus.item}
          pigId={pigId}
          view={focus.view}
          size={ART_SIZE.stage}
          frame={frame}
        />
      </View>
      <View style={styles.chips}>
        {VIEWS.map((v) => (
          <Chip
            key={v.key}
            label={v.label}
            selected={v.key === focus.view.key}
            onPress={() => onView(v)}
          />
        ))}
      </View>
      <View style={styles.chips}>
        {Array.from({ length: frames }, (_, i) => (
          <Chip
            key={i}
            label={`f${i + 1}`}
            selected={frame === i}
            onPress={() => setFrame(i)}
          />
        ))}
      </View>
      <View style={styles.chips}>
        {PIG_IDS.map((id) => (
          <Chip
            key={id}
            label={pigDefinition(id).name}
            selected={pigId === id}
            onPress={() => onPig(id)}
          />
        ))}
      </View>
      <Button variant={flagged ? "primary" : "gold"} onPress={onToggleFlag}>
        {flagged ? "Unflag this view" : "Flag this view"}
      </Button>
      <TextField
        label="Note"
        value={note}
        onChangeText={onNote}
        placeholder="what's wrong here"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: UI_COLORS.canvas },
  list: {
    paddingHorizontal: PAGE_PAD,
    paddingBottom: SPACE.xxl,
    gap: SPACE.md,
  },
  header: { gap: SPACE.sm, marginBottom: SPACE.xs },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.xs },
  columns: {
    flexDirection: "row",
    paddingHorizontal: SPACE.card + BORDER.ink,
    marginTop: SPACE.xs,
  },
  row: { gap: SPACE.sm },
  rowHead: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: SPACE.xs,
  },
  rowTitle: { flexShrink: 1 },
  strip: { flexDirection: "row", gap: SPACE.xs },
  cell: {
    aspectRatio: 1,
    borderRadius: RADII.sm,
    backgroundColor: UI_COLORS.surfaceMuted,
  },
  cellFlagged: {
    borderWidth: BORDER.heavy,
    borderColor: UI_COLORS.warningText,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: SPACE.sm,
    marginTop: SPACE.lg,
  },
  focus: { gap: SPACE.md, alignItems: "stretch" },
  focusStage: { alignSelf: "center" },
});

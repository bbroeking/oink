// The Snout Deep dialogs on the reveal family's Ledger (docs/reveal-family-
// spec.md §1): the tally — the tied receipt (§5.7) and the woke receipt (§5.8)
// — and the how-it-works ledger. (No layer-clear sheet: a loose truffle is
// the footer's decision, §5.5.) One left edge, lines not cards, two solid
// rules bracketing the body, one gold primary, a hand-link secondary. This is
// the interim ledger markup until `RevealSheet` / `LedgerRow` land as
// primitives; the grammar is theirs so the swap is a rename.
//
// The tally (2026-09-13): a before → now sticker in the Barn's counter role,
// then one row per find landing ~350 ms apart top to bottom; as each lands
// the top number rolls up by its tickles. A tap anywhere on the body hurries
// it (every row lands, the number settles). Under Reduce Motion everything is
// present at once. The server's receipt may correct the numbers while the
// roll-up runs (`reconcileReceipt`): the target re-aims, the roll never
// restarts.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { AdaptiveModalScaffold, Button, Hand, Icon, Kicker, KickerPill, PageTitle, Shovel, Snout, Sticker, T, Trotter } from "../ui";
import { ART_SIZE, BORDER, RADII, SPACE, UI_COLORS, WHIMSY } from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { popIn } from "@/utils/motionRecipes";
import {
  type DigReceipt,
  type DigReceiptRow,
  type FindTone,
} from "@/utils/snoutDeep";
import { FindMark } from "./FindMark";
import { Hungerer } from "./Hungerer";

// --- ART -------------------------------------------------------------------
// The reveal family's one width, and the ledger's fixed columns: the mark
// disc (the detail-card art step) with the painted mark on it (a row glyph —
// a step under the disc so it reads as a mark, not art), and the value
// column's ceiling so a long title never crushes it.
const REVEAL_MAX_W = 390;
const MARK_DISC = ART_SIZE.glyph;
const MARK_ART = ART_SIZE.glyphSm;
const VALUE_MAX_W = 88;
// The arrow between before and now — a mark beside two numerals.
const ARROW = ART_SIZE.glyphSm;

// --- MOTION ----------------------------------------------------------------
// The tally's cadence (spec §5.7): rows land ~350 ms apart — a beat per find,
// slower than any MOTION_DURATION step because each row is read, not just
// seen — after a first-row beat that lets the sheet's own pop-in settle. The
// count rolls toward its target a tick at a time, closing a quarter of the
// gap per tick so a big Boom lands in a few ticks and a +3 in three.
export const ROW_STAGGER_MS = 350;
const FIRST_ROW_MS = 450;
const COUNT_TICK_MS = 40;
const COUNT_ROLL_DIVISOR = 4;

const TONE_FILL: Readonly<Record<FindTone, string>> = {
  paper: WHIMSY.paper,
  sun: WHIMSY.sun,
  sage: WHIMSY.sage,
  rose: WHIMSY.rose,
  roseDeep: WHIMSY.roseDeep,
  lilac: WHIMSY.lilac,
};

// ── The ledger grammar ──────────────────────────────────────────────────────

function LedgerRow({
  first,
  mark,
  title,
  sub,
  value,
  valueNode,
  clampSub = true,
  onPress,
  pressLabel,
  pressHint,
}: {
  first: boolean;
  mark: ReactNode;
  title: string;
  sub?: string;
  value?: string;
  /** The value column drawn as a node (the tally's numeral); wins over `value`. */
  valueNode?: ReactNode;
  /** Receipt rows clamp their sub to two lines; an explanation says it all. */
  clampSub?: boolean;
  /** The row is a door (the uncrewed truffle row's join line). */
  onPress?: () => void;
  pressLabel?: string;
  pressHint?: string;
}) {
  const body = (
    <>
      {mark}
      <View style={styles.words}>
        <T role="body" numberOfLines={2}>
          {title}
        </T>
        {sub ? (
          <Hand tone={onPress ? "accent" : "secondary"} numberOfLines={clampSub ? 2 : undefined}>
            {sub}
          </Hand>
        ) : null}
      </View>
      {valueNode ??
        (value ? (
          <Hand numberOfLines={1} align="right" style={styles.value}>
            {value}
          </Hand>
        ) : null)}
    </>
  );
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={pressLabel ?? [title, sub].filter(Boolean).join(", ")}
        accessibilityHint={pressHint}
        onPress={onPress}
        style={[styles.row, !first && styles.rowRule]}
      >
        {body}
      </Pressable>
    );
  }
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={[title, sub, value].filter(Boolean).join(", ")}
      style={[styles.row, !first && styles.rowRule]}
    >
      {body}
    </View>
  );
}

function MarkDisc({ tone, children }: { tone: FindTone; children: ReactNode }) {
  return <View style={[styles.disc, { backgroundColor: TONE_FILL[tone] }]}>{children}</View>;
}

function Ledger({ children }: { children: ReactNode }) {
  return <View style={styles.ledger}>{children}</View>;
}

/** The family's frame: heading in the close rail's row, the popIn entrance,
 *  the 24pt inset. */
function LedgerSheet({
  visible,
  onClose,
  closeLabel,
  kicker,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  closeLabel: string;
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  const policy = useMotionPolicy();
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) {
      scale.setValue(0);
      opacity.setValue(0);
      return;
    }
    const anim = popIn(scale, opacity, policy);
    anim.start();
    return () => anim.stop();
  }, [visible, policy, scale, opacity]);
  return (
    <AdaptiveModalScaffold
      visible={visible}
      onRequestClose={onClose}
      animationType="fade"
      maxWidth={REVEAL_MAX_W}
      showCloseButton
      closeLabel={closeLabel}
      closeRowContent={
        <View style={styles.heading}>
          <Kicker>{kicker}</Kicker>
          <PageTitle numberOfLines={2}>{title}</PageTitle>
        </View>
      }
      contentContainerStyle={styles.sheet}
    >
      <Animated.View style={{ opacity, transform: [{ scale }] }}>{children}</Animated.View>
    </AdaptiveModalScaffold>
  );
}

// ── The payoff — the tally (§5.7 tied · §5.8 woke) ──────────────────────────

function receiptRowMark(row: DigReceiptRow) {
  return (
    <MarkDisc tone={row.tone}>
      <FindMark kind={row.mark} variant={row.variant} size={MARK_ART} />
    </MarkDisc>
  );
}

/** The tally row's value column: the tickles in accent Caprasimo, "his" in
 *  mute for the truffle he took, the plain hand value for a row that pays
 *  none (Pass XP). */
function tallyValue(row: DigReceiptRow): ReactNode {
  if (row.lost) {
    return (
      <Hand tone="secondary" numberOfLines={1} align="right" style={styles.value}>
        {row.value}
      </Hand>
    );
  }
  if (row.tickles != null) {
    return (
      <T role="numeral" tone="accent" numberOfLines={1} align="right" style={styles.value}>
        +{row.tickles}
      </T>
    );
  }
  return (
    <Hand numberOfLines={1} align="right" style={styles.value}>
      {row.value}
    </Hand>
  );
}

/** One row of the tally, landing when its turn comes (the popIn recipe; under
 *  Reduce Motion it is simply there). Unlanded rows keep their height so the
 *  sheet never grows row by row. */
function TallyRow({
  row,
  first,
  landed,
  onJoin,
}: {
  row: DigReceiptRow;
  first: boolean;
  landed: boolean;
  onJoin?: () => void;
}) {
  const policy = useMotionPolicy();
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!landed) {
      scale.setValue(0);
      opacity.setValue(0);
      return;
    }
    const anim = popIn(scale, opacity, policy);
    anim.start();
    return () => anim.stop();
  }, [landed, policy, scale, opacity]);
  const join = row.join && onJoin ? onJoin : undefined;
  return (
    <Animated.View
      style={{ opacity, transform: [{ scale }] }}
      accessibilityElementsHidden={!landed}
      testID={`tally-row-${row.id}`}
    >
      <LedgerRow
        first={first}
        mark={receiptRowMark(row)}
        title={row.title}
        sub={row.sub}
        value={row.value}
        valueNode={tallyValue(row)}
        onPress={join}
        pressLabel={join ? `${row.title}, +${row.tickles ?? 0}. Truffles are for herds. Find yours` : undefined}
        pressHint={join ? "Opens the Sounder join path" : undefined}
      />
    </Animated.View>
  );
}

/** The tally's count so far: the tickles of every landed row. */
function landedTotal(rows: readonly DigReceiptRow[], landed: number): number {
  let n = 0;
  for (let i = 0; i < landed && i < rows.length; i++) n += rows[i].tickles ?? 0;
  return n;
}

/** The tally's body — the hand line, the before → now count, the ledger and
 *  the foot — and its clock. Keyed on the sheet's visibility by its parent so
 *  every opening starts from nothing landed; a tap anywhere hurries it. */
function TallyBody({
  receipt,
  onJoin,
}: {
  receipt: DigReceipt;
  onJoin?: () => void;
}) {
  const woke = receipt.kind === "woke";
  const policy = useMotionPolicy();
  const rows = receipt.rows;
  const before = receipt.tickledBefore;

  // ── landing: rows land one by one; under Reduce Motion all are present ───
  const [landed, setLanded] = useState(() => (policy.reduceMotion ? rows.length : 0));
  useEffect(() => {
    if (policy.reduceMotion || landed >= rows.length) return;
    const id = setTimeout(
      () => setLanded((n) => Math.min(rows.length, n + 1)),
      landed === 0 ? FIRST_ROW_MS : ROW_STAGGER_MS,
    );
    return () => clearTimeout(id);
  }, [landed, rows.length, policy.reduceMotion]);
  const done = landed >= rows.length;

  // ── the count: rolls toward the landed total; the server may re-aim it ───
  // The number reads `before + landed` when the count is known and the dig's
  // own `+landed` when it is not (the server's receipt fills `before` in).
  const target = landedTotal(rows, landed);
  const [rolled, setRolled] = useState(() => (policy.reduceMotion ? target : 0));
  const shown = policy.reduceMotion ? target : rolled;
  useEffect(() => {
    if (policy.reduceMotion || rolled === target) return;
    const id = setTimeout(() => {
      setRolled((d) => {
        const diff = target - d;
        if (diff === 0) return d;
        const step = Math.sign(diff) * Math.max(1, Math.ceil(Math.abs(diff) / COUNT_ROLL_DIVISOR));
        return d + step;
      });
    }, COUNT_TICK_MS);
    return () => clearTimeout(id);
  }, [rolled, target, policy.reduceMotion]);

  const hurry = useCallback(() => {
    setLanded(rows.length);
    setRolled(landedTotal(rows, rows.length));
  }, [rows]);

  const settled = done && shown === target;
  const total = receipt.ticklesTotal;
  const nowLabel = before == null ? `+${shown}` : `${before + shown}`;
  const countLabel =
    before == null
      ? `${total} tickles this dig`
      : `${before} before, ${before + total} tickled now`;

  return (
    <Pressable
      onPress={hurry}
      disabled={settled}
      accessibilityRole="button"
      accessibilityLabel={settled ? "The tally" : "Hurry the tally"}
      accessibilityHint={settled ? undefined : "Lands every find and settles the count"}
      accessibilityState={{ disabled: settled }}
      style={styles.body}
    >
      <Hand tone="secondary">{receipt.countLine}</Hand>
      {receipt.wokeLine ? <Hand tone="secondary">{receipt.wokeLine}</Hand> : null}
      <Sticker
        color={woke ? "cream2" : "sun"}
        pad
        accessibilityRole="text"
        accessibilityLabel={countLabel}
        style={styles.count}
      >
        {before == null ? (
          <View style={styles.countCell}>
            <T role="hero" numberOfLines={1} style={styles.countNum}>
              {nowLabel}
            </T>
            <KickerPill star={false}>this dig</KickerPill>
          </View>
        ) : (
          <>
            <View style={styles.countCell}>
              <T role="hero" numberOfLines={1} style={styles.countNum}>
                {before}
              </T>
              <KickerPill star={false}>before</KickerPill>
            </View>
            <Icon name="arrowRight" size={ARROW} color={WHIMSY.ink} />
            <View style={styles.countCell}>
              <T role="hero" numberOfLines={1} style={styles.countNum}>
                {nowLabel}
              </T>
              <KickerPill star={false}>tickled now</KickerPill>
            </View>
          </>
        )}
      </Sticker>
      <Ledger>
        {rows.map((row, i) => (
          <TallyRow key={row.id} row={row} first={i === 0} landed={i < landed} onJoin={onJoin} />
        ))}
      </Ledger>
      <View style={styles.foot} accessibilityRole="text" accessibilityLabel={`the dig, +${total}`}>
        <T role="body">the dig</T>
        <T role="sectionTitle" tone="accent" numberOfLines={1}>
          +{total}
        </T>
      </View>
    </Pressable>
  );
}

export function DigReceiptSheet({
  visible,
  receipt,
  onPrimary,
  onSecondary,
  onJoin,
  onClose,
}: {
  visible: boolean;
  receipt: DigReceipt;
  onPrimary: () => void;
  /** "share the dig ›" — omit to hide the secondary. */
  onSecondary?: () => void;
  /** The uncrewed join line's destination. */
  onJoin?: () => void;
  onClose: () => void;
}) {
  return (
    <LedgerSheet
      visible={visible}
      onClose={onClose}
      closeLabel={receipt.primary}
      kicker={receipt.kicker}
      title={receipt.title}
    >
      {/* Keyed on visibility: every opening is a fresh tally. */}
      <TallyBody key={visible ? "open" : "shut"} receipt={receipt} onJoin={onJoin} />
      {receipt.nextTimeLine ? <Hand tone="accent">{receipt.nextTimeLine}</Hand> : null}
      <Button
        variant="gold"
        size="md"
        full
        onPress={onPrimary}
        accessibilityLabel={receipt.primary}
        accessibilityHint="Closes the receipt"
      >
        {receipt.primary}
      </Button>
      {receipt.joinLine && onJoin ? (
        <Button
          variant="handLink"
          size="sm"
          onPress={onJoin}
          style={styles.secondary}
          accessibilityLabel="Truffles are for herds. Find yours"
          accessibilityHint="Opens the Sounder join path"
        >
          {receipt.joinLine}
        </Button>
      ) : receipt.secondary && onSecondary ? (
        <Button
          variant="handLink"
          size="sm"
          onPress={onSecondary}
          style={styles.secondary}
          accessibilityLabel="Share the dig"
          accessibilityHint="Opens the share sheet"
        >
          {receipt.secondary}
        </Button>
      ) : null}
    </LedgerSheet>
  );
}

// ── How it works ────────────────────────────────────────────────────────────
// The whole game on one ledger: three verbs, three layers, the tie, the wake,
// and what he can and cannot eat. Opens from the sign, and once by itself on
// a player's first Snout Deep dig.

export const HELP_ROWS: readonly { mark: "sniff" | "rub" | "shove" | "layers" | "tie" | "wake" | "things"; title: string; sub: string; value?: string }[] = [
  { mark: "sniff", title: "Sniff", sub: "marks a tile with how many finds touch it. moves no mud. free in topsoil; a whisper of risk below", value: "quietest" },
  { mark: "rub", title: "Rub", sub: "clears a little on a tile and half on its neighbours. a half-cleared tile shows the shape underneath", value: "quiet" },
  { mark: "shove", title: "Shove", sub: "clears a tile and half the four around it. holding any tile shoves. fast, and he hears it", value: "loud" },
  { mark: "layers", title: "Three layers", sub: "topsoil · the mud · the root. deeper is richer — relics and Barn pieces live at the root — and he sleeps lighter", value: "deeper" },
  { mark: "tie", title: "Tie it off", sub: "banks this layer's truffle and ends the dig. Dig deeper banks it too, so each layer only ever stakes its own", value: "bank" },
  { mark: "wake", title: "If he wakes", sub: "he takes the truffle that is still loose on this layer — it comes back gilded next Feeding. nothing banked is ever touched", value: "his" },
  { mark: "things", title: "Things are yours", sub: "booms, acorns, tea, keepsakes, furnishings, relics — yours the moment they surface. he only ever eats truffles", value: "kept" },
];

function HelpMark({ mark }: { mark: (typeof HELP_ROWS)[number]["mark"] }) {
  if (mark === "sniff") return <MarkDisc tone="paper"><Snout size={MARK_ART} /></MarkDisc>;
  if (mark === "rub") return <MarkDisc tone="paper"><Trotter size={MARK_ART} /></MarkDisc>;
  if (mark === "shove") return <MarkDisc tone="sun"><Shovel size={MARK_ART} /></MarkDisc>;
  if (mark === "layers") return <MarkDisc tone="sage"><Icon name="chevronDown" size={MARK_ART} color={WHIMSY.ink} /></MarkDisc>;
  if (mark === "tie") return <MarkDisc tone="sage"><Icon name="check" size={MARK_ART} color={WHIMSY.ink} /></MarkDisc>;
  if (mark === "wake") return <MarkDisc tone="rose"><Hungerer state="awake" size={MARK_ART} /></MarkDisc>;
  return <MarkDisc tone="lilac"><FindMark kind="boom" size={MARK_ART} /></MarkDisc>;
}

export function SnoutDeepHelpSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <LedgerSheet visible={visible} onClose={onClose} closeLabel="Back to the patch" kicker="how it works" title="Snout Deep">
      <Hand tone="secondary">sniff to know, rub to take, dig as deep as you dare — tie off before he wakes.</Hand>
      <Ledger>
        {HELP_ROWS.map((row, i) => (
          <LedgerRow key={row.mark} first={i === 0} mark={<HelpMark mark={row.mark} />} title={row.title} sub={row.sub} value={row.value} clampSub={false} />
        ))}
      </Ledger>
      <Button variant="gold" size="md" full onPress={onClose} accessibilityLabel="Got it" accessibilityHint="Closes the explanation and returns to the patch">
        Got it
      </Button>
    </LedgerSheet>
  );
}

const styles = StyleSheet.create({
  // The sheet's inset: sides and bottom; the top is the close rail's row.
  sheet: {
    paddingHorizontal: SPACE.xl,
    paddingBottom: SPACE.xl,
  },
  heading: { gap: SPACE.xxs },
  // The body between two solid rules, the primary a card-pad under it.
  ledger: {
    marginTop: SPACE.md,
    marginBottom: SPACE.sm,
    borderTopWidth: BORDER.ink,
    borderBottomWidth: BORDER.ink,
    borderColor: UI_COLORS.border,
  },
  // The 3-column grid: disc · words · value; a dashed hairline on the top of
  // every row but the first.
  row: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: SPACE.sm,
    paddingVertical: SPACE.sm,
  },
  rowRule: {
    borderTopWidth: BORDER.hair,
    borderTopColor: UI_COLORS.uiMuted,
    borderStyle: "dashed",
  },
  disc: {
    width: MARK_DISC,
    height: MARK_DISC,
    borderRadius: RADII.pill,
    borderWidth: BORDER.thin,
    borderColor: UI_COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  words: { flex: 1, minWidth: 0 },
  value: { maxWidth: VALUE_MAX_W, fontVariant: ["tabular-nums"] },
  secondary: { alignSelf: "flex-start", marginTop: SPACE.xs },
  // The tally's body — the hand line, the count, the ledger, the foot — is
  // one press target: a tap anywhere hurries it.
  body: { gap: SPACE.xs, marginBottom: SPACE.card },
  // Before → now: two numerals across the sticker with the arrow between.
  count: {
    marginTop: SPACE.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  countCell: { alignItems: "center" },
  countNum: { fontVariant: ["tabular-nums"] },
  // "the dig · +67", on the baseline under the ledger's bottom rule.
  foot: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
});

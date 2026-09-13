// The Snout Deep dialogs on the reveal family's Ledger (docs/reveal-family-
// spec.md §1): the decision sheet when a layer's truffle is loose (§5.5), the
// tied receipt (§5.7) and the woke receipt (§5.8). One left edge, lines not
// cards, two solid rules bracketing the body, one gold primary, a hand-link
// secondary. This is the interim ledger markup until `RevealSheet` /
// `LedgerRow` land as primitives; the grammar is theirs so the swap is a
// rename.
import { useEffect, useRef, type ReactNode } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { AdaptiveModalScaffold, Button, Hand, Icon, Kicker, PageTitle, T } from "../ui";
import { BORDER, RADII, SPACE, UI_COLORS, WHIMSY } from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { popIn } from "@/utils/motionRecipes";
import {
  decisionCopy,
  type DigReceipt,
  type DigReceiptRow,
  type FindTone,
  type Layer,
} from "@/utils/snoutDeep";
import { FindMark } from "./FindMark";
import { Hungerer } from "./Hungerer";

// --- ART -------------------------------------------------------------------
// The reveal family's one width, and the ledger's fixed columns: the mark
// disc and the mark on it (a step under the disc so it reads as a mark, not
// art), and the value column's ceiling so a long title never crushes it.
const REVEAL_MAX_W = 390;
const MARK_DISC = 26;
const MARK_ART = 16;
const VALUE_MAX_W = 88;
// The woke sheet's face: the reveal portrait scale, not a spacing step.
const WOKE_FACE = 96;

const TONE_FILL: Readonly<Record<FindTone, string>> = {
  paper: WHIMSY.paper,
  sun: WHIMSY.sun,
  sage: WHIMSY.sage,
  rose: WHIMSY.rose,
  lilac: WHIMSY.lilac,
};

// ── The ledger grammar ──────────────────────────────────────────────────────

function LedgerRow({
  first,
  mark,
  title,
  sub,
  value,
}: {
  first: boolean;
  mark: ReactNode;
  title: string;
  sub?: string;
  value?: string;
}) {
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={[title, sub, value].filter(Boolean).join(", ")}
      style={[styles.row, !first && styles.rowRule]}
    >
      {mark}
      <View style={styles.words}>
        <T role="body" numberOfLines={2}>
          {title}
        </T>
        {sub ? (
          <Hand tone="secondary" numberOfLines={2}>
            {sub}
          </Hand>
        ) : null}
      </View>
      {value ? (
        <Hand numberOfLines={1} align="right" style={styles.value}>
          {value}
        </Hand>
      ) : null}
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

// ── The decision (§5.5) ─────────────────────────────────────────────────────

export function DecisionSheet({
  visible,
  layer,
  coop,
  gtSoFar,
  onDeeper,
  onTie,
  onClose,
}: {
  visible: boolean;
  layer: Layer;
  coop: boolean;
  /** Golden Truffles a tie would mint right now (uncrewed digs pass 0). */
  gtSoFar: number;
  onDeeper: () => void;
  onTie: () => void;
  onClose: () => void;
}) {
  const copy = decisionCopy(layer, coop, gtSoFar);
  return (
    <LedgerSheet
      visible={visible}
      onClose={onClose}
      closeLabel="Keep digging this layer"
      kicker={copy.kicker}
      title={copy.title}
    >
      <Hand tone="secondary">{copy.countLine}</Hand>
      <Ledger>
        <LedgerRow
          first
          mark={
            <MarkDisc tone="sun">
              <FindMark kind="truffles" size={MARK_ART} />
            </MarkDisc>
          }
          title={copy.tie.title}
          sub={copy.tie.sub}
          value={copy.tie.value}
        />
        <LedgerRow
          first={false}
          mark={
            <MarkDisc tone="rose">
              <Icon name="chevronDown" size={MARK_ART} color={WHIMSY.ink} />
            </MarkDisc>
          }
          title={copy.deeper.title}
          sub={copy.deeper.sub}
          value={copy.deeper.value}
        />
      </Ledger>
      <Button
        variant="gold"
        size="md"
        full
        onPress={onDeeper}
        accessibilityLabel={copy.primary}
        accessibilityHint="Banks the loose truffle and opens the next layer"
      >
        {copy.primary}
      </Button>
      <Button
        variant="handLink"
        size="sm"
        onPress={onTie}
        style={styles.secondary}
        accessibilityLabel="Tie it off instead"
        accessibilityHint="Banks the loose truffle and ends the dig"
      >
        {copy.secondary}
      </Button>
    </LedgerSheet>
  );
}

// ── The payoff (§5.7 tied · §5.8 woke) ──────────────────────────────────────

function receiptRowMark(row: DigReceiptRow) {
  return (
    <MarkDisc tone={row.tone}>
      <FindMark kind={row.mark} size={MARK_ART} />
    </MarkDisc>
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
  const woke = receipt.kind === "woke";
  return (
    <LedgerSheet
      visible={visible}
      onClose={onClose}
      closeLabel={receipt.primary}
      kicker={receipt.kicker}
      title={receipt.title}
    >
      {woke ? (
        <View style={styles.wokeFace}>
          <Hungerer state="awake" size={WOKE_FACE} />
          <View style={styles.wokeWords}>
            <Hand tone="secondary">{receipt.countLine}</Hand>
            {receipt.wokeLine ? <Hand>{receipt.wokeLine}</Hand> : null}
          </View>
        </View>
      ) : (
        <Hand tone="secondary">{receipt.countLine}</Hand>
      )}
      <Ledger>
        {receipt.rows.map((row, i) => (
          <LedgerRow
            key={row.id}
            first={i === 0}
            mark={receiptRowMark(row)}
            title={row.title}
            sub={row.sub}
            value={row.value}
          />
        ))}
      </Ledger>
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
    marginBottom: SPACE.card,
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
  wokeFace: { flexDirection: "row", alignItems: "center", columnGap: SPACE.lg },
  wokeWords: { flex: 1, minWidth: 0, gap: SPACE.xs },
});

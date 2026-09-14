// The Snout Deep dialogs on the reveal family's Ledger (docs/reveal-family-
// spec.md §1): the tied receipt (§5.7), the woke receipt (§5.8) and the
// how-it-works ledger. (No layer-clear sheet: a loose truffle is the footer's
// decision, §5.5.) One left edge, lines not
// cards, two solid rules bracketing the body, one gold primary, a hand-link
// secondary. This is the interim ledger markup until `RevealSheet` /
// `LedgerRow` land as primitives; the grammar is theirs so the swap is a
// rename.
import { useEffect, useRef, type ReactNode } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { AdaptiveModalScaffold, Button, Hand, Icon, Kicker, PageTitle, Shovel, Snout, T, Trotter } from "../ui";
import { BORDER, RADII, SPACE, UI_COLORS, WHIMSY } from "@/constants/theme";
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
  clampSub = true,
}: {
  first: boolean;
  mark: ReactNode;
  title: string;
  sub?: string;
  value?: string;
  /** Receipt rows clamp their sub to two lines; an explanation says it all. */
  clampSub?: boolean;
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
          <Hand tone="secondary" numberOfLines={clampSub ? 2 : undefined}>
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

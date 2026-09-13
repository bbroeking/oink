import { useMemo, useRef, useState, useEffect } from "react";
import { Image, StyleSheet, View } from "react-native";
import {
  AdaptiveModalScaffold,
  Body,
  Button,
  CardTitle,
  POPUP_HANDOFF_GAP_MS,
  POPUP_TEARDOWN_MS,
  SectionTitle,
  Sticker,
  usePopupSlot,
} from "@/components/ui";
import { habitatItemAsset } from "@/constants/habitat";
import { ROW_TILTS, SPACE } from "@/constants/theme";

import {
  useHabitatJournal,
  type HabitatJournalBackend,
} from "@/hooks/useHabitatJournal";
import type { HabitatCatalogItem } from "@/utils/habitat";
import type { HabitatAcquisition } from "@/utils/habitatCompletion";

// The gift portrait — product art at a fixed frame, not an icon step and not a
// spacing value, so the size carries its own name.
const GIFT_ART = { width: 120, height: 110 } as const;

/** Gift presentation is separate from New: Later acknowledges only the reveal. */
export function HabitatGiftReveal({
  accountId,
  catalog,
  enabled = true,
  onPreview,
  onDone,
  backend,
}: {
  accountId: string | null;
  catalog: readonly HabitatCatalogItem[];
  enabled?: boolean;
  onPreview: (item: HabitatCatalogItem) => void;
  onDone?: () => void;
  backend?: HabitatJournalBackend;
}) {
  const journal = useHabitatJournal(accountId, backend);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [batch, setBatch] = useState<{
    accountId: string;
    gifts: HabitatAcquisition[];
  } | null>(null);
  const busyRef = useRef(false);
  const teardownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);
  const currentAccount = useRef(accountId);
  const currentlyEnabled = useRef(enabled);
  currentAccount.current = accountId;
  currentlyEnabled.current = enabled;
  useEffect(() => {
    busyRef.current = false;
    setBusy(false);
    setError(false);
    setBatch(null);
    if (teardownTimer.current) clearTimeout(teardownTimer.current);
    if (previewTimer.current) clearTimeout(previewTimer.current);
    teardownTimer.current = null;
    previewTimer.current = null;
  }, [accountId]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (teardownTimer.current) clearTimeout(teardownTimer.current);
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, []);
  const candidates = useMemo(
    () =>
      journal.acquisitions.filter(
        (entry) =>
          !entry.presented &&
          entry.source !== "habitat_starter" &&
          entry.source !== "habitat_purchase" &&
          catalog.some((item) => item.id === entry.itemId),
      ),
    [journal.acquisitions, catalog],
  );
  useEffect(() => {
    if (accountId && !batch && candidates.length)
      setBatch({ accountId, gifts: candidates });
  }, [accountId, batch, candidates]);
  const gifts = batch?.accountId === accountId ? batch.gifts : [];
  const slot = usePopupSlot(
    `habitat-gifts:${accountId}`,
    enabled && gifts.length > 0,
    95,
  );
  const close = async (preview?: HabitatCatalogItem) => {
    if (
      busyRef.current ||
      !accountId ||
      !batch ||
      batch.accountId !== accountId
    )
      return;
    busyRef.current = true;
    const owner = accountId;
    const ids = gifts.map((gift) => gift.id);
    setBusy(true);
    setError(false);
    const saved = await journal.markPresented(ids);
    if (!mounted.current || currentAccount.current !== owner) return;
    if (!saved) {
      busyRef.current = false;
      setBusy(false);
      setError(true);
      return;
    }
    if (preview) {
      const seen = await journal.markSeen(
        gifts
          .filter((gift) => gift.itemId === preview.id)
          .map((gift) => gift.id),
      );
      if (!mounted.current || currentAccount.current !== owner) return;
      if (!seen) {
        busyRef.current = false;
        setBusy(false);
        setError(true);
        return;
      }
    }
    slot.release();
    setBusy(false);
    teardownTimer.current = setTimeout(() => {
      teardownTimer.current = null;
      if (!mounted.current || currentAccount.current !== owner) return;
      // Keep the duplicate-action guard latched through popup teardown, then
      // reopen it for a later acquisition batch on the same account.
      busyRef.current = false;
      setBatch(null);
      if (currentlyEnabled.current && !preview) onDone?.();
    }, POPUP_TEARDOWN_MS);
    if (preview) {
      previewTimer.current = setTimeout(() => {
        previewTimer.current = null;
        if (
          mounted.current &&
          currentAccount.current === owner &&
          currentlyEnabled.current
        ) {
          onPreview(preview);
          onDone?.();
        }
      }, POPUP_HANDOFF_GAP_MS);
    }
  };
  const newlyOwned = gifts.filter((gift) => gift.newlyOwned).length;
  return (
    <AdaptiveModalScaffold
      visible={slot.visible}
      onRequestClose={() => {
        void close();
      }}
      showCloseButton
      closeLabel="Keep gifts for later"
    >
      <View style={styles.content}>
        <SectionTitle accessibilityRole="header">
          {newlyOwned ? "A little more home" : "A Wallow worth remembering"}
        </SectionTitle>
        <Body tone="secondary">
          {newlyOwned
            ? `${newlyOwned === 1 ? "A new furnishing is" : `${newlyOwned} new furnishings are`} yours to keep. Try a spot in your Barn, or save them for later.`
            : "You already own these designs. This milestone is recorded, and everything stays yours."}
        </Body>
        {gifts.map((gift, index) => {
          const item = catalog.find((entry) => entry.id === gift.itemId);
          if (!item) return null;
          return (
            <Sticker
              key={gift.id}
              color="paper"
              rotate={ROW_TILTS[index % ROW_TILTS.length]}
              shadow="sm"
              style={styles.item}
            >
              <Image
                source={habitatItemAsset(item.assetKey)}
                style={styles.art}
                resizeMode="contain"
                accessible={false}
              />
              <CardTitle align="center">{item.name}</CardTitle>
              <Body tone="secondary">
                {gift.newlyOwned
                  ? "New · yours to keep"
                  : "Already in your collection"}
              </Body>
              <Button
                variant="gold"
                size="md"
                full
                disabled={busy}
                onPress={() => {
                  void close(item);
                }}
                accessibilityLabel={`Preview ${item.name} in my Barn`}
                accessibilityHint="Places it in your Barn draft so you can see it in the room"
              >
                Preview in my Barn
              </Button>
            </Sticker>
          );
        })}
        {error ? (
          <Body accessibilityRole="alert" tone="danger">
            Your choice could not be saved on this device. Please try again.
          </Body>
        ) : null}
        <Button
          variant="ghost"
          full
          disabled={busy}
          onPress={() => {
            void close();
          }}
          accessibilityLabel="Later"
          accessibilityHint="Keeps these gifts and closes this reveal"
        >
          Later
        </Button>
        <Body tone="secondary">
          Previewing changes your draft. Save when it feels right.
        </Body>
      </View>
    </AdaptiveModalScaffold>
  );
}
const styles = StyleSheet.create({
  content: { gap: SPACE.md },
  item: { gap: SPACE.sm, alignItems: "center", padding: SPACE.card },
  art: { ...GIFT_ART },
});

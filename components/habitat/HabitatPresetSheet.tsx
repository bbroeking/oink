// Saved rooms — the two-slot preset panel, rebuilt on the system in wave 3.
// It was an `AdaptiveModalScaffold` wearing a hand-rolled cream card, a
// hand-rolled text well and a bare `ActivityIndicator`: a component named
// `*Sheet` mounts the `Sheet` panel (spec §3.4), its rows are `Sticker`s, the
// name field is `TextField`, the spinner is `LoadingBeat`, the failure is
// `EmptyState kind="error"` with a retry action, and every word speaks through
// a text role. `keyboardAware` keeps Room 2's field above the keyboard.
// [A-03, A-19] (2026-09-11)
import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import {
  BodySm,
  Button,
  EmptyState,
  LoadingBeat,
  Sheet,
  Sticker,
  Tag,
  TextField,
} from "@/components/ui";
import { ROW_TILTS, SPACE } from "@/constants/theme";
import type { HabitatPositions, HabitatSnapshot } from "@/utils/habitat";
import { useHabitatPresets, type HabitatPresetBackend } from "@/hooks/useHabitatPresets";

const NAME_MAX_LENGTH = 30;

export function HabitatPresetSheet({ accountId, visible, onClose, positions, roomRevision, dirty, onActivated, backend }: {
  accountId: string | null;
  visible: boolean;
  onClose: () => void;
  positions: HabitatPositions<string | null>;
  roomRevision: number;
  dirty: boolean;
  onActivated: (snapshot: HabitatSnapshot) => void;
  backend?: HabitatPresetBackend;
}) {
  const presets = useHabitatPresets(accountId, backend);
  const [names, setNames] = useState<Record<1 | 2, string>>({ 1: "Room 1", 2: "Room 2" });
  const [edited, setEdited] = useState<ReadonlySet<1 | 2>>(new Set());
  useEffect(() => {
    if (!presets.data) return;
    setNames((current) => ({
      1: edited.has(1) ? current[1] : presets.data!.presets.find((p) => p.slot === 1)?.name ?? current[1],
      2: edited.has(2) ? current[2] : presets.data!.presets.find((p) => p.slot === 2)?.name ?? current[2],
    }));
  }, [edited, presets.data]);
  useEffect(() => {
    if (!presets.recoveredActivation) return;
    onActivated(presets.recoveredActivation);
    void presets.clearRecoveredActivation();
  }, [onActivated, presets]);
  if (!presets.supported && !presets.loading) return null;
  return (
    <Sheet
      open={visible}
      onClose={onClose}
      title="Saved rooms"
      subtitle="Keep two arrangements. Saving a room copies this draft; using one changes the Barn friends visit."
      closeLabel="Close saved rooms"
      keyboardAware
      testID="habitat-preset-sheet"
    >
      {presets.loading ? (
        <LoadingBeat label="opening your saved rooms" />
      ) : (
        ([1, 2] as const).map((slot) => {
          const preset = presets.data?.presets.find((candidate) => candidate.slot === slot);
          const active = presets.data?.activeSlot === slot;
          return (
            <Sticker
              key={slot}
              color="cream"
              rotate={ROW_TILTS[(slot - 1) % ROW_TILTS.length]}
              shadow="sm"
              title={`Room ${slot}`}
              right={active ? <Tag label="ACTIVE" tone="sun" /> : undefined}
              style={styles.card}
            >
              <TextField
                label={`Name for room ${slot}`}
                value={names[slot]}
                onChangeText={(name) => {
                  setEdited((value) => new Set(value).add(slot));
                  setNames((value) => ({ ...value, [slot]: name }));
                }}
                maxLength={NAME_MAX_LENGTH}
              />
              <Button
                full
                size="md"
                variant="ghost"
                disabled={!presets.storageReady || presets.busy || !names[slot].trim()}
                onPress={() => void presets.save(slot, names[slot], positions)}
                accessibilityLabel={preset ? `Replace room ${slot} with the current draft` : `Save the current draft as room ${slot}`}
                accessibilityHint="Overwrites this saved room with the arrangement you are editing"
              >
                {preset ? "Replace with current draft" : "Save current draft here"}
              </Button>
              {preset ? (
                <Button
                  full
                  size="md"
                  variant={active ? "locked" : "primary"}
                  disabled={!presets.storageReady || active || dirty || presets.busy}
                  onPress={() => void presets.activate(slot, roomRevision).then((result) => {
                    if (result?.ok && "snapshot" in result) onActivated(result.snapshot);
                  })}
                  accessibilityLabel={active ? `Room ${slot} is in use` : `Use room ${slot}`}
                  accessibilityHint="Replaces the Barn your friends visit with this saved room"
                >
                  {active ? "In use" : "Use this room"}
                </Button>
              ) : null}
              {dirty && preset && !active ? (
                <BodySm tone="secondary">Save or cancel your current draft first.</BodySm>
              ) : null}
            </Sticker>
          );
        })
      )}
      {presets.error ? (
        <EmptyState
          kind="error"
          title={presets.error}
          action={
            <Button
              size="md"
              variant="ghost"
              onPress={() => void (presets.conflictReason === "revision_conflict" && presets.conflict?.kind === "activate" ? onClose() : presets.conflict ? presets.retryConflict() : presets.refresh())}
            >
              {presets.conflictReason === "revision_conflict" && presets.conflict?.kind === "activate" ? "Close and review room" : presets.conflict ? "Retry with latest rooms" : "Retry"}
            </Button>
          }
        />
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: { padding: SPACE.card, gap: SPACE.sm, marginBottom: SPACE.md },
});

// Local-only adapters for exercising completion UI without touching Supabase.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { HabitatJournalBackend } from "@/hooks/useHabitatJournal";
import type { HabitatPresetBackend } from "@/hooks/useHabitatPresets";
import type { HabitatAcquisition, HabitatPreset } from "@/utils/habitatCompletion";
import { habitatAcceptanceBackend } from "./habitatAcceptanceBackend";

const KEY = "habitat:dev-acceptance:completion-v1";
type State = {
  seen: string[]; presented: string[]; wishlist: string[]; presets: HabitatPreset[];
  active: { slot: 1 | 2; roomRevision: number } | null;
  saves: Record<string, { payload: string; preset: HabitatPreset }>;
};
const initial = (): State => ({ seen: [], presented: [], wishlist: [], presets: [], active: null, saves: {} });
async function read(): Promise<State> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : initial();
}
const write = (state: State) => AsyncStorage.setItem(KEY, JSON.stringify(state));
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(work: () => Promise<T>) {
  const next = chain.catch(() => {}).then(work); chain = next; return next;
}
export const resetHabitatCompletionAcceptance = () => write(initial());
export const habitatAcceptanceJournalBackend: HabitatJournalBackend = {
  async fetch() {
    const owner = await habitatAcceptanceBackend.fetch();
    if (!owner.ok) return owner;
    const state = await read();
    const acquisitions: HabitatAcquisition[] = owner.owned.filter((item) => item.prestigeRank !== undefined).map((item) => ({
      id: item.id, itemId: item.id, source: "habitat_prestige", grantedAt: "2026-09-10T12:00:00Z",
      newlyOwned: true, seen: state.seen.includes(item.id), presented: state.presented.includes(item.id),
    }));
    return { ok: true, acquisitions, wishlist: state.wishlist };
  },
  acknowledge(ids, kind) { return serial(async () => {
    const owner = await habitatAcceptanceBackend.fetch(); if (!owner.ok) return owner;
    const state = await read(); state[kind] = [...new Set([...state[kind], ...ids])];
    await write(state); return { ok: true as const, updated: ids.length };
  }); },
  wishlist(itemId, saved) { return serial(async () => {
    const owner = await habitatAcceptanceBackend.fetch(); if (!owner.ok) return owner;
    const state = await read(); state.wishlist = [...new Set(saved ? [...state.wishlist, itemId] : state.wishlist.filter((id) => id !== itemId))];
    await write(state); return { ok: true as const, wishlist: state.wishlist };
  }); },
};
export const habitatAcceptancePresetBackend: HabitatPresetBackend = {
  async fetch() {
    const owner = await habitatAcceptanceBackend.fetch(); if (!owner.ok) return owner;
    const state = await read();
    return { ok: true, presets: state.presets, activeSlot: state.active?.roomRevision === owner.snapshot.revision ? state.active.slot : null };
  },
  save(input) { return serial(async () => {
    const owner = await habitatAcceptanceBackend.fetch(); if (!owner.ok) return owner;
    const state = await read(); const payload = JSON.stringify(input); const previous = state.saves[input.requestId];
    if (previous) return previous.payload === payload ? { ok: true as const, preset: previous.preset, replayed: true } : { ok: false as const, reason: "idempotency_mismatch" };
    const current = state.presets.find((entry) => entry.slot === input.slot);
    if ((current?.revision ?? null) !== input.expectedRevision) return { ok: false as const, reason: "revision_conflict" };
    const preset: HabitatPreset = { slot: input.slot, name: input.name, positions: input.positions, revision: (current?.revision ?? -1) + 1 };
    state.presets = [...state.presets.filter((entry) => entry.slot !== input.slot), preset];
    state.saves[input.requestId] = { payload, preset };
    if (state.active?.slot === input.slot && JSON.stringify(current?.positions) !== JSON.stringify(input.positions)) state.active = null;
    await write(state); return { ok: true as const, preset, replayed: false };
  }); },
  activate(input) { return serial(async () => {
    const state = await read(); const preset = state.presets.find((entry) => entry.slot === input.slot);
    if (!preset) return { ok: false as const, reason: "not_found" };
    if (input.expectedPresetRevision !== undefined && preset.revision !== input.expectedPresetRevision) return { ok: false as const, reason: "preset_revision_conflict" };
    const result = await habitatAcceptanceBackend.save({ positions: preset.positions, expectedRevision: input.expectedRevision, requestId: input.requestId });
    if (result.ok) { state.active = { slot: input.slot, roomRevision: result.snapshot.revision }; await write(state); }
    return result;
  }); },
};

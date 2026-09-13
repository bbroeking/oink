import type { MotePlayCommand } from "@/utils/moteGame";

export interface MoteCommandStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const PREFIX = "mote_game_pending_v2";
export const pendingMoteCommandKey = (accountId: string) => `${PREFIX}:${accountId}`;
export const rememberedMoteModeKey = (accountId: string) => `mote_game_mode_v1:${accountId}`;

function parsePendingMoteCommand(raw: string | null, accountId: string): MotePlayCommand | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<MotePlayCommand>;
    if (value.protocolVersion !== 2 || value.accountId !== accountId ||
      typeof value.requestId !== "string" || value.requestId.length < 8 ||
      (value.mode !== "reveal" && value.mode !== "wager") ||
      !Number.isSafeInteger(value.stakeMotes) || typeof value.expectedRulesVersion !== "string" ||
      typeof value.createdAt !== "string") return null;
    return value as MotePlayCommand;
  } catch { return null; }
}

export async function persistMoteCommand(storage: MoteCommandStorage, command: MotePlayCommand) {
  await storage.setItem(pendingMoteCommandKey(command.accountId), JSON.stringify(command));
}
export async function loadMoteCommand(storage: MoteCommandStorage, accountId: string) {
  return parsePendingMoteCommand(await storage.getItem(pendingMoteCommandKey(accountId)), accountId);
}
export async function clearMoteCommand(storage: MoteCommandStorage, command: MotePlayCommand) {
  const current = await loadMoteCommand(storage, command.accountId);
  if (current?.requestId === command.requestId)
    await storage.removeItem(pendingMoteCommandKey(command.accountId));
}

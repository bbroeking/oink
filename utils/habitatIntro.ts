// Reopen the existing queue-owned introduction without resetting discovery
// acknowledgements, starter gifts, or the player's saved room.
const listeners = new Set<(accountId: string) => void>();

export function showHabitatIntro(accountId: string) {
  for (const listener of listeners) listener(accountId);
}

export function subscribeHabitatIntro(listener: (accountId: string) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

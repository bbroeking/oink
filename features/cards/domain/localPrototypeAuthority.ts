import type { CardFinish } from "./catalog";
import {
  CARD_CATALOG, COLLECTION_CARD_BY_ID, LEGACY_FIVE_CARD_OPENING_FIXTURE, OPENING_FIXTURE,
} from "../data/catalog";
import { SPOOKY_SNOUTS_BY_ID, SPOOKY_SNOUTS_COSTUME_OPENING_FIXTURE, SPOOKY_SNOUTS_OPENING_FIXTURE } from "../data/seasonalCatalog";
import { HEDGE_RUN_KIT } from "./hedgeRun";
import {
  HALLOWEEN_LOGIN_GIFT_CAMPAIGN,
  HALLOWEEN_LOGIN_GIFT_POOL,
  type HalloweenLoginGiftReceipt,
} from "./halloweenLoginGift";

const knownCardIds: ReadonlySet<string> = new Set([
  ...COLLECTION_CARD_BY_ID.keys(),
  ...HALLOWEEN_LOGIN_GIFT_POOL.map(({ cardId }) => cardId),
]);
const loginGiftCardByCostume = new Map(HALLOWEEN_LOGIN_GIFT_POOL.map((entry) => [entry.costumeId, entry.cardId]));

export const LOCAL_CARD_DEMO_NOTICE =
  "Local demo only. This state is stored by the prototype and is not a server receipt or production reward.";
export const LOCAL_AUTHORITY_KIND = "local-demo" as const;
export const WELCOME_PACK_ID = "local-demo:welcome-pack:v1";
export const SPOOKY_SNOUTS_PACK_ID = "local-demo:spooky-snouts:v1";
export const SPOOKY_SNOUTS_COSTUME_PACK_ID = "local-demo:spooky-snouts-costumes:v1";
export const FOIL_PROGRESS_COST = 10;
export const LOCAL_HALLOWEEN_LOGIN_GIFT_RECEIPT_ID = `local-demo:${HALLOWEEN_LOGIN_GIFT_CAMPAIGN}`;

export type LocalFixtureId = "welcome" | "tenth-pack" | "all-repeat" | "dig-demo" | "spooky-snouts" | "spooky-snouts-costumes";
export interface LocalPackGrant { id: string; source: "fixed-demo-fixture"; fixtureId: LocalFixtureId; opened: boolean }
export interface OpeningResult { cardId: string; finish: CardFinish; isNew: boolean; copyNumber: number; itemUnlock?: { itemId: string; itemName: string; newlyOwned: boolean } }
export interface LocalOpeningReceipt {
  id: string;
  packId: string;
  authority: typeof LOCAL_AUTHORITY_KIND;
  results: readonly OpeningResult[];
  newCardCount: number;
  repeatProgressCredit: number;
}
export interface LocalCardAuthorityState {
  version: 1;
  authority: typeof LOCAL_AUTHORITY_KIND;
  notice: typeof LOCAL_CARD_DEMO_NOTICE;
  grants: Record<string, LocalPackGrant>;
  receipts: Record<string, LocalOpeningReceipt>;
  copies: Record<string, number>;
  finishes: Record<string, readonly CardFinish[]>;
  repeatProgress: number;
  foilClaimIds: Record<string, string>;
  selectedFoilGoal: string | null;
  cosmeticUnlocks: Record<string, string>;
  loginGift?: HalloweenLoginGiftReceipt;
}

export const createLocalCardAuthority = (): LocalCardAuthorityState => ({
  version: 1,
  authority: LOCAL_AUTHORITY_KIND,
  notice: LOCAL_CARD_DEMO_NOTICE,
  grants: {}, receipts: {}, copies: {}, finishes: {}, repeatProgress: 0, foilClaimIds: {}, selectedFoilGoal: null, cosmeticUnlocks: {},
});

export interface GrantLocalHalloweenLoginGiftOptions {
  draw: number;
  claimedAt?: string;
}

export interface LocalHalloweenLoginGiftGrantResult {
  state: LocalCardAuthorityState;
  status: "new" | "replay";
  receipt: HalloweenLoginGiftReceipt;
}

function currentTimestamp(): string {
  return new Date().toISOString();
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

export function grantLocalHalloweenLoginGift(
  state: LocalCardAuthorityState,
  { draw, claimedAt = currentTimestamp() }: GrantLocalHalloweenLoginGiftOptions,
): LocalHalloweenLoginGiftGrantResult {
  if (state.loginGift) return { state, status: "replay", receipt: state.loginGift };
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error("Local Halloween login gift draw must be within [0, 1)");
  if (!isIsoTimestamp(claimedAt)) throw new Error("Local Halloween login gift claimedAt must be an ISO timestamp");

  const selected = HALLOWEEN_LOGIN_GIFT_POOL[Math.floor(draw * HALLOWEEN_LOGIN_GIFT_POOL.length)];
  const receipt: HalloweenLoginGiftReceipt = {
    receiptId: LOCAL_HALLOWEEN_LOGIN_GIFT_RECEIPT_ID,
    campaignKey: HALLOWEEN_LOGIN_GIFT_CAMPAIGN,
    costumeId: selected.costumeId,
    cardId: selected.cardId,
    claimedAt,
    acknowledgedAt: null,
  };
  const finishes = new Set(state.finishes[selected.cardId] ?? []);
  finishes.add("standard");
  return {
    status: "new",
    receipt,
    state: {
      ...state,
      loginGift: receipt,
      copies: { ...state.copies, [selected.cardId]: (state.copies[selected.cardId] ?? 0) + 1 },
      finishes: { ...state.finishes, [selected.cardId]: [...finishes] },
      cosmeticUnlocks: state.cosmeticUnlocks[selected.costumeId]
        ? state.cosmeticUnlocks
        : { ...state.cosmeticUnlocks, [selected.costumeId]: receipt.receiptId },
    },
  };
}

export function ackLocalHalloweenLoginGift(
  state: LocalCardAuthorityState,
  acknowledgedAt = currentTimestamp(),
): LocalCardAuthorityState {
  if (!state.loginGift || state.loginGift.acknowledgedAt !== null) return state;
  if (!isIsoTimestamp(acknowledgedAt)) throw new Error("Local Halloween login gift acknowledgedAt must be an ISO timestamp");
  return { ...state, loginGift: { ...state.loginGift, acknowledgedAt } };
}

export function grantWelcomePack(state: LocalCardAuthorityState): LocalCardAuthorityState {
  if (state.grants[WELCOME_PACK_ID]) return state;
  const guaranteedIds = new Set([
    ...CARD_CATALOG.filter((card) => card.type === "legend").map((card) => card.id),
    ...HEDGE_RUN_KIT.map((card) => card.cardId),
  ]);
  const copies = { ...state.copies };
  const finishes = { ...state.finishes };
  for (const cardId of guaranteedIds) {
    copies[cardId] = Math.max(1, copies[cardId] ?? 0);
    finishes[cardId] = [...new Set([...(finishes[cardId] ?? []), "standard" as const])];
  }
  return {
    ...state, copies, finishes,
    grants: { ...state.grants, [WELCOME_PACK_ID]: { id: WELCOME_PACK_ID, source: "fixed-demo-fixture", fixtureId: "welcome", opened: false } },
  };
}

export function grantSpookySnoutsPack(state: LocalCardAuthorityState): LocalCardAuthorityState {
  if (state.grants[SPOOKY_SNOUTS_PACK_ID]) return state;
  return {
    ...state,
    grants: { ...state.grants, [SPOOKY_SNOUTS_PACK_ID]: { id: SPOOKY_SNOUTS_PACK_ID, source: "fixed-demo-fixture", fixtureId: "spooky-snouts", opened: false } },
  };
}

export function grantSpookySnoutsCostumePack(state: LocalCardAuthorityState): LocalCardAuthorityState {
  if (state.grants[SPOOKY_SNOUTS_COSTUME_PACK_ID]) return state;
  return {
    ...state,
    grants: { ...state.grants, [SPOOKY_SNOUTS_COSTUME_PACK_ID]: { id: SPOOKY_SNOUTS_COSTUME_PACK_ID, source: "fixed-demo-fixture", fixtureId: "spooky-snouts-costumes", opened: false } },
  };
}

export function grantFixturePack(
  state: LocalCardAuthorityState,
  packId: string,
  fixtureId: Exclude<LocalFixtureId, "welcome">,
): LocalCardAuthorityState {
  if (state.grants[packId]) return state;
  const copies = { ...state.copies };
  const finishes = { ...state.finishes };
  if (fixtureId === "all-repeat") {
    for (const { cardId } of OPENING_FIXTURE) {
      copies[cardId] = Math.max(1, copies[cardId] ?? 0);
      finishes[cardId] = [...new Set([...(finishes[cardId] ?? []), "standard" as const])];
    }
  }
  return {
    ...state, copies, finishes,
    grants: { ...state.grants, [packId]: { id: packId, source: "fixed-demo-fixture", fixtureId, opened: false } },
  };
}

export function openLocalPack(
  state: LocalCardAuthorityState,
  packId = WELCOME_PACK_ID,
): { state: LocalCardAuthorityState; receipt: LocalOpeningReceipt } {
  const prior = state.receipts[packId];
  if (prior) return { state, receipt: prior };
  const grant = state.grants[packId];
  if (!grant) throw new Error(`Unknown local pack grant: ${packId}`);

  const copies = { ...state.copies };
  const finishes: Record<string, readonly CardFinish[]> = { ...state.finishes };
  const cosmeticUnlocks = { ...state.cosmeticUnlocks };
  let repeatProgressCredit = 0;
  const fixture = grant.fixtureId === "spooky-snouts" ? SPOOKY_SNOUTS_OPENING_FIXTURE
    : grant.fixtureId === "spooky-snouts-costumes" ? SPOOKY_SNOUTS_COSTUME_OPENING_FIXTURE
    : OPENING_FIXTURE;
  const results: OpeningResult[] = fixture.map(({ cardId, finish }) => {
    const before = copies[cardId] ?? 0;
    copies[cardId] = before + 1;
    if (before > 0 && grant.fixtureId !== "spooky-snouts" && grant.fixtureId !== "spooky-snouts-costumes") repeatProgressCredit += 1;
    const owned = new Set(finishes[cardId] ?? []);
    owned.add(finish);
    finishes[cardId] = [...owned];
    const item = SPOOKY_SNOUTS_BY_ID.get(cardId)?.unlock;
    const itemWasOwned = item ? Boolean(cosmeticUnlocks[item.itemId]) : false;
    if (item && before === 0 && !itemWasOwned) cosmeticUnlocks[item.itemId] = `opening:${packId}`;
    return { cardId, finish, isNew: before === 0, copyNumber: before + 1,
      ...(item ? { itemUnlock: { itemId: item.itemId, itemName: item.itemName, newlyOwned: before === 0 && !itemWasOwned } } : {}) };
  });
  const receipt: LocalOpeningReceipt = {
    id: `opening:${packId}`,
    packId,
    authority: LOCAL_AUTHORITY_KIND,
    results,
    newCardCount: results.filter((result) => result.isNew).length,
    repeatProgressCredit,
  };
  return {
    receipt,
    state: {
      ...state,
      grants: { ...state.grants, [packId]: { ...grant, opened: true } },
      receipts: { ...state.receipts, [packId]: receipt },
      copies,
      finishes,
      repeatProgress: state.repeatProgress + repeatProgressCredit,
      cosmeticUnlocks,
    },
  };
}

export function claimLocalFoil(
  state: LocalCardAuthorityState,
  cardId: string,
  claimId: string,
): LocalCardAuthorityState {
  const claimedCard = state.foilClaimIds[claimId];
  if (claimedCard) {
    if (claimedCard !== cardId) throw new Error("A foil claim ID cannot target two cards");
    return state;
  }
  if (!(state.copies[cardId] > 0)) throw new Error("The foil target must be owned");
  if ((state.finishes[cardId] ?? []).includes("foil")) throw new Error("The foil target is already owned");
  if (state.repeatProgress < FOIL_PROGRESS_COST) throw new Error("Not enough repeat progress");
  return {
    ...state,
    repeatProgress: state.repeatProgress - FOIL_PROGRESS_COST,
    foilClaimIds: { ...state.foilClaimIds, [claimId]: cardId },
    finishes: { ...state.finishes, [cardId]: [...(state.finishes[cardId] ?? []), "foil"] },
  };
}

export function selectFoilGoal(state: LocalCardAuthorityState, cardId: string | null): LocalCardAuthorityState {
  if (cardId !== null && !(state.copies[cardId] > 0)) throw new Error("The foil goal must be an owned card");
  return state.selectedFoilGoal === cardId ? state : { ...state, selectedFoilGoal: cardId };
}

export function restoreLocalCardAuthority(value: unknown): LocalCardAuthorityState {
  if (!value || typeof value !== "object") return createLocalCardAuthority();
  const candidate = value as Partial<LocalCardAuthorityState>;
  if (
    candidate.version !== 1 || candidate.authority !== LOCAL_AUTHORITY_KIND ||
    candidate.notice !== LOCAL_CARD_DEMO_NOTICE || !candidate.grants || !candidate.receipts ||
    !candidate.copies || !candidate.finishes || !candidate.foilClaimIds ||
    !Number.isInteger(candidate.repeatProgress) || candidate.repeatProgress! < 0 ||
    !(candidate.selectedFoilGoal === null || typeof candidate.selectedFoilGoal === "string")
  ) return createLocalCardAuthority();

  const finishes = ["standard", "foil", "living"] as const;
  const fixtureIds = ["welcome", "tenth-pack", "all-repeat", "dig-demo", "spooky-snouts", "spooky-snouts-costumes"] as const;
  const cosmeticUnlocks = candidate.cosmeticUnlocks ?? {};
  if (!cosmeticUnlocks || typeof cosmeticUnlocks !== "object" || Array.isArray(cosmeticUnlocks)) return createLocalCardAuthority();
  const loginGift = candidate.loginGift;
  if (loginGift !== undefined && (
    !loginGift || loginGift.receiptId !== LOCAL_HALLOWEEN_LOGIN_GIFT_RECEIPT_ID ||
    loginGift.campaignKey !== HALLOWEEN_LOGIN_GIFT_CAMPAIGN ||
    loginGiftCardByCostume.get(loginGift.costumeId) !== loginGift.cardId ||
    !isIsoTimestamp(loginGift.claimedAt) ||
    !(loginGift.acknowledgedAt === null || isIsoTimestamp(loginGift.acknowledgedAt)) ||
    !(candidate.copies[loginGift.cardId] > 0) ||
    !candidate.finishes[loginGift.cardId]?.includes("standard")
  )) return createLocalCardAuthority();
  for (const [itemId, receiptId] of Object.entries(cosmeticUnlocks)) {
    const isGiftProvenance = loginGift?.costumeId === itemId && receiptId === loginGift.receiptId;
    if (!itemId || typeof receiptId !== "string" || (!receiptId.startsWith("opening:") && !isGiftProvenance)) {
      return createLocalCardAuthority();
    }
  }
  for (const [cardId, count] of Object.entries(candidate.copies)) {
    if (!knownCardIds.has(cardId) || !Number.isInteger(count) || count < 0) return createLocalCardAuthority();
  }
  for (const [cardId, values] of Object.entries(candidate.finishes)) {
    if (
      !knownCardIds.has(cardId) || !Array.isArray(values) ||
      values.some((finish) => !finishes.includes(finish as CardFinish)) || new Set(values).size !== values.length ||
      (values.length > 0 && !(candidate.copies[cardId] > 0))
    ) return createLocalCardAuthority();
  }
  for (const [packId, grant] of Object.entries(candidate.grants)) {
    if (
      !grant || grant.id !== packId || grant.source !== "fixed-demo-fixture" ||
      !fixtureIds.includes(grant.fixtureId) || typeof grant.opened !== "boolean"
    ) return createLocalCardAuthority();
  }
  const receiptUnlocks: Record<string, string> = {};
  const repeatedUnlockIds = new Set<string>();
  for (const [packId, receipt] of Object.entries(candidate.receipts)) {
    const grant = candidate.grants[packId];
    if (
      !grant?.opened || !receipt || receipt.id !== `opening:${packId}` || receipt.packId !== packId ||
      receipt.authority !== LOCAL_AUTHORITY_KIND || !Array.isArray(receipt.results) ||
      (receipt.results.length !== OPENING_FIXTURE.length && receipt.results.length !== LEGACY_FIVE_CARD_OPENING_FIXTURE.length) ||
      !Number.isInteger(receipt.newCardCount) || receipt.newCardCount < 0 || receipt.newCardCount > receipt.results.length ||
      !Number.isInteger(receipt.repeatProgressCredit) || receipt.repeatProgressCredit < 0 ||
      receipt.repeatProgressCredit > receipt.results.length
    ) return createLocalCardAuthority();
    const receiptFixture = grant.fixtureId === "spooky-snouts" ? SPOOKY_SNOUTS_OPENING_FIXTURE
      : grant.fixtureId === "spooky-snouts-costumes" ? SPOOKY_SNOUTS_COSTUME_OPENING_FIXTURE
      : receipt.results.length === OPENING_FIXTURE.length ? OPENING_FIXTURE : LEGACY_FIVE_CARD_OPENING_FIXTURE;
    if (receipt.results.length !== receiptFixture.length) return createLocalCardAuthority();
    let newCount = 0; let repeatCount = 0;
    for (const [index, result] of receipt.results.entries()) {
      const fixtureResult = receiptFixture[index];
      if (
        !result || !knownCardIds.has(result.cardId) || !finishes.includes(result.finish) ||
        result.cardId !== fixtureResult.cardId || result.finish !== fixtureResult.finish ||
        typeof result.isNew !== "boolean" || !Number.isInteger(result.copyNumber) || result.copyNumber < 1 ||
        result.isNew !== (result.copyNumber === 1) ||
        (candidate.copies[result.cardId] ?? 0) < result.copyNumber ||
        !candidate.finishes[result.cardId]?.includes(result.finish)
      ) return createLocalCardAuthority();
      const expectedUnlock = SPOOKY_SNOUTS_BY_ID.get(result.cardId)?.unlock;
      if (!expectedUnlock && result.itemUnlock) return createLocalCardAuthority();
      if (expectedUnlock && (
        result.itemUnlock?.itemId !== expectedUnlock.itemId || result.itemUnlock.itemName !== expectedUnlock.itemName ||
        typeof result.itemUnlock.newlyOwned !== "boolean" || (result.copyNumber > 1 && result.itemUnlock.newlyOwned)
      )) return createLocalCardAuthority();
      if (result.itemUnlock?.newlyOwned) {
        if (receiptUnlocks[result.itemUnlock.itemId]) return createLocalCardAuthority();
        receiptUnlocks[result.itemUnlock.itemId] = receipt.id;
      } else if (result.itemUnlock) repeatedUnlockIds.add(result.itemUnlock.itemId);
      if (result.isNew) newCount += 1;
      else if (grant.fixtureId !== "spooky-snouts" && grant.fixtureId !== "spooky-snouts-costumes") repeatCount += 1;
    }
    if (newCount !== receipt.newCardCount || repeatCount !== receipt.repeatProgressCredit) return createLocalCardAuthority();
  }
  if ([...repeatedUnlockIds].some((itemId) => !receiptUnlocks[itemId])) return createLocalCardAuthority();
  if (loginGift && !receiptUnlocks[loginGift.costumeId]) {
    receiptUnlocks[loginGift.costumeId] = loginGift.receiptId;
  }
  if (
    Object.keys(cosmeticUnlocks).length !== Object.keys(receiptUnlocks).length ||
    Object.entries(receiptUnlocks).some(([itemId, receiptId]) => cosmeticUnlocks[itemId] !== receiptId)
  ) return createLocalCardAuthority();
  for (const grant of Object.values(candidate.grants)) {
    if (grant.opened !== Boolean(candidate.receipts[grant.id])) return createLocalCardAuthority();
  }
  for (const [claimId, cardId] of Object.entries(candidate.foilClaimIds)) {
    if (!claimId || !knownCardIds.has(cardId) || !candidate.finishes[cardId]?.includes("foil")) return createLocalCardAuthority();
  }
  if (candidate.selectedFoilGoal !== null &&
    (!knownCardIds.has(candidate.selectedFoilGoal) || !(candidate.copies[candidate.selectedFoilGoal] > 0))) {
    return createLocalCardAuthority();
  }
  return (candidate.cosmeticUnlocks ? candidate : { ...candidate, cosmeticUnlocks: receiptUnlocks }) as LocalCardAuthorityState;
}

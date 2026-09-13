import { router } from "expo-router";
import { supabase } from "@/utils/supabase";
import { openOwnHabitatCollection } from "@/utils/habitatNavigation";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
const mockUnsubscribe = jest.fn();
let mockListener: (event: string, session: { user: { id: string } } | null) => void;
jest.mock("@/utils/supabase", () => ({ supabase: { auth: {
  getUser: jest.fn(),
  onAuthStateChange: jest.fn((listener) => {
    mockListener = listener;
    return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
  }),
} } }));

describe("visit to own collection navigation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: "viewer" } }, error: null } as never);
  });
  afterEach(() => jest.useRealTimers());

  it("dismisses the visit before routing and carries only the furnishing ID", async () => {
    const dismiss = jest.fn();
    openOwnHabitatCollection("tiny_radio", "viewer", dismiss);
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(350);
    expect(router.push).toHaveBeenCalledWith({ pathname: "/barn-collection", params: { itemId: "tiny_radio" } });
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it("cancels after an account change even if the original account returns", async () => {
    openOwnHabitatCollection("tiny_radio", "viewer", jest.fn());
    mockListener("SIGNED_IN", { user: { id: "different" } });
    mockListener("SIGNED_IN", { user: { id: "viewer" } });
    await jest.advanceTimersByTimeAsync(350);
    expect(router.push).not.toHaveBeenCalled();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it("does not navigate when the authenticated viewer cannot be confirmed", async () => {
    jest.mocked(supabase.auth.getUser).mockRejectedValue(new Error("offline"));
    openOwnHabitatCollection("tiny_radio", "viewer", jest.fn());
    await jest.advanceTimersByTimeAsync(350);
    expect(router.push).not.toHaveBeenCalled();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});

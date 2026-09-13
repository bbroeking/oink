import { createMoteSensoryController, parseMoteSensorySettings } from "../components/mote-machine/moteMachineSensory";
import { getMoteCueSchedule, type MoteSensoryPresentation } from "../components/mote-machine/moteMachineTiming";

const play: MoteSensoryPresentation = { receiptId: "stored-result-1", stake: 3, outcome: "big", acorns: 3,
  newlyUnlocked: true, recovered: false, reduceMotion: false, presentationVersion: "mote-animation-v4" };
function setup() {
  const driver = { preload: jest.fn(), sound: jest.fn(), haptic: jest.fn(), pause: jest.fn(),
    release: jest.fn(), globallyMuted: jest.fn(() => false) };
  const controller = createMoteSensoryController(driver);
  controller.setActive(true);
  return { driver, controller };
}
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it("never celebrates losses or returned stakes and preserves exact neutral cues", () => {
  for (const outcome of ["loss", "returned_stake"] as const) {
    const schedule = getMoteCueSchedule({ ...play, outcome, acorns: 0, newlyUnlocked: false });
    expect(schedule.some(event => event.haptic === "success")).toBe(false);
    expect(schedule.some(event => event.cue === "acorn_award")).toBe(false);
    expect(schedule.some(event => event.cue === outcome)).toBe(true);
  }
});
it("suppresses every award and haptic on receipt recovery", () => {
  expect(getMoteCueSchedule({ ...play, recovered: true })).toEqual([{at: 0, cue: "receipt_replay"}]);
});
it("caps Reduced Motion at two haptics across all outcomes and stakes", () => {
  for (const outcome of ["loss", "returned_stake", "small", "medium", "big", "jackpot"] as const) {
    for (const stake of [1,3,5]) {
      const schedule = getMoteCueSchedule({ ...play, outcome, stake, reduceMotion: true });
      expect(schedule.filter(event => event.haptic).length).toBeLessThanOrEqual(2);
      expect(schedule.some(event => event.cue === "reel_loop")).toBe(false);
    }
  }
});
it("latches receipt identities without cancelling their existing choreography", () => {
  const { controller, driver } = setup();
  controller.playPresentation(play);
  jest.advanceTimersByTime(600);
  controller.playPresentation(play);
  jest.runAllTimers();
  expect(driver.sound.mock.calls.filter(([cue]) => cue === "deposit_bundle")).toHaveLength(1);
  expect(driver.sound.mock.calls.filter(([cue]) => cue === "first_unlock")).toHaveLength(1);
});
it("pauses current players immediately on mute and honors independent haptic settings", () => {
  const { controller, driver } = setup();
  controller.playPresentation(play);
  jest.advanceTimersByTime(1000);
  const before = driver.sound.mock.calls.length;
  controller.setSettings({ sound: false, haptics: false });
  const hapticsBefore = driver.haptic.mock.calls.length;
  jest.runAllTimers();
  expect(driver.pause).toHaveBeenCalled();
  expect(driver.sound).toHaveBeenCalledTimes(before);
  expect(driver.haptic).toHaveBeenCalledTimes(hapticsBefore);
});
it("never restarts celebration after backgrounding or effect reactivation", () => {
  const { controller, driver } = setup();
  controller.playPresentation(play);
  jest.advanceTimersByTime(800);
  controller.setActive(false);
  const before = driver.sound.mock.calls.length;
  controller.setActive(true);
  controller.playPresentation(play);
  jest.runAllTimers();
  expect(driver.sound).toHaveBeenCalledTimes(before);
});
it("treats unavailable audio/haptics as no-ops and honors global sound mute", () => {
  const { controller, driver } = setup();
  driver.globallyMuted.mockReturnValue(true);
  driver.haptic.mockImplementation(() => { throw new Error("unsupported"); });
  controller.playPresentation(play);
  expect(() => jest.runAllTimers()).not.toThrow();
  expect(driver.sound).not.toHaveBeenCalled();
  controller.dispose();
  expect(driver.release).toHaveBeenCalledTimes(1);
});
it("parses persisted false switches without treating them as missing", () => {
  expect(parseMoteSensorySettings('{"sound":false,"haptics":false}')).toEqual({sound:false,haptics:false});
  expect(parseMoteSensorySettings('broken')).toEqual({sound:true,haptics:true});
});

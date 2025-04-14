import { withCleanup } from "./withCleanup.js";

declare global {
  interface DateConstructor {
    /* Jest uses @sinonjs/fake-timers, that add this flag */
    isFake: boolean;
  }
}

export function enableFakeTimers(
  config?: FakeTimersConfig | LegacyFakeTimersConfig
) {
  if (global.Date.isFake === true) {
    // Nothing to do here, fake timers have already been set up.
    // That also means we don't want to clean that up later.
    return withCleanup({}, () => {});
  }

  jest.useFakeTimers(config);
  return withCleanup({}, () => {
    if (global.Date.isFake === true) {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    }
  });
}

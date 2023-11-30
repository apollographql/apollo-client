import type { MatcherFunction } from "expect";

export const toBeGarbageCollected: MatcherFunction<[weakRef: WeakRef<any>]> =
  async function (actual) {
    const hint = this.utils.matcherHint("toBeGarbageCollected");

    if (!(actual instanceof WeakRef)) {
      throw new Error(
        hint +
          "\n\n" +
          `Expected value to be a WeakRef, but it was a ${typeof actual}.`
      );
    }

    let pass = false;
    let interval: NodeJS.Timeout | undefined;
    let timeout: NodeJS.Timeout | undefined;
    await Promise.race([
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, 1000);
      }),
      new Promise<void>((resolve) => {
        interval = setInterval(() => {
          global.gc!();
          pass = actual.deref() === undefined;
          if (pass) {
            resolve();
          }
        }, 1);
      }),
    ]);

    clearInterval(interval);
    clearTimeout(timeout);

    return {
      pass,
      message: () => {
        if (pass) {
          return (
            hint +
            "\n\n" +
            "Expected value to not be cache-collected, but it was."
          );
        }

        return (
          hint + "\n\n Expected value to be cache-collected, but it was not."
        );
      },
    };
  };

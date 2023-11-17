import type { MatcherFunction } from "expect";

declare class WeakRef<T extends WeakKey> {
  constructor(target: T);
  deref(): T | undefined;
}

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
    await Promise.race([
      new Promise<void>((resolve) => setTimeout(resolve, 1000)),
      new Promise<void>((resolve) => {
        setInterval(() => {
          global.gc!();
          pass = actual.deref() === undefined;
          if (pass) {
            resolve();
          }
        }, 1);
      }),
    ]).finally(() => clearInterval(interval));

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

import type { MatcherContext, MatcherFunction } from "expect";

import type { ObservableSubscriber } from "@apollo/client/testing/internal";

import type { TakeOptions } from "../internal/ObservableSubscriber.js";

function isErrorEqual(this: MatcherContext, expected: any, actual: any) {
  if (typeof expected === "string" && actual instanceof Error) {
    return actual.message === expected;
  }

  return this.equals(expected, actual, this.customTesters);
}

export const toObserveError: MatcherFunction<
  [value?: any, options?: TakeOptions]
> = async function (actual, expected, options) {
  const observer = actual as ObservableSubscriber<any>;
  const hint = this.utils.matcherHint("toObserveError", "observer", "error", {
    isNot: this.isNot,
  });

  try {
    const error = await observer.takeError(options);
    const pass =
      expected === undefined ? true : isErrorEqual.call(this, expected, error);

    return {
      pass,
      message: () => {
        if (pass) {
          return (
            hint +
            "\n\nExpected observer not to have received error notification but it did." +
            `\n\nReceived:` +
            `\n` +
            this.utils.printReceived(error)
          );
        }

        return (
          hint +
          "\n\n" +
          this.utils.printDiffOrStringify(
            expected,
            typeof expected === "string" ? error.message : error,
            "Expected",
            "Recieved",
            true
          )
        );
      },
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Timeout waiting for next event"
    ) {
      return {
        pass: false,
        message: () =>
          hint +
          "\n\nExpected observer to have received an error notification but it did not.",
      };
    } else {
      throw error;
    }
  }
};

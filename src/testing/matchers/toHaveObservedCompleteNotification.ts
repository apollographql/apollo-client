import type { MatcherFunction } from "expect";

import type { ObservableSubscriber } from "@apollo/client/testing/internal";

import type { TakeOptions } from "../internal/ObservableSubscriber.js";

export const toHaveObservedCompleteNotification: MatcherFunction<
  [options?: TakeOptions]
> = async function (actual, options) {
  const observer = actual as ObservableSubscriber<any>;
  const hint = this.utils.matcherHint(
    "toHaveObservedCompleteNotification",
    "observer",
    "",
    { isNot: this.isNot }
  );

  try {
    await observer.takeComplete(options);

    return {
      pass: true,
      message: () => {
        return (
          hint +
          "\n\nExpected observer not to have received complete notification but it did."
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
          "\n\nExpected observer to have received complete notification but it did not.",
      };
    } else {
      throw error;
    }
  }
};

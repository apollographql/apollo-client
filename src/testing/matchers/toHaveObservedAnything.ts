import type { MatcherFunction } from "expect";

import type { ObservableSubscriber } from "@apollo/client/testing/internal";

import type { TakeOptions } from "../internal/ObservableSubscriber.js";

export const toHaveObservedAnything: MatcherFunction<[options?: TakeOptions]> =
  async function (actual, options) {
    const observer = actual as ObservableSubscriber<any>;
    const hint = this.utils.matcherHint(
      "toHaveObservedAnything",
      "observer",
      "",
      { isNot: this.isNot }
    );

    try {
      const value = await observer.peek(options);

      return {
        pass: true,
        message: () => {
          return (
            hint +
            "\n\nExpected observable not to have observed any notification but it did." +
            "\n\nReceived:\n" +
            this.utils.printReceived(value)
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
            "\n\nExpected observer to have observed a notification but it did not.",
        };
      } else {
        throw error;
      }
    }
  };

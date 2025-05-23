import { iterableEquality } from "@jest/expect-utils";
import type { MatcherFunction } from "expect";
import type { MatcherHintOptions } from "jest-matcher-utils";

import type { ObservableSubscriber } from "@apollo/client/testing/internal";

import type { TakeOptions } from "../internal/ObservableSubscriber.js";

import { getSerializableProperties } from "./utils/getSerializableProperties.js";

export const toObserveTypedValue: MatcherFunction<
  [
    value: any,
    options?: TakeOptions & {
      received?: string;
      expected?: string;
      hintOptions?: MatcherHintOptions;
    },
  ]
> = async function (actual, expected, options) {
  const observer = actual as ObservableSubscriber<any>;
  const hint = this.utils.matcherHint(
    "toObserveTypedValue",
    options?.received || "observer",
    options?.expected || "expected",
    { ...options?.hintOptions, isNot: this.isNot }
  );

  try {
    const value = await observer.takeNext(options);
    const serializableProperties = getSerializableProperties(value);

    const pass = this.equals(
      serializableProperties,
      expected,
      // https://github.com/jestjs/jest/blob/22029ba06b69716699254bb9397f2b3bc7b3cf3b/packages/expect/src/matchers.ts#L62-L67
      [...this.customTesters, iterableEquality],
      true
    );

    return {
      pass,
      message: () => {
        if (pass) {
          return (
            hint +
            "\n\nExpected observer not to receive emitted value equal to expected but it did."
          );
        }

        return (
          hint +
          "\n\n" +
          this.utils.printDiffOrStringify(
            expected,
            serializableProperties,
            "Expected",
            "Received",
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
          "\n\nExpected observer to receive an emitted value but it did not.",
      };
    } else {
      throw error;
    }
  }
};

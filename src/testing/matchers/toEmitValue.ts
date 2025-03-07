import { iterableEquality } from "@jest/expect-utils";
import type { MatcherFunction } from "expect";

import type { ObservableStream } from "../internal/index.js";
import type { TakeOptions } from "../internal/ObservableStream.js";

export const toEmitValue: MatcherFunction<[value: any, options?: TakeOptions]> =
  async function (actual, expected, options) {
    const stream = actual as ObservableStream<any>;
    const hint = this.utils.matcherHint(
      this.isNot ? ".not.toEmitValue" : "toEmitValue",
      "stream",
      "expected"
    );

    try {
      const value = await stream.takeNext(options);
      const pass = this.equals(value, expected, [
        ...this.customTesters,
        iterableEquality,
      ]);

      return {
        pass,
        message: () => {
          if (pass) {
            return (
              hint +
              "\n\nExpected stream not to emit a value equal to expected but it did."
            );
          }

          return (
            hint +
            "\n\n" +
            this.utils.printDiffOrStringify(
              expected,
              value,
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
            hint + "\n\nExpected stream to emit a value but it did not.",
        };
      } else {
        throw error;
      }
    }
  };

import type { MatcherFunction } from "expect";
import type { ObservableStream } from "../internal/index.js";
import type { TakeOptions } from "../internal/ObservableStream.js";

export const toEmitNext: MatcherFunction<[options?: TakeOptions]> =
  async function (actual, options) {
    const stream = actual as ObservableStream<any>;
    const hint = this.utils.matcherHint(
      this.isNot ? ".not.toEmitValue" : "toEmitValue",
      "stream",
      "expected"
    );

    try {
      await stream.takeNext(options);

      return {
        pass: true,
        message: () => {
          return hint + "\n\nExpected stream not to emit a value but it did.";
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

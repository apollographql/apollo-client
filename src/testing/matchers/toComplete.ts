import type { MatcherFunction } from "expect";
import type { ObservableStream } from "../internal/index.js";
import type { TakeOptions } from "../internal/ObservableStream.js";

export const toComplete: MatcherFunction<[options?: TakeOptions]> =
  async function (actual, options) {
    const stream = actual as ObservableStream<any>;
    const hint = this.utils.matcherHint("toComplete", "stream", "");

    try {
      await stream.takeComplete(options);

      return {
        pass: true,
        message: () => {
          return hint + "\n\nExpected stream not to complete but it did.";
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
            hint + "\n\nExpected stream to complete but it did not.",
        };
      } else {
        throw error;
      }
    }
  };

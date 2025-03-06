import { iterableEquality } from "@jest/expect-utils";
import type { MatcherFunction } from "expect";
import type { ObservableStream } from "../internal/index.js";
import type { TakeOptions } from "../internal/ObservableStream.js";
import type { ApolloQueryResult } from "@apollo/client/core";

export const toEmitApolloQueryResult: MatcherFunction<
  [queryResult: ApolloQueryResult<any>, options?: TakeOptions]
> = async function (actual, expected, options) {
  const stream = actual as ObservableStream<any>;
  const hint = this.utils.matcherHint(
    this.isNot ? ".not.toEmitApolloQueryResult" : "toEmitApolloQueryResult",
    "stream",
    "expected"
  );

  try {
    const value = await stream.takeNext(options);
    const pass = this.equals(
      value,
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
            "\n\nExpected stream not to emit a query result equal to expected but it did."
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

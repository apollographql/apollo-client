import type {
  NextRenderOptions,
  RenderStream,
  SnapshotStream,
} from "@testing-library/react-render-stream";
import { WaitForRenderTimeoutError } from "@testing-library/react-render-stream";
import type { MatcherContext } from "expect";
import type { MatcherFunction } from "expect";

import { getSerializableProperties } from "./utils/getSerializableProperties.js";

export interface ToRerenderWithSimilarSnapshotOptions<T>
  extends Partial<NextRenderOptions> {
  expected?(previous: T): T;
}

export type ToEmitSimilarValueOptions<T> =
  ToRerenderWithSimilarSnapshotOptions<T>;

export type CommonStream<T = unknown> = {
  getCurrent(): undefined | T;
  takeNext(options: Partial<NextRenderOptions>): Promise<T>;
};

export const toEmitSimilarValue = async function toEmitSimilarValue(
  this: MatcherContext,
  actual,
  {
    expected: getExpected = (previous) => previous,
    ...options
  }: ToEmitSimilarValueOptions<any> = {}
) {
  const stream = actual as CommonStream;
  const hint = this.utils.matcherHint(
    "toRerenderWithSimilarSnapshot",
    undefined,
    undefined,
    {
      isNot: this.isNot,
    }
  );
  let pass = true;
  const previousResult = stream.getCurrent();
  let reason = "rerender.";
  try {
    const expected = getSerializableProperties(getExpected(previousResult));
    const nextResult = await stream.takeNext({ timeout: 100, ...options });
    const received = getSerializableProperties(nextResult);

    pass = this.equals(
      expected,
      received,
      // https://github.com/jestjs/jest/blob/22029ba06b69716699254bb9397f2b3bc7b3cf3b/packages/expect/src/matchers.ts#L62-L67
      [...this.customTesters, this.utils.iterableEquality],
      true
    );
    reason =
      "match: \n" +
      this.utils.printDiffOrStringify(
        expected,
        received,
        "Expected",
        "Received",
        true
      );
  } catch (e) {
    if (e instanceof WaitForRenderTimeoutError) {
      pass = false;
    } else {
      throw e;
    }
  }

  return {
    pass,
    message() {
      return (
        `${hint}\n\nExpected component to${
          pass ? " not" : ""
        } rerender, with a similar result ` +
        `but it did${pass ? "" : " not"} ${reason}`
      );
    },
    reason,
  };
} satisfies MatcherFunction<[options?: ToEmitSimilarValueOptions<any>]>;

export const toRerenderWithSimilarSnapshot: MatcherFunction<
  [options?: NextRenderOptions]
> = async function toRerenderWithSimilarSnapshot(
  this: MatcherContext,
  actual,
  options
) {
  const hint = this.utils.matcherHint(
    "toRerenderWithStrictEqualSnapshot",
    undefined,
    undefined,
    {
      isNot: this.isNot,
    }
  );
  const stream = actual as RenderStream<any> | SnapshotStream<any, any>;
  const common: CommonStream =
    "getCurrentRender" in stream ?
      {
        getCurrent: () => stream.getCurrentRender()?.snapshot,
        takeNext: (options) =>
          stream.takeRender(options).then((result) => result.snapshot),
      }
    : {
        getCurrent: () => stream.getCurrentSnapshot(),
        takeNext: () => stream.takeSnapshot(),
      };
  const { pass, reason } = await toEmitSimilarValue.call(this, common, options);

  return {
    pass,
    message() {
      return (
        `${hint}\n\nExpected component to${
          pass ? " not" : ""
        } rerender, with a similar snapshot ` +
        `but it was${pass ? "" : " not"} ${reason}`
      );
    },
  };
} satisfies MatcherFunction<
  [options?: ToRerenderWithSimilarSnapshotOptions<any>]
>;

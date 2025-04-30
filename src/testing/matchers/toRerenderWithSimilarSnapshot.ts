import type {
  NextRenderOptions,
  RenderStream,
} from "@testing-library/react-render-stream";
import { WaitForRenderTimeoutError } from "@testing-library/react-render-stream";
import type { MatcherContext } from "expect";
import type { MatcherFunction } from "expect";

interface ToRerenderWithSimilarSnapshotOptions<T>
  extends Partial<NextRenderOptions> {
  compare(previous: T, current: T): boolean;
}

export const toRerenderWithSimilarSnapshot: MatcherFunction<
  [options: ToRerenderWithSimilarSnapshotOptions<any>]
> = async function toRerenderWithSimilarSnapshot(
  this: MatcherContext,
  actual,
  options
) {
  const stream = actual as RenderStream<any>;
  const hint = this.utils.matcherHint(
    "toRerenderWithSimilarSnapshot",
    undefined,
    undefined,
    {
      isNot: this.isNot,
    }
  );
  let pass = true;
  const previousResult = stream.getCurrentRender();
  try {
    const nextResult = await stream.takeRender({ timeout: 100, ...options });
    pass = options.compare(previousResult.snapshot, nextResult.snapshot);
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
        } rerender, with a similar snapshot by comparison function` +
        `but it did${pass ? "" : " not"}.`
      );
    },
  };
};

export const toRerenderWithStrictEqualSnapshot: MatcherFunction<
  [options?: NextRenderOptions]
> = async function toRerenderWithStrictEqualSnapshot(
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
  const { pass } = await toRerenderWithSimilarSnapshot.call(this, actual, {
    ...options,
    compare: (previous, current) =>
      this.equals(
        previous,
        current,
        // https://github.com/jestjs/jest/blob/22029ba06b69716699254bb9397f2b3bc7b3cf3b/packages/expect/src/matchers.ts#L62-L67
        [...this.customTesters, this.utils.iterableEquality],
        true
      ),
  });

  return {
    pass,
    message() {
      return (
        `${hint}\n\nExpected component to${
          pass ? " not" : ""
        } rerender, with a strict equal snapshot` +
        `but it did${pass ? "" : " not"}.`
      );
    },
  };
};

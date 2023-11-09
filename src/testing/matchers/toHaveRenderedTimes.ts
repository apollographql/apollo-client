import type { MatcherFunction } from "expect";
import type { ProfiledComponent } from "../internal/index.js";

export const toHaveRenderedTimes: MatcherFunction<[count: number]> = function (
  ProfiledComponent: ProfiledComponent<any, any>,
  count: number
) {
  const hint = this.utils.matcherHint(
    "toHaveRenderedTimes",
    "ProfiledComponent",
    "renderCount"
  );
  const actualRenderCount = ProfiledComponent.currentRenderCount();
  const pass = actualRenderCount === count;

  return {
    pass,
    message: () => {
      return (
        hint +
        `\n\nExpected profiled component to${
          pass ? " not" : ""
        } have rendered times ${this.utils.printExpected(
          count
        )}, but it rendered times ${this.utils.printReceived(
          actualRenderCount
        )}.`
      );
    },
  };
};

import type { MatcherFunction } from "expect";
import type { ProfiledComponent, ProfiledHook } from "../internal/index.js";

export const toHaveRenderedTimes: MatcherFunction<[count: number]> = function (
  ProfiledComponent: ProfiledComponent<any, any> | ProfiledHook<any, any>,
  count: number
) {
  if ("ProfiledComponent" in ProfiledComponent) {
    ProfiledComponent = ProfiledComponent.ProfiledComponent;
  }

  const actualRenderCount = ProfiledComponent.currentRenderCount();
  const pass = actualRenderCount === count;

  const hint = this.utils.matcherHint(
    "toHaveRenderedTimes",
    "ProfiledComponent",
    "renderCount"
  );

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

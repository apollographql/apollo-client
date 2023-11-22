import type { MatcherFunction } from "expect";
import type { Profiler } from "../internal/index.js";
import type { ProfiledHook } from "../internal/index.js";

export const toHaveRendered: MatcherFunction = function (actual) {
  let ProfiledComponent = actual as Profiler<any, any> | ProfiledHook<any, any>;

  if ("ProfiledComponent" in ProfiledComponent) {
    ProfiledComponent = ProfiledComponent.ProfiledComponent;
  }

  const pass = ProfiledComponent.totalRenderCount() > 0;

  const hint = this.utils.matcherHint(
    "toHaveRendered",
    "ProfiledComponent",
    ""
  );

  return {
    pass,
    message() {
      return (
        hint +
        `\n\nExpected profiled component to${pass ? " not" : ""} have rendered.`
      );
    },
  };
};

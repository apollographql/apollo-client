import type { MatcherFunction } from "expect";
import type { ProfiledComponent } from "../internal/index.js";

export const toHaveRendered: MatcherFunction = function (
  ProfiledComponent: ProfiledComponent<any, any>
) {
  const hint = this.utils.matcherHint(
    "toHaveRendered",
    "ProfiledComponent",
    ""
  );
  const pass = ProfiledComponent.currentRenderCount() > 0;

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

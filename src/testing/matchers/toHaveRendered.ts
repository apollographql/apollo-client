import type { MatcherFunction } from "expect";
import type { ProfiledComponent, ProfiledHook } from "../internal/index.js";

export const toHaveRendered: MatcherFunction = function (
  ProfiledComponent: ProfiledComponent<any, any> | ProfiledHook<any, any>
) {
  if ("ProfiledComponent" in ProfiledComponent) {
    ProfiledComponent = ProfiledComponent.ProfiledComponent;
  }

  const pass = ProfiledComponent.currentRenderCount() > 0;

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

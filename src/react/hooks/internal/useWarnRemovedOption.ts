import * as React from "rehackt";
import { invariant } from "../../../utilities/globals/index.js";

// Remove with Apollo Client 4.0
export function useWarnRemovedOption<TOptions extends Record<string, any>>(
  options: TOptions,
  name: keyof TOptions,
  callSite: string,
  recommendation: string = "Please remove this option."
) {
  "use no memo";
  const didWarn = React.useRef(false);

  if (name in options && !didWarn.current) {
    invariant.warn(
      "[%s]: `%s` is a deprecated hook option and will be removed in Apollo Client 4.0. %s",
      callSite,
      name,
      recommendation
    );
    // eslint-disable-next-line react-compiler/react-compiler
    didWarn.current = true;
  }
}

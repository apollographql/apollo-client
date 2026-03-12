import * as React from "rehackt";
import type { PossibleDeprecations } from "../../../utilities/index.js";
import { warnRemovedOption } from "../../../utilities/index.js";

// Remove with Apollo Client 4.0
export function useWarnRemovedOption<
  TOptions extends Record<string, any>,
  CallSite extends keyof PossibleDeprecations,
>(
  options: TOptions,
  name: keyof TOptions & PossibleDeprecations[CallSite][number],
  callSite: CallSite,
  recommendation: string = "Please remove this option."
) {
  "use no memo";
  const didWarn = React.useRef(false);

  if (__DEV__) {
    if (name in options && !didWarn.current) {
      warnRemovedOption(options, name, callSite, recommendation);

      // eslint-disable-next-line react-compiler/react-compiler
      didWarn.current = true;
    }
  }
}

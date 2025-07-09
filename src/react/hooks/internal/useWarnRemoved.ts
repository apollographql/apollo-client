import * as React from "rehackt";
import type { DeprecationName } from "../../../utilities/deprecation/index.js";
import { warnDeprecated } from "../../../utilities/deprecation/index.js";

export function useWarnRemoved(name: DeprecationName, cb: () => void) {
  "use no memo";
  const didWarn = React.useRef(false);

  if (__DEV__) {
    if (!didWarn.current) {
      warnDeprecated(name, cb);
    }

    // eslint-disable-next-line react-compiler/react-compiler
    didWarn.current = true;
  }
}

import * as React from "rehackt";
import { warnDeprecated } from "../../../utilities/deprecation/index.js";

export function useWarnRemoved(name: string, cb: () => void) {
  "use no memo";
  const didWarn = React.useRef(false);

  if (__DEV__) {
    warnDeprecated(name, cb);

    // eslint-disable-next-line react-compiler/react-compiler
    didWarn.current = true;
  }
}

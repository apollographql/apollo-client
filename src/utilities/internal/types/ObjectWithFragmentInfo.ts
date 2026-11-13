import type { fragmentInfoSymbol } from "../constants.js";

import type { FragmentInfo } from "./FragmentInfo.js";

/**
 * @internal
 * A result object that might store `FragmentInfo` under `fragmentInfoSymbol`.
 * Cast to this type to read or write the symbol with the correct value type.
 */
export interface ObjectWithFragmentInfo {
  [fragmentInfoSymbol]?: FragmentInfo;
}

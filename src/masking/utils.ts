import { Slot } from "optimism";

import { canUseWeakSet } from "@apollo/client/utilities";
import { invariant } from "@apollo/client/utilities/invariant";

export const MapImpl = WeakMap;
export const SetImpl = canUseWeakSet ? WeakSet : Set;

// Contextual slot that allows us to disable accessor warnings on fields when in
// migrate mode.
/** @internal */
export const disableWarningsSlot = new Slot<boolean>();

let issuedWarning = false;
export function warnOnImproperCacheImplementation() {
  if (!issuedWarning) {
    issuedWarning = true;
    invariant.warn(
      "The configured cache does not support data masking which effectively disables it. Please use a cache that supports data masking or disable data masking to silence this warning."
    );
  }
}

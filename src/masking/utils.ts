import { Slot } from "optimism";

import { invariant } from "@apollo/client/utilities/invariant";

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

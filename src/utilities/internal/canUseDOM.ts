import { maybe } from "@apollo/client/utilities/globals";

/** @internal */
export const canUseDOM =
  typeof maybe(() => window.document.createElement) === "function";

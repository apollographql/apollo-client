import { maybe } from "@apollo/client/utilities/internal/globals";

/** @internal */
export const canUseDOM =
  typeof maybe(() => window.document.createElement) === "function";

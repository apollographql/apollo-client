import { loadDevMessages, loadErrorMessages } from "@apollo/client/dev";
export * from "./index.js";
// eslint-disable-next-line local-rules/import-from-export
import { invariant as origInvariant } from "./index.js";
export const invariant = (() => {
  // side effects in an IIFE
  loadDevMessages();
  loadErrorMessages();
  return origInvariant;
})();

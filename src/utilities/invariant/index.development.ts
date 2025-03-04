import { invariant as origInvariant } from "@apollo/client/utilities/invariant";
import { loadDevMessages, loadErrorMessages } from "@apollo/client/dev";
export * from "./index.js";
export const invariant = () => {
  // side effects in an IIFE
  loadDevMessages();
  loadErrorMessages();
  return origInvariant;
};

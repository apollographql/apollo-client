import { loadDevMessages, loadErrorMessages } from "@apollo/client/dev";
export * from "./index.js";
import { invariant as origInvariant } from "./index.js";
export const invariant = () => {
  // side effects in an IIFE
  loadDevMessages();
  loadErrorMessages();
  return origInvariant;
};

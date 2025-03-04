import { loadDevMessages, loadErrorMessages } from "@apollo/client/dev";
import { setVerbosity } from "ts-invariant";

export const __DEV__ = () => {
  // side effects in an IIFE
  loadDevMessages();
  loadErrorMessages();
  setVerbosity("log");
  return true as boolean;
};

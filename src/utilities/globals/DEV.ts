import global from "./global";
import { maybe } from "./maybe";

export default (
  "__DEV__" in global
    // We want it to be possible to set __DEV__ globally to control the result
    // of this code, so it's important to check global.__DEV__ instead of
    // assuming a naked reference like __DEV__ refers to global scope, since
    // those references could be replaced with true or false by minifiers.
    ? Boolean(global.__DEV__)

    // In a buildless browser environment, maybe(() => process.env.NODE_ENV)
    // evaluates to undefined, so __DEV__ becomes true by default, but can be
    // initialized to false instead by a script/module that runs earlier.
    //
    // If you use tooling to replace process.env.NODE_ENV with a string like
    // "development", this code will become something like maybe(() =>
    // "development") !== "production", which also works as expected.
    : maybe(() => process.env.NODE_ENV) !== "production"
);

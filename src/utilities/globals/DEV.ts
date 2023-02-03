import global from "./global";
import { maybe } from "./maybe";

function getDEV() {
  return "__DEV__" in global
    ? Boolean(global.__DEV__)
    // In a buildless browser environment, maybe(() => process.env.NODE_ENV)
    // evaluates as undefined, so __DEV__ becomes true by default, but can be
    // initialized to false instead by a script/module that runs earlier.
    : maybe(() => process.env.NODE_ENV) !== "production";
}

export default getDEV();

import global from "../common/global";
import { maybe } from "../common/maybe";

function getDEV() {
  try {
    return Boolean(__DEV__);
  } catch {
    Object.defineProperty(global, "__DEV__", {
      // In a buildless browser environment, maybe(() => process.env.NODE_ENV)
      // evaluates as undefined, so __DEV__ becomes true by default, but can be
      // initialized to false instead by a script/module that runs earlier.
      value: maybe(() => process.env.NODE_ENV) !== "production",
      enumerable: false,
      configurable: true,
      writable: true,
    });
    return global.__DEV__;
  }
}

export default getDEV();

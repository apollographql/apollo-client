import { invariant } from "ts-invariant";

import global from "../common/global";
import { maybe } from "../common/maybe";

function getDEV() {
  try {
    return Boolean(__DEV__);
  } catch {
    const maybeNodeEnv = maybe(() => process.env.NODE_ENV);
    const runningInNode = !!maybe(() => process.versions.node);

    Object.defineProperty(global, "__DEV__", {
      // In a buildless browser environment, maybe(() => process.env.NODE_ENV)
      // evaluates as undefined, so __DEV__ becomes true by default, but can be
      // initialized to false instead by a script/module that runs earlier.
      value: maybeNodeEnv !== "production",
      enumerable: false,
      configurable: true,
      writable: true,
    });

    if (maybeNodeEnv && !runningInNode) {
      // Issue this warning only if the developer has some sort of configuration
      // that provides process.env.NODE_ENV already (and we're not running in
      // Node.js), since they probably have an existing minifier configuration
      // (e.g. using terser's global_defs option or webpack's DefinePlugin) that
      // can be adapted to replace __DEV__ with false, similar to replacing
      // process.env.NODE_ENV with a string literal.
      invariant.log([
        "Apollo Client has provided a default value for the __DEV__ constant " +
        `(${global.__DEV__}), but you may be able to reduce production bundle ` +
        "sizes by configuring your JavaScript minifier to replace __DEV__ with " +
        "false, allowing development-only code to be stripped from the bundle.",
        "",
        "For more information about the switch to __DEV__, see " +
        "https://github.com/apollographql/apollo-client/pull/8347.",
      ].join("\n"));
    }

    return global.__DEV__;
  }
}

export default getDEV();

import * as fs from "fs";
import { EOL } from "os";
import { distDir } from './helpers';

export function applyDistSpotFixes() {
  sanitizeDEV();
}

function sanitizeDEV() {
  const globalDTsPath = `${distDir}/utilities/globals/global.d.ts`;
  const globalDTs = fs.readFileSync(globalDTsPath, "utf8");
  // The global.d.ts types are useful within the @apollo/client codebase to
  // provide a type for the global __DEV__ constant, but actually shipping that
  // declaration as a globally-declared type runs too much risk of conflict with
  // other __DEV__ declarations attempting to achieve the same thing, most
  // notably the one in @types/react-native/index.d.ts. We preserve the default
  // export so that index.d.ts can remain unchanged, but otherwise we remove all
  // traces of __DEV__ from global.d.ts.
  if (/__DEV__/.test(globalDTs)) {
    fs.writeFileSync(globalDTsPath, [
      "declare const _default: typeof globalThis;",
      "export default _default;",
    ].join(EOL));
  }
}

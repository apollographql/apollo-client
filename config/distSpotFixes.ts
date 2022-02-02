import * as fs from "fs";
import { EOL } from "os";
import { distDir } from './helpers';

export function applyDistSpotFixes() {
  const globalDTsPath = `${distDir}/utilities/globals/global.d.ts`;
  const globalDTs = fs.readFileSync(globalDTsPath, "utf8");
  const dtsLines = globalDTs.split(EOL);

  const found = dtsLines.some((line, i) => {
    // As explained in ../src/utilities/globals/global.ts, we actually do want the
    // @ts-ignore comment to be propagated to the .d.ts file, so it won't conflict
    // with React Native's declaration of a global type for __DEV__.
    if (/__DEV__/.test(line)) {
      const prevLine = dtsLines[i - 1];
      if (!/@ts-ignore/.test(prevLine)) {
        const leadingSpace = /^\s*/.exec(line);
        dtsLines.splice(i, 0, leadingSpace + "// @ts-ignore");
      }
      return true;
    }
  });

  if (found) {
    const fixed = dtsLines.join(EOL);
    if (fixed !== globalDTs) {
      fs.writeFileSync(globalDTsPath, fixed);
    }
  } else {
    throw Error(`Could not find/fix __DEV__ type declaration in ${globalDTsPath}`);
  }
}

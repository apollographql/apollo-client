import { join } from "node:path";

import * as madgePkg from "madge";
const madge = madgePkg.default;
process.env.DEBUG = "*";

for (const customConditions of [[], ["development"], ["production"]]) {
  const inst = await madge(join(import.meta.dirname, "../src"), {
    baseDir: join(import.meta.dirname, ".."),
    fileExtensions: ["ts", "tsx", "js", "jsx"],
    tsConfig: {
      compilerOptions: {
        moduleResolution: "NodeNext",
        customConditions,
      },
    },
    includeNpm: true,
    detectiveOptions: {
      ts: {
        skipTypeImports: true,
      },
    },
  });
  const circular = inst.circular();
  if (circular.length) {
    process.exitCode = 1;
    console.warn(
      "❌ Circular dependencies found for customConditions:",
      customConditions
    );
    console.log(circular);
  } else {
    console.log(
      "✅ No circular dependencies found for customConditions:",
      customConditions
    );
  }
}

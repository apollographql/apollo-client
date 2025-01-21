// @ts-check

import { join } from "node:path";
import { map } from "./config/entryPoints.js";

export default /** @type{import('knip').KnipConfig}*/ ({
  entry: map(({ dirs, bundleName = "index.ts" }) =>
    join("src", ...dirs, bundleName)
  ).concat([
    "src/cache/inmemory/fixPolyfills.native.ts",
    "src/config/jest/setup.ts",
    "src/react/types/types.documentation.ts",
    "src/**/__benches__/*.bench.ts",
  ]),
  project: ["src/**/*.ts", "config/*.js"],
  ignore: ["integration-tests/**/*"],
});

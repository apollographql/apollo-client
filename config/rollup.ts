import { rollup } from "rollup";

import rollupConfig from "./rollup.config.ts";

for (const config of rollupConfig) {
  const output = Array.isArray(config.output) ? config.output : [config.output];
  const bundle = await rollup(config);
  await Promise.all(output.map(bundle.write));
  await bundle.close();
}

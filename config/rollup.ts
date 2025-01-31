import { rollup as runRollup } from "rollup";

import rollupConfig from "./rollup.config.ts";

export async function rollup() {
  for (const config of rollupConfig) {
    const output =
      Array.isArray(config.output) ? config.output : [config.output];
    const bundle = await runRollup(config);
    await Promise.all(output.map(bundle.write));
    await bundle.close();
  }
}

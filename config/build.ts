import { $ } from "zx";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { inlineInheritDoc } from "./inlineInheritDoc.ts";
import { updateVersion, verifyVersion } from "./version.js";
import { processInvariants } from "./processInvariants.ts";
import { rewriteSourceMaps } from "./rewriteSourceMaps.ts";
import { rollup } from "./rollup.ts";
import { prepareDist } from "./prepareDist.js";
import { postprocessDist } from "./postprocessDist.ts";

$.cwd = join(import.meta.dirname, "..");
$.verbose = true;

const steps = {
  typescript: () => $`npx tsc`,
  updateVersion,
  inlineInheritDoc,
  processInvariants,
  rewriteSourceMaps,
  rollup,
  prepareDist,
  postprocessDist,
  verifyVersion,
};

const args = parseArgs({
  options: {
    step: {
      type: "string",
      multiple: true,
      default: Object.keys(steps),
    },
  },
});

const wrongSteps = args.values.step.filter((step) => !(step in steps));
if (wrongSteps.length) {
  throw new Error(
    `Unknown steps: ${wrongSteps.join(", ")}. Valid steps are ${Object.keys(
      steps
    ).join(", ")}`
  );
}

for (const step of args.values.step) {
  console.log("--- Step %s: running ---", step);
  await steps[step]();
  console.log("--- Step %s: done ---", step);
}

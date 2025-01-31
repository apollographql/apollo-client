import { $ } from "zx";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { inlineInheritDoc } from "./inlineInheritDoc.ts";
import { updateVersion, verifyVersion } from "./version.ts";
import { processInvariants } from "./processInvariants.ts";
import { rewriteSourceMaps } from "./rewriteSourceMaps.ts";
import { rollup } from "./rollup.ts";
import { prepareDist } from "./prepareDist.ts";
import { postprocessDist } from "./postprocessDist.ts";
import { prepareChangesetsRelease } from "./prepareChangesetsRelease.ts";

$.cwd = join(import.meta.dirname, "..");
$.verbose = true;

const buildSteps = {
  typescript: () => $`npx tsc --verbatimModuleSyntax false`,
  updateVersion,
  inlineInheritDoc,
  processInvariants,
  rewriteSourceMaps,
  rollup,
  prepareDist,
  postprocessDist,
  verifyVersion,
};
const additionalSteps = {
  prepareChangesetsRelease,
};

const args = parseArgs({
  options: {
    step: {
      type: "string",
      multiple: true,
      default: ["build"],
    },
  },
});

const allSteps = Object.assign({}, buildSteps, additionalSteps);

const runSteps = args.values.step.flatMap((step) =>
  step === "build" ? Object.keys(buildSteps) : [step]
);

const wrongSteps = runSteps.filter((step) => !(step in allSteps));
if (wrongSteps.length) {
  throw new Error(
    `Unknown steps: ${wrongSteps.join(", ")}. Valid steps are ${Object.keys(
      allSteps
    ).join(", ")}`
  );
}

console.log("Running build steps: %s", runSteps.join(", "));

for (const step of runSteps) {
  console.log("--- Step %s: running ---", step);
  await allSteps[step]();
  console.log("--- Step %s: done ---", step);
}

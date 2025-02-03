import { $ } from "zx";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { compileTs } from "./compileTs.ts";
// import { inlineInheritDoc } from "./inlineInheritDoc.ts";
// import { updateVersion, verifyVersion } from "./version.ts";
// import { processInvariants } from "./processInvariants.ts";
// import { rewriteSourceMaps } from "./rewriteSourceMaps.ts";
// import { prepareDist } from "./prepareDist.ts";
// import { postprocessDist } from "./postprocessDist.ts";
import { verifySourceMaps } from "./verifySourceMaps.ts";
import { prepareChangesetsRelease } from "./prepareChangesetsRelease.ts";

export interface BuildStepOptions {
  type: "esm" | "cjs";
  baseDir: string;
}
export type BuildStep = (options: BuildStepOptions) => void | Promise<void>;
type BuildSteps = Record<string, BuildStep>;

$.cwd = join(import.meta.dirname, "..");
$.verbose = true;

const buildSteps = {
  typescript: compileTs,
  // updateVersion,
  // inlineInheritDoc,
  // processInvariants,
  // rewriteSourceMaps,
  // prepareDist,
  // postprocessDist,
  // verifyVersion,
  verifySourceMaps,
} satisfies BuildSteps;
const additionalSteps = {
  prepareChangesetsRelease,
} satisfies BuildSteps;

const args = parseArgs({
  options: {
    step: {
      type: "string",
      multiple: true,
      default: ["build"],
    },
  },
});

const allSteps = Object.assign(
  {},
  buildSteps,
  additionalSteps
) satisfies BuildSteps;

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

for (const buildStepOptions of [
  // { type: "esm", baseDir: "dist/esm" },
  { type: "cjs", baseDir: "dist/cjs" },
])
  for (const step of runSteps) {
    console.log("--- Step %s: running ---", step);
    await allSteps[step](buildStepOptions);
    console.log("--- Step %s: done ---", step);
  }

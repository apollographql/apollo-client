import { $ } from "zx";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { compileTs } from "./compileTs.ts";
// import { inlineInheritDoc } from "./inlineInheritDoc.ts";
import { updateVersion, verifyVersion } from "./version.ts";
import { processInvariants } from "./processInvariants.ts";
import { prepareDist } from "./prepareDist.ts";
// import { postprocessDist } from "./postprocessDist.ts";
import { verifySourceMaps } from "./verifySourceMaps.ts";
import { prepareChangesetsRelease } from "./prepareChangesetsRelease.ts";

export interface BuildStepOptions {
  type: "esm" | "cjs";
  rootDir: string;
  /** build target directory, relative to `rootDir` */
  targetDir: string;
  jsExt: "js" | "cjs";
  tsExt: "ts" | "cts";
}
export type BuildStep = {
  (options: BuildStepOptions): void | Promise<void>;
  // some build steps only need to run once as they don't need to be run for each build type
  runOnce?: "leading" | "trailing";
};
type BuildSteps = Record<string, BuildStep>;

$.cwd = join(import.meta.dirname, "..");
$.verbose = true;

const buildSteps = {
  typescript: compileTs,
  updateVersion,
  // inlineInheritDoc,
  processInvariants,
  // postprocessDist,
  verifyVersion,
  verifySourceMaps,
  prepareDist,
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

const buildStepOptions = [
  // this order is important so that globs on the esm build don't accidentally match the cjs build
  {
    type: "esm",
    rootDir: import.meta.dirname,
    targetDir: "dist",
    jsExt: "js",
    tsExt: "ts",
  },
  {
    type: "cjs",
    rootDir: import.meta.dirname,
    targetDir: "dist/__cjs",
    jsExt: "cjs",
    tsExt: "cts",
  },
] satisfies BuildStepOptions[];
for (const options of buildStepOptions)
  for (const step of runSteps) {
    const buildStep: BuildStep = allSteps[step];
    if (
      (buildStep.runOnce === "leading" && options !== buildStepOptions.at(0)) ||
      (buildStep.runOnce === "trailing" && options !== buildStepOptions.at(-1))
    ) {
      continue;
    }

    console.log("--- Step %s: running ---", step);
    await buildStep(options);
    console.log("--- Step %s: done ---", step);
  }

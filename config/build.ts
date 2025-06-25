import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { $ } from "zx";

import { babelTransform } from "./babel.ts";
import { compileTs } from "./compileTs.ts";
import { reactCompiler } from "./react-compiler.ts";
import { deprecateInternals } from "./deprecateInternals.ts";
import { addExports } from "./exports.ts";
import { distDir } from "./helpers.ts";
import { inlineInheritDoc } from "./inlineInheritDoc.ts";
import { prepareDist } from "./prepareDist.ts";
import { processInvariants } from "./processInvariants.ts";
import { verifySourceMaps } from "./verifySourceMaps.ts";
import { updateVersion, verifyVersion } from "./version.ts";

export interface BuildStepOptions {
  type: "esm" | "cjs";
  rootDir: string;
  packageRoot: string;
  /** build target directory, relative to `rootDir` */
  targetDir: string;
  jsExt: "js" | "cjs";
  tsExt: "ts" | "cts";
  first: boolean;
  last: boolean;
}
export type BuildStep = {
  (options: BuildStepOptions): void | Promise<void>;
};
type BuildSteps = Record<string, BuildStep>;

$.cwd = join(import.meta.dirname, "..");
$.verbose = true;

const buildSteps = {
  prepareDist,
  addExports,
  typescript: compileTs,
  babelTransform,
  updateVersion,
  inlineInheritDoc,
  deprecateInternals,
  processInvariants,
  reactCompiler,
  verifyVersion,
  verifySourceMaps,
} satisfies BuildSteps;
const additionalSteps = {} satisfies BuildSteps;

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
  { type: "esm", targetDir: "dist", jsExt: "js", tsExt: "ts" },
  { type: "cjs", targetDir: "dist/__cjs", jsExt: "cjs", tsExt: "cts" },
] satisfies Omit<
  BuildStepOptions,
  "first" | "last" | "rootDir" | "packageRoot"
>[];
for (const options of buildStepOptions) {
  const first = options === buildStepOptions.at(0);
  const last = options === buildStepOptions.at(-1);
  const rootDir = resolve(import.meta.dirname, "..");

  for (const step of runSteps) {
    const buildStep: BuildStep = allSteps[step];

    console.log("--- Step %s: running ---", step);
    await buildStep({ ...options, first, last, rootDir, packageRoot: distDir });
    console.log("--- Step %s: done ---", step);
  }
}

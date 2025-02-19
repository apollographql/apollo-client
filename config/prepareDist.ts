// The Apollo Client source that is published to npm is located in the
// "dist" directory. This utility script is called when building Apollo Client,
// to make sure the "dist" directory is prepared for publishing.
//
// This script will:
//
// - Copy the current root package.json into "dist" after adjusting it for
//   publishing.
// - Copy the supporting files from the root into "dist" (e.g. `README.MD`,
//   `LICENSE`, etc.).
// - Create a new `package.json` for each sub-set bundle we support, and
//   store it in the appropriate dist sub-directory.

import fs from "node:fs";
import path from "node:path";

/* @apollo/client */

import pkg from "../package.json" with { type: "json" };
import type { JSONSchemaForNPMPackageJsonFiles } from "./schema.package.json.ts";
import type { BuildStep } from "./build.ts";
import { mkdir } from "node:fs/promises";

// the generated `Person` type is a bit weird - `author` as a string is valid
const packageJson: Omit<JSONSchemaForNPMPackageJsonFiles, "author"> & {
  author: string;
} = pkg;

export const prepareDist: BuildStep = async (options) => {
  if (!options.first) return;

  await mkdir(options.packageRoot, { recursive: true });

  // The root package.json is marked as private to prevent publishing
  // from happening in the root of the project. This sets the package back to
  // public so it can be published from the "dist" directory.
  packageJson.private = false;

  // Remove package.json items that we don't need to publish
  delete packageJson.scripts;
  delete packageJson.bundlesize;
  delete packageJson.devEngines;
  delete packageJson.devDependencies;

  packageJson.exports = {
    "./package.json": "./package.json",
  };

  // The root package.json points to the CJS/ESM source in "dist", to support
  // on-going package development (e.g. running tests, supporting npm link, etc.).
  // When publishing from "dist" however, we need to update the package.json
  // to point to the files within the same directory.
  const distPackageJson =
    JSON.stringify(
      packageJson,
      (_key, value) => {
        if (typeof value === "string" && value.startsWith("./dist/")) {
          const parts = value.split("/");
          parts.splice(1, 1); // remove dist
          return parts.join("/");
        }
        return value;
      },
      2
    ) + "\n";

  // Save the modified package.json to "dist"
  fs.writeFileSync(
    path.join(options.packageRoot, `package.json`),
    distPackageJson
  );

  // Copy supporting files into "dist"
  fs.copyFileSync(
    `${options.rootDir}/README.md`,
    `${options.packageRoot}/README.md`
  );
  fs.copyFileSync(
    `${options.rootDir}/LICENSE`,
    `${options.packageRoot}/LICENSE`
  );
};

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

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const distRoot = `${__dirname}/../dist`;

/* @apollo/client */

import packageJson from "../package.json" assert { type: "json" };
import * as entryPoints from "./entryPoints.js";

// Remove package.json items that we don't need to publish
const { scripts, engines, ...prePackageJson } = packageJson;

// The root package.json is marked as private to prevent publishing
// from happening in the root of the project. This sets the package back to
// public so it can be published from the "dist" directory.
prePackageJson.private = false;

function buildExports({
  dirs,
  bundleName = dirs[dirs.length - 1],
}: {
  dirs: string[],
  bundleName: string,
}) {
  const bundleDir = dirs.length ? `./${path.join(...dirs)}` : '.';
  const bundleExports = {
    default: `${bundleDir}/${bundleName}.cjs`,
    import: `${bundleDir}/index.js`,
    types: `${bundleDir}/index.d.ts`,
  };
  return {
    [`${bundleDir}`]: bundleExports,
    [`${bundleDir}/index`]: bundleExports,
    [`${bundleDir}/index.js`]: bundleExports,
  };
}

(prePackageJson as any).exports = Object.assign(
  {}, ...entryPoints.map(buildExports)
);

// The root package.json points to the CJS/ESM source in "dist", to support
// on-going package development (e.g. running tests, supporting npm link, etc.).
// When publishing from "dist" however, we need to update the package.json
// to point to the files within the same directory.
const distPackageJson =
  JSON.stringify(
    prePackageJson,
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
fs.writeFileSync(`${distRoot}/package.json`, distPackageJson);

// Copy supporting files into "dist"
const srcDir = `${__dirname}/..`;
const destDir = `${srcDir}/dist`;
fs.copyFileSync(`${srcDir}/README.md`, `${destDir}/README.md`);
fs.copyFileSync(`${srcDir}/LICENSE`, `${destDir}/LICENSE`);

// Create individual bundle package.json files, storing them in their
// associated dist directory. This helps provide a way for the Apollo Client
// core to be used without React, as well as AC's cache, utilities, SSR,
// components, HOC, and various links to be used by themselves, via CommonJS
// entry point files that only include the exports needed for each bundle.
entryPoints.forEach(function buildPackageJson({
  dirs,
  bundleName = dirs[dirs.length - 1],
  sideEffects = false,
}) {
  if (!dirs.length) return;
  fs.writeFileSync(
    path.join(distRoot, ...dirs, "package.json"),
    JSON.stringify(
      {
        name: path.posix.join("@apollo", "client", ...dirs),
        type: "module",
        main: `${bundleName}.cjs`,
        module: "index.js",
        types: "index.d.ts",
        exports: buildExports({dirs: [], bundleName}),
        sideEffects,
      },
      null,
      2
    ) + "\n"
  );
});

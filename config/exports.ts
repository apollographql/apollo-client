import { readFile, writeFile } from "node:fs/promises";
import type { BuildStep } from "./build.ts";
import { entryPoints } from "./entryPoints.ts";
import { join } from "node:path";
import assert from "node:assert";

type ConditionRoot = {
  types: {
    import?: string;
    require?: string;
  };
  import?: string;
  "module-sync"?: string;
  module?: string;
  require?: string;
  default?: string;
};

export const addExports: BuildStep = async (options) => {
  const pkgFileName = join(options.packageRoot, "package.json");
  const pkg = JSON.parse(await readFile(pkgFileName, "utf-8"));
  // normal entry points a la `@apollo/client` and `@apollo/client/core`.
  // these entry points will be used in most cases and point to the right file depending
  // on how the user is consuming the package.
  for (const entryPoint of entryPoints) {
    if (typeof entryPoint.value === "string") {
      pkg.exports[entryPoint.key] = processEntryPoint(
        entryPoint.value,
        pkg.exports[entryPoint.key]
      );
    } else {
      for (const [key, value] of Object.entries(entryPoint.value)) {
        if (!pkg.exports[entryPoint.key]) {
          pkg.exports[entryPoint.key] = {};
        }
        assert(
          typeof value === "string",
          "nesting of this complexity is not supported yet"
        );
        pkg.exports[entryPoint.key][key] = processEntryPoint(
          value,
          pkg.exports[entryPoint.key][key]
        );
      }
    }
  }
  for (const entryPoint of entryPoints) {
    // add legacy-style exports for `@apollo/client/index.js`, `@apollo/client/core/index.js`, etc.
    // although it would be shorter, we're not doing something like `"./*/index.js": "./*/index.js"`
    // here as that would also allow acces to internal `index.js` files we don't explicilty specify
    // as entry points.
    if (options.type === "esm") {
      pkg.exports[`${entryPoint.key}/index.${options.jsExt}`] = {
        types: `${entryPoint.key}/index.d.${options.tsExt}`,
        default: `${entryPoint.key}/index.${options.jsExt}`,
      };
    } else {
      // add legacy-style exports for `@apollo/client/main.cjs`, `@apollo/client/core/core.cjs`, etc.
      let entry = pkg.exports[entryPoint.key];
      while (typeof entry.default === "object") {
        entry = entry.default;
      }
      pkg.exports[
        `${entryPoint.key}/${entryPoint.dirs.at(-1) || "main"}.${options.jsExt}`
      ] = {
        types: entry.types.require,
        default: entry.require,
      };
    }
  }
  if (options.type === "cjs") {
    // Legacy entry point for `@apollo/client/apollo-client.cjs`.
    // This was a rolled-up build in the past, while now it's one of many compiled files.
    // It's probably still better to have this available in case someone ever used it with bundlers.
    pkg.exports["./apollo-client.cjs"] = pkg.exports["./main.cjs"];
  }
  await writeFile(pkgFileName, JSON.stringify(pkg, null, 2));

  function processEntryPoint(
    value: string,
    existing: ConditionRoot = { types: {} }
  ) {
    value = value.replace(
      /^.\/src/,
      `.${options.targetDir.replace(/^dist/, "")}`
    );

    if (options.type === "esm") {
      existing.types.import = value.replace(/\.ts$/, `.d.${options.tsExt}`);
      const target = value.replace(/\.ts$/, `.${options.jsExt}`);
      existing.module = target;
      existing["module-sync"] = target;
      //existing.import = target;
      existing.default = target;
    } else {
      existing.types.require = value.replace(/\.ts$/, `.d.${options.tsExt}`);
      existing.require = value.replace(/\.ts$/, `.${options.jsExt}`);
    }
    return JSON.parse(
      JSON.stringify(existing, [
        // ensure the order of keys is consistent
        "types",
        "module",
        "module-sync",
        "require",
        "import",
        "default",
      ])
    );
  }
};

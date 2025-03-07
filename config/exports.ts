import { readFile, writeFile, mkdir } from "node:fs/promises";
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
  await writeFile(pkgFileName, JSON.stringify(pkg, null, 2));

  // add legacy-style exports for `@apollo/client/index.js`, `@apollo/client/core/index.js`,
  // `@apollo/client/main.cjs`, `@apollo/client/core/core.cjs`, etc.
  // adding full entries for these would completely reiterate the other exports,
  // not doing so would break things like a `production`/`development` distinction.
  // instead, we create a new directory structure with stub files that `export * from "@apollo/client/..."
  // which will then be picked up by the detailed export maps
  for (const entryPoint of entryPoints) {
    const from = `@apollo/client/${entryPoint.key.substring(2)}`.replace(
      /\/$/,
      ""
    );
    const baseName =
      options.type === "esm" ? "index" : entryPoint.dirs.at(-1) || "main";
    await writeLegacyExport(entryPoint.dirs, baseName, from);
  }
  if (options.type === "cjs") {
    // Legacy entry point for `@apollo/client/apollo-client.cjs`.
    // This was a rolled-up build in the past, while now it's one of many compiled files.
    // It's probably still better to have this available in case someone ever used it with bundlers.
    await writeLegacyExport([], "apollo-client", "@apollo/client");
  }

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
      // this will be handled by `default`, which directly follows, so we can omit it
      // existing.import = target;
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

  async function writeLegacyExport(
    dirs: string[],
    baseName: string,
    from: string
  ) {
    const dirname = join(options.packageRoot, "legacyEntryPoints", ...dirs);
    await mkdir(dirname, { recursive: true });
    await writeFile(
      join(dirname, `${baseName}.d.${options.tsExt}`),
      `export * from "${from}";`,
      { encoding: "utf-8" }
    );
    await writeFile(
      join(dirname, `${baseName}.${options.jsExt}`),
      options.type === "esm" ?
        `export * from "${from}";`
      : `module.exports = require("${from}");`,
      { encoding: "utf-8" }
    );
  }
};

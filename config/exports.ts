import { readFile, writeFile } from "node:fs/promises";
import type { BuildStep } from "./build.ts";
import { entryPoints } from "./entryPoints.ts";
import path, { join } from "node:path";
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
    await writeFile(pkgFileName, JSON.stringify(pkg, null, 2));
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

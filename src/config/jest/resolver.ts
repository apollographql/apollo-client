import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { ResolverOptions } from "jest-resolve";

const possibleExtensions = [".ts", ".tsx", ".js", ".jsx"];

export function sync(path: string, options: ResolverOptions): string {
  const resolver = options.defaultResolver;

  if (process.env.TEST_ENV === "ci" && path.startsWith("@apollo/client")) {
    const result = import.meta.resolve(
      path,
      pathToFileURL(join(options.rootDir!, "../dist/index.js"))
    );
    if (result.includes("__cjs")) {
      throw new Error(
        "Resolved to CJS entry point, we want to test ESM entry points!"
      );
    }
    if (!result.includes("dist")) {
      throw new Error("Did not resolve to build artifact!");
    }
    return fileURLToPath(result);
  }

  if (path.startsWith(".") && path.endsWith(".js")) {
    for (const extension of possibleExtensions) {
      try {
        return resolver(path.replace(/\.js$/i, extension), options);
      } catch {}
    }
  }

  if (path.startsWith("@apollo/client")) {
    return fileURLToPath(import.meta.resolve(path));
  }

  return resolver(path, options);
}

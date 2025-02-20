import type { ResolverOptions } from "jest-resolve";
import { fileURLToPath } from "node:url";

const possibleExtensions = [".ts", ".tsx", ".js", ".jsx"];

export function sync(path: string, options: ResolverOptions): string {
  const resolver = options.defaultResolver;

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

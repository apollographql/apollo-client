import path from "path";
// @ts-expect-error An import path can only end with a '.cts' extension when 'allowImportingTsExtensions' is enabled.
import { __dirname } from "./dirname.cts";
import type { BuildStepOptions } from "./build.ts";

type EntryPoint = {
  dirs: string[];
  bundleName?: string;
  extensions?: string[];
  sideEffects?: boolean;
};
const entryPoints = [
  { dirs: [], bundleName: "main" },
  { dirs: ["cache"] },
  { dirs: ["core"] },
  { dirs: ["dev"] },
  { dirs: ["errors"] },
  { dirs: ["link", "batch"] },
  { dirs: ["link", "batch-http"] },
  { dirs: ["link", "context"] },
  { dirs: ["link", "core"] },
  { dirs: ["link", "error"] },
  { dirs: ["link", "http"] },
  { dirs: ["link", "persisted-queries"] },
  { dirs: ["link", "retry"] },
  { dirs: ["link", "remove-typename"] },
  { dirs: ["link", "schema"] },
  { dirs: ["link", "subscriptions"] },
  { dirs: ["link", "utils"] },
  { dirs: ["link", "ws"] },
  { dirs: ["masking"] },
  { dirs: ["react"] },
  { dirs: ["react", "context"] },
  { dirs: ["react", "hooks"] },
  { dirs: ["react", "internal"] },
  { dirs: ["react", "parser"] },
  { dirs: ["react", "ssr"] },
  { dirs: ["testing"], extensions: [".js", ".jsx"] },
  { dirs: ["testing", "core"] },
  { dirs: ["testing", "experimental"] },
  { dirs: ["testing", "react"] },
  { dirs: ["utilities"] },
  { dirs: ["utilities", "subscriptions", "relay"] },
  { dirs: ["utilities", "subscriptions", "urql"] },
  { dirs: ["utilities", "globals"], sideEffects: true },
] satisfies EntryPoint[];

const lookupTrie = Object.create(null);
entryPoints.forEach((info) => {
  let node = lookupTrie;
  info.dirs.forEach((dir) => {
    const dirs = node.dirs || (node.dirs = Object.create(null));
    node = dirs[dir] || (dirs[dir] = { isEntry: false });
  });
  node.isEntry = true;
});

export const forEach = function (
  callback: (value: EntryPoint, index: number, array: EntryPoint[]) => void,
  context?: any
) {
  entryPoints.forEach(callback, context);
};

export const map = function map<U>(
  callback: (value: EntryPoint, index: number, array: EntryPoint[]) => U,
  context?: any
) {
  return entryPoints.map(callback, context);
};

export const check = function (id: string, parentId: string) {
  const resolved = path.resolve(path.dirname(parentId), id);
  const importedParts = partsAfterDist(resolved);

  if (importedParts) {
    const entryPointIndex = lengthOfLongestEntryPoint(importedParts);
    if (entryPointIndex === importedParts.length) {
      return true;
    }

    if (entryPointIndex >= 0) {
      const parentParts = partsAfterDist(parentId);
      const parentEntryPointIndex = lengthOfLongestEntryPoint(parentParts);
      const sameEntryPoint =
        entryPointIndex === parentEntryPointIndex &&
        arraysEqualUpTo(importedParts, parentParts, entryPointIndex);

      // If the imported ID and the parent ID have the same longest entry
      // point prefix, then this import is safely confined within that
      // entry point. Returning false lets Rollup know this import is not
      // external, and can be bundled into the CJS bundle that we build
      // for this shared entry point.
      if (sameEntryPoint) {
        return false;
      }

      console.warn(
        `Risky cross-entry-point nested import of ${id} in ${partsAfterDist(
          parentId
        ).join("/")}`
      );
    }
  }

  return false;
};

function partsAfterDist(id: string): string[] {
  const parts = id.split(path.sep);
  const distIndex = parts.lastIndexOf("dist");
  if (/^index.jsx?$/.test(parts[parts.length - 1])) {
    parts.pop();
  }
  if (distIndex >= 0) {
    return parts.slice(distIndex + 1);
  }
  return [];
}

function lengthOfLongestEntryPoint(parts: string[]) {
  let node = lookupTrie;
  let longest = -1;
  for (let i = 0; node && i < parts.length; ++i) {
    if (node.isEntry) longest = i;
    node = node.dirs && node.dirs[parts[i]];
  }
  if (node && node.isEntry) {
    return parts.length;
  }
  return longest;
}

function arraysEqualUpTo(a: unknown[], b: unknown[], end: number) {
  for (let i = 0; i < end; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export const buildDocEntryPoints = (
  options: Pick<BuildStepOptions, "rootDir" | "targetDir" | "jsExt">
) => {
  const entryPoints = map((entryPoint) => {
    return `export * from "${path.join(
      options.rootDir,
      options.targetDir,
      ...entryPoint.dirs,
      `index.${options.jsExt}`
    )}";`;
  });
  entryPoints.push(
    `export * from "${path.join(
      options.rootDir,
      options.targetDir,
      "react",
      "types",
      `types.documentation.${options.jsExt}`
    )}";`
  );
  return entryPoints.join("\n");
};

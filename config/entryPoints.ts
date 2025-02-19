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

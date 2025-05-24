import { readFileSync } from "fs";
import path from "path";

// @ts-ignore An import path can only end with a '.cts' extension when 'allowImportingTsExtensions' is enabled.
import type { BuildStepOptions } from "./build.ts";
import { __dirname } from "./dirname.cjs";

const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, "../package.json"), {
    encoding: "utf-8",
  })
) as typeof import("../package.json");

export type ExportsCondition = string | { [key: string]: ExportsCondition };

const CONDITIONAL_ENTRYPOINTS = {
  "./testing/internal": {
    env: "test",
  },
};

type EntryPoint = {
  dirs: string[];
  key: string;
  value: ExportsCondition;
};

export function getEntryPoints(env: string) {
  return Object.entries(pkg.exports)
    .filter(([key]) => {
      return (
        !Object.hasOwn(CONDITIONAL_ENTRYPOINTS, key) ||
        CONDITIONAL_ENTRYPOINTS[key]?.env === env
      );
    })
    .map<EntryPoint>(([key, value]) => ({
      dirs: key.slice("./".length).split("/"),
      key,
      value,
    }));
}

export const buildDocEntryPoints = (
  options: Pick<BuildStepOptions, "rootDir" | "targetDir" | "jsExt" | "env">
) => {
  console.log({
    env: options.env,
    entryPoints: getEntryPoints(options.env).map((e) => e.key),
  });
  const acc = getEntryPoints(options.env).map((entryPoint) => {
    return `export * from "${path.join(
      "@apollo/client",
      ...entryPoint.dirs
    )}";`;
  });
  acc.push(
    `export * from "${path.join(
      options.rootDir,
      options.targetDir,
      "react",
      "types",
      `types.documentation.${options.jsExt}`
    )}";`
  );
  return acc.join("\n");
};

import path from "path";
// @ts-expect-error An import path can only end with a '.cts' extension when 'allowImportingTsExtensions' is enabled.
import { __dirname } from "./dirname.cts";
import type { BuildStepOptions } from "./build.ts";
import { readFileSync } from "fs";

const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, "../package.json"), {
    encoding: "utf-8",
  })
) as typeof import("../package.json");

type ExportsCondition = string | { [key: string]: ExportsCondition };

type EntryPoint = {
  dirs: string[];
  key: string;
  value: ExportsCondition;
};
export const entryPoints = Object.entries(pkg.exports).map<EntryPoint>(
  ([key, value]) => ({
    dirs: key.slice("./".length).split("/"),
    key,
    value,
  })
);

export const buildDocEntryPoints = (
  options: Pick<BuildStepOptions, "rootDir" | "targetDir" | "jsExt">
) => {
  const acc = entryPoints.map((entryPoint) => {
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

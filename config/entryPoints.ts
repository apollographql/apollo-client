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

type EntryPoint = {
  dirs: string[];
  key: string;
  value: ExportsCondition;
};
export const entryPoints = Object.entries(pkg.exports).map<EntryPoint>(
  ([key, value]) => ({
    dirs: key
      .slice("./".length)
      .split("/")
      .filter((d) => d !== ""),
    key,
    value,
  })
);

export const buildDocEntryPoints = (
  options: Pick<BuildStepOptions, "rootDir" | "targetDir" | "jsExt">
) => {
  const acc = entryPoints.map((entryPoint) => {
    let identifier = "";
    if (entryPoint.dirs.length) {
      identifier =
        `entrypoint_` + entryPoint.dirs.join("__").replace(/-/g, "_");
    }
    if (identifier === "core") return;
    return `export * ${identifier ? `as ${identifier}` : ""} from "${path.join(
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

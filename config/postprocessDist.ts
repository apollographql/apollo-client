import { distDir } from "./helpers.ts";
import fs from "node:fs";
import path from "node:path";

const globalTypesFile = path.resolve(distDir, "utilities/globals/global.d.ts");
fs.writeFileSync(
  globalTypesFile,
  fs
    .readFileSync(globalTypesFile, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "const __DEV__: boolean;")
    .join("\n"),
  "utf8"
);

import * as path from "path";
import { readFileSync, promises as fs } from "fs";
import { eachFile, distDir } from "./helpers";

const entryPoints = require("./entryPoints.js");

const filesWithDEV = new Set<string>();

eachFile(distDir, async file => {
  const source = await fs.readFile(file, "utf8");
  if (/\b__DEV__\b/.test(source)) {
    filesWithDEV.add(file);
  }
}).then(() => {
  const filesByEntryPoint = new Map<string, {
    indexPath: string;
    source: string;
    files: Set<string>;
  }>();

  entryPoints.forEach(({ dirs }: { dirs: string[] }) => {
    const relIndexPath = path.join(...dirs, "index.js");
    const absIndexPath = path.join(distDir, relIndexPath);
    filesByEntryPoint.set(dirs.join("/"), {
      indexPath: relIndexPath,
      source: readFileSync(absIndexPath, "utf8"),
      files: new Set<string>(),
    });
  });

  filesWithDEV.forEach(file => {
    const entryPointDir = entryPoints.getEntryPointDirectory(file);
    const info = filesByEntryPoint.get(entryPointDir);
    const absEntryPointDir = path.join(distDir, entryPointDir);
    const relPath = "./" + path.relative(absEntryPointDir, file);
    if (info) {
      info.files.add(relPath);
    }
  });

  filesByEntryPoint.forEach(({ indexPath, source, files }, entryPointDir) => {
    if (!files.size || source.indexOf("checkDEV()") >= 0) {
      return;
    }
    const entryPointId = `@apollo/client/${entryPointDir}`;
    throw new Error(`Entry point ${
      entryPointId
    }/index.js does not call checkDEV(), but ${
      entryPointId
    } contains the following files that use __DEV__: ${
      Array.from(files).join(", ")
    }`);
  });
});

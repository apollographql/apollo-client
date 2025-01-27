import * as fs from "fs";
import * as path from "path";
import { distDir } from "./helpers.ts";
import { glob } from "node:fs/promises";

export async function rewriteSourceMaps() {
  const rootDir = path.dirname(distDir);

  const startTime = Date.now();
  let rewriteCount = 0;

  for await (const file of glob(`${distDir.replace(/\\/g, "/")}/**/*.js.map`)) {
    const content = await fs.promises.readFile(file, "utf8");
    const map = JSON.parse(content);
    if (map.sourcesContent) return;
    if (map.sources) {
      map.sourcesContent = await Promise.all(
        map.sources.map((relSourcePath: string) => {
          const sourcePath = path.normalize(
            path.join(path.dirname(file), relSourcePath)
          );
          const relPath = path.relative(rootDir, sourcePath);
          // Disallow reading paths outside rootDir.
          if (relPath.startsWith("../")) {
            throw new Error(`Bad path: ${sourcePath}`);
          }
          return fs.promises.readFile(sourcePath, "utf8");
        })
      );
      ++rewriteCount;
      await fs.promises.writeFile(file, JSON.stringify(map));
    }
  }
  console.log(
    `Rewrote ${rewriteCount} source maps in ${Date.now() - startTime}ms`
  );
}

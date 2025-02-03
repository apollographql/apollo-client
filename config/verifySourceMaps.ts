import type { BuildStep } from "./build.ts";
import { glob, readFile } from "node:fs/promises";
import validate from "sourcemap-validator";
import { SourceMapConsumer } from "source-map";
import * as assert from "node:assert";
import { join } from "node:path";

export const verifySourceMaps: BuildStep = async (options) => {
  for await (const file of glob(`${options.baseDir}/**/*.{js,ts,cjs,cts}`, {
    withFileTypes: true,
  })) {
    const filePath = join(file.parentPath, file.name);
    const distFileContents = await readFile(filePath, "utf-8");

    if (isEmptyFile(distFileContents)) {
      continue;
    }

    const rawSourceMap = await readFile(filePath + ".map", "utf-8");
    const sourceMap = JSON.parse(rawSourceMap);
    const parsed = new SourceMapConsumer(sourceMap);

    const originalFileName = sourceMap.sources[0];
    const originalFilePath = join(file.parentPath, originalFileName);
    const originalFileContents = await readFile(originalFilePath, "utf-8");
    assert.equal(
      parsed.sourceContentFor(originalFileName, true),
      originalFileContents
    );

    validate(
      await readFile(filePath, { encoding: "utf-8" }),
      await readFile(filePath + ".map", { encoding: "utf-8" })
    );
  }
};

function isEmptyFile(file: string) {
  return (
    file.split("\n").filter(
      (line) =>
        // skip a few things that TypeScript adds on transpilation, even to an empty file
        line.trim() !== `"use strict";` &&
        line.trim() !== `export {};` &&
        line.trim() !==
          `Object.defineProperty(exports, "__esModule", { value: true });` &&
        !line.trim().startsWith(`//# sourceMappingURL=`) &&
        line.trim() !== ""
    ).length === 0
  );
}

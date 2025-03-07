import * as assert from "node:assert";
import { glob, readFile } from "node:fs/promises";
import { join } from "node:path";

import { SourceMapConsumer } from "source-map";
import validate from "sourcemap-validator";

import type { BuildStep } from "./build.ts";

export const verifySourceMaps: BuildStep = async (options) => {
  // this only checks source maps for JavaScript files, not TypeScript declarations
  // as we won't ship declaration maps in the end
  for await (const file of glob(`${options.targetDir}/**/*.{js,cjs}`, {
    withFileTypes: true,
    exclude(fileName) {
      return fileName.parentPath.indexOf("legacyEntryPoints") !== -1;
    },
  })) {
    const filePath = join(file.parentPath, file.name);
    const distFileContents = await readFile(filePath, "utf-8");

    if (isEmptyFile(distFileContents)) {
      continue;
    }

    const sourceMapPath = filePath + ".map";
    const rawSourceMap = await readFile(sourceMapPath, "utf-8");
    const sourceMap = JSON.parse(rawSourceMap);
    const parsed = new SourceMapConsumer(sourceMap);

    const originalFileName = sourceMap.sources[0];
    const originalFilePath = join(file.parentPath, originalFileName);
    const originalFileContents = await readFile(originalFilePath, "utf-8");
    const parsedContents = parsed.sourceContentFor(originalFileName, true);

    assert.notEqual(
      parsedContents,
      null,
      `No original contents for ${originalFileName} found in ${sourceMapPath}`
    );

    assert.equal(
      parsed.sourceContentFor(originalFileName, true),
      originalFileContents,
      `Original file contents in source map for ${originalFileName} do not match actual file contents`
    );

    // sourcemap-validator really just does a basic sanity check,
    // it doesn't actually compare the original file contents
    // or anything like that - but it's the best tool I could find.
    validate(
      await readFile(filePath, { encoding: "utf-8" }),
      await readFile(filePath + ".map", { encoding: "utf-8" }),
      {
        [originalFileName]: originalFileContents,
      }
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

import * as path from "path";
import * as recast from "recast";
import * as parser from "recast/parsers/babel.js";
import * as tsParser from "recast/parsers/typescript.js";
import glob from "glob";
import { glob as nodeGlob } from "node:fs/promises";
import { readFile, rm } from "node:fs/promises";
import * as assert from "node:assert";
// @ts-ignore unfortunately we don't have types for this as it's JS with JSDoc
// eslint-disable-next-line import/no-unresolved
import * as sorcery from "sorcery";
import { relative } from "node:path";

export const distDir = path.resolve(import.meta.dirname, "..", "dist");

export function eachFile(
  dir: string,
  callback: (absPath: string, relPath: string) => any
) {
  const promises: Promise<any>[] = [];

  return new Promise<void>((resolve, reject) => {
    glob(`${dir.replace(/\\/g, "/")}/**/*.js`, (error, files) => {
      if (error) return reject(error);

      files.sort().forEach((file) => {
        const relPath = path.relative(dir, file);

        // Outside the distDir, somehow.
        if (relPath.startsWith("../")) return;

        // Avoid re-transforming CommonJS bundle files.
        if (relPath.endsWith(".cjs")) return;
        if (relPath.endsWith(".cjs.js")) return;
        if (relPath.endsWith(".cjs.native.js")) return;

        // Avoid re-transforming CommonJS bundle files.
        if (relPath.endsWith(".min.js")) return;

        // This file is not meant to be imported or processed.
        if (relPath.endsWith("invariantErrorCodes.js")) return;

        promises.push(
          new Promise((resolve) => {
            resolve(callback(file, relPath));
          })
        );
      });

      resolve();
    });
  }).then(() => Promise.all(promises));
}

export function reparse(source: string) {
  return recast.parse(source, { parser });
}

export function reprint(ast: ReturnType<typeof reparse>) {
  return recast.print(ast).code;
}

export async function applyRecast({
  glob,
  cwd,
  transformStep,
}: {
  glob: string;
  cwd: string;
  transformStep: (options: {
    ast: recast.types.ASTNode;
    sourceName: string;
    relativeSourcePath: string;
  }) => { ast: recast.types.ASTNode; targetFileName?: string };
}) {
  for await (let sourceFile of nodeGlob(glob, { withFileTypes: true, cwd })) {
    const baseDir = sourceFile.parentPath;
    const sourceFileName = sourceFile.name;
    const sourcePath = path.join(baseDir, sourceFile.name);
    const source = await readFile(sourcePath, { encoding: "utf8" });
    const sourceMapName = source.match(/\/\/# sourceMappingURL=(.*)$/m)?.[1];
    assert.ok(
      sourceMapName,
      `No source map found for file ${sourcePath} in ${source}`
    );
    const sourceMapPath = path.join(baseDir, sourceMapName);
    const sourceMapContents = JSON.parse(
      await readFile(sourceMapPath, {
        encoding: "utf8",
      })
    );

    // from now on, we're treating this data as if it were from an "intermediate" file instead
    // we might want to override the original source file after all
    // we place this in a "parallel folder" so relative paths have the same depth
    const intermediateName = path.join("../intermediate", sourceFileName);
    const intermediateNamePath = path.join(baseDir, intermediateName);

    const ast = recast.parse(source, {
      parser: tsParser,
      sourceFileName: intermediateName,
    });
    const transformResult = transformStep({
      ast,
      sourceName: sourceFileName,
      relativeSourcePath: relative(cwd, sourcePath),
    });
    const targetFileName = transformResult.targetFileName || sourceFileName;
    const targetFilePath = path.join(baseDir, targetFileName);

    const result = recast.print(transformResult.ast, {
      sourceMapName: `${targetFileName}.map`,
    });

    if (targetFileName !== sourceFileName) {
      // we are renaming the files - as we won't be overriding in place,
      // delete the old files
      await rm(sourcePath);
      await rm(sourceMapPath);
    }

    // load the resulting "targetFileName" and the intermediate file into sorcery
    // it will read the original .ts source from the file system
    const virtualFiles = {
      content: {
        [intermediateNamePath]: source,
        [targetFilePath]: result.code,
      },
      sourcemaps: {
        [intermediateNamePath]: sourceMapContents,
        [targetFilePath]: result.map,
      },
    };
    // we use sorcery to combine all these source maps back into one
    const chain = await sorcery.load(targetFilePath, virtualFiles);
    // save everything back to the file system, applying the source map changes of the transformation
    await chain.write();
  }
}

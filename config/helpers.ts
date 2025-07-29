import * as assert from "node:assert";
import { glob, unlink, writeFile } from "node:fs/promises";
import { mkdir, readFile, rm, symlink } from "node:fs/promises";
import { relative } from "node:path";
import * as path from "path";

import { TSDocParser } from "@microsoft/tsdoc";
import * as recast from "recast";
import * as parser from "recast/parsers/babel.js";
import * as tsParser from "recast/parsers/typescript.js";
// @ts-ignore unfortunately we don't have types for this as it's JS with JSDoc
// eslint-disable-next-line import/no-unresolved
import * as sorcery from "sorcery";

import type { JSONSchemaForNPMPackageJsonFiles } from "./schema.package.json.ts";

export const distDir = path.resolve(import.meta.dirname, "..", "dist");

export function reparse(source: string) {
  return recast.parse(source, { parser });
}

export function reprint(ast: ReturnType<typeof reparse>) {
  return recast.print(ast).code;
}

type MaybePromise<T> = T | Promise<T>;

export async function applyRecast({
  glob: globString,
  cwd,
  transformStep,
}: {
  glob: string;
  cwd: string;
  transformStep: (options: {
    ast: recast.types.ASTNode;
    sourceName: string;
    relativeSourcePath: string;
  }) => MaybePromise<{
    ast: recast.types.ASTNode;
    targetFileName?: string;
    copy?: boolean;
  }>;
}) {
  for await (let sourceFile of glob(globString, {
    withFileTypes: true,
    cwd,
    exclude(fileName) {
      return fileName.parentPath.indexOf("legacyEntryPoints") !== -1;
    },
  })) {
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
    const transformResult = await transformStep({
      ast,
      sourceName: sourceFileName,
      relativeSourcePath: relative(cwd, sourcePath),
    });
    const targetFileName = transformResult.targetFileName || sourceFileName;
    const targetFilePath = path.join(baseDir, targetFileName);

    const result = recast.print(transformResult.ast, {
      sourceMapName: `${targetFileName}.map`,
    });

    if (!transformResult.copy) {
      if (targetFileName !== sourceFileName) {
        // we are renaming the files - as we won't be overriding in place,
        // delete the old files
        await rm(sourcePath);
        await rm(sourceMapPath);
      } else if (result.code === source) {
        // no changes, so we can skip writing the file, which guarantees no further
        // changes to the source map
        continue;
      }
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

/**
 * creates a pseudo "dist/node_modules" folder with
 * "dist/node_modules/@apollo/client" symlinked to "dist"
 * so that tools can pick up the client package as an "external" package
 */
export async function withPseudoNodeModules<T>(fn: () => T) {
  const node_modules = path.join(distDir, "node_modules");
  const parent = path.join(node_modules, "@apollo");
  const link = path.join(parent, "client");

  try {
    await mkdir(parent, { recursive: true });
    await unlink(link).catch(() => {});
    await symlink(distDir, link);

    return await fn();
  } finally {
    await rm(node_modules, { recursive: true });
  }
}

export function frameComment(text: string) {
  const framed = text
    .split("\n")
    .map((t) => (t.match(/\s+\*/) ? t.trim() : t))
    .map((t) => (!t.startsWith("*") ? "* " + t : t))
    .join("\n")
    .replaceAll(/(^(\s*\*\s*\n)*|(\n\s*\*\s*)*$)/g, "");
  return `*\n${framed}\n`;
}

type PackageJson = Omit<JSONSchemaForNPMPackageJsonFiles, "author"> & {
  author: string;
};

export async function updatePackageJson(
  dirname: string,
  updater: (pkg: PackageJson) => PackageJson | void,
  replacer: null | ((this: any, key: string, value: any) => any) = null
) {
  const packageJsonPath = path.join(dirname, "package.json");
  const pkg = JSON.parse(
    await readFile(packageJsonPath, "utf8")
  ) as PackageJson;
  const newContents = updater(pkg) ?? pkg;
  await writeFile(
    packageJsonPath,
    JSON.stringify(newContents, replacer, 2) + "\n"
  );
}

export function patchApiExtractorInternals() {
  // The TSDoc parser mangles some parts of DocBlocks in a way that's problematic
  // for us.
  // This code is used to keep the original DocComment intact, so that we can
  // use it later in the API docs.

  const orig_parseRange = TSDocParser.prototype.parseRange;
  TSDocParser.prototype.parseRange = function (range) {
    const parsed = orig_parseRange.call(this, range);
    parsed.docComment.emitAsTsdoc = function () {
      return range.toString();
    };
    return parsed;
  };
  return () => {
    TSDocParser.prototype.parseRange = orig_parseRange;
  };
}

import { readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { visit } from "recast";
import { parseConfigFileTextToJson } from "typescript";
import { $ } from "zx";

import type { BuildStep, BuildStepOptions } from "./build.ts";
import type { ExportsCondition } from "./entryPoints.ts";
import { applyRecast, updatePackageJson } from "./helpers.ts";

export const compileTs: BuildStep = async (options) => {
  // TODO use `await using` instead of the `try..finally` here once Node supports it
  const tsconfig = await withBuildTsConfig();
  try {
    if (options.type === "esm") {
      await $`npx tsc --project tsconfig.build.json --outDir ${options.targetDir}`;
    } else {
      const packageJsonPath = join(import.meta.dirname, "..", `package.json`);
      const originalPackageJson = await readFile(
        join(options.rootDir, "package.json"),
        "utf-8"
      );
      try {
        // module `node18` will compile to CommonJS if the [detected module format](https://www.typescriptlang.org/docs/handbook/modules/reference.html#module-format-detection)
        // is CommonJS, so we temporarily overwrite the `package.json` file
        // this is the right way to build CommonJS, the `commonjs` module option should actually not be used
        // see https://www.typescriptlang.org/docs/handbook/modules/reference.html#commonjs
        await updatePackageJson(options.rootDir, (packageJson) => {
          packageJson.type = "commonjs";
        });
        // noCheck is required to suppress errors like
        // error TS1479: The current file is a CommonJS module whose imports will produce 'require' calls; however, the referenced file is an ECMAScript module and cannot be imported with 'require'. Consider writing a dynamic 'import("@wry/equality")' call instead.
        await $`npx tsc --project tsconfig.build.json --outDir ${options.targetDir} --module node16 --moduleResolution node16 --noCheck`;
      } finally {
        await writeFile(packageJsonPath, originalPackageJson);
      }

      await renameJsFilesToCjs(options);
    }
  } finally {
    await tsconfig[Symbol.asyncDispose]();
  }
};

function renameJsFilesToCjs(options: BuildStepOptions) {
  return applyRecast({
    glob: `**/*.{js,d.ts}`,
    cwd: options.targetDir,
    transformStep({ ast, sourceName }) {
      return {
        ast: visit(ast, {
          visitCallExpression(path) {
            const node = path.node;
            if (
              node.callee.type === "Identifier" &&
              node.callee.name === "require" &&
              node.arguments.length === 1 &&
              node.arguments[0].type === "StringLiteral" &&
              node.arguments[0].value.startsWith(".") &&
              node.arguments[0].value.endsWith(".js")
            ) {
              node.arguments[0].value = node.arguments[0].value.replace(
                /\.js$/,
                ".cjs"
              );
            }
            this.traverse(path);
          },
          visitExportAllDeclaration(path) {
            const node = path.node;
            if (
              node.source &&
              node.source.type === "StringLiteral" &&
              node.source.value.startsWith(".") &&
              node.source.value.endsWith(".js")
            ) {
              node.source.value = node.source.value.replace(/\.js$/, ".cjs");
            }
            this.traverse(path);
          },
          visitExportNamedDeclaration(path) {
            const node = path.node;
            if (
              node.source &&
              node.source.type === "StringLiteral" &&
              node.source.value.startsWith(".") &&
              node.source.value.endsWith(".js")
            ) {
              node.source.value = node.source.value.replace(/\.js$/, ".cjs");
            }
            this.traverse(path);
          },
          visitImportDeclaration(path) {
            const node = path.node;
            if (
              node.source.type === "StringLiteral" &&
              node.source.value.startsWith(".") &&
              node.source.value.endsWith(".js")
            ) {
              node.source.value = node.source.value.replace(/\.js$/, ".cjs");
            }
            this.traverse(path);
          },
          visitTSImportType(path) {
            const node = path.node;
            if (
              node.argument.type === "StringLiteral" &&
              node.argument.value.startsWith(".") &&
              node.argument.value.endsWith(".js")
            ) {
              node.argument.value = node.argument.value.replace(
                /\.js$/,
                ".cjs"
              );
            }
            this.traverse(path);
          },
        }),
        targetFileName: sourceName
          .replace(/\.js$/, ".cjs")
          .replace(/\.d\.ts$/, ".d.cts"),
      };
    },
  });
}

async function withBuildTsConfig() {
  const tsconfigPath = join(import.meta.dirname, "..", `tsconfig.build.json`);
  const originalTsconfig = await readFile(tsconfigPath, "utf-8");
  const tsconfig = parseConfigFileTextToJson(
    tsconfigPath,
    originalTsconfig
  ).config;
  tsconfig.files = getEntryPoints();
  await writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2));
  return {
    [Symbol.asyncDispose]() {
      return writeFile(tsconfigPath, originalTsconfig);
    },
  };
}

function getEntryPoints() {
  const pkg = JSON.parse(
    readFileSync(join(import.meta.dirname, "..", "package.json"), "utf-8")
  );
  const acc = new Set<ExportsCondition>([pkg.exports]);
  const results = new Set<string>(["./src/react/types/types.documentation.ts"]);
  for (const entry of acc) {
    if (typeof entry === "string") {
      results.add(entry);
    } else if (typeof entry === "object") {
      Object.values(entry).forEach((e) => acc.add(e));
    }
  }
  return Array.from(results);
}

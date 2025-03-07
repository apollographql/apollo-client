import { $ } from "zx";
import { applyRecast } from "./helpers.ts";
import { visit } from "recast";
import type { BuildStep, BuildStepOptions } from "./build.ts";

export const compileTs: BuildStep = async (options) => {
  if (options.type === "esm") {
    await $`npx tsc --project tsconfig.build.json --outDir ${options.targetDir}`;
  } else {
    // for a `commonjs` output, we have to specify `moduleResulution: node`, and as that will error because it cannot verify some imports, we add `--noCheck`
    await $`npx tsc --project tsconfig.build.json --outDir ${options.targetDir} --module commonjs --moduleResolution node --noCheck`;
    await renameJsFilesToCjs(options);
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

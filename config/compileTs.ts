import { $ } from "zx";
import { applyRecast } from "./helpers.ts";
import { visit } from "recast";
import type { BuildStep } from "./build.ts";

export const compileTs: BuildStep = async (options) => {
  if (options.type === "esm") {
    await $`npx tsc --outDir ${options.baseDir}`;
  } else {
    await $`npx tsc --outDir ${options.baseDir} --module commonjs`;
    await applyRecast({
      glob: `**/*.{js,d.ts}`,
      cwd: options.baseDir,
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
          }),
          targetFileName: sourceName
            .replace(/\.js$/, ".cjs")
            .replace(/\.d\.ts$/, ".d.cts"),
        };
      },
    });
  }
};

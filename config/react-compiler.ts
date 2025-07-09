import { cp, mkdir } from "node:fs/promises";
import { format, join, parse } from "node:path";

import { transformFromAstAsync } from "@babel/core";
import { visit } from "recast";

import type { BuildStep } from "./build.ts";
import { applyRecast, updatePackageJson } from "./helpers.ts";

export const reactCompiler: BuildStep = async (options) => {
  if (options.type !== "esm") {
    return;
  }
  await cp(
    join(options.targetDir, "react", "hooks"),
    join(options.targetDir, "react", "hooks-compiled"),
    { recursive: true }
  );
  await applyRecast({
    glob: `**/*.${options.jsExt}`,
    cwd: join(options.targetDir, "react", "hooks-compiled"),
    async transformStep({ ast, sourceName }) {
      const result = await transformFromAstAsync(ast as any, undefined, {
        filename: sourceName,
        sourceFileName: sourceName,
        sourceMaps: true,
        code: false,
        ast: true,
        cloneInputAst: false,
        retainLines: true,
        plugins: [
          [
            "babel-plugin-react-compiler",
            {
              target: "17",
            },
          ],
          {
            visitor: {
              ImportDeclaration(path) {
                // Rewrite imports for the React Compiler Runtime to our own copy
                // until the upstream package is stable
                if (path.node.source.value === "react-compiler-runtime") {
                  path.node.source.value =
                    "@apollo/client/react/internal/compiler-runtime";
                }
              },
            },
          },
        ],
      });
      return { ast: result.ast!, map: result.map };
    },
  });

  const compilerVersion = (
    await import("babel-plugin-react-compiler/package.json", {
      with: { type: "json" },
    })
  ).default.version;

  await applyRecast({
    glob: "index.{js,d.ts}",
    cwd: join(options.targetDir, "react"),
    transformStep({ ast, sourceName }) {
      return {
        targetFileName: sourceName.replace("index.", "index.compiled."),
        copy: true,
        ast: visit(ast, {
          visitExportNamedDeclaration(path) {
            if (path.node.source) {
              const source = path.node.source.value.toString();
              if (source.startsWith("./hooks/")) {
                path.node.source.value = source.replace(
                  "./hooks/",
                  "./hooks-compiled/"
                );
              }
            }
            this.traverse(path);
          },
          visitVariableDeclarator(path) {
            if (
              path.node.id.type === "Identifier" &&
              path.node.id.name === "reactCompilerVersion"
            ) {
              path.node.init = {
                type: "StringLiteral",
                value: compilerVersion,
              };
            }
            this.traverse(path);
          },
        }),
      };
    },
  });
  await updatePackageJson(options.packageRoot, (pkg) => {
    pkg.exports["./react/compiled"] = "./react/index.compiled.js";
  });

  // add `react/compiled/index.js` entry point for `node10` resolution
  await mkdir(join(options.targetDir, "react", "compiled"));
  await applyRecast({
    glob: "index.{js,d.ts}",
    cwd: join(options.targetDir, "react"),
    transformStep({ ast, sourceName }) {
      const originalFileName = parse(sourceName);
      const targetFileName = format({
        ...originalFileName,
        dir: join(originalFileName.dir, "compiled"),
      });
      return {
        targetFileName,
        copy: true,
        ast: {
          type: "File",
          program: {
            type: "Program",
            sourceType: "module",
            body: [
              {
                type: "ExportAllDeclaration",
                source: {
                  type: "StringLiteral",
                  value: "../index.compiled.js",
                },
              },
            ],
          },
        },
      };
    },
  });
};

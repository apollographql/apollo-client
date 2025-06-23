import { transformFromAstAsync } from "@babel/core";

import type { BuildStep } from "./build.ts";
import { applyRecast } from "./helpers.ts";

export const babelTransform: BuildStep = async (options) => {
  return applyRecast({
    glob: `**/*.${options.jsExt}`,
    cwd: options.targetDir,
    async transformStep({ ast, sourceName, relativeSourcePath }) {
      const result = await transformFromAstAsync(ast as any, undefined, {
        filename: sourceName,
        sourceFileName: sourceName,
        sourceMaps: true,
        code: false,
        ast: true,
        cloneInputAst: false,
        retainLines: true,
        presets: [
          [
            "@babel/preset-env",
            {
              modules: false,
              targets: "since 2023, node >= 20, not dead",
            } satisfies import("@babel/preset-env").Options,
          ],
        ],
        plugins:
          (
            // apply the compiler only to the react hooks, not test helper components etc.
            relativeSourcePath.match(/react\/hooks/)
          ) ?
            // compiler will insert `"import"` statements, so it's not CJS compatible
            options.type === "esm" ?
              [
                [
                  "babel-plugin-react-compiler",
                  {
                    target: "17",
                  },
                ],
                {
                  visitor: {
                    ImportDeclaration(path) {
                      // Remove import declarations that are not used in the file
                      if (path.node.source.value === "react-compiler-runtime") {
                        path.node.source.value =
                          "@apollo/client/react/internal/compiler-runtime";
                      }
                    },
                  },
                },
              ]
              //For now, the compiler doesn't seem to work in CJS files
              /*
                [
                  "babel-plugin-react-compiler",
                  {
                    target: "17",
                  },
                ],
                [
                  "@babel/plugin-transform-modules-commonjs",
                  { importInterop: "none" },
                ],
                */
            : []
          : [],
      });
      return { ast: result.ast!, map: result.map };
    },
  });
};

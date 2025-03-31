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
            // compiler will insert `"import"` statements, so it's not CJS compatible
            options.type === "esm" &&
            // apply the compiler only to the react hooks, not test helper components etc.
            relativeSourcePath.match(/react\/hooks/)
          ) ?
            [
              [
                "babel-plugin-react-compiler",
                {
                  target: "17",
                },
              ],
            ]
          : [],
      });
      return { ast: result.ast!, map: result.map };
    },
  });
};

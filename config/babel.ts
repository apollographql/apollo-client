import type { BuildStep } from "./build.ts";
import { transformFromAstAsync } from "@babel/core";
import { applyRecast } from "./helpers.ts";

export const babelTransform: BuildStep = async (options) => {
  return applyRecast({
    glob: `**/*.${options.jsExt}`,
    cwd: options.targetDir,
    async transformStep({ ast, sourceName }) {
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
      });
      return { ast: result.ast!, map: result.map };
    },
  });
};

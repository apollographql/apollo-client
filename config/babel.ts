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
              targets:
                "baseline widely available on 2023-12-31, node >= 20, not dead",
            } satisfies import("@babel/preset-env").Options,
          ],
        ],
      });
      return { ast: result.ast!, map: result.map };
    },
  });
};

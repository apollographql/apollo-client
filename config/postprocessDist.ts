import { visit } from "recast";

import type { BuildStep } from "./build.ts";
import { distDir } from "./helpers.ts";
import { applyRecast } from "./helpers.ts";

export const postprocessDist: BuildStep = async (options) => {
  return applyRecast({
    glob: `utilities/globals/global.d.${options.tsExt}`,
    cwd: distDir,
    transformStep({ ast }) {
      return {
        ast: visit(ast, {
          visitVariableDeclarator(path) {
            const node = path.node;
            if (node.id.type === "Identifier" && node.id.name === "__DEV__") {
              path.prune();
            }
            return false;
          },
        }),
      };
    },
  });
};

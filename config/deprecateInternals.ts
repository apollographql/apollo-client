import { visit } from "recast";

import type { BuildStep } from "./build.ts";
import { applyRecast, frameComment } from "./helpers.ts";

export const deprecateInternals: BuildStep = async (options) =>
  applyRecast({
    glob: `**/*.{${options.jsExt},d.${options.tsExt}}`,
    cwd: options.targetDir,
    transformStep({ ast }) {
      return {
        ast: visit(ast, {
          visitNode(path) {
            this.traverse(path);
            const node = path.node;

            if (!node.comments) {
              return;
            }

            for (const comment of node.comments) {
              if (
                comment.type === "CommentBlock" &&
                comment.value.includes("@internal")
              ) {
                if (comment.value.includes("@deprecated")) continue;

                comment.value = frameComment(
                  comment.value.trim() +
                    "\n\n@deprecated This is an internal API and should not be used directly. This can be removed or changed at any time."
                );
              }
            }
          },
        }),
      };
    },
  });

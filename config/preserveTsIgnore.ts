/**
 * TypeScript removes normal comments when it creates declaration files.
 *
 * That means that `// @ts-ignore` comments are removed, which can lead to
 * unwanted errors in the generated declaration files, if those comments
 * are still necessary in the generated `.d.ts` files.
 *
 * As a workaround, it's possible to use `/** @ts-ignore ...` instead,
 * as these are preserved in the generated declaration files.
 * The downside to this is that these comments then also might end up in
 * IDE inline documentation, which we want to avoid.
 *
 * This build step post-processes all `.d.ts` files if a block-comment
 * starts with `* @ts-ignore`, it removes the leading `*`, effectively
 * turning them into non-docBlock comments for shipping.
 */

import { visit } from "recast";

import type { BuildStep } from "./build.ts";
import { applyRecast, frameComment } from "./helpers.ts";

export const preserveTsIgnore: BuildStep = async (options) =>
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
                comment.value.match(/^\*\s*@ts-ignore/)
              ) {
                comment.value = comment.value.substring(1);
              }
            }
          },
        }),
      };
    },
  });

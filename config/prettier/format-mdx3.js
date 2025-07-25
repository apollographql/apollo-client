/** @import { Plugin } from 'prettier' */

import markdown from "prettier/plugins/markdown.js";

/** @type {Plugin["languages"]} */
export const languages = [
  {
    name: "MDX",
    parsers: ["mdx3"],
    extensions: [".mdx"],
  },
];
/** @type {Plugin["parsers"]} */
export const parsers = {
  mdx3: {
    ...markdown.parsers.mdx,
    astFormat: "mdx3",
  },
};
/** @type {Plugin["printers"]} */
export const printers = {
  mdx3: {
    ...markdown.printers.mdast,
    embed(path, options) {
      const node = path.node;
      if (node.type === "jsx") {
        // If the node was parsed incorrectly because it followed the MDX3 format (no spacing around JSX tags),
        // we will not try to format it as MDX, but instead return the original value.

        // We detect that by looking at `value` - if it's only a starting or closing tag, it was parsed correctly.
        const correctlyParsedMatch = node.value.match(/^(<\/?[^>]*>)$/);
        if (!correctlyParsedMatch)
          return (
            node.value
              .split("\n")
              // But we need to restore the original indentation
              .map((line, idx) =>
                idx === 0 ? line : (
                  " ".repeat(node.position.indent[idx - 1] - 1) + line
                )
              )
              .join("\n")
          );
      }
      return markdown.printers.mdast.embed(path, options);
    },
  },
};

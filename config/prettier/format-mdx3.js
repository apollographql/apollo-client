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
      if (path.node.type === "jsx") {
        // We will not format embedded JSX as Prettier gets the spacing wrong
        return path.node.value;
      }
      return markdown.printers.mdast.embed(path, options);
    },
  },
};
